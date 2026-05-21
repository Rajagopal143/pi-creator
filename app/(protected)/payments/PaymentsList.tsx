'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

interface MuOption { id: number; unitName: string; state: string }

interface PaymentRow {
  invoiceId: string;
  invoiceNumber: string;
  tokenLabel: string;
  dealerName: string;
  dealerId: string;
  muName: string;
  muState: string;
  invoiceTotal: number;
  status: string;
  expectedDeliveryDate: string;
  amount: number;
  mode: string;
  date: string;
  reference: string;
  recordedAt: string;
}

interface ApiResponse {
  success: boolean;
  data: PaymentRow[];
  meta: { total: number; totalAmount: number };
}

const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'] as const;

function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Payments ledger — first payments recorded against PIs, each linked to its
 * dealer and invoice. Filter by dealer/invoice/token, manufacturing unit,
 * payment mode and date range.
 */
export default function PaymentsList({ manufacturingUnits }: { manufacturingUnits: MuOption[] }) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalAmount: 0 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [muId, setMuId] = useState('');
  const [mode, setMode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    p.set('limit', '200');
    if (search.trim()) p.set('search', search.trim());
    if (muId) p.set('manufacturingUnitId', muId);
    if (mode) p.set('mode', mode);
    if (startDate) p.set('startDate', startDate);
    if (endDate) p.set('endDate', endDate);
    return p;
  }, [search, muId, mode, startDate, endDate]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payments?${buildParams().toString()}`);
      const json = await res.json() as ApiResponse;
      if (!json.success) throw new Error('Failed to load payments');
      setRows(json.data);
      setMeta({ total: json.meta.total, totalAmount: json.meta.totalAmount });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const hasFilters = !!(search || muId || mode || startDate || endDate);
  const clearFilters = () => {
    setSearch(''); setMuId(''); setMode(''); setStartDate(''); setEndDate('');
  };

  const statusBadge = useMemo(() => (s: string) => {
    switch (s?.toLowerCase()) {
      case 'dispatched': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-amber-100 text-amber-700';
    }
  }, []);

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">

        {/* Summary */}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {meta.total} payment{meta.total !== 1 ? 's' : ''}
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            Total Received
            <span className="font-bold text-emerald-800">{formatINR(meta.totalAmount)}</span>
          </span>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search dealer, invoice #, token…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="min-w-[200px] flex-1 md:flex-none md:w-72 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
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
            <select
              value={mode}
              onChange={e => setMode(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="">All Modes</option>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              title="From date"
            />
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              title="To date"
            />
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-red-700 hover:text-red-800 font-medium"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  {['Date', 'Dealer', 'Invoice / Token', 'MFG Unit', 'Amount', 'Mode', 'Reference', 'PI Total', ''].map(h => (
                    <th key={h} className="text-[10px] uppercase text-gray-500 font-semibold text-left px-4 py-3 tracking-wide">
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
                          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: '60%' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-400">
                      {hasFilters
                        ? 'No payments match your filters.'
                        : 'No payments recorded yet. Record a first payment from the All Invoices or Dispatch page.'}
                    </td>
                  </tr>
                ) : (
                  rows.map(p => (
                    <tr key={p.invoiceId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{formatDate(p.date)}</td>
                      <td className="px-4 py-3 text-xs text-gray-900">
                        <div className="font-medium">{p.dealerName}</div>
                        {p.dealerId && <div className="text-gray-400 text-[10px]">{p.dealerId}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-mono font-medium text-gray-900">{p.invoiceNumber}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {p.tokenLabel && (
                            <span className="inline-block rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                              Token {p.tokenLabel}
                            </span>
                          )}
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${statusBadge(p.status)}`}>
                            {p.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {p.muName} {p.muState && <span className="text-gray-400">/ {p.muState}</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-700 whitespace-nowrap">
                        {formatINR(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{p.mode}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{p.reference || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{formatINR(p.invoiceTotal)}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/create-pi?invoiceId=${p.invoiceId}`}
                          className="text-xs text-red-700 hover:text-red-800 font-medium border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
                        >
                          View PI
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
