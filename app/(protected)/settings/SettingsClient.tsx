'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { InvoiceCounterDTO } from '@/lib/invoiceCounterModel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RowState extends InvoiceCounterDTO {
  saving?: boolean;
  saved?: boolean;
}

const numberInputClass =
  'w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 ' +
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
const textInputClass =
  'w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600';

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsClient({
  initialCounters,
}: {
  initialCounters: InvoiceCounterDTO[];
}) {
  const [rows, setRows] = useState<RowState[]>(initialCounters);

  // New-state form
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ state: '', stateName: '', prefix: '', series: '2627', nextNumber: 1 });
  const [addSaving, setAddSaving] = useState(false);

  const patchRow = (state: string, patch: Partial<RowState>) =>
    setRows(rs => rs.map(r => (r.state === state ? { ...r, ...patch } : r)));

  const saveRow = async (row: RowState) => {
    patchRow(row.state, { saving: true, saved: false });
    try {
      const res = await fetch('/api/invoice-counters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: row.state,
          stateName: row.stateName,
          prefix: row.prefix,
          series: row.series,
          nextNumber: row.nextNumber,
        }),
      });
      const json = (await res.json()) as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message || 'Failed to save');
      patchRow(row.state, { saving: false, saved: true });
      toast.success(`${row.state} series saved.`);
      setTimeout(() => patchRow(row.state, { saved: false }), 2500);
    } catch (err: unknown) {
      patchRow(row.state, { saving: false });
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const addState = async () => {
    setAddSaving(true);
    try {
      const res = await fetch('/api/invoice-counters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json = (await res.json()) as { success: boolean; message?: string; data?: InvoiceCounterDTO };
      if (!json.success || !json.data) throw new Error(json.message || 'Failed to add state');
      setRows(rs => [...rs, json.data!].sort((a, b) => a.stateName.localeCompare(b.stateName)));
      toast.success(`${json.data.state} series added.`);
      setShowAdd(false);
      setDraft({ state: '', stateName: '', prefix: '', series: '2627', nextNumber: 1 });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add state');
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Intro */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Invoice Numbering</h2>
          <p className="text-xs text-gray-500">
            Each manufacturing-unit state has its own PI series. When an invoice is created, the
            number <strong className="text-gray-700">Prefix / Series / Next Number</strong> is used and
            the counter advances by one. Update any value below at any time.
          </p>
        </div>

        {/* Per-state counters */}
        <div className="space-y-4">
          {rows.map(row => (
            <div key={row.state} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center min-w-[2.5rem] h-7 px-2 rounded-md bg-red-700 text-white text-xs font-bold tracking-wide">
                    {row.state}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">
                    {row.stateName || row.state}
                  </span>
                </div>
                <code className="text-xs font-mono text-gray-500 bg-gray-50 border border-gray-100 rounded px-2 py-1">
                  {row.prefix}/{row.series}/{row.nextNumber}
                </code>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">State Name</label>
                  <input
                    type="text"
                    value={row.stateName}
                    onChange={e => patchRow(row.state, { stateName: e.target.value, saved: false })}
                    className={textInputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Prefix</label>
                  <input
                    type="text"
                    value={row.prefix}
                    onChange={e => patchRow(row.state, { prefix: e.target.value, saved: false })}
                    className={textInputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Series</label>
                  <input
                    type="text"
                    value={row.series}
                    onChange={e => patchRow(row.state, { series: e.target.value, saved: false })}
                    className={textInputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Next Number</label>
                  <input
                    type="number"
                    min={0}
                    value={row.nextNumber}
                    onChange={e =>
                      patchRow(row.state, {
                        nextNumber: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        saved: false,
                      })
                    }
                    className={numberInputClass}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4">
                {row.saved && <span className="text-xs text-green-700 font-medium">✓ Saved</span>}
                <button
                  onClick={() => saveRow(row)}
                  disabled={row.saving}
                  className="bg-red-700 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {row.saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add new state */}
        {showAdd ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
              Add State Series
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">State Code</label>
                <input
                  type="text"
                  placeholder="e.g. KA"
                  value={draft.state}
                  onChange={e => setDraft(d => ({ ...d, state: e.target.value.toUpperCase() }))}
                  className={textInputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">State Name</label>
                <input
                  type="text"
                  value={draft.stateName}
                  onChange={e => setDraft(d => ({ ...d, stateName: e.target.value }))}
                  className={textInputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Prefix</label>
                <input
                  type="text"
                  placeholder="e.g. KA-PI"
                  value={draft.prefix}
                  onChange={e => setDraft(d => ({ ...d, prefix: e.target.value }))}
                  className={textInputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Series</label>
                <input
                  type="text"
                  value={draft.series}
                  onChange={e => setDraft(d => ({ ...d, series: e.target.value }))}
                  className={textInputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Next Number</label>
                <input
                  type="number"
                  min={0}
                  value={draft.nextNumber}
                  onChange={e =>
                    setDraft(d => ({
                      ...d,
                      nextNumber: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    }))
                  }
                  className={numberInputClass}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setShowAdd(false)}
                className="text-sm text-gray-600 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addState}
                disabled={addSaving || !draft.state.trim() || !draft.prefix.trim()}
                className="bg-red-700 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {addSaving ? 'Adding…' : 'Add State'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-sm text-red-700 hover:text-red-800 font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add State Series
          </button>
        )}
      </div>
    </div>
  );
}
