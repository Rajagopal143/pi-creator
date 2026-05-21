import mongoose, { Schema } from 'mongoose';

/**
 * Daily product-level stock snapshot per manufacturing unit.
 *
 * One row per `(muId, productCode, date)`. `opening` carries over from the
 * previous day's `closing` so the ledger reads as a running balance:
 *
 *     closing = opening + added
 *
 * Day N's `closing` becomes Day N+1's `opening` when the next add happens.
 * Days with no activity don't get a row — `getPreviousClosing` walks
 * backwards to find the last recorded closing.
 */
export interface DailyStockDoc {
  _id?: mongoose.Types.ObjectId;
  muId: number;
  productCode: number;
  /** ISO `YYYY-MM-DD` date string. */
  date: string;
  /** Carried forward from the previous day's closing. */
  opening: number;
  /** Auto-incremented when invoices for this product at this MU dispatch. */
  delivered: number;
  /** Auto-incremented when an invoice's first payment is recorded. */
  reserved: number;
  /** Filled when In Transit qty is approved/received (or via manual receive). */
  received: number;
  /** Manually maintained by ops when material is shipped to the factory. */
  inTransit: number;
  /** `opening - delivered - reserved + received` — stored for query speed. */
  closing: number;
  /** `closing + inTransit` — stored for query speed. */
  grandTotal: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const DailyStockSchema = new Schema<DailyStockDoc>(
  {
    muId: { type: Number, required: true },
    productCode: { type: Number, required: true },
    date: { type: String, required: true },
    opening: { type: Number, required: true, default: 0, min: 0 },
    delivered: { type: Number, required: true, default: 0, min: 0 },
    reserved: { type: Number, required: true, default: 0, min: 0 },
    received: { type: Number, required: true, default: 0, min: 0 },
    inTransit: { type: Number, required: true, default: 0, min: 0 },
    closing: { type: Number, required: true, default: 0 },
    grandTotal: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

DailyStockSchema.index({ muId: 1, productCode: 1, date: 1 }, { unique: true });

// Always re-register the model so a hot-reload that changed `DailyStockSchema`
// is reflected at runtime. Mongoose otherwise caches the schema registered at
// process start and silently drops new fields under `strict: true`.
if (mongoose.models.DailyStock) mongoose.deleteModel('DailyStock');
export const DailyStock = mongoose.model<DailyStockDoc>('DailyStock', DailyStockSchema);

/** Returns the closing balance from the most recent DailyStock row strictly
 *  before `date` for this product/MU. Returns 0 if there are no prior rows. */
export async function getPreviousClosing(
  muId: number,
  productCode: number,
  date: string,
): Promise<number> {
  const prior = await DailyStock.findOne({
    muId, productCode, date: { $lt: date },
  })
    .sort({ date: -1 })
    .select('closing')
    .lean();
  return prior?.closing ?? 0;
}

export interface DailyStockDTO {
  muId: number;
  productCode: number;
  productName: string;
  date: string;
  opening: number;
  delivered: number;
  reserved: number;
  received: number;
  inTransit: number;
  closing: number;
  grandTotal: number;
}

/** Pure helper: closing & grand total derived from the column counters. */
export function computeBalances(row: {
  opening: number;
  delivered: number;
  reserved: number;
  received: number;
  inTransit: number;
}): { closing: number; grandTotal: number } {
  const closing = row.opening - row.delivered - row.reserved + row.received;
  return { closing, grandTotal: closing + row.inTransit };
}

/** Pure helper: physical units sitting at the MU right now, ignoring reservations.
 *  Used for dispatch readiness — reservation is a hold, not a removal. */
export function physicalOnHand(row: {
  opening: number;
  delivered: number;
  received: number;
}): number {
  return row.opening - row.delivered + row.received;
}

/**
 * "Available to commit" qty for a (MU, product) on `date` — i.e. closing.
 * Used by PI creation and first-payment reservation; both need to know how
 * many fresh units can be promised without over-allocating.
 *
 * If no row exists for `date`, opening rolls forward from the previous day's
 * closing and the other counters are 0 — so the answer is just the prior
 * closing.
 */
export async function getAvailableForCommit(
  muId: number,
  productCode: number,
  date: string,
  session?: mongoose.ClientSession,
): Promise<number> {
  const row = await DailyStock.findOne({ muId, productCode, date }).session(session ?? null);
  if (row) {
    return computeBalances({
      opening: row.opening ?? 0,
      delivered: row.delivered ?? 0,
      reserved: row.reserved ?? 0,
      received: row.received ?? 0,
      inTransit: row.inTransit ?? 0,
    }).closing;
  }
  return getPreviousClosing(muId, productCode, date);
}

/**
 * Physical units that can be dispatched today. Same as `opening + received
 * - delivered` on today's row; reservation isn't subtracted because dispatch
 * consumes reservation. If today's row is missing, falls back to the most
 * recent earlier closing.
 */
export async function getAvailableForDispatch(
  muId: number,
  productCode: number,
  date: string,
  session?: mongoose.ClientSession,
): Promise<number> {
  const row = await DailyStock.findOne({ muId, productCode, date }).session(session ?? null);
  if (row) {
    return physicalOnHand({
      opening: row.opening ?? 0,
      delivered: row.delivered ?? 0,
      received: row.received ?? 0,
    });
  }
  return getPreviousClosing(muId, productCode, date);
}

/**
 * Pure helper: collapse line items into a per-product total qty (plus a
 * display name). Items with a non-numeric product or non-positive qty are
 * ignored. Exported for unit testing.
 */
export function sumQtyByProduct(
  items: Array<{ productId?: number; productName?: string; qty?: number }>,
): Map<number, { qty: number; name?: string }> {
  const qtyByProduct = new Map<number, { qty: number; name?: string }>();
  for (const item of items) {
    const productCode = Number(item.productId);
    const qty = Number(item.qty) || 0;
    if (!Number.isFinite(productCode) || qty <= 0) continue;
    const cur = qtyByProduct.get(productCode);
    qtyByProduct.set(productCode, {
      qty: (cur?.qty ?? 0) + qty,
      name: cur?.name ?? item.productName,
    });
  }
  return qtyByProduct;
}

/**
 * Thrown when a product can't satisfy the requested qty. Carries a stable
 * `code` so API handlers can map it to HTTP 409 and clients can react (e.g.
 * prompt the user to refresh because the stock was taken in the meantime).
 */
export class InsufficientStockError extends Error {
  readonly code = 'INSUFFICIENT_STOCK' as const;
  readonly productCode: number;
  readonly productName?: string;
  readonly need: number;
  readonly available: number;
  constructor(args: { productCode: number; productName?: string; need: number; available: number; muId: number }) {
    const label = args.productName ? `${args.productName} (#${args.productCode})` : `product #${args.productCode}`;
    super(`Insufficient stock for ${label} at MU ${args.muId}: need ${args.need}, available ${args.available}.`);
    this.name = 'InsufficientStockError';
    this.productCode = args.productCode;
    this.productName = args.productName;
    this.need = args.need;
    this.available = args.available;
  }
}

/**
 * Sums each line item's qty per `productId` and asserts that today's stock
 * has enough for either committing (PI save / first payment) or physically
 * dispatching. Throws `InsufficientStockError` on the first product that fails
 * so the caller's transaction rolls back.
 */
export async function assertSufficientStock(
  muId: number,
  items: Array<{ productId?: number; productName?: string; qty?: number }>,
  mode: 'commit' | 'dispatch',
  opts: { date?: string; session?: mongoose.ClientSession } = {},
): Promise<void> {
  const date = opts.date || new Date().toISOString().split('T')[0];
  const session = opts.session;

  const qtyByProduct = sumQtyByProduct(items);

  for (const [productCode, { qty, name }] of qtyByProduct) {
    const available = mode === 'commit'
      ? await getAvailableForCommit(muId, productCode, date, session)
      : await getAvailableForDispatch(muId, productCode, date, session);
    if (available < qty) {
      throw new InsufficientStockError({ productCode, productName: name, need: qty, available, muId });
    }
  }
}

/**
 * Increments one of the auto columns (`delivered`, `reserved`, `received`) on
 * today's row for `(muId, productCode)`. Creates the row on first touch with
 * opening carried from the previous day's closing, then recomputes balances.
 *
 * Caller passes a Mongoose ClientSession when running inside a transaction.
 */
export async function bumpDailyStock(
  muId: number,
  productCode: number,
  field: 'delivered' | 'reserved' | 'received',
  amount: number,
  opts: { date?: string; session?: mongoose.ClientSession } = {},
): Promise<void> {
  if (amount === 0) return;
  const date = opts.date || new Date().toISOString().split('T')[0];
  const session = opts.session;

  const existing = await DailyStock.findOne({ muId, productCode, date }).session(session ?? null);
  if (existing) {
    // Backfill legacy missing fields before any arithmetic — otherwise undefined
    // + amount = NaN gets persisted.
    existing.opening = existing.opening ?? 0;
    existing.delivered = existing.delivered ?? 0;
    existing.reserved = existing.reserved ?? 0;
    existing.received = existing.received ?? 0;
    existing.inTransit = existing.inTransit ?? 0;
    existing.set(field, Math.max(0, (existing.get(field) ?? 0) + amount));
    const { closing, grandTotal } = computeBalances(existing.toObject());
    existing.closing = closing;
    existing.grandTotal = grandTotal;
    await existing.save({ session });
    return;
  }

  const opening = await getPreviousClosing(muId, productCode, date);
  const base = { opening, delivered: 0, reserved: 0, received: 0, inTransit: 0 } as const;
  const row = { ...base, [field]: Math.max(0, amount) };
  const { closing, grandTotal } = computeBalances(row);
  await DailyStock.create(
    [{ muId, productCode, date, ...row, closing, grandTotal }],
    session ? { session } : undefined,
  );
}
