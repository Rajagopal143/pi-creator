'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import InvoicePreview from '@/app/(protected)/create-pi/InvoicePreview';
import type { InvoicePreviewProps } from '@/app/(protected)/create-pi/InvoicePreview';
import { PI_STATUSES } from '@/lib/invoiceStatus';
import type { SavedInvoice } from '@/lib/invoiceModel';
import type { ManufacturingUnit } from '@/lib/csvData';
import { Button } from '@/components/ui/button';

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
    insuranceEnabled:  inv.insuranceEnabled !== false,
    total:             inv.total,
  };
}

function statusBadgeClass(status: SavedInvoice['status']): string {
  switch (status?.toLowerCase()) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-700';
    case 'advance payment done':
    case 'full payment done':
    case 'full payment verified':
      return 'bg-indigo-100 text-indigo-700';
    case 'production':
      return 'bg-amber-100 text-amber-700';
    case 'dispatched':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
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

const DEFAULT_LIMIT = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

interface InvoiceListProps {
  manufacturingUnits: ManufacturingUnit[];
}

export default function InvoiceList({ manufacturingUnits }: InvoiceListProps) {
  const [invoices, setInvoices]       = useState<SavedInvoice[]>([]);
  const [meta, setMeta]               = useState({ total: 0, page: 1, totalPages: 1, limit: DEFAULT_LIMIT });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const [search, setSearch]           = useState('');
  const [taxTypeFilter, setTaxType]   = useState('');
  const [manufacturingUnitId, setManufacturingUnitId] = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [page, setPage]               = useState(1);
  const [limit, setLimit]             = useState<number>(DEFAULT_LIMIT);

  const [viewInvoice, setViewInvoice] = useState<SavedInvoice | null>(null);
  const [statusInvoice, setStatusInvoice] = useState<SavedInvoice | null>(null);
  const [statusValue, setStatusValue] = useState<string>(PI_STATUSES[0]);
  const [statusDescription, setStatusDescription] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search)        params.set('search', search);
      if (taxTypeFilter) params.set('taxType', taxTypeFilter);
      if (manufacturingUnitId) params.set('manufacturingUnitId', manufacturingUnitId);
      if (startDate)     params.set('startDate', startDate);
      if (endDate)       params.set('endDate', endDate);

      const res  = await fetch(`/api/invoices?${params.toString()}`);
      const json = await res.json() as ApiResponse;
      if (!json.success) throw new Error('Failed to load invoices');
      setInvoices(json.data);
      setMeta({
        total: json.meta.total,
        page: json.meta.page,
        totalPages: json.meta.totalPages,
        limit: json.meta.limit,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, taxTypeFilter, manufacturingUnitId, startDate, endDate]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleSearch = useCallback(() => { setPage(1); fetchInvoices(); }, [fetchInvoices]);

  const clearFilters = () => {
    setSearch('');
    setTaxType('');
    setManufacturingUnitId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasActiveFilters =
    !!search || !!taxTypeFilter || !!manufacturingUnitId || !!startDate || !!endDate;

  const openStatusEditor = (invoice: SavedInvoice) => {
    setStatusInvoice(invoice);
    setStatusValue(invoice.status || PI_STATUSES[0]);
    setStatusDescription(invoice.statusDescription || '');
  };

  const handleUpdateStatus = async () => {
    if (!statusInvoice?._id) return;
    setUpdatingStatus(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${String(statusInvoice._id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusValue, description: statusDescription }),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message || 'Failed to update status');
      setStatusInvoice(null);
      await fetchInvoices();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="min-h-0 bg-zinc-100 print:hidden">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {meta.total} invoice{meta.total !== 1 ? 's' : ''} total
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Rows</label>
            <select
              value={limit}
              onChange={e => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border border-zinc-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
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

            {/* Manufacturing unit */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Manufacturing Unit</label>
              <select
                value={manufacturingUnitId}
                onChange={e => { setManufacturingUnitId(e.target.value); setPage(1); }}
                className="min-w-[200px] max-w-[280px] border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <option value="">All units</option>
                {manufacturingUnits.map(mu => (
                  <option key={mu.id} value={String(mu.id)}>
                    {mu.unitName} ({mu.state})
                  </option>
                ))}
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
            <Button type="button" onClick={handleSearch} className="bg-primary">
              Search
            </Button>
            {hasActiveFilters && (
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear
              </Button>
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
                  {['Invoice #', 'Date', 'Dealer', 'MFG Unit', 'Status', 'Items', 'Total', 'Saved On', 'Actions'].map(h => (
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
                      {Array.from({ length: 10 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: j === 0 ? '80%' : '60%' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <div className="text-gray-400 text-sm">
                        {hasActiveFilters
                          ? 'No invoices match your filters.'
                          : 'No invoices saved yet. Create your first invoice!'}
                      </div>
                      {!hasActiveFilters && (
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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusBadgeClass(inv.status)}`}>
                          {inv.status || PI_STATUSES[0]}
                        </span>
                        <div className="text-[10px] text-gray-400 mt-1 truncate max-w-[200px]">
                          {inv.statusDescription}
                        </div>
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
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setViewInvoice(inv)}
                            className="text-xs text-red-700 hover:text-red-800 font-medium border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
                          >
                            View
                          </button>
                          <Link
                            href={`/create-pi?invoiceId=${String(inv._id || '')}`}
                            className="text-xs text-blue-700 hover:text-blue-800 font-medium border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap"
                          >
                            Edit PI
                          </Link>
                          <button
                            onClick={() => openStatusEditor(inv)}
                            className="text-xs text-amber-700 hover:text-amber-800 font-medium border border-amber-200 px-3 py-1 rounded-lg hover:bg-amber-50 transition-colors whitespace-nowrap"
                          >
                            Update Status
                          </button>
                        </div>
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
                {meta.total === 0
                  ? '0 results'
                  : `${(meta.page - 1) * meta.limit + 1}-${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`}
                &nbsp;·&nbsp; Page {meta.page} of {meta.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  className="border border-gray-300 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  « First
                </button>
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
                <button
                  onClick={() => setPage(meta.totalPages)}
                  disabled={page >= meta.totalPages}
                  className="border border-gray-300 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Last »
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View Modal */}
      <ViewModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />
      {statusInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
          <div className="bg-white w-full max-w-md rounded-xl border border-gray-200 shadow-2xl p-5">
            <h3 className="text-base font-semibold text-gray-900">Update PI Status</h3>
            <p className="text-xs text-gray-500 mt-1">{statusInvoice.invoiceNumber}</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={statusValue}
                  onChange={e => setStatusValue(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  {PI_STATUSES.map(status => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <textarea
                  value={statusDescription}
                  onChange={e => setStatusDescription(e.target.value)}
                  rows={3}
                  placeholder="Reason or notes for this status update"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStatusInvoice(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleUpdateStatus} disabled={updatingStatus}>
                {updatingStatus ? 'Updating…' : 'Update'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
