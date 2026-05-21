import mongoose, { Schema } from 'mongoose';

/**
 * Per-manufacturing-unit dispatch token counter.
 *
 * When an invoice receives its first payment, the system allocates the next
 * token number for that MU. Tokens drive the dispatch queue order: the lowest
 * outstanding token at each MU is dispatched first.
 *
 * Mirrors the per-state pattern in `lib/invoiceCounterModel.ts` — atomic
 * `findOneAndUpdate` with `$inc` is the lock; no two concurrent requests can
 * receive the same token even under heavy load.
 */
export interface TokenCounterDoc {
  _id?: string;
  /** Numeric manufacturing-unit id (from `public/manufacturing_units.csv`). */
  muId: number;
  /** Two-letter state code cached for label formatting (e.g. WB, MP). */
  muState: string;
  /** The next token number to assign for this MU. */
  nextNumber: number;
  createdAt?: string;
  updatedAt?: string;
}

const TokenCounterSchema = new Schema<TokenCounterDoc>(
  {
    muId: { type: Number, required: true, unique: true },
    muState: { type: String, default: '' },
    nextNumber: { type: Number, required: true, default: 1, min: 0 },
  },
  { timestamps: true },
);

export const TokenCounter =
  (mongoose.models.TokenCounter as mongoose.Model<TokenCounterDoc>) ||
  mongoose.model<TokenCounterDoc>('TokenCounter', TokenCounterSchema);

/** The token display label is just its per-MU sequence number (1, 2, 3…). */
export function formatTokenLabel(n: number): string {
  return String(n);
}
