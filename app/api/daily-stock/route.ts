import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import {
  DailyStock,
  computeBalances,
  getPreviousClosing,
  type DailyStockDoc,
  type DailyStockDTO,
} from '@/lib/products/dailyStockModel';
import { ProductRecord, ensureProductsSeeded } from '@/lib/products/productModel';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Per-MU daily stock ledger. For every active product:
 *
 *   • If a row exists for the target date, return it verbatim.
 *   • Otherwise carry forward the most recent earlier closing as today's
 *     opening (with every other column zero) so the table is never blank.
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    await ensureProductsSeeded();
    const { searchParams } = new URL(req.url);
    const muId = Number(searchParams.get('muId'));
    const date = (searchParams.get('date') || todayISO()).trim();

    if (!Number.isFinite(muId)) {
      return NextResponse.json({ success: false, message: 'muId is required.' }, { status: 400 });
    }

    const latestByProduct = await DailyStock.aggregate<{ _id: number; latest: DailyStockDoc }>([
      { $match: { muId, date: { $lte: date } } },
      { $sort: { productCode: 1, date: -1 } },
      { $group: { _id: '$productCode', latest: { $first: '$$ROOT' } } },
    ]);
    const byCode = new Map<number, DailyStockDoc>(latestByProduct.map(r => [r._id, r.latest]));

    const products = await ProductRecord.find({ isActive: true })
      .sort({ sortOrder: 1, code: 1 })
      .select('code name')
      .lean();

    // Coalesce: legacy `DailyStock` docs (from before this schema migration)
    // may lack the new columns — fall back to `?? 0` and recompute balances
    // so the UI never receives NaN/undefined numerics.
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const data: DailyStockDTO[] = products.map(p => {
      const latest = byCode.get(p.code);
      if (latest?.date === date) {
        const opening = num(latest.opening);
        const delivered = num(latest.delivered);
        const reserved = num(latest.reserved);
        const received = num(latest.received);
        const inTransit = num(latest.inTransit);
        const closing = Number.isFinite(latest.closing)
          ? num(latest.closing)
          : opening - delivered - reserved + received;
        const grandTotal = Number.isFinite(latest.grandTotal)
          ? num(latest.grandTotal)
          : closing + inTransit;
        return {
          muId, productCode: p.code, productName: p.name, date,
          opening, delivered, reserved, received, inTransit, closing, grandTotal,
        };
      }
      const opening = num(latest?.closing);
      const closing = opening;
      return {
        muId, productCode: p.code, productName: p.name, date,
        opening,
        delivered: 0,
        reserved: 0,
        received: 0,
        inTransit: 0,
        closing,
        grandTotal: closing,
      };
    });

    return NextResponse.json({ success: true, data, meta: { date } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load stock';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/**
 * Increment In Transit for today's row — used by the "Add Stock" modal when
 * ops registers material shipped from port to the factory.
 *
 * Body: `{ muId, productCode, amount, date? }`. Negative `amount` adjusts down.
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json() as {
      muId?: number;
      productCode?: number;
      amount?: number;
      date?: string;
    };

    const muId = Number(body.muId);
    const productCode = Number(body.productCode);
    const amount = Math.floor(Number(body.amount));
    const date = (body.date || todayISO()).trim();

    if (!Number.isFinite(muId) || !Number.isFinite(productCode)) {
      return NextResponse.json(
        { success: false, message: 'muId and productCode are required.' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json(
        { success: false, message: 'Amount must be a non-zero integer.' },
        { status: 400 },
      );
    }

    const existing = await DailyStock.findOne({ muId, productCode, date });
    if (existing) {
      // Backfill any legacy nullable fields before mutating to avoid NaN math.
      existing.opening = existing.opening ?? 0;
      existing.delivered = existing.delivered ?? 0;
      existing.reserved = existing.reserved ?? 0;
      existing.received = existing.received ?? 0;
      existing.inTransit = Math.max(0, (existing.inTransit ?? 0) + amount);
      const { closing, grandTotal } = computeBalances(existing.toObject());
      existing.closing = closing;
      existing.grandTotal = grandTotal;
      await existing.save();
      return NextResponse.json({ success: true, data: existing.toObject() });
    }

    const opening = await getPreviousClosing(muId, productCode, date);
    const inTransit = Math.max(0, amount);
    const row = { opening, delivered: 0, reserved: 0, received: 0, inTransit };
    const { closing, grandTotal } = computeBalances(row);
    const created = await DailyStock.create({
      muId, productCode, date, ...row, closing, grandTotal,
    });
    return NextResponse.json({ success: true, data: created.toObject() });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update stock';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/**
 * Edit columns on today's row. Supports two actions:
 *
 *   • `inTransit` (number) — replaces today's In Transit value directly,
 *     mirrors clicking the yellow cell.
 *   • `receive` (number) — moves N units from In Transit to Received,
 *     mirrors the "receiving approval" workflow.
 *
 * Body: `{ muId, productCode, date?, inTransit?, receive? }`.
 */
export async function PATCH(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json() as {
      muId?: number;
      productCode?: number;
      date?: string;
      inTransit?: number;
      receive?: number;
    };

    const muId = Number(body.muId);
    const productCode = Number(body.productCode);
    const date = (body.date || todayISO()).trim();

    if (!Number.isFinite(muId) || !Number.isFinite(productCode)) {
      return NextResponse.json(
        { success: false, message: 'muId and productCode are required.' },
        { status: 400 },
      );
    }

    // Always work off today's row — create it from the previous closing if missing.
    let row = await DailyStock.findOne({ muId, productCode, date });
    if (!row) {
      const opening = await getPreviousClosing(muId, productCode, date);
      const base = { opening, delivered: 0, reserved: 0, received: 0, inTransit: 0 };
      const { closing, grandTotal } = computeBalances(base);
      row = await DailyStock.create({ muId, productCode, date, ...base, closing, grandTotal });
    } else {
      // Backfill legacy nullable fields so the math below never produces NaN.
      row.opening = row.opening ?? 0;
      row.delivered = row.delivered ?? 0;
      row.reserved = row.reserved ?? 0;
      row.received = row.received ?? 0;
      row.inTransit = row.inTransit ?? 0;
    }

    if (typeof body.inTransit === 'number') {
      row.inTransit = Math.max(0, Math.floor(body.inTransit));
    }
    if (typeof body.receive === 'number') {
      const moveQty = Math.max(0, Math.floor(body.receive));
      const available = row.inTransit;
      if (moveQty > available) {
        return NextResponse.json(
          { success: false, message: `Only ${available} units in transit — can't receive ${moveQty}.` },
          { status: 400 },
        );
      }
      row.inTransit -= moveQty;
      row.received += moveQty;
    }

    const { closing, grandTotal } = computeBalances(row.toObject());
    row.closing = closing;
    row.grandTotal = grandTotal;
    await row.save();

    return NextResponse.json({ success: true, data: row.toObject() });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update stock';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
