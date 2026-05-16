import { loadDealers, loadManufacturingUnits } from '@/lib/csvData';
import { loadPricedCatalog } from '@/lib/productCatalog';
import { getDealersForPIAction } from '@/lib/dealers/server-actions';
import PICreator from './PICreator';

export const metadata = {
  title: 'Create Purchase Order Invoice — Yakuza DMS',
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
  const { products, variants } = loadPricedCatalog();
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
