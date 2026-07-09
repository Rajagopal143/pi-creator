'use client';

import type { Dealer } from '@/lib/csvData';
import type { DealerAddress, PriceList } from '../types';
import { PRICE_LISTS, PRICE_TIERS } from '../constants';
import { DealerSearch } from './DealerSearch';
import { EditableAddressBlock } from './EditableAddress';

/** Human-readable label for a dealer's classification. */
function dealerTypeLabel(type?: string): string | null {
  if (!type) return null;
  return PRICE_TIERS.find(t => t.value === type)?.label ?? type;
}

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
  showDealerType = false,
}: DealerPartyProps & { showDealerType?: boolean }) {
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
          <div className="font-semibold text-gray-900 text-sm">
            {dealer.orgName}
            {showDealerType && dealerTypeLabel(dealer.dealerType) && (
              <span className="font-normal text-gray-500"> ({dealerTypeLabel(dealer.dealerType)})</span>
            )}
          </div>
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

/** "Bill To & Ship To" card, with the Old/New price-list toggle for the PI. */
export function PartiesCard({
  billTo, shipTo, priceList, onPriceListChange,
}: {
  billTo: DealerPartyProps;
  shipTo: DealerPartyProps;
  priceList: PriceList;
  onPriceListChange: (p: PriceList) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="mb-4 pb-2 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Bill To &amp; Ship To</h2>
        {/* Price-list toggle — picks which price list the dealer is quoted. */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-gray-500">Price List</span>
          <div className="inline-flex rounded-lg border border-zinc-300 p-0.5">
            {PRICE_LISTS.map(pl => (
              <button
                key={pl.value}
                type="button"
                onClick={() => onPriceListChange(pl.value)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  priceList === pl.value
                    ? 'bg-red-700 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {pl.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <DealerParty {...billTo} showDealerType />
        <DealerParty {...shipTo} />
      </div>
    </div>
  );
}
