'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { DailyStockDTO } from '@/lib/products/dailyStockModel';
import { AddStockModal } from '../stock/AddStockModal';

interface ProductOption { code: number; name: string }
interface MuOption { id: number; unitName: string; state: string }

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
 * In Transit management — the editable side of the stock ledger.
 *
 * Stock arrives at the factory in two steps:
 *   1. Ops enters the qty into IN TRANSIT (via Add Stock or by clicking
 *      the In Transit cell to edit it inline).
 *   2. When the material physically lands, they "Receive" a qty — that
 *      moves it from In Transit into Received, which then flows into the
 *      Closing balance on the read-only Stock page.
 */
export default function TransitClient({
  products, manufacturingUnits,
}: {
  products: ProductOption[];
  manufacturingUnits: MuOption[];
}) {
  const defaultMuId = useMemo(() => {
    const tn = manufacturingUnits.find(m => m.state === 'TN');
    return (tn ?? manufacturingUnits[0])?.id ?? 0;
  }, [manufacturingUnits]);

  const [muId, setMuId] = useState<number>(defaultMuId);
  const [date] = useState(todayISO());
  const [rows, setRows] = useState<DailyStockDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyInTransit, setOnlyInTransit] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    if (!muId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/daily-stock?muId=${muId}&date=${date}`);
      const json = (await res.json()) as ApiResponse;
      if (!json.success) throw new Error('Failed to load transit list');
      setRows(json.data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load transit list');
    } finally {
      setLoading(false);
    }
  }, [muId, date]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(r => !onlyInTransit || r.inTransit > 0)
      .filter(r => !q || r.productName.toLowerCase().includes(q));
  }, [rows, search, onlyInTransit]);

  const totals = useMemo(() => filtered.reduce(
    (acc, r) => ({
      inTransit: acc.inTransit + r.inTransit,
      received: acc.received + r.received,
    }),
    { inTransit: 0, received: 0 },
  ), [filtered]);

  const currentMu = manufacturingUnits.find(m => m.id === muId);

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">

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
          <input
            type="text"
            placeholder="Search model…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 min-w-[160px] flex-1"
          />
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={onlyInTransit}
              onChange={e => setOnlyInTransit(e.target.checked)}
              className="h-4 w-4 accent-red-700"
            />
            Only with stock in transit
          </label>
          <Button type="button" className="gap-2" onClick={() => setShowAdd(true)}>
            <Plus className="size-4" />
            Add Stock
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-amber-100 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wide">
              In Transit — Date: {formatDate(date)}
            </h3>
            {currentMu && (
              <span className="text-xs font-medium text-amber-900/80">
                · {currentMu.unitName} ({currentMu.state})
              </span>
            )}
            <span className="ml-auto text-xs text-amber-900/80">
              <strong>{totals.inTransit}</strong> in transit · <strong>{totals.received}</strong> received today
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="bg-amber-200 border-b border-amber-300">
                  {['Product', 'In Transit', 'Received (today)', 'Receive'].map((h, i) => (
                    <th
                      key={h}
                      className={`text-[10px] uppercase text-amber-900 font-bold px-3 py-2 tracking-wide border border-amber-300 ${i === 0 ? 'text-left' : 'text-right'}`}
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
                      {Array.from({ length: 4 }).map((__, j) => (
                        <td key={j} className="px-3 py-2 border border-gray-200">
                          <div className="h-3.5 bg-gray-100 rounded animate-pulse" style={{ width: '60%' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">
                      {onlyInTransit
                        ? 'Nothing in transit right now. Click Add Stock to register inbound material.'
                        : 'No products match the search.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map(row => (
                    <TransitRow key={row.productCode} row={row} onChange={load} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AddStockModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={load}
        products={products}
        manufacturingUnits={manufacturingUnits}
        defaultMuId={muId}
      />
    </div>
  );
}

// ─── Single row: editable In Transit + Receive workflow ─────────────────────────

function TransitRow({ row, onChange }: { row: DailyStockDTO; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(String(row.inTransit));
  const [busy, setBusy] = useState(false);
  const [receiveQty, setReceiveQty] = useState('');

  useEffect(() => {
    if (!editing) setDraftValue(String(row.inTransit));
  }, [row.inTransit, editing]);

  const saveInTransit = async () => {
    const n = Math.floor(Number(draftValue));
    if (!Number.isFinite(n) || n < 0) {
      toast.error('In Transit must be a non-negative number.');
      return;
    }
    if (n === row.inTransit) { setEditing(false); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/daily-stock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muId: row.muId, productCode: row.productCode, inTransit: n }),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message || 'Failed to update In Transit');
      toast.success(`${row.productName} updated.`);
      setEditing(false);
      onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update In Transit');
    } finally {
      setBusy(false);
    }
  };

  const receive = async () => {
    const qty = Math.floor(Number(receiveQty));
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Enter a qty to receive.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/daily-stock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muId: row.muId, productCode: row.productCode, receive: qty }),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message || 'Failed to receive stock');
      toast.success(`Received ${qty} ${row.productName}.`);
      setReceiveQty('');
      onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to receive stock');
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="hover:bg-amber-50/30">
      <td className="px-3 py-2.5 border border-amber-200 bg-amber-50/50 text-sm font-medium text-gray-900">
        {row.productName}
      </td>

      {/* In Transit — editable */}
      <td className="px-3 py-2.5 border border-amber-300 bg-amber-100 text-right tabular-nums">
        {editing ? (
          <div className="flex items-center gap-1 justify-end">
            <input
              type="number"
              min={0}
              value={draftValue}
              onChange={e => setDraftValue(e.target.value)}
              onWheel={e => e.currentTarget.blur()}
              onKeyDown={e => {
                if (e.key === 'Enter') saveInTransit();
                if (e.key === 'Escape') { setDraftValue(String(row.inTransit)); setEditing(false); }
              }}
              autoFocus
              className="w-20 border border-zinc-300 rounded px-1.5 py-0.5 text-sm text-right bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              disabled={busy}
            />
            <button
              type="button"
              onClick={saveInTransit}
              disabled={busy}
              className="text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
              aria-label="Save"
            >
              <Check className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full text-right tabular-nums font-semibold text-amber-900 hover:underline"
          >
            {row.inTransit}
          </button>
        )}
      </td>

      {/* Received today (display only) */}
      <td className="px-3 py-2.5 border border-emerald-200 bg-emerald-50 text-right tabular-nums text-emerald-800 font-semibold">
        {row.received}
      </td>

      {/* Receive workflow */}
      <td className="px-3 py-2.5 border border-amber-200 bg-white">
        <div className="flex items-center justify-end gap-1.5">
          <input
            type="number"
            min={1}
            max={row.inTransit}
            value={receiveQty}
            onChange={e => setReceiveQty(e.target.value)}
            onWheel={e => e.currentTarget.blur()}
            onKeyDown={e => { if (e.key === 'Enter') receive(); }}
            placeholder={row.inTransit > 0 ? 'qty' : '—'}
            disabled={row.inTransit === 0 || busy}
            className="w-20 border border-amber-300 rounded px-2 py-1 text-sm text-right bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-gray-50 disabled:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={receive}
            disabled={busy || !receiveQty || row.inTransit === 0}
            className="rounded-md bg-emerald-700 text-white text-xs font-medium px-3 py-1 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Receive
          </button>
        </div>
      </td>
    </tr>
  );
}
