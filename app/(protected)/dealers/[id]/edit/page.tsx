import { notFound } from 'next/navigation';

import { loadManufacturingUnits } from '@/lib/csvData';
import { OPERATING_STATES } from '@/lib/dealers/referenceData';
import {
  getDealerForEditAction,
  getDistributorsForFormAction,
  getDealersForParentFormAction,
} from '@/lib/dealers/server-actions';
import AddDealerForm from '../../add/AddDealerForm';

export const metadata = {
  title: 'Edit Dealer — Yakuza DMS',
};

export default async function EditDealerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [dealer, manufacturingUnits, distributors, parentDealers] = await Promise.all([
    getDealerForEditAction(id),
    Promise.resolve(loadManufacturingUnits()),
    getDistributorsForFormAction(),
    getDealersForParentFormAction(),
  ]);

  if (!dealer) notFound();

  return (
    <AddDealerForm
      manufacturingUnits={manufacturingUnits}
      distributors={distributors}
      parentDealers={parentDealers}
      states={OPERATING_STATES}
      dealer={dealer}
    />
  );
}
