'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface ProductOption { code: number; name: string }
interface MuOption { id: number; unitName: string; state: string }

/** Modal for adding daily stock — MU + product + qty. */
export function AddStockModal({
  open, onClose, onAdded,
  products, manufacturingUnits, defaultMuId,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  products: ProductOption[];
  manufacturingUnits: MuOption[];
  defaultMuId: number;
}) {
  const [muId, setMuId] = useState(defaultMuId);
  const [productCode, setProductCode] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMuId(defaultMuId);
    setProductCode('');
    setAmount('');
  }, [open, defaultMuId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    if (productCode === '') {
      toast.error('Pick a product.');
      return;
    }
    const qty = Math.floor(Number(amount));
    if (!Number.isFinite(qty) || qty === 0) {
      toast.error('Enter a non-zero quantity.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/daily-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muId, productCode, amount: qty }),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message || 'Failed to add stock');
      toast.success('Stock updated.');
      onAdded();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md rounded-xl border border-gray-200 shadow-2xl p-5">
        <h3 className="text-base font-semibold text-gray-900">Add Stock — In Transit</h3>
        <p className="text-xs text-gray-500 mt-1">
          Adds today&apos;s qty to <strong>In Transit</strong>. Once it physically arrives,
          click <em>Receive</em> on the table to move it into Received (which flows into Closing).
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Manufacturing Unit</label>
            <select
              value={muId}
              onChange={e => setMuId(Number(e.target.value))}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              {manufacturingUnits.map(mu => (
                <option key={mu.id} value={mu.id}>{mu.unitName} ({mu.state})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
            <select
              value={productCode === '' ? '' : String(productCode)}
              onChange={e => setProductCode(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="">— Select product —</option>
              {products.map(p => (
                <option key={p.code} value={String(p.code)}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onWheel={e => e.currentTarget.blur()}
              placeholder="e.g. 10"
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              Negative values are allowed for corrections (e.g. -2).
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Add Stock'}
          </Button>
        </div>
      </div>
    </div>
  );
}
