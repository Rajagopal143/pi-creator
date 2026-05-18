import mongoose, { Schema } from 'mongoose';
import type { DealerUserType } from './referenceData';
import type { Address } from '@/lib/csvData';

/** Pricing type used by PI / product variant rows. */
export type PricingDealerType = 'dealer' | 'distributor' | 'subdealer' | 'areadealer';

export interface DealerBankDetails {
  accountType: 'Current' | 'Savings';
  beneficiaryName: string;
  bankName: string;
  accountNumber: string;
  IFSC: string;
}

export interface DealerRecordDoc {
  _id?: mongoose.Types.ObjectId;
  dealerNumericId: number;
  dealerId: string;
  OEMProfileID: number;
  userType: DealerUserType;
  pricingDealerType: PricingDealerType;
  salutation: 'mr' | 'miss' | 'mrs';
  firstName: string;
  lastName: string;
  orgName: string;
  orgDisplayName: string;
  gstNo: string;
  orgEmail: string;
  contact: string;
  passwordHash?: string;
  parentDistributorId?: mongoose.Types.ObjectId | null;
  parentDealerId?: mongoose.Types.ObjectId | null;
  regionId: string;
  zoneId: string;
  manufacturingUnitId?: number | null;
  billingAddress: Address;
  shippingAddress: Address;
  bankDetails: DealerBankDetails;
  logoBase64?: string;
  logoMimeType?: string;
  isActive: boolean;
  source: 'csv' | 'manual' | 'import';
  createdAt?: Date;
  updatedAt?: Date;
}

const AddressSchema = new Schema<Address>(
  {
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    address: { type: String, default: '' },
    country: { type: String, default: 'India' },
    pincode: { type: String, default: '' },
  },
  { _id: false },
);

const BankSchema = new Schema<DealerBankDetails>(
  {
    accountType: { type: String, enum: ['Current', 'Savings'], default: 'Current' },
    beneficiaryName: { type: String, default: '' },
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    IFSC: { type: String, default: '' },
  },
  { _id: false },
);

const DealerRecordSchema = new Schema<DealerRecordDoc>(
  {
    dealerNumericId: { type: Number, required: true, unique: true },
    dealerId: { type: String, required: true, unique: true },
    OEMProfileID: { type: Number, default: 1 },
    userType: {
      type: String,
      enum: ['distributor', 'divisionaldistributor', 'districtdealer', 'areadealer'],
      required: true,
    },
    pricingDealerType: {
      type: String,
      enum: ['dealer', 'distributor', 'subdealer', 'areadealer'],
      required: true,
    },
    salutation: { type: String, enum: ['mr', 'miss', 'mrs'], default: 'mr' },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    orgName: { type: String, required: true },
    orgDisplayName: { type: String, default: '' },
    gstNo: { type: String, default: '' },
    orgEmail: { type: String, default: '' },
    contact: { type: String, default: '' },
    passwordHash: { type: String, default: '' },
    parentDistributorId: { type: Schema.Types.ObjectId, ref: 'DealerRecord', default: null },
    parentDealerId: { type: Schema.Types.ObjectId, ref: 'DealerRecord', default: null },
    regionId: { type: String, default: '' },
    zoneId: { type: String, default: '' },
    manufacturingUnitId: { type: Number, default: null },
    billingAddress: { type: AddressSchema, default: () => ({}) },
    shippingAddress: { type: AddressSchema, default: () => ({}) },
    bankDetails: { type: BankSchema, default: () => ({ accountType: 'Current', beneficiaryName: '', bankName: '', accountNumber: '', IFSC: '' }) },
    logoBase64: { type: String, default: '' },
    logoMimeType: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    source: { type: String, enum: ['csv', 'manual', 'import'], default: 'manual' },
  },
  { timestamps: true },
);

DealerRecordSchema.index({ orgEmail: 1 });
DealerRecordSchema.index({ orgName: 'text' });

export const DealerRecord =
  mongoose.models.DealerRecord ||
  mongoose.model<DealerRecordDoc>('DealerRecord', DealerRecordSchema, 'dealers');
