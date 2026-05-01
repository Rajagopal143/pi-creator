import { loadManufacturingUnits } from '@/lib/csvData';
import { OPERATING_STATES } from '@/lib/dealers/referenceData';
import { getDistributorsForFormAction, getDealersForParentFormAction } from '@/lib/dealers/server-actions';
import AddDealerForm from './AddDealerForm';

export const metadata = {
  title: 'Add New Dealer — Yakuza DMS',
};

export default async function AddDealerPage() {
  const [manufacturingUnits, distributors, parentDealers] = await Promise.all([
    Promise.resolve(loadManufacturingUnits()),
    getDistributorsForFormAction(),
    getDealersForParentFormAction(),
  ]);

  return (
    <AddDealerForm
      manufacturingUnits={manufacturingUnits}
      distributors={distributors}
      parentDealers={parentDealers}
      states={OPERATING_STATES}
    />
  );
}
