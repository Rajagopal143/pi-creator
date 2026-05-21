import { loadManufacturingUnits } from '@/lib/csvData';
import DispatchList from './DispatchList';

export const metadata = {
  title: 'Dispatch Queue — Yakuza DMS',
};

export default function DispatchPage() {
  const manufacturingUnits = loadManufacturingUnits();
  return <DispatchList manufacturingUnits={manufacturingUnits} />;
}
