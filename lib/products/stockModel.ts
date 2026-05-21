import mongoose, { Schema } from 'mongoose';

/**
 * Per (manufacturing-unit × product variant) inventory.
 *
 * `onHand` is the physical stock at the MU, `reserved` is the qty locked for
 * paid PIs that haven't dispatched yet. The available-to-sell figure
 * (`onHand - reserved`) is derived in the UI/handlers, not stored.
 *
 * Joins:
 *  - `muId` → `public/manufacturing_units.csv` numeric id (TN=1, MP=2, WB=3, HR=4).
 *  - `productCode` + `variantKey` → `ProductDoc.code` + `ProductVariantSub.key`
 *    in `lib/products/productModel.ts`.
 */
export interface StockDoc {
  _id?: mongoose.Types.ObjectId;
  muId: number;
  productCode: number;
  variantKey: string;
  onHand: number;
  reserved: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const StockSchema = new Schema<StockDoc>(
  {
    muId: { type: Number, required: true },
    productCode: { type: Number, required: true },
    variantKey: { type: String, required: true },
    onHand: { type: Number, required: true, default: 0, min: 0 },
    reserved: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

StockSchema.index({ muId: 1, productCode: 1, variantKey: 1 }, { unique: true });

export const Stock =
  (mongoose.models.Stock as mongoose.Model<StockDoc>) ||
  mongoose.model<StockDoc>('Stock', StockSchema);

// ─── Stock log (append-only ledger) ─────────────────────────────────────────────

export type StockLogReason = 'top_up' | 'reserve' | 'unreserve' | 'dispatch' | 'adjustment';

export interface StockLogDoc {
  _id?: mongoose.Types.ObjectId;
  muId: number;
  productCode: number;
  variantKey: string;
  /** Positive for inflows (top_up, unreserve), negative for outflows (reserve, dispatch). */
  delta: number;
  reason: StockLogReason;
  note?: string;
  invoiceId?: mongoose.Types.ObjectId;
  at: Date;
}

const StockLogSchema = new Schema<StockLogDoc>(
  {
    muId: { type: Number, required: true, index: true },
    productCode: { type: Number, required: true },
    variantKey: { type: String, required: true },
    delta: { type: Number, required: true },
    reason: {
      type: String,
      required: true,
      enum: ['top_up', 'reserve', 'unreserve', 'dispatch', 'adjustment'],
    },
    note: { type: String, default: '' },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false },
);

export const StockLog =
  (mongoose.models.StockLog as mongoose.Model<StockLogDoc>) ||
  mongoose.model<StockLogDoc>('StockLog', StockLogSchema);

// ─── Plain DTOs (server → client) ───────────────────────────────────────────────

export interface StockDTO {
  id: string;
  muId: number;
  productCode: number;
  variantKey: string;
  onHand: number;
  reserved: number;
  available: number;
}

export function stockToDTO(d: StockDoc): StockDTO {
  return {
    id: String(d._id),
    muId: d.muId,
    productCode: d.productCode,
    variantKey: d.variantKey,
    onHand: d.onHand,
    reserved: d.reserved,
    available: Math.max(0, d.onHand - d.reserved),
  };
}
