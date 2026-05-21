import { loadManufacturingUnits } from '@/lib/csvData';
import PaymentsList from './PaymentsList';

export const metadata = {
  title: 'Payments — Yakuza DMS',
};

export default function PaymentsPage() {
  const manufacturingUnits = loadManufacturingUnits();
  return (
    <PaymentsList
      manufacturingUnits={manufacturingUnits
        .map(mu => ({ id: mu.id, unitName: mu.unitName, state: mu.state }))
        .sort((a, b) => a.id - b.id)}
    />
  );
}
