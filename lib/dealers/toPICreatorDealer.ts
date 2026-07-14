import type { Dealer } from '@/lib/csvData';
import type { DealerRecordDoc } from './dealerRecordModel';

export function dealerRecordToPICreatorDealer(doc: DealerRecordDoc): Dealer {
  const id = doc.dealerNumericId;
  return {
    id,
    dealerId: doc.dealerId,
    OEMProfileID: doc.OEMProfileID ?? 1,
    dealerType: doc.pricingDealerType,
    userType: doc.userType,
    orgName: doc.orgName,
    orgDisplayName: doc.orgDisplayName || doc.orgName,
    orgEmail: doc.orgEmail,
    contact: doc.contact,
    gstNo: doc.gstNo,
    billingAddress: {
      city: doc.billingAddress?.city ?? '',
      state: doc.billingAddress?.state ?? '',
      address: doc.billingAddress?.address ?? '',
      country: doc.billingAddress?.country ?? 'India',
      pincode: doc.billingAddress?.pincode ?? '',
    },
    shippingAddress: {
      city: doc.shippingAddress?.city ?? '',
      state: doc.shippingAddress?.state ?? '',
      address: doc.shippingAddress?.address ?? '',
      country: doc.shippingAddress?.country ?? 'India',
      pincode: doc.shippingAddress?.pincode ?? '',
    },
    firstName: doc.firstName,
    lastName: doc.lastName,
    state: doc.billingAddress?.state || doc.shippingAddress?.state || '',
  };
}
