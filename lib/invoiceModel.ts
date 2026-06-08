import mongoose, { Schema } from 'mongoose';
import type { PIStatus } from '@/lib/invoiceStatus';

export interface SavedAddress {
  city: string;
  state: string;
  address: string;
  country: string;
  pincode: string;
}

export interface SavedDealer {
  id: number;
  dealerId: string;
  OEMProfileID: number;
  dealerType: string;
  orgName: string;
  orgEmail: string;
  contact: string;
  gstNo: string;
  billingAddress: SavedAddress;
  shippingAddress: SavedAddress;
  firstName: string;
  lastName: string;
  state: string;
}

export interface SavedManufacturingUnit {
  id: number;
  OEMProfileID: number;
  unitName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstNo: string;
  phoneNo: string;
  email: string;
  accountNumber: string;
}

export type AccessoryType = 'none' | 'black' | 'steel';

export interface SavedLineItem {
  id: string;
  productId: number;
  variantId: number;
  /** Legacy field — colour is no longer captured in the PI creator. */
  colour?: string;
  qty: number;
  productName: string;
  variantName: string;
  HSN: string;
  rate: number;
  sgstPct: number;
  cgstPct: number;
  igstPct: number;
  sgstAmount: number;
  cgstAmount: number;
  igstAmount: number;
  taxableAmount: number;
  accessory: AccessoryType;
  accessoryCharge: number;
  totalAmount: number;
}

export interface SavedInvoice {
  _id?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  seqNumber: string;
  manufacturingUnit: SavedManufacturingUnit;
  /** Bill To dealer */
  dealer: SavedDealer;
  /** Ship To dealer (separate from Bill To). Optional for legacy invoices. */
  shipToDealer?: SavedDealer;
  lineItems: SavedLineItem[];
  /** Dealer-type price tier the line items were priced at (e.g. 'dealer'). */
  priceTier?: string;
  /** Which price list the line items were priced from ('old' | 'new'). */
  priceList?: 'old' | 'new';
  taxType: 'within_state' | 'other_state';
  subTotal: number;
  discount: number;
  totalSGST: number;
  totalCGST: number;
  totalIGST: number;
  totalGST: number;
  totalAccessory: number;
  /** GST-exclusive transportation charge. */
  transportCharge?: number;
  /** 18% GST computed on the transportation charge. */
  transportGST?: number;
  insurance: number;
  /** Signed rounding adjustment applied to reach the whole-rupee total. */
  roundOff?: number;
  total: number;
  insuranceEnabled?: boolean;
  status?: PIStatus;
  statusDescription?: string;
  statusHistory?: Array<{
    status: PIStatus;
    description: string;
    updatedAt: string;
  }>;
  /** Recorded when the first payment arrives — triggers token issue + stock reservation. */
  firstPayment?: {
    amount: number;
    mode: string;
    date: string;
    reference?: string;
    recordedAt: string;
  };
  /** Per-MU sequential token, allocated when first payment is recorded. */
  tokenNumber?: number;
  /** Display label for the token, e.g. `WB-T-1`. */
  tokenLabel?: string;
  /** Promised delivery date (ISO YYYY-MM-DD), set when first payment is recorded. */
  expectedDeliveryDate?: string;
  /** Scheduled dispatch date (ISO YYYY-MM-DD), set manually from the invoice actions menu. */
  dispatchDate?: string;
  createdAt?: string;
}

const InvoiceSchema = new Schema<SavedInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    invoiceDate: { type: String, required: true },
    dueDate: { type: String, required: true },
    seqNumber: { type: String, required: true },
    manufacturingUnit: { type: Schema.Types.Mixed, required: true },
    dealer: { type: Schema.Types.Mixed, required: true },
    shipToDealer: { type: Schema.Types.Mixed },
    lineItems: [{ type: Schema.Types.Mixed }],
    priceTier: { type: String },
    priceList: { type: String, enum: ['old', 'new'], default: 'old' },
    taxType: { type: String, enum: ['within_state', 'other_state'], required: true },
    subTotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    totalSGST: { type: Number, default: 0 },
    totalCGST: { type: Number, default: 0 },
    totalIGST: { type: Number, default: 0 },
    totalGST: { type: Number, required: true },
    totalAccessory: { type: Number, default: 0 },
    transportCharge: { type: Number, default: 0 },
    transportGST: { type: Number, default: 0 },
    insurance: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    total: { type: Number, required: true },
    insuranceEnabled: { type: Boolean, default: true },
    // `status` is intentionally not enum-constrained — legacy invoices hold
    // older status values and must still re-save cleanly. The UI restricts
    // new values to PI_STATUSES (Pending / Dispatched / Cancelled).
    status: { type: String, default: 'Pending' },
    statusDescription: { type: String, default: 'Invoice created' },
    statusHistory: [
      {
        status: { type: String },
        description: { type: String, default: '' },
        updatedAt: { type: String, required: true },
      },
    ],
    firstPayment: {
      type: new Schema(
        {
          amount: { type: Number, required: true },
          mode: { type: String, required: true },
          date: { type: String, required: true },
          reference: { type: String, default: '' },
          recordedAt: { type: String, required: true },
        },
        { _id: false },
      ),
      default: undefined,
    },
    tokenNumber: { type: Number },
    tokenLabel: { type: String },
    expectedDeliveryDate: { type: String },
    dispatchDate: { type: String },
  },
  { timestamps: true }
);

// Re-register on every module load so schema changes (new fields like
// firstPayment, tokenNumber, expectedDeliveryDate) take effect immediately
// during dev hot-reload — Mongoose's `strict: true` would otherwise silently
// drop them when the cached schema is stale.
if (mongoose.models.Invoice) mongoose.deleteModel('Invoice');
export const Invoice = mongoose.model<SavedInvoice>('Invoice', InvoiceSchema);
