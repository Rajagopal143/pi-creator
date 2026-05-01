import type { Dealer } from '@/lib/csvData';
import { legacyCsvPricingTypeToUserType } from './mapUserTypeToPricing';
import type { DealerRecordDoc } from './dealerRecordModel';

/** Build Mongo payload from existing CSV row shape (loadDealers). */
export function csvDealerRowToRecordPayload(row: Dealer): Partial<DealerRecordDoc> {
  const userType = legacyCsvPricingTypeToUserType(row.dealerType);
  return {
    dealerNumericId: row.id,
    dealerId: row.dealerId,
    OEMProfileID: row.OEMProfileID,
    userType,
    pricingDealerType: row.dealerType,
    salutation: 'mr',
    firstName: row.firstName,
    lastName: row.lastName,
    orgName: row.orgName,
    orgDisplayName: row.orgDisplayName || row.orgName,
    gstNo: row.gstNo,
    orgEmail: row.orgEmail,
    contact: row.contact,
    regionId: '',
    zoneId: '',
    manufacturingUnitId: null,
    billingAddress: { ...row.billingAddress },
    shippingAddress: { ...row.shippingAddress },
    bankDetails: {
      accountType: 'Current',
      beneficiaryName: '',
      bankName: '',
      accountNumber: '',
      IFSC: '',
    },
    isActive: true,
    source: 'csv',
  };
}
