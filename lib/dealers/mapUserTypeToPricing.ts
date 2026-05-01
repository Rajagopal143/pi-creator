import type { DealerUserType } from './referenceData';
import type { PricingDealerType } from './dealerRecordModel';

export function userTypeToPricingType(userType: DealerUserType): PricingDealerType {
  switch (userType) {
    case 'distributor':
    case 'divisionaldistributor':
      return 'distributor';
    case 'districtdealer':
      return 'dealer';
    case 'areadealer':
      return 'areadealer';
    default:
      return 'dealer';
  }
}

export function legacyCsvPricingTypeToUserType(
  t: 'dealer' | 'distributor' | 'subdealer' | 'areadealer',
): DealerUserType {
  switch (t) {
    case 'distributor':
      return 'distributor';
    case 'areadealer':
      return 'areadealer';
    case 'subdealer':
      return 'districtdealer';
    case 'dealer':
    default:
      return 'districtdealer';
  }
}
