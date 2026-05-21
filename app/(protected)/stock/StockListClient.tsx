'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import type { DailyStockDTO } from '@/lib/products/dailyStockModel';

interface ProductOption { code: number; name: string }
interface MuOption { id: number; unitName: string; state: string }

interface ReservationRow {
  invoiceId: string;
  invoiceNumber: string;
  tokenLabel: string;
  dealerName: string;
  dealerId: string;
  variantName: string;
  qty: number;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

interface ApiResponse {
  success: boolean;
  data: DailyStockDTO[];
  meta?: { date: string };
}

/**
 * Read-only stock showcase per manufacturing unit. Edits and the In-Transit
 * receive workflow live on the separate `/transit` page; this view only
 * mirrors the daily ledger:
 *
 *   SR. NO · MODEL · OPENING · DELIVERED · RESERVED · RECEIVED · CLOSING · IN TRANSIT · GRAND TOTAL
 *
 * Green columns are system-derived, the amber IN TRANSIT column reflects the
 * current value managed on `/transit`. Closing/Grand Total recompute live as
 * upstream events (payment/dispatch/receive) bump their source columns.
 */
export default function StockListClient({
  manufacturingUnits,
}: {
  products: ProductOption[];
  manufacturingUnits: MuOption[];
}) {
  // Default to the TN unit when present, otherwise the first MU.
  const defaultMuId = useMemo(() => {
    const tn = manufacturingUnits.find(m => m.state === 'TN');
    return (tn ?? manufacturingUnits[0])?.id ?? 0;
  }, [manufacturingUnits]);

  const [muId, setMuId] = useState<number>(defaultMuId);
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<DailyStockDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Reserved-cell drill-down: which product's reservations are open, and the
  // list of PIs holding them.
  const [reservedFor, setReservedFor] = useState<{ productCode: number; productName: string } | null>(null);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);

