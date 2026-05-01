import { Metadata } from 'next';
import { loadManufacturingUnits } from '@/lib/csvData';
import InvoiceList from './InvoiceList';

export const metadata: Metadata = {
  title: 'All Invoices — Yakuza DMS',
};

export default function InvoicesPage() {
  const manufacturingUnits = loadManufacturingUnits();
  return <InvoiceList manufacturingUnits={manufacturingUnits} />;
}
