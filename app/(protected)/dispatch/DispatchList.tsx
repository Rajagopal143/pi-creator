'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';

import type { ManufacturingUnit } from '@/lib/csvData';
import type { SavedInvoice } from '@/lib/invoiceModel';
import { Button } from '@/components/ui/button';
import { downloadInvoicesExcel } from '@/app/(protected)/invoices/invoiceExport';
import { InvoiceRowActions } from '@/app/(protected)/invoices/InvoiceRowActions';

interface ApiResponse {
  success: boolean;
  data: SavedInvoice[];
  meta: { total: number; page: number; limit: number; totalPages: number; totalQty?: number };
}

function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type DateMode = 'all' | 'today' | 'custom';

const DEFAULT_LIMIT = 100;

/**
 * Dispatch queue.
 * - "All" mode: token-issued invoices still pending dispatch (original queue).
 * - "Today" / "Custom" mode: any invoice with dispatchDate matching the selected range.
 */
export default function DispatchList({ manufacturingUnits }: { manufacturingUnits: ManufacturingUnit[] }) {
  const [invoices, setInvoices] = useState<SavedInvoice[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalQty: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [muId, setMuId] = useState('');
  const [exporting, setExporting] = useState(false);

  const [dateMode, setDateMode] = useState<DateMode>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    p.set('limit', String(DEFAULT_LIMIT));

    if (dateMode === 'all') {
      // All invoices that have a dispatch date set (any date)
      p.set('hasDispatchDate', 'true');
    } else if (dateMode === 'today') {
      const t = todayISO();
      p.set('dispatchStartDate', t);
      p.set('dispatchEndDate', t);
    } else if (dateMode === 'custom') {
      if (customFrom) p.set('dispatchStartDate', customFrom);
      if (customTo) p.set('dispatchEndDate', customTo);
    }

    if (search.trim()) p.set('search', search.trim());
    if (muId) p.set('manufacturingUnitId', muId);
    return p;
  }, [search, muId, dateMode, customFrom, customTo]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices?${buildParams().toString()}`);
      const json = await res.json() as ApiResponse;
      if (!json.success) throw new Error('Failed to load dispatch list');
      setInvoices(json.data);
      setMeta({ total: json.meta.total, totalQty: json.meta.totalQty ?? 0 });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load dispatch list');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = buildParams();
      params.set('export', 'true');
      const res = await fetch(`/api/invoices?${params.toString()}`);
      const json = await res.json() as ApiResponse;
      if (!json.success) throw new Error('Failed to export');
      if (json.data.length === 0) {
        toast.warning('No invoices match the current filter to export.');
        return;
      }
      downloadInvoicesExcel(json.data);
      toast.success(`Exported ${json.data.length} invoice${json.data.length !== 1 ? 's' : ''}.`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const dateModeLabel: Record<DateMode, string> = {
    all: 'Dispatch Queue',
    today: `Today (${formatDate(todayISO())})`,
    custom: 'Custom Range',
  };

  return (
    <div className="min-h-0 bg-zinc-100">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-muted-foreground">
              {meta.total} invoice{meta.total !== 1 ? 's' : ''} — {dateModeLabel[dateMode]}
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              Total Qty
              <span className="font-bold text-amber-800">
                {meta.totalQty.toLocaleString('en-IN')}
              </span>
            </span>
          </div>
        </div>

        {/* Search + filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          {/* Date mode toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Dispatch Date:</span>
            {(['all', 'today', 'custom'] as DateMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setDateMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  dateMode === mode
                    ? 'bg-red-700 text-white border-red-700'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {mode === 'all' ? 'Queue (All)' : mode === 'today' ? 'Today' : 'Custom'}
              </button>
            ))}
          </div>

          {/* Custom date range inputs */}
          {dateMode === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-gray-500">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="border border-zinc-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              />
              <label className="text-xs text-gray-500">To</label>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="border border-zinc-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
          )}

          {/* Search + MU + Export */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search invoice #, token, dealer…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="min-w-[180px] flex-1 md:flex-none md:w-72 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
            />
            <select
              value={muId}
              onChange={e => setMuId(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="">All Units</option>
              {manufacturingUnits.map(mu => (
                <option key={mu.id} value={String(mu.id)}>{mu.unitName} ({mu.state})</option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              className="ml-auto gap-2"
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
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  {['Token', 'Invoice #', 'Bill To', 'MFG Unit', 'Items', 'Qty', 'Dispatch Date', 'Exp. Delivery', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-[10px] uppercase text-gray-500 font-semibold text-left px-4 py-3 tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 10 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: '60%' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-sm text-gray-400">
                      {dateMode === 'all'
                        ? 'No invoices have a dispatch date set. Use "Set Dispatch Date" from the All Invoices menu.'
                        : 'No invoices have a dispatch date set for this period.'}
                    </td>
                  </tr>
                ) : (
                  invoices.map(inv => {
                    const qty = (inv.lineItems ?? []).reduce((s, li) => s + (li.qty || 0), 0);
                    const isDispatched = inv.status === 'Dispatched';
                    return (
                      <tr key={String(inv._id)} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {inv.tokenLabel ? (
                            <span className="inline-block rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800 font-mono">
                              {inv.tokenLabel}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono font-medium text-gray-900 whitespace-nowrap">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-900">
                          <div className="font-medium">{inv.dealer?.orgName || '—'}</div>
                          {inv.dealer?.dealerId && (
                            <div className="text-gray-400 text-[10px]">{inv.dealer.dealerId}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700">
                          <div>{inv.manufacturingUnit?.unitName || '—'}</div>
                          <div className="text-gray-400 text-[10px]">{inv.manufacturingUnit?.state}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 text-center">
                          {inv.lineItems?.length ?? 0}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-900 text-center font-semibold">{qty}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {inv.dispatchDate ? (
                            <span className="inline-block rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                              {formatDate(inv.dispatchDate)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                          {formatDate(inv.expectedDeliveryDate)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            isDispatched
                              ? 'bg-green-100 text-green-700'
                              : inv.status === 'Cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {inv.status ?? 'Pending'}
                          </span>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {formatINR(inv.total)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <InvoiceRowActions invoice={inv} onChanged={fetchList} showDispatch />
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
