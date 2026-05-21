import ProductForm from '../ProductForm';

export const metadata = {
  title: 'Add Product — Yakuza DMS',
};

export default function NewProductPage() {
  return <ProductForm mode="create" />;
}
