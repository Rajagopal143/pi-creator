'use client';

import type { Dealer } from '@/lib/csvData';
import type { DealerAddress } from '../types';
import { DealerSearch } from './DealerSearch';
import { EditableAddressBlock } from './EditableAddress';

/** Props for one party (Bill To or Ship To). */
export interface DealerPartyProps {
  label: string;
  keyPrefix: string;
  addressLabel: string;
  dealers: Dealer[];
  search: string;
  onSearchChange: (v: string) => void;
  dealer: Dealer | null;
  addr: DealerAddress;
  onAddrChange: (a: DealerAddress) => void;
  onSelect: (d: Dealer) => void;
}

/** A single dealer party block — search + selected card with editable address. */
function DealerParty({
  label, keyPrefix, addressLabel, dealers,
  search, onSearchChange, dealer, addr, onAddrChange, onSelect,
}: DealerPartyProps) {
  return (
    <div>
      <div className="text-[10px] uppercase font-semibold text-red-500 tracking-wide mb-1">{label}</div>
      <DealerSearch
        dealers={dealers}
        value={search}
        onChange={onSearchChange}
        onSelect={onSelect}
        placeholder={`Search ${label}…`}
      />
      {dealer && (
        <div key={`${keyPrefix}-${dealer.id}`} className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100">
          <div className="font-semibold text-gray-900 text-sm">{dealer.orgName}</div>
          <div className="text-[10px] text-gray-500 mb-2">
            {dealer.dealerId} · Ph: {dealer.contact} · GSTIN: {dealer.gstNo}
          </div>
          <div className="text-[10px] uppercase font-semibold text-gray-400 tracking-wide">
            {addressLabel} (click any value to edit)
          </div>
          <EditableAddressBlock addr={addr} onChange={onAddrChange} />
        </div>
      )}
    </div>
  );
}

/** "Bill To & Ship To" card. */
export function PartiesCard({ billTo, shipTo }: { billTo: DealerPartyProps; shipTo: DealerPartyProps }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
        Bill To &amp; Ship To
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <DealerParty {...billTo} />
        <DealerParty {...shipTo} />
      </div>
    </div>
  );
}
