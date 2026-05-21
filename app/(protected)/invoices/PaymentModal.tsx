'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { SavedInvoice } from '@/lib/invoiceModel';

const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'] as const;

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Records the first payment against an invoice — triggers token allocation,
 * stock reservation, and saves the expected delivery date on the server.
 */
export function PaymentModal({
  invoice,
  onClose,
  onRecorded,
}: {
  invoice: SavedInvoice | null;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<string>(PAYMENT_MODES[0]);
  const [date, setDate] = useState(todayISO());
  const [reference, setReference] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(addDaysISO(todayISO(), 15));
  const [submitting, setSubmitting] = useState(false);

  // Reset fields whenever a new invoice is opened.
  useEffect(() => {
    if (!invoice) return;
    setAmount('');
    setMode(PAYMENT_MODES[0]);
    setDate(todayISO());
    setReference('');
    setExpectedDeliveryDate(addDaysISO(todayISO(), 15));
  }, [invoice]);

  useEffect(() => {
    if (!invoice) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [invoice, onClose]);

  if (!invoice?._id) return null;

  const submit = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${String(invoice._id)}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, mode, date, reference, expectedDeliveryDate }),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message || 'Failed to record payment');
      toast.success('First payment recorded — token issued.');
      onRecorded();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md rounded-xl border border-gray-200 shadow-2xl p-5">
        <h3 className="text-base font-semibold text-gray-900">Record First Payment</h3>
        <p className="text-xs text-gray-500 mt-1">
          {invoice.invoiceNumber} · {invoice.dealer?.orgName}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Amount (₹)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onWheel={e => e.currentTarget.blur()}
              placeholder="e.g. 50000"
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Mode</label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value)}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Reference (optional)</label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="UTR / Cheque # / Receipt #"
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Expected Delivery Date</label>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={e => setExpectedDeliveryDate(e.target.value)}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              Editable later; defaults to 15 days from today.
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting ? 'Recording…' : 'Record Payment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
