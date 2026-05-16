import { connectDB } from '@/lib/mongodb';
import {
  InvoiceCounter,
  ensureCountersSeeded,
  counterToDTO,
} from '@/lib/invoiceCounterModel';
import SettingsClient from './SettingsClient';

export const metadata = {
  title: 'Settings — Yakuza DMS',
};

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await connectDB();
  await ensureCountersSeeded();
  const counters = await InvoiceCounter.find().sort({ stateName: 1 }).lean();
  return <SettingsClient initialCounters={counters.map(counterToDTO)} />;
}
