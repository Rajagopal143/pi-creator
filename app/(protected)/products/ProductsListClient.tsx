'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ProductDTO } from '@/lib/products/productModel';

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
          <input
            type="text"
            placeholder="Search by name or HSN…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-64 max-w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
          />
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
                          <Link
                            href={`/products/${p.id}/edit`}
                            className="text-xs text-red-700 hover:text-red-800 font-medium border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
                          >
                            Edit
                          </Link>
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
