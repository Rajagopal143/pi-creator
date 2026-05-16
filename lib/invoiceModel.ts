import mongoose, { Schema } from 'mongoose';
import { PI_STATUSES } from '@/lib/invoiceStatus';
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
  taxType: 'within_state' | 'other_state';
  subTotal: number;
  discount: number;
  totalSGST: number;
  totalCGST: number;
  totalIGST: number;
  totalGST: number;
  totalAccessory: number;
  insurance: number;
  total: number;
  insuranceEnabled?: boolean;
  status?: PIStatus;
  statusDescription?: string;
  statusHistory?: Array<{
    status: PIStatus;
    description: string;
    updatedAt: string;
  }>;
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
    taxType: { type: String, enum: ['within_state', 'other_state'], required: true },
    subTotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    totalSGST: { type: Number, default: 0 },
    totalCGST: { type: Number, default: 0 },
    totalIGST: { type: Number, default: 0 },
    totalGST: { type: Number, required: true },
    totalAccessory: { type: Number, default: 0 },
    insurance: { type: Number, default: 0 },
    total: { type: Number, required: true },
    insuranceEnabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: PI_STATUSES,
      default: 'Approved',
    },
    statusDescription: { type: String, default: 'Invoice created' },
    statusHistory: [
      {
        status: { type: String, enum: PI_STATUSES },
        description: { type: String, default: '' },
        updatedAt: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

export const Invoice =
  mongoose.models.Invoice || mongoose.model<SavedInvoice>('Invoice', InvoiceSchema);
