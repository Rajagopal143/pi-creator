import { notFound } from 'next/navigation';
import { getProductForEditAction } from '@/lib/products/server-actions';
import EditProductForm from './EditProductForm';

export const metadata = {
  title: 'Edit Product — Yakuza DMS',
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductForEditAction(id);
  if (!product) notFound();

  return <EditProductForm product={product} />;
}
