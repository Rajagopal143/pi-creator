'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Download, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import InvoicePreview from '@/app/(protected)/create-pi/InvoicePreview';
import type { InvoicePreviewProps } from '@/app/(protected)/create-pi/InvoicePreview';
import { PI_STATUSES } from '@/lib/invoiceStatus';
import type { SavedInvoice } from '@/lib/invoiceModel';
import type { ManufacturingUnit } from '@/lib/csvData';
import { Button } from '@/components/ui/button';
import { InvoiceFiltersDrawer } from './InvoiceFiltersDrawer';
import {
  InvoiceFilterControls,
  EMPTY_FILTERS,
  type InvoiceFilters,
} from './InvoiceFilterControls';
import { downloadInvoicesExcel } from './invoiceExport';
import { PaymentModal } from './PaymentModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiResponse {
  success: boolean;
  data: SavedInvoice[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    /** Total qty across every invoice matching the filter (all pages). */
    totalQty?: number;
  };
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
    shipToDealer:      (inv.shipToDealer ?? null) as InvoicePreviewProps['shipToDealer'],
    items:             (inv.lineItems ?? []) as InvoicePreviewProps['items'],
    taxType:           inv.taxType,
    subTotal:          inv.subTotal,
    discount:          inv.discount,
    totalSGST:         inv.totalSGST,
    totalCGST:         inv.totalCGST,
    totalIGST:         inv.totalIGST,
    totalGST:          inv.totalGST,
    totalAccessory:    inv.totalAccessory,
    insurance:         inv.insurance,
    insuranceEnabled:  inv.insuranceEnabled !== false,
    roundOff:          inv.roundOff ?? 0,
    total:             inv.total,
  };
}

