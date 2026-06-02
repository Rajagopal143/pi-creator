import { ProductRecord, productToDTO } from '@/lib/products/productModel';
import ProductsListClient from './ProductsListClient';

export const metadata = {
  title: 'Products — Yakuza DMS',
};

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {

  const docs = await ProductRecord.find().sort({ sortOrder: 1, code: 1 }).lean();

  return <ProductsListClient products={docs.map(productToDTO)} />;
}
