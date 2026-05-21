'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { MoreVertical, Truck } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import InvoicePreview, { type InvoicePreviewProps } from '@/app/(protected)/create-pi/InvoicePreview';
import { PI_STATUSES } from '@/lib/invoiceStatus';
import type { SavedInvoice } from '@/lib/invoiceModel';
import { PaymentModal } from './PaymentModal';

export function invoiceToPreviewProps(inv: SavedInvoice): InvoicePreviewProps {
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

// ─── View Modal ───────────────────────────────────────────────────────────────

function ViewModal({ invoice, onClose }: { invoice: SavedInvoice | null; onClose: () => void }) {
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

// ─── Row actions (shared by All Invoices + Dispatch queue) ──────────────────────

/**
 * The per-row actions menu used by both the All Invoices table and the Dispatch
 * queue: View, Edit PI, Record First Payment, Update Status, Delete — plus an
 * optional "Mark Dispatched" entry (`showDispatch`) for the dispatch queue.
 *
 * `onChanged` is called after any mutation (status / delete / payment / dispatch)
 * so the parent list can refetch.
 */
export function InvoiceRowActions({
  invoice,
  onChanged,
  showDispatch = false,
}: {
  invoice: SavedInvoice;
  onChanged: () => void;
  showDispatch?: boolean;
}) {
  const [viewing, setViewing] = useState(false);
  const [paying, setPaying] = useState(false);

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusValue, setStatusValue] = useState<string>(invoice.status || PI_STATUSES[0]);
  const [statusDescription, setStatusDescription] = useState(invoice.statusDescription || '');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [dispatching, setDispatching] = useState(false);

  const id = String(invoice._id || '');
  const isDispatched = invoice.status === 'Dispatched';
  const isCancelled = invoice.status === 'Cancelled';

  const openStatusEditor = () => {
    setStatusValue(invoice.status || PI_STATUSES[0]);
    setStatusDescription(invoice.statusDescription || '');
    setStatusOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!id) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusValue, description: statusDescription }),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message || 'Failed to update status');
      toast.success('Status updated.');
      setStatusOpen(false);
      onChanged();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message || 'Failed to delete invoice');
      toast.success('Invoice deleted.');
      setDeleteOpen(false);
      onChanged();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete invoice');
    } finally {
      setDeleting(false);
    }
  };

  const markDispatched = async () => {
    if (!id) return;
    setDispatching(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Dispatched' }),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message || 'Failed to mark dispatched');
      toast.success(`${invoice.tokenLabel ?? invoice.invoiceNumber} dispatched.`);
      onChanged();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to mark dispatched');
    } finally {
      setDispatching(false);
    }
  };

  return (
    <>
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
          <DropdownMenuItem onClick={() => setViewing(true)}>
            View
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/create-pi?invoiceId=${id}`}>Edit PI</Link>
          </DropdownMenuItem>
          {!invoice.firstPayment && (
            <DropdownMenuItem onClick={() => setPaying(true)}>
              Record First Payment
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={openStatusEditor}>
            Update Status
          </DropdownMenuItem>
          {showDispatch && !isDispatched && !isCancelled && (
            <DropdownMenuItem onClick={markDispatched} disabled={dispatching}>
              <Truck className="size-3.5" />
              {dispatching ? 'Dispatching…' : 'Mark Dispatched'}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-red-600 focus:bg-red-50 focus:text-red-700"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View */}
      <ViewModal invoice={viewing ? invoice : null} onClose={() => setViewing(false)} />

      {/* First payment */}
      <PaymentModal
        invoice={paying ? invoice : null}
        onClose={() => setPaying(false)}
        onRecorded={onChanged}
      />

      {/* Update status */}
      {statusOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
          <div className="bg-white w-full max-w-md rounded-xl border border-gray-200 shadow-2xl p-5">
            <h3 className="text-base font-semibold text-gray-900">Update PI Status</h3>
            <p className="text-xs text-gray-500 mt-1">{invoice.invoiceNumber}</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={statusValue}
                  onChange={e => setStatusValue(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  {PI_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
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
              <Button type="button" variant="outline" onClick={() => setStatusOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleUpdateStatus} disabled={updatingStatus}>
                {updatingStatus ? 'Updating…' : 'Update'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch in progress — overlay (the dropdown closes on click, so the
          in-menu label isn't visible while the request runs). */}
      {dispatching && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="flex items-center gap-3 bg-white rounded-lg px-5 py-4 text-sm font-medium text-gray-700 shadow-lg">
            <svg className="size-5 animate-spin text-red-700" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Dispatching {invoice.tokenLabel ?? invoice.invoiceNumber}…
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
          <div className="bg-white w-full max-w-md rounded-xl border border-gray-200 shadow-2xl p-5">
            <h3 className="text-base font-semibold text-gray-900">Delete Invoice</h3>
            <p className="text-sm text-gray-600 mt-2">
              Permanently delete{' '}
              <span className="font-mono font-medium text-gray-900">{invoice.invoiceNumber}</span>
              ? This cannot be undone.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              The invoice number stays consumed in its state series and will not be reused.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-700 hover:bg-red-600"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
