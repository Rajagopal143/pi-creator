import { loadDealers, loadManufacturingUnits } from '@/lib/csvData';
import { getPricedCatalog } from '@/lib/products/catalog';
import { getDealersForPIAction } from '@/lib/dealers/server-actions';
import PICreator from './PICreator';

export const metadata = {
  title: 'Create Proforma Invoice — Yakuza DMS',
};

export default async function CreatePIPage({
  searchParams,
}: {
  searchParams: Promise<{ invoiceId?: string }>;
}) {
  const { invoiceId } = await searchParams;
  let dealers = await getDealersForPIAction();
  if (dealers.length === 0) {
    dealers = loadDealers();
  }
  const { products, variants } = await getPricedCatalog();
  const manufacturingUnits     = loadManufacturingUnits();

  return (
    <PICreator
      dealers={dealers}
      products={products}
      variants={variants}
      manufacturingUnits={manufacturingUnits}
      editInvoiceId={invoiceId}
    />
  );
}
