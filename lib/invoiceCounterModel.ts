import mongoose, { Schema } from 'mongoose';

/**
 * Per-state PI invoice numbering.
 *
 * The displayed number is `<prefix>/<series>/<nextNumber>` — e.g. `WB-PI/2627/359`.
 * `state` matches the manufacturing unit's state code (WB, MP, TN, HR …) and is
 * the lookup key when an invoice is created. `nextNumber` is incremented after
 * each invoice so the next one in that state continues the series.
 */
export interface InvoiceCounterDoc {
  _id?: string;
  /** Manufacturing-unit state code — the lookup key. */
  state: string;
  stateName: string;
  /** Text before the first slash, e.g. "WB-PI". */
  prefix: string;
  /** Middle segment, e.g. "2627". */
  series: string;
  /** The next count to assign; incremented after each invoice. */
  nextNumber: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Plain object shipped to the client. */
export interface InvoiceCounterDTO {
  state: string;
  stateName: string;
  prefix: string;
  series: string;
  nextNumber: number;
}

const InvoiceCounterSchema = new Schema<InvoiceCounterDoc>(
  {
    state: { type: String, required: true, unique: true, uppercase: true, trim: true },
    stateName: { type: String, default: '' },
    prefix: { type: String, required: true, trim: true },
    series: { type: String, required: true, trim: true },
    nextNumber: { type: Number, required: true, default: 1, min: 0 },
  },
  { timestamps: true },
);

export const InvoiceCounter =
  (mongoose.models.InvoiceCounter as mongoose.Model<InvoiceCounterDoc>) ||
  mongoose.model<InvoiceCounterDoc>('InvoiceCounter', InvoiceCounterSchema);

/** Seed values — West Bengal continues from 359 as specified. */
export const DEFAULT_INVOICE_COUNTERS: InvoiceCounterDTO[] = [
  { state: 'WB', stateName: 'West Bengal',    prefix: 'WB-PI', series: '2627', nextNumber: 359 },
  { state: 'MP', stateName: 'Madhya Pradesh', prefix: 'MP-PI', series: '2627', nextNumber: 89 },
  { state: 'TN', stateName: 'Tamil Nadu',     prefix: 'TN-PI', series: '2627', nextNumber: 89 },
  { state: 'HR', stateName: 'Haryana',        prefix: 'HR-PI', series: '2627', nextNumber: 1 },
];

/** Builds the displayed invoice number for a given count. */
export function formatInvoiceNumber(
  c: { prefix: string; series: string },
  num: number,
): string {
  return `${c.prefix}/${c.series}/${num}`;
}

/** Idempotently inserts any missing default counters without overwriting edits. */
export async function ensureCountersSeeded(): Promise<void> {
  await Promise.all(
    DEFAULT_INVOICE_COUNTERS.map(c =>
      InvoiceCounter.updateOne({ state: c.state }, { $setOnInsert: c }, { upsert: true }),
    ),
  );
}

export function counterToDTO(c: InvoiceCounterDoc): InvoiceCounterDTO {
  return {
    state: c.state,
    stateName: c.stateName,
    prefix: c.prefix,
    series: c.series,
    nextNumber: c.nextNumber,
  };
}
