'use client';

import type { Product, ProductVariant } from '@/lib/csvData';
import type { ComputedLineItem, LineItemState, PriceList, PriceTier } from '../types';
import { PRICE_TIERS } from '../constants';
import { LineItemRow } from './LineItemRow';

const HEADERS = [
  '#', 'Model', 'Variant', 'Accessory', 'Qty',
  'Unit Rate', 'Rate (incl. GST)', 'Line Total',
];

/** "Line Items" card — price-tier selector plus the editable items table. */
export function LineItemsCard({
  items, products, variants, priceTier, priceList, stockAvailability, stockEnforced, stockLoading, muSelected,
  onPriceTierChange, onUpdateItem, onRemoveItem, onAddItem,
}: {
  items: ComputedLineItem[];
  products: Product[];
  variants: ProductVariant[];
  priceTier: PriceTier;
  /** Which price list (Old / New) the rates reflect. */
  priceList: PriceList;
  /** productCode → committable qty at the selected MU. */
  stockAvailability: Record<number, number>;
  /** When true, only in-stock models are offered and qty is capped to stock. */
  stockEnforced: boolean;
  /** True while available stock is being (re)fetched after an MU change. */
  stockLoading: boolean;
  /** A manufacturing unit must be chosen before models can be picked. */
  muSelected: boolean;
  onPriceTierChange: (t: PriceTier) => void;
  onUpdateItem: (id: string, updates: Partial<LineItemState>) => void;
  onRemoveItem: (id: string) => void;
  onAddItem: () => void;
}) {
  const totalQty = items.reduce((sum, i) => sum + (i.qty || 0), 0);

  // Models with available stock (when enforcing). The currently-selected model
  // on a row is always kept available to that row so it never vanishes.
  const inStockProducts = stockEnforced
    ? products.filter(p => (stockAvailability[p.id] ?? 0) > 0)
    : products;

  // Per-product qty already consumed across all rows — used to compute each
  // row's remaining cap so the PI total for a product never exceeds its stock.
  const usedByProduct = items.reduce<Record<number, number>>((acc, i) => {
    if (i.productId != null) acc[i.productId] = (acc[i.productId] ?? 0) + (i.qty || 0);
    return acc;
  }, {});

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
        Each row has its own <strong className="text-gray-600">Old / New</strong> toggle — the global toggle
        near the dealer selection (currently <strong className="text-gray-600">{priceList === 'new' ? 'New' : 'Old'}</strong>) bulk-sets every row.
      </p>
      {!muSelected && (
        <p className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-700">
          Select a manufacturing unit above to choose models for the line items.
        </p>
      )}
      <div className="relative overflow-x-auto">
        {/* Inline loading while available stock is (re)fetched after an MU change. */}
        {stockLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px] rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <svg className="size-4 animate-spin text-red-700" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading available stock…
            </div>
          </div>
        )}
        <table className="w-full ">
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
            {items.map((item, idx) => {
              // Cap = product's stock minus what *other* rows of the same
              // product use (so the running total can't overshoot).
              const available = item.productId != null ? (stockAvailability[item.productId] ?? 0) : 0;
              const usedElsewhere = item.productId != null
                ? (usedByProduct[item.productId] ?? 0) - (item.qty || 0)
                : 0;
              const maxQty = item.productId != null
                ? Math.max(0, available - usedElsewhere)
                : undefined;

              // Keep this row's currently-selected model visible even if its
              // stock has since dropped to zero (else the dropdown clears it).
              const selected = item.productId != null
                ? products.find(p => p.id === item.productId)
                : undefined;
              const rowProducts = stockEnforced && selected && !inStockProducts.some(p => p.id === selected.id)
                ? [selected, ...inStockProducts]
                : inStockProducts;

              return (
                <LineItemRow
                  key={item.id}
                  item={item}
                  index={idx}
                  products={rowProducts}
                  variants={variants}
                  priceTier={priceTier}
                  stockAvailability={stockAvailability}
                  stockEnforced={stockEnforced}
                  available={item.productId != null ? available : undefined}
                  maxQty={stockEnforced ? maxQty : undefined}
                  muSelected={muSelected}
                  onUpdate={onUpdateItem}
                  onRemove={onRemoveItem}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onAddItem}
          className="flex items-center gap-1.5 text-sm text-red-700 hover:text-red-800 font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Item
        </button>
        <span className="text-sm text-gray-500">
          Total Qty: <span className="font-semibold text-gray-900">{totalQty}</span>
        </span>
      </div>
    </div>
  );
}
