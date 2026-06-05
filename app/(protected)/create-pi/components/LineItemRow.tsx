'use client';

import { useMemo } from 'react';
import type { Product, ProductVariant } from '@/lib/csvData';
import type { ComputedLineItem, LineItemState, PriceTier } from '../types';
import { ACCESSORY_ONLY_BASE_PRICE } from '../constants';
import { ACCESSORY_PI_LABEL } from '../InvoicePreview';
import { getVariantPrice, formatINR } from '../utils';
import { ProductSelect } from './ProductSelect';

/** A single editable row in the line-items table. */
export function LineItemRow({
  item, index, products, variants, priceTier,
  stockAvailability, stockEnforced, available, maxQty, muSelected,
  onUpdate, onRemove,
}: {
  item: ComputedLineItem;
  index: number;
  products: Product[];
  variants: ProductVariant[];
  priceTier: PriceTier;
  /** productCode → committable qty (for the dropdown stock labels). */
  stockAvailability: Record<number, number>;
  /** When true, models are stock-filtered and qty is capped. */
  stockEnforced: boolean;
  /** Total available for this row's product (for the qty hint). */
  available?: number;
  /** Max qty this row may take (product stock minus other rows' usage). */
  maxQty?: number;
  /** A manufacturing unit must be chosen before a model can be picked. */
  muSelected: boolean;
  onUpdate: (id: string, updates: Partial<LineItemState>) => void;
  onRemove: (id: string) => void;
}) {
  const isAccessoryRow = item.kind === 'accessory';
  // Qty is only editable once a model is selected for this line.
  const qtyDisabled = item.productId == null;
  // Only variants priced for the selected tier + this row's price list are
  // offered — N/A configs (price 0, e.g. a model not on the new list) are hidden.
  const productVariants = useMemo(
    () => variants.filter(v => v.productId === item.productId && getVariantPrice(v, priceTier, item.priceList) > 0),
    [variants, item.productId, priceTier, item.priceList],
  );

  // Clamp qty entry to the available cap when stock enforcement is on.
  // Accessory-only rows are uncapped — they don't consume vehicle stock.
  const handleQtyChange = (raw: number) => {
    let qty = Math.max(0, Math.floor(raw || 0));
    if (stockEnforced && !isAccessoryRow && maxQty != null) qty = Math.min(qty, maxQty);
    onUpdate(item.id, { qty });
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-2 px-2 text-center text-gray-500 text-sm w-8">{index + 1}</td>
      {isAccessoryRow ? (
        <>
          {/* NAME — fixed for every accessory row. */}
          <td className="py-2 px-2 min-w-[160px] text-[11px] font-semibold uppercase tracking-wide text-gray-700">
            {ACCESSORY_PI_LABEL}
          </td>
          {/* MODEL — vehicle picker. */}
          <td className="py-2 px-2 min-w-[180px]">
            <ProductSelect
              products={products}
              value={item.productId}
              disabled={!muSelected}
              placeholder="— Select vehicle —"
              onChange={id => onUpdate(item.id, { productId: id })}
            />
          </td>
          {/* TYPE — Steel / Black. */}
          <td className="py-2 px-2 w-44">
            <div className="flex flex-col gap-1">
              {(['steel', 'black'] as const).map(opt => (
                <label key={opt} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name={`accessory-${item.id}`}
                    checked={item.accessory === opt}
                    onChange={() => onUpdate(item.id, { accessory: opt })}
                    className="h-3.5 w-3.5 accent-zinc-800"
                  />
                  <span className="capitalize">{opt}</span>
                  <span className="text-gray-400">
                    ₹{ACCESSORY_ONLY_BASE_PRICE[opt].toLocaleString('en-IN')} + 18% GST
                  </span>
                </label>
              ))}
            </div>
          </td>
        </>
      ) : (
        <>
          <td className="py-2 px-2 min-w-[180px]">
            <ProductSelect
              products={products}
              value={item.productId}
              stockAvailability={stockEnforced ? stockAvailability : undefined}
              disabled={!muSelected}
              placeholder="— Select unit first —"
              onChange={id => onUpdate(item.id, { productId: id })}
            />
            {/* Per-row Old/New price-list toggle — overrides the PI-level default. */}
            <div className="mt-1.5 inline-flex rounded-md border border-zinc-200 p-0.5 text-[10px] font-semibold">
              {(['old', 'new'] as const).map(pl => (
                <button
                  key={pl}
                  type="button"
                  onClick={() => onUpdate(item.id, { priceList: pl })}
                  title={pl === 'new' ? 'Use the new (May 2026) price list for this row' : 'Use the old price list for this row'}
                  className={`px-2 py-0.5 rounded-[3px] uppercase tracking-wide transition-colors ${
                    item.priceList === pl
                      ? 'bg-red-700 text-white'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {pl}
                </button>
              ))}
            </div>
          </td>
          <td className="py-2 px-2">
            <select
              value={item.variantId ?? ''}
              onChange={e => onUpdate(item.id, { variantId: e.target.value ? Number(e.target.value) : null })}
              disabled={!item.productId}
              className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">— Select Variant —</option>
              {productVariants.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </td>
          <td className="py-2 px-2 w-40">
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.accessory === 'black'}
                  onChange={e => onUpdate(item.id, { accessory: e.target.checked ? 'black' : 'none' })}
                  className="h-3.5 w-3.5 accent-gray-800"
                />
                Black Accessory <span className="text-gray-400">+₹1,000/unit</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.accessory === 'steel'}
                  onChange={e => onUpdate(item.id, { accessory: e.target.checked ? 'steel' : 'none' })}
                  className="h-3.5 w-3.5 accent-gray-800"
                />
                Steel Accessory <span className="text-gray-400">+₹1,500/unit</span>
              </label>
            </div>
          </td>
        </>
      )}
      <td className="py-2 px-2 w-24">
        <input
          type="number"
          min={0}
          max={stockEnforced && !isAccessoryRow && maxQty != null ? maxQty : undefined}
          disabled={qtyDisabled}
          // Qty may be left blank — 0 shows as an empty field rather than forcing 1.
          value={item.qty || ''}
          onChange={e => handleQtyChange(Number(e.target.value))}
          // Blur on wheel so scrolling over a focused field never changes the qty.
          onWheel={e => e.currentTarget.blur()}
          placeholder={qtyDisabled ? '—' : ''}
          title={qtyDisabled ? 'Select a model first' : undefined}
          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-red-600 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0"
        />
        {stockEnforced && !isAccessoryRow && item.productId != null && available != null && (
          <span className={`block text-[10px] mt-0.5 text-center ${available === 0 ? 'text-red-500' : 'text-gray-400'}`}>
            {available === 0 ? 'out of stock' : `avail: ${available}`}
          </span>
        )}
      </td>
      <td className="py-2 px-2 text-right text-sm text-gray-700 w-28 whitespace-nowrap">
        {item.displayRate > 0 ? formatINR(item.displayRate) : '—'}
      </td>
      <td className="py-2 px-2 text-right text-sm text-gray-700 w-28 whitespace-nowrap">
        {item.displayRateWithGst > 0 ? formatINR(item.displayRateWithGst) : '—'}
      </td>
      <td className="py-2 px-2 text-right text-sm font-medium text-gray-800 w-28 whitespace-nowrap">
        {item.totalAmount > 0 ? formatINR(item.totalAmount) : '—'}
        {item.accessoryCharge > 0 && (
          <span className="block text-[10px] text-gray-400 font-normal">
            incl. {formatINR(item.accessoryCharge)} accessory
          </span>
        )}
      </td>
      <td className="py-2 px-2 w-8 text-center">
        <button
          onClick={() => onRemove(item.id)}
          className="text-red-400 hover:text-red-600 transition-colors text-lg leading-none"
          title="Remove item"
        >
          ×
        </button>
      </td>
    </tr>
  );
}