function statusBadgeClass(status: SavedInvoice['status']): string {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    case 'dispatched':
      return 'bg-green-100 text-green-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    case 'deleted':
      return 'bg-zinc-200 text-zinc-600 line-through';
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
  const [meta, setMeta]               = useState({ total: 0, page: 1, totalPages: 1, limit: DEFAULT_LIMIT, totalQty: 0 });
  const [loading, setLoading]         = useState(true);
  const [paymentInvoice, setPaymentInvoice] = useState<SavedInvoice | null>(null);

  const [search, setSearch]           = useState('');
  const [filters, setFilters]         = useState<InvoiceFilters>(EMPTY_FILTERS);
  const [page, setPage]               = useState(1);
  const [limit, setLimit]             = useState<number>(DEFAULT_LIMIT);
  const [exporting, setExporting]     = useState(false);

  // Whether the URL → state hydration on mount has run; gates fetching and the
  // state → URL mirror so we don't overwrite the incoming query string.
  const [initialized, setInitialized] = useState(false);

  const [viewInvoice, setViewInvoice] = useState<SavedInvoice | null>(null);
  const [statusInvoice, setStatusInvoice] = useState<SavedInvoice | null>(null);
  const [statusValue, setStatusValue] = useState<string>(PI_STATUSES[0]);
  const [statusDescription, setStatusDescription] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [dispatchDateInvoice, setDispatchDateInvoice] = useState<SavedInvoice | null>(null);
  const [dispatchDateValue, setDispatchDateValue] = useState('');
  const [savingDispatchDate, setSavingDispatchDate] = useState(false);

  // Builds the shared query string for both the list fetch and the export.
  const buildParams = useCallback((extra?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (search)                    params.set('search', search);
    if (filters.taxType)           params.set('taxType', filters.taxType);
    if (filters.status)            params.set('status', filters.status);
    if (filters.manufacturingUnitId) params.set('manufacturingUnitId', filters.manufacturingUnitId);
    if (filters.startDate)         params.set('startDate', filters.startDate);
    if (filters.endDate)           params.set('endDate', filters.endDate);
    Object.entries(extra ?? {}).forEach(([k, v]) => params.set(k, v));
    return params;
  }, [search, filters]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams({ page: String(page), limit: String(limit) });
      const res  = await fetch(`/api/invoices?${params.toString()}`);
      const json = await res.json() as ApiResponse;
      if (!json.success) throw new Error('Failed to load invoices');
      setInvoices(json.data);
      setMeta({
        total: json.meta.total,
        page: json.meta.page,
        totalPages: json.meta.totalPages,
        limit: json.meta.limit,
        totalQty: json.meta.totalQty ?? 0,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [buildParams, page, limit]);

  // ── URL ⇄ state sync ──────────────────────────────────────────────────────
  // Hydrate filter/search/page state from the URL once on mount.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setSearch(sp.get('search') ?? '');
    setFilters({
      taxType:             sp.get('taxType') ?? '',
      status:              sp.get('status') ?? '',
      manufacturingUnitId: sp.get('manufacturingUnitId') ?? '',
      startDate:           sp.get('startDate') ?? '',
      endDate:             sp.get('endDate') ?? '',
    });
    const p = Number(sp.get('page'));
    if (p >= 1) setPage(p);
    const l = Number(sp.get('limit'));
    if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(l)) setLimit(l);
    setInitialized(true);
  }, []);

  // Mirror the current filter/search/page state back into the URL.
  useEffect(() => {
    if (!initialized) return;
    const qs = buildParams({ page: String(page), limit: String(limit) }).toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [initialized, buildParams, page, limit]);

  useEffect(() => { if (initialized) fetchInvoices(); }, [fetchInvoices, initialized]);

  // Exports every invoice matching the current filters (not just this page).
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res  = await fetch(`/api/invoices?${buildParams({ export: 'true' }).toString()}`);
      const json = await res.json() as ApiResponse;
      if (!json.success) throw new Error('Failed to export invoices');
      if (json.data.length === 0) {
        toast.warning('No invoices match the current filters to export.');
        return;
      }
      downloadInvoicesExcel(json.data);
      toast.success(`Exported ${json.data.length} invoice${json.data.length !== 1 ? 's' : ''}.`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to export invoices');
    } finally {
      setExporting(false);
    }
  }, [buildParams]);

  // Filter changes always reset to the first page.
  const updateFilters = useCallback((patch: Partial<InvoiceFilters>) => {
    setFilters(f => ({ ...f, ...patch }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }, []);

  const activeFilterCount =
    [filters.taxType, filters.status, filters.manufacturingUnitId, filters.startDate, filters.endDate]
      .filter(Boolean).length;
  const hasActiveFilters = !!search || activeFilterCount > 0;

  const openStatusEditor = (invoice: SavedInvoice) => {
    setStatusInvoice(invoice);
    setStatusValue(invoice.status || PI_STATUSES[0]);
    setStatusDescription(invoice.statusDescription || '');
  };

  const openDispatchDateModal = (inv: SavedInvoice) => {
    setDispatchDateInvoice(inv);
    setDispatchDateValue(inv.dispatchDate || '');
  };

  const handleSaveDispatchDate = async () => {
    if (!dispatchDateInvoice?._id) return;
    setSavingDispatchDate(true);
    try {
      const res = await fetch(`/api/invoices/${String(dispatchDateInvoice._id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatchDate: dispatchDateValue }),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message || 'Failed to save dispatch date');
      toast.success('Dispatch date saved.');
      setDispatchDateInvoice(null);
      await fetchInvoices();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save dispatch date');
    } finally {
      setSavingDispatchDate(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!statusInvoice?._id) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/invoices/${String(statusInvoice._id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusValue, description: statusDescription }),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message || 'Failed to update status');
      toast.success('Status updated.');
      setStatusInvoice(null);
      await fetchInvoices();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="min-h-0 bg-zinc-100 print:hidden">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-muted-foreground">
              {meta.total} invoice{meta.total !== 1 ? 's' : ''} total
            </p>
            {/* Total Qty across every invoice matching the active filter — server-aggregated. */}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-100 px-2.5 py-1 text-[11px] font-medium text-red-700">
              Total Qty
              <span className="font-bold text-red-800">
                {meta.totalQty.toLocaleString('en-IN')}
              </span>
            </span>
          </div>
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
        {/* Search, Filters & Export */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search invoice #, dealer, unit…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="min-w-[180px] flex-1 md:flex-none md:w-64 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
            />

            {/* Desktop — filters shown inline next to the search */}
            <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
              <InvoiceFilterControls
                manufacturingUnits={manufacturingUnits}
                filters={filters}
                onChange={updateFilters}
                variant="bar"
              />
              {activeFilterCount > 0 && (
                <Button type="button" variant="ghost" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>

            {/* Mobile — filters collapse into a drawer */}
            <div className="md:hidden">
              <InvoiceFiltersDrawer
                manufacturingUnits={manufacturingUnits}
                filters={filters}
                onChange={updateFilters}
                onClear={clearFilters}
                activeCount={activeFilterCount}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className="ml-auto gap-2 md:ml-0"
              onClick={handleExport}
              disabled={exporting}
            >
              <Download className="size-4" />
              {exporting ? 'Exporting…' : 'Export Excel'}
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  {['Invoice #', 'Date', 'Bill To', 'Ship To', 'MFG Unit', 'Status', 'Items', 'Qty', 'Total',  'Actions'].map(h => (
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
                      {Array.from({ length: 11 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: j === 0 ? '80%' : '60%' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center">
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
                        {inv.tokenLabel && (
                          <div className="mt-0.5 inline-block rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                            {inv.tokenLabel}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {formatDate(inv.invoiceDate)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-900">
                        <div className="font-medium">{inv.dealer?.orgName || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-900">
                        <div className="font-medium">
                          {inv.shipToDealer?.orgName || inv.dealer?.orgName || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        <div className="text-gray-400 text-[10px]">{inv.manufacturingUnit?.state}</div>
                      </td>
                     
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusBadgeClass(inv.status)}`}>
                          {inv.status || PI_STATUSES[0]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 text-center">
                        {inv.lineItems?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-900 text-center font-semibold">
                        {(inv.lineItems ?? []).reduce((s, li) => s + (li.qty || 0), 0)}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-900 whitespace-nowrap">
                        {formatINR(inv.total)}
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="Invoice actions"
                              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <MoreVertical className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewInvoice(inv)}>
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/create-pi?invoiceId=${String(inv._id || '')}`}>
                                Edit PI
                              </Link>
                            </DropdownMenuItem>
                            {!inv.firstPayment && (
                              <DropdownMenuItem onClick={() => setPaymentInvoice(inv)}>
                                Record First Payment
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openDispatchDateModal(inv)}>
                              Set Dispatch Date
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openStatusEditor(inv)}>
                              Update Status
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-xs text-gray-500">
                {meta.total === 0
                  ? '0 results'
                  : `${(meta.page - 1) * meta.limit + 1}-${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`}
                &nbsp;·&nbsp; Page {meta.page} of {meta.totalPages}
              </span>
              <div className="flex flex-wrap items-center gap-2">
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

      {/* Dispatch date modal */}
      {dispatchDateInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
          <div className="bg-white w-full max-w-sm rounded-xl border border-gray-200 shadow-2xl p-5">
            <h3 className="text-base font-semibold text-gray-900">Set Dispatch Date</h3>
            <p className="text-xs text-gray-500 mt-1">{dispatchDateInvoice.invoiceNumber}</p>
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Dispatch Date</label>
              <input
                type="date"
                value={dispatchDateValue}
                onChange={e => setDispatchDateValue(e.target.value)}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
            {dispatchDateValue && (
              <p className="text-xs text-gray-400 mt-1">
                Currently: {dispatchDateInvoice.dispatchDate ? formatDate(dispatchDateInvoice.dispatchDate) : 'not set'}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDispatchDateInvoice(null)}>
                Cancel
              </Button>
              {dispatchDateInvoice.dispatchDate && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setDispatchDateValue(''); }}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  Clear Date
                </Button>
              )}
              <Button type="button" onClick={handleSaveDispatchDate} disabled={savingDispatchDate}>
                {savingDispatchDate ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* First-payment modal */}
      <PaymentModal
        invoice={paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        onRecorded={fetchInvoices}
      />

    </div>
  );
}
