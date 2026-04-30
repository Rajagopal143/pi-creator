'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import InvoicePreview from '@/app/create-pi/InvoicePreview';
import type { InvoicePreviewProps } from '@/app/create-pi/InvoicePreview';
import type { SavedInvoice } from '@/lib/invoiceModel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiResponse {
  success: boolean;
  data: SavedInvoice[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTime(ts: string | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function invoiceToPreviewProps(inv: SavedInvoice): InvoicePreviewProps {
  return {
    invoiceNumber:     inv.invoiceNumber,
    invoiceDate:       inv.invoiceDate,
    dueDate:           inv.dueDate,
    manufacturingUnit: inv.manufacturingUnit,
    dealer:            inv.dealer as InvoicePreviewProps['dealer'],
    items:             (inv.lineItems ?? []) as InvoicePreviewProps['items'],
    taxType:           inv.taxType,
    subTotal:          inv.subTotal,
    discount:          inv.discount,
    totalSGST:         inv.totalSGST,
    totalCGST:         inv.totalCGST,
    totalIGST:         inv.totalIGST,
    totalGST:          inv.totalGST,
    insurance:         inv.insurance,
    total:             inv.total,
  };
}

// ─── View Modal ───────────────────────────────────────────────────────────────

function ViewModal({
  invoice,
  onClose,
}: {
  invoice: SavedInvoice | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!invoice) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [invoice, onClose]);

  if (!invoice) return null;

  const handlePrint = () => {
    onClose();
    setTimeout(() => window.print(), 100);
  };

  return (
    <>
      {/* Print-only area */}
      <div className="hidden print:block">
        <InvoicePreview {...invoiceToPreviewProps(invoice)} />
      </div>

      <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4 print:hidden">
        <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-xl">
            <div>
              <h2 className="text-base font-bold text-gray-900">Invoice</h2>
              <p className="text-xs text-gray-500 mt-0.5">{invoice.invoiceNumber}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 text-sm text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="p-5">
            <InvoicePreview {...invoiceToPreviewProps(invoice)} />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const LIMIT = 20;

export default function InvoiceList() {
  const router = useRouter();
  const [invoices, setInvoices]       = useState<SavedInvoice[]>([]);
  const [meta, setMeta]               = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const [search, setSearch]           = useState('');
  const [taxTypeFilter, setTaxType]   = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [page, setPage]               = useState(1);

  const [viewInvoice, setViewInvoice] = useState<SavedInvoice | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(LIMIT));
      if (search)        params.set('search', search);
      if (taxTypeFilter) params.set('taxType', taxTypeFilter);
      if (startDate)     params.set('startDate', startDate);
      if (endDate)       params.set('endDate', endDate);

      const res  = await fetch(`/api/invoices?${params.toString()}`);
      const json = await res.json() as ApiResponse;
      if (!json.success) throw new Error('Failed to load invoices');
      setInvoices(json.data);
      setMeta({ total: json.meta.total, page: json.meta.page, totalPages: json.meta.totalPages });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, search, taxTypeFilter, startDate, endDate]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleSearch = useCallback(() => { setPage(1); fetchInvoices(); }, [fetchInvoices]);

  const clearFilters = () => {
    setSearch('');
    setTaxType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-zinc-100 print:hidden">
      {/* Top Bar */}
      <div className="bg-zinc-900 text-white border-b border-red-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-base font-bold text-white">Yakuza DMS</h1>
            <nav className="flex items-center gap-1">
              <Link
                href="/create-pi"
                className="text-sm px-3 py-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
              >
                Create Invoice
              </Link>
              <Link
                href="/invoices"
                className="text-sm px-3 py-1.5 rounded-md bg-red-700 text-white font-medium"
              >
                All Invoices
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">{meta.total} invoice{meta.total !== 1 ? 's' : ''} total</span>
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.replace('/login');
              }}
              className="text-zinc-400 hover:text-white text-xs px-3 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Search & Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
              <input
                type="text"
                placeholder="Invoice #, dealer name, unit…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            {/* Tax Type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tax Type</label>
              <select
                value={taxTypeFilter}
                onChange={e => { setTaxType(e.target.value); setPage(1); }}
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <option value="">All</option>
                <option value="within_state">Within State</option>
                <option value="other_state">Other State</option>
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setPage(1); }}
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setPage(1); }}
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            {/* Buttons */}
            <button
              onClick={handleSearch}
              className="bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
            >
              Search
            </button>
            {(search || taxTypeFilter || startDate || endDate) && (
              <button
                onClick={clearFilters}
                className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {error && (
            <div className="px-5 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">{error}</div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  {['Invoice #', 'Date', 'Dealer', 'MFG Unit', 'Tax Type', 'Items', 'Total', 'Saved On', 'Actions'].map(h => (
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
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: j === 0 ? '80%' : '60%' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <div className="text-gray-400 text-sm">
                        {search || taxTypeFilter || startDate || endDate
                          ? 'No invoices match your filters.'
                          : 'No invoices saved yet. Create your first invoice!'}
                      </div>
                      {!search && !taxTypeFilter && !startDate && !endDate && (
                        <Link
                          href="/create-pi"
                          className="mt-3 inline-block text-sm text-red-700 hover:text-red-800 font-medium"
                        >
                          → Create Invoice
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  invoices.map(inv => (
                    <tr key={String(inv._id)} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono font-medium text-gray-900 whitespace-nowrap">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {formatDate(inv.invoiceDate)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-900">
                        <div className="font-medium">{inv.dealer?.orgName || '—'}</div>
                        <div className="text-gray-400 text-[10px]">{inv.dealer?.dealerId}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        <div>{inv.manufacturingUnit?.unitName || '—'}</div>
                        <div className="text-gray-400 text-[10px]">{inv.manufacturingUnit?.state}</div>
                      </td>
                      <td className="px-4 py-3">
                        {inv.taxType === 'other_state' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                            Other · IGST
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                            Within · SGST+CGST
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 text-center">
                        {inv.lineItems?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-900 whitespace-nowrap">
                        {formatINR(inv.total)}
                      </td>
                      <td className="px-4 py-3 text-[10px] text-gray-400 whitespace-nowrap">
                        {formatDateTime(inv.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setViewInvoice(inv)}
                          className="text-xs text-red-700 hover:text-red-800 font-medium border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
                        >
                          View / Print
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-xs text-gray-500">
                Page {meta.page} of {meta.totalPages} &nbsp;·&nbsp; {meta.total} results
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="border border-gray-300 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(meta.totalPages - 4, page - 2)) + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                        p === page
                          ? 'bg-red-700 text-white font-medium'
                          : 'border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                  className="border border-gray-300 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View Modal */}
      <ViewModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />
    </div>
  );
}
