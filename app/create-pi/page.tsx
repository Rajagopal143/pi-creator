import { loadDealers, loadProducts, loadProductVariants, loadManufacturingUnits } from '@/lib/csvData';
import PICreator from './PICreator';

export const metadata = {
  title: 'Create Purchase Order Invoice — Yakuza DMS',
};

export default function CreatePIPage() {
  const dealers             = loadDealers();
  const products            = loadProducts();
  const variants            = loadProductVariants();
  const manufacturingUnits  = loadManufacturingUnits();

  return (
    <PICreator
      dealers={dealers}
      products={products}
      variants={variants}
      manufacturingUnits={manufacturingUnits}
    />
  );
}
