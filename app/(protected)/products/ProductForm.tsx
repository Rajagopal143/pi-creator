'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { ProductDTO, ProductVariantSub, DealerTierKey } from '@/lib/products/productModel';
import { createProductAction, updateProductAction } from '@/lib/products/server-actions';
import { initialProductFormState } from '@/lib/products/formState';

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Dealer tiers in display order, with labels matching the PI creator. */
const TIERS: { key: DealerTierKey; label: string }[] = [
  { key: 'distributor', label: 'Distributor' },
  { key: 'divisionaldistributor', label: 'Divisional Distributor' },
  { key: 'districtdealer', label: 'District Dealer' },
  { key: 'areadealer', label: 'Area Dealer' },
];

const numberInputClass =
  'w-full border border-zinc-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 ' +
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
const textInputClass =
  'w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600';

const zeroTiers = () => ({ areadealer: 0, districtdealer: 0, distributor: 0, divisionaldistributor: 0 });

const emptyVariant = (): ProductVariantSub => ({
  key: '',
  label: '',
  prices: zeroTiers(),
  newPrices: zeroTiers(),
});

/** Ensures a loaded variant always has a `newPrices` object to edit. */
const withNewPrices = (v: ProductVariantSub): ProductVariantSub => ({
  ...v,
  newPrices: v.newPrices ?? zeroTiers(),
});

// ─── Component ──────────────────────────────────────────────────────────────────

/** Shared add/edit product form. `mode` picks the server action + copy. */
export default function ProductForm({
  mode,
  product,
}: {
  mode: 'create' | 'edit';
  product?: ProductDTO;
}) {
  const action = mode === 'edit' ? updateProductAction : createProductAction;
  const [state, formAction, pending] = useActionState(action, initialProductFormState);

  const [variants, setVariants] = useState<ProductVariantSub[]>(
    product?.variants.length ? product.variants.map(withNewPrices) : [emptyVariant()],
  );

  // A successful save redirects away; any returned message is an error.
  useEffect(() => {
    if (state.message) toast.error(state.message);
  }, [state]);

  const patchVariant = (idx: number, patch: Partial<ProductVariantSub>) =>
    setVariants(vs => vs.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

  const patchPrice = (idx: number, tier: DealerTierKey, value: number) =>
    setVariants(vs =>
      vs.map((v, i) =>
        i === idx ? { ...v, prices: { ...v.prices, [tier]: value } } : v,
      ),
    );

  const patchNewPrice = (idx: number, tier: DealerTierKey, value: number) =>
    setVariants(vs =>
      vs.map((v, i) =>
        i === idx
          ? { ...v, newPrices: { ...(v.newPrices ?? zeroTiers()), [tier]: value } }
          : v,
      ),
    );

  return (
    <div className="min-h-screen bg-zinc-100">
      <form action={formAction} className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {mode === 'edit' && product && <input type="hidden" name="id" value={product.id} />}
        {/* Variants are edited as client state and submitted as one JSON field. */}
        <input type="hidden" name="variantsJson" value={JSON.stringify(variants)} />

        {/* Heading */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {mode === 'create' ? 'Add Product' : product?.name}
            </h1>
            <p className="text-xs text-gray-500">
              {mode === 'create'
                ? 'A new model for the catalog'
                : `Product #${product?.code}`}
            </p>
          </div>
          <Link href="/products" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to products
          </Link>
        </div>

        {/* Product details */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            Product Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Product Name</label>
              <input
                name="name"
                defaultValue={product?.name ?? ''}
                required
                placeholder="e.g. RUBIE"
                className={textInputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">HSN Number</label>
              <input
                name="hsn"
                defaultValue={product?.hsn ?? '87116020'}
                required
                placeholder="e.g. 87116020"
                className={`${textInputClass} font-mono`}
              />
            </div>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">CGST %</label>
                <input
                  type="number"
                  name="cgst"
                  min={0}
                  step="0.01"
                  defaultValue={product?.cgst ?? 2.5}
                  className={numberInputClass}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">SGST %</label>
                <input
                  type="number"
                  name="sgst"
                  min={0}
                  step="0.01"
                  defaultValue={product?.sgst ?? 2.5}
                  className={numberInputClass}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 sm:col-span-2">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={product?.isActive ?? true}
                className="h-4 w-4 accent-red-700"
              />
              Active — shown in the PI creator
            </label>
          </div>
          <p className="mt-3 text-[11px] text-gray-400">
            Variant prices below are <strong>GST-inclusive</strong>. Total GST ={' '}
            CGST + SGST. A price of 0 marks the variant N/A for that dealer tier.
            Each variant has an <strong>Old</strong> and a <strong>New</strong> price list —
            the PI creator picks between them with the Old/New toggle.
          </p>
        </div>

        {/* Variants */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            Variants &amp; Pricing
          </h2>
          <div className="space-y-4">
            {variants.map((v, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <input
                    type="text"
                    value={v.label}
                    onChange={e => patchVariant(idx, { label: e.target.value })}
                    placeholder="Variant label (e.g. 60V)"
                    className="flex-1 border border-zinc-300 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                  <button
                    type="button"
                    onClick={() => setVariants(vs => vs.filter((_, i) => i !== idx))}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Remove
                  </button>
                </div>
                {/* Old price list (GST-inclusive). */}
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-gray-500 font-bold">
                  Old Price <span className="text-gray-400 font-medium normal-case">(₹, incl. GST)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {TIERS.map(tier => (
                    <div key={tier.key}>
                      <label className="block text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1">
                        {tier.label}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={v.prices[tier.key] || ''}
                        onChange={e => patchPrice(idx, tier.key, Number(e.target.value) || 0)}
                        placeholder="0"
                        className={numberInputClass}
                      />
                    </div>
                  ))}
                </div>

                {/* New price list (GST-inclusive) — May 2026 onward. */}
                <div className="mt-4 mb-1.5 text-[10px] uppercase tracking-wide text-red-600 font-bold">
                  New Price <span className="text-gray-400 font-medium normal-case">(₹, incl. GST)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {TIERS.map(tier => (
                    <div key={tier.key}>
                      <label className="block text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1">
                        {tier.label}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={v.newPrices?.[tier.key] || ''}
                        onChange={e => patchNewPrice(idx, tier.key, Number(e.target.value) || 0)}
                        placeholder="0"
                        className={numberInputClass}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setVariants(vs => [...vs, emptyVariant()])}
            className="mt-3 flex items-center gap-1.5 text-sm text-red-700 hover:text-red-800 font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Variant
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <Link
            href="/products"
            className="text-sm text-gray-600 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="bg-red-700 text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? 'Saving…' : mode === 'create' ? 'Create Product' : 'Save Product'}
          </button>
        </div>
      </form>
    </div>
  );
}
