import { connectDB } from '@/lib/mongodb';
import { ProductRecord, ensureProductsSeeded } from '@/lib/products/productModel';
import { loadManufacturingUnits } from '@/lib/csvData';
import StockListClient from './StockListClient';

export const metadata = {
  title: 'Stock — Yakuza DMS',
};

export const dynamic = 'force-dynamic';

export default async function StockPage() {
  await connectDB();
  await ensureProductsSeeded();

  const [products, manufacturingUnits] = await Promise.all([
    ProductRecord.find({ isActive: true }).sort({ sortOrder: 1, code: 1 }).select('code name').lean(),
    Promise.resolve(loadManufacturingUnits()),
  ]);

  const productOptions = products.map(p => ({ code: p.code, name: p.name }));
  const muOptions = manufacturingUnits
    .map(mu => ({ id: mu.id, unitName: mu.unitName, state: mu.state }))
    .sort((a, b) => a.id - b.id);

  return <StockListClient products={productOptions} manufacturingUnits={muOptions} />;
}