  const openReservations = useCallback(async (productCode: number, productName: string) => {
    setReservedFor({ productCode, productName });
    setReservations([]);
    setReservationsLoading(true);
    try {
      const res = await fetch(`/api/stock/reservations?muId=${muId}&productCode=${productCode}`);
      const json = await res.json() as { success: boolean; data?: ReservationRow[]; message?: string };
      if (!json.success) throw new Error(json.message || 'Failed to load reservations');
      setReservations(json.data ?? []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load reservations');
    } finally {
      setReservationsLoading(false);
    }
  }, [muId]);

  const load = useCallback(async () => {
    if (!muId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/daily-stock?muId=${muId}&date=${date}`);
      const json = (await res.json()) as ApiResponse;
      if (!json.success) throw new Error('Failed to load stock');
      setRows(json.data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  }, [muId, date]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter(r => r.productName.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const totals = useMemo(() => filtered.reduce(
    (acc, r) => ({
      opening: acc.opening + r.opening,
      delivered: acc.delivered + r.delivered,
      reserved: acc.reserved + r.reserved,
      received: acc.received + r.received,
      closing: acc.closing + r.closing,
      inTransit: acc.inTransit + r.inTransit,
      grandTotal: acc.grandTotal + r.grandTotal,
    }),
    { opening: 0, delivered: 0, reserved: 0, received: 0, closing: 0, inTransit: 0, grandTotal: 0 },
  ), [filtered]);

  const currentMu = manufacturingUnits.find(m => m.id === muId);

  const greenCell = 'px-3 py-2 border border-emerald-200 bg-emerald-50 tabular-nums text-right';
  const amberCell = 'px-3 py-2 border border-amber-300 bg-amber-100 tabular-nums text-right font-semibold text-amber-900';

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">

        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-gray-500">Manufacturing Unit</label>
          <select
            value={muId}
            onChange={e => setMuId(Number(e.target.value))}
            className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
          >
            {manufacturingUnits.map(mu => (
              <option key={mu.id} value={mu.id}>{mu.unitName} ({mu.state})</option>
            ))}
          </select>
          <label className="text-xs font-medium text-gray-500">Date</label>
          {/* Any past date works — the API returns the row for that date if it
              exists, otherwise carries forward the most recent earlier closing. */}
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={e => setDate(e.target.value || todayISO())}
            className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
          />
          {date !== todayISO() && (
            <button
              type="button"
              onClick={() => setDate(todayISO())}
              className="text-xs text-red-700 hover:text-red-800 font-medium"
            >
              Today
            </button>
          )}
          <input
            type="text"
            placeholder="Search model…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 min-w-[180px]"
          />
        </div>

        <p className="text-[11px] text-gray-500">
          Read-only view. Edit In Transit and run receive on the <strong>Transit</strong> page.
          Closing = Opening − Delivered − Reserved + Received · Grand Total = Closing + In Transit.
        </p>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-orange-100 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-orange-900 uppercase tracking-wide">
              Raw Material — Date: {formatDate(date)}
            </h3>
            {currentMu && (
              <span className="text-xs font-medium text-orange-900/80">
                · {currentMu.unitName} ({currentMu.state})
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse">
              <thead>
                <tr className="bg-orange-200 border-b border-orange-300">
                  {[
                    { label: 'SR. NO', align: 'center' },
                    { label: 'MODELS', align: 'left' },
                    { label: 'OPENING', align: 'right' },
                    { label: 'DELIVERED', align: 'right' },
                    { label: 'RESERVED', align: 'right' },
                    { label: 'RECEIVED', align: 'right' },
                    { label: 'CLOSING', align: 'right' },
                    { label: 'IN TRANSIT', align: 'right' },
                    { label: 'GRAND TOTAL', align: 'right' },
                  ].map(h => (
                    <th
                      key={h.label}
                      className={`text-[10px] uppercase text-orange-900 font-bold px-3 py-2 tracking-wide border border-orange-300 text-${h.align}`}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="px-3 py-2 border border-gray-200">
                          <div className="h-3.5 bg-gray-100 rounded animate-pulse" style={{ width: '60%' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-400">
                      No products match the current search.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, idx) => (
                    <tr key={row.productCode} className="hover:bg-amber-50/30">
                      <td className="px-3 py-2 border border-emerald-200 bg-emerald-50 text-center text-xs text-gray-700">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 border border-emerald-200 bg-emerald-50 text-sm font-medium text-gray-900">
                        {row.productName}
                      </td>
                      <td className={greenCell}>{row.opening}</td>
                      <td className={greenCell}>{row.delivered}</td>
                      {row.reserved > 0 ? (
                        <td className={`${greenCell} p-0`}>
                          <button
                            type="button"
                            onClick={() => openReservations(row.productCode, row.productName)}
                            title="View reservations"
                            className="w-full h-full px-3 py-2 text-right font-semibold text-red-700 underline decoration-dotted underline-offset-2 hover:bg-red-50 cursor-pointer transition-colors"
                          >
                            {row.reserved}
                          </button>
                        </td>
                      ) : (
                        <td className={greenCell}>{row.reserved}</td>
                      )}
                      <td className={greenCell}>{row.received}</td>
                      <td className={`${greenCell} font-semibold`}>{row.closing}</td>
                      <td className={amberCell}>{row.inTransit}</td>
                      <td className={`${greenCell} font-bold text-gray-900`}>{row.grandTotal}</td>
                    </tr>
                  ))
                )}
                {!loading && filtered.length > 0 && (
                  <tr className="bg-emerald-100 font-bold">
                    <td colSpan={2} className="px-3 py-2 border border-emerald-300 text-right text-xs">
                      Totals
                    </td>
                    <td className="px-3 py-2 border border-emerald-300 tabular-nums text-right">{totals.opening}</td>
                    <td className="px-3 py-2 border border-emerald-300 tabular-nums text-right">{totals.delivered}</td>
                    <td className="px-3 py-2 border border-emerald-300 tabular-nums text-right">{totals.reserved}</td>
                    <td className="px-3 py-2 border border-emerald-300 tabular-nums text-right">{totals.received}</td>
                    <td className="px-3 py-2 border border-emerald-300 tabular-nums text-right">{totals.closing}</td>
                    <td className="px-3 py-2 border border-amber-300 bg-amber-100 tabular-nums text-right">{totals.inTransit}</td>
                    <td className="px-3 py-2 border border-emerald-300 tabular-nums text-right">{totals.grandTotal}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reservations popup — the PIs holding this product's reserved qty. */}
      {reservedFor && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-10 px-4"
          onClick={() => setReservedFor(null)}
        >
          <div
            className="bg-white w-full max-w-2xl rounded-xl border border-gray-200 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Reserved — {reservedFor.productName}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {currentMu ? `${currentMu.unitName} (${currentMu.state})` : ''} · open orders holding stock
                </p>
              </div>
              <button
                onClick={() => setReservedFor(null)}
                className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      {['PO ID', 'Dealer', 'Variant', 'Qty'].map(h => (
                        <th key={h} className="text-[10px] uppercase text-gray-500 font-semibold text-left px-3 py-2 tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reservationsLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          {Array.from({ length: 4 }).map((__, j) => (
                            <td key={j} className="px-3 py-2">
                              <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: '60%' }} />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : reservations.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-400">
                          No open reservations found.
                        </td>
                      </tr>
                    ) : (
                      reservations.map((r, i) => (
                        <tr key={`${r.invoiceId}-${i}`} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <Link
                              href={`/create-pi?invoiceId=${r.invoiceId}`}
                              className="text-xs font-mono font-medium text-red-700 hover:text-red-800 underline decoration-dotted underline-offset-2"
                            >
                              {r.invoiceNumber}
                            </Link>
                            {r.tokenLabel && (
                              <span className="ml-1.5 inline-block rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 align-middle">
                                Token {r.tokenLabel}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-900">
                            <div className="font-medium">{r.dealerName}</div>
                            {r.dealerId && <div className="text-gray-400 text-[10px]">{r.dealerId}</div>}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-700">{r.variantName}</td>
                          <td className="px-3 py-2 text-sm font-semibold text-gray-900 tabular-nums">{r.qty}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {!reservationsLoading && reservations.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                        <td colSpan={3} className="px-3 py-2 text-right text-xs">Total Reserved</td>
                        <td className="px-3 py-2 text-sm tabular-nums">
                          {reservations.reduce((s, r) => s + r.qty, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
