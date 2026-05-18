'use client';

import { useMemo } from 'react';
import type { Product, ProductVariant } from '@/lib/csvData';
import type { ComputedLineItem, LineItemState, PriceTier } from '../types';
import { getVariantPrice, formatINR } from '../utils';
import { ProductSelect } from './ProductSelect';

/** A single editable row in the line-items table. */
export function LineItemRow({
  item, index, products, variants, priceTier, onUpdate, onRemove,
}: {
  item: ComputedLineItem;
  index: number;
  products: Product[];
  variants: ProductVariant[];
  priceTier: PriceTier;
  onUpdate: (id: string, updates: Partial<LineItemState>) => void;
  onRemove: (id: string) => void;
}) {
  // Only variants priced for the selected tier are offered — N/A configs (price 0) are hidden.
  const productVariants = useMemo(
    () => variants.filter(v => v.productId === item.productId && getVariantPrice(v, priceTier) > 0),
    [variants, item.productId, priceTier],
  );

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-2 px-2 text-center text-gray-500 text-sm w-8">{index + 1}</td>
      <td className="py-2 px-2 min-w-[180px]">
        <ProductSelect
          products={products}
          value={item.productId}
          onChange={id => onUpdate(item.id, { productId: id })}
        />
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
      <td className="py-2 px-2 w-20">
        <input
          type="number"
          min={1}
          value={item.qty}
          onChange={e => onUpdate(item.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-red-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0"
        />
      </td>
      <td className="py-2 px-2 text-right text-sm text-gray-700 w-28 whitespace-nowrap">
        {item.rateWithGst > 0 ? formatINR(item.rateWithGst) : '—'}
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
