import type { Address } from '@/lib/csvData';
import type { DealerUserType } from './referenceData';
import type { DealerBankDetails } from './dealerRecordModel';

export interface DealerListRow {
  id: string;
  dealerNumericId: number;
  dealerId: string;
  orgName: string;
  userType: string;
  orgEmail: string;
  contact: string;
  source: string;
}

export interface ParentOption {
  id: string;
  orgName: string;
}

/** Pre-filled values passed to the dealer form when editing an existing dealer. */
export interface DealerFormInitial {
  id: string;
  dealerId: string;
  userType: DealerUserType;
  salutation: 'mr' | 'miss' | 'mrs';
  firstName: string;
  lastName: string;
  orgName: string;
  gstNo: string;
  orgEmail: string;
  contact: string;
  regionId: string;
  zoneId: string;
  manufacturingUnitId: number | null;
  parentDistributorId: string;
  parentDealerId: string;
  billingAddress: Address;
  shippingAddress: Address;
  bankDetails: DealerBankDetails;
  logoBase64: string;
  logoMimeType: string;
}

export type CreateDealerState = {
  ok: boolean;
  message: string;
  fieldErrors: Record<string, string>;
};

export const initialCreateState: CreateDealerState = {
  ok: false,
  message: '',
  fieldErrors: {},
};
