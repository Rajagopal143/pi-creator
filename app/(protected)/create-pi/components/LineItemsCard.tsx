'use client';

import type { Product, ProductVariant } from '@/lib/csvData';
import type { ComputedLineItem, LineItemState, PriceTier } from '../types';
import { PRICE_TIERS } from '../constants';
import { LineItemRow } from './LineItemRow';

const HEADERS = ['#', 'Model', 'Variant', 'Accessory', 'Qty', 'Rate (incl. GST)', 'Line Total', ''];

/** "Line Items" card — price-tier selector plus the editable items table. */
export function LineItemsCard({
  items, products, variants, priceTier,
  onPriceTierChange, onUpdateItem, onRemoveItem, onAddItem,
}: {
  items: ComputedLineItem[];
  products: Product[];
  variants: ProductVariant[];
  priceTier: PriceTier;
  onPriceTierChange: (t: PriceTier) => void;
  onUpdateItem: (id: string, updates: Partial<LineItemState>) => void;
  onRemoveItem: (id: string) => void;
  onAddItem: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="mb-4 pb-2 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Line Items</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Price for Dealer Type</label>
          <select
            value={priceTier}
            onChange={e => onPriceTierChange(e.target.value as PriceTier)}
            className="border border-zinc-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
          >
            {PRICE_TIERS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">
        Prices below are shown for the <strong className="text-gray-600 capitalize">{priceTier}</strong> tier.
        Change the dropdown to re-price every product line.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="border-b-2 border-gray-200">
              {HEADERS.map(h => (
                <th key={h} className="text-[10px] uppercase text-gray-400 font-semibold text-left px-2 pb-2 tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <LineItemRow
                key={item.id}
                item={item}
                index={idx}
                products={products}
                variants={variants}
                priceTier={priceTier}
                onUpdate={onUpdateItem}
                onRemove={onRemoveItem}
              />
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={onAddItem}
        className="mt-3 flex items-center gap-1.5 text-sm text-red-700 hover:text-red-800 font-medium transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Item
      </button>
    </div>
  );
}
