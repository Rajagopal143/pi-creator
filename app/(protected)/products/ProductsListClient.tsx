'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ProductDTO } from '@/lib/products/productModel';
import { deleteProductAction, syncNewPricesAction } from '@/lib/products/server-actions';

/** Lowest non-zero district-dealer price across a product's variants. */
function priceFrom(product: ProductDTO): number {
  const prices = product.variants
    .map(v => v.prices.districtdealer)
    .filter(p => p > 0);
  return prices.length ? Math.min(...prices) : 0;
}

function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProductsListClient({ products }: { products: ProductDTO[] }) {
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = (p: ProductDTO) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    setBusyId(p.id);
    startTransition(async () => {
      const res = await deleteProductAction(p.id);
      setBusyId(null);
      if (!res.ok) {
        alert(res.message || 'Failed to delete product.');
        return;
      }
      router.refresh();
    });
  };

  const handleSync = () => {
    if (!confirm('Sync new prices from JSON into the database? Listed products will have their new-price tiers overwritten.')) return;
    setSyncMsg(null);
    startTransition(async () => {
      const res = await syncNewPricesAction();
      setSyncMsg(`Updated ${res.updated} • Created ${res.created}`);
      router.refresh();
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      p => p.name.toLowerCase().includes(q) || p.hsn.toLowerCase().includes(q),
    );
  }, [products, search]);

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {products.length} product{products.length !== 1 ? 's' : ''} in catalog
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search by name or HSN…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64 max-w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
            />
            <button
              type="button"
              onClick={handleSync}
              disabled={pending}
              className="inline-flex items-center gap-1.5 border border-zinc-300 bg-white text-zinc-800 text-sm font-medium px-3 py-2 rounded-lg hover:bg-zinc-50 disabled:opacity-50 whitespace-nowrap"
              title="Overwrite new-price tiers in the DB from productPricingNew.json"
            >
              {pending ? 'Syncing…' : 'Sync New Prices'}
            </button>
            {syncMsg && <span className="text-xs text-emerald-700">{syncMsg}</span>}
            <Link
              href="/products/new"
              className="inline-flex items-center gap-1.5 bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-600 transition-colors whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Product
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  {['#', 'Product', 'HSN', 'GST %', 'Variants', 'From Price', 'Status', ''].map(h => (
                    <th
                      key={h}
                      className="text-[10px] uppercase text-gray-500 font-semibold text-left px-4 py-3 tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                      No products match your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map(p => {
                    const from = priceFrom(p);
                    return (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-400">{p.code}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-700">{p.hsn || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-700">{p.cgst + p.sgst}%</td>
                        <td className="px-4 py-3 text-xs text-gray-700 text-center">{p.variants.length}</td>
                        <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                          {from > 0 ? formatINR(from) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              p.isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {p.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/products/${p.id}/edit`}
                              className="text-xs text-red-700 hover:text-red-800 font-medium border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
                            >
                              Edit
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(p)}
                              disabled={busyId === p.id}
                              className="text-xs text-zinc-700 hover:text-red-700 font-medium border border-zinc-200 px-3 py-1 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors whitespace-nowrap disabled:opacity-50"
                            >
                              {busyId === p.id ? '…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
