import { Metadata } from 'next';
import InvoiceList from './InvoiceList';

export const metadata: Metadata = {
  title: 'All Invoices — Yakuza DMS',
};

export default function InvoicesPage() {
  return <InvoiceList />;
}
