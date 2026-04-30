'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Dealer, Product, ProductVariant, ManufacturingUnit } from '@/lib/csvData';
import InvoicePreview from './InvoicePreview';
import type { InvoicePreviewProps } from './InvoicePreview';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItemState {
  id: string;
  productId: number | null;
  variantId: number | null;
  colour: string;
  qty: number;
}

interface ComputedLineItem extends LineItemState {
  productName: string;
  variantName: string;
  HSN: string;
  rate: number;
  sgstPct: number;
  cgstPct: number;
  igstPct: number;
  sgstAmount: number;
  cgstAmount: number;
  igstAmount: number;
  taxableAmount: number;
  totalAmount: number;
}

interface Props {
  dealers: Dealer[];
  products: Product[];
  variants: ProductVariant[];
  manufacturingUnits: ManufacturingUnit[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INSURANCE_RATE = 0.075 / 100;

// ─── Utilities ────────────────────────────────────────────────────────────────

function getVariantPrice(variant: ProductVariant, dealerType: string): number {
  switch (dealerType) {
    case 'dealer':      return variant.dealerPrice;
    case 'distributor': return variant.distributorPrice;
    case 'subdealer':   return variant.subdealerPrice;
    case 'areadealer':  return variant.areadealerPrice;
    default:            return variant.dealerPrice;
  }
}

function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function futureDateISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatAddress(addr: Dealer['billingAddress']): string {
  if (!addr) return '';
  return [addr.address, addr.city, addr.state, addr.country, addr.pincode].filter(Boolean).join(', ');
}

// ─── DealerSearch ─────────────────────────────────────────────────────────────

function DealerSearch({
  dealers, value, onChange, onSelect,
}: {
  dealers: Dealer[];
  value: string;
  onChange: (v: string) => void;
  onSelect: (d: Dealer) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value) return dealers.slice(0, 8);
    const q = value.toLowerCase();
    return dealers
      .filter(d =>
        d.orgName.toLowerCase().includes(q) ||
        d.dealerId.toLowerCase().includes(q) ||
        d.orgEmail.toLowerCase().includes(q) ||
        (d.billingAddress?.city || '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [dealers, value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        placeholder="Search dealer by name, ID or city…"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 bg-white border border-zinc-200 rounded-lg shadow-lg mt-1 max-h-56 overflow-y-auto">
          {filtered.map(d => (
            <li
              key={d.id}
              onMouseDown={() => { onSelect(d); setOpen(false); }}
              className="px-3 py-2 hover:bg-red-50 cursor-pointer text-sm"
            >
              <span className="font-medium text-gray-900">{d.orgName}</span>
              <span className="ml-2 text-xs text-gray-500">{d.dealerId}</span>
              <span className="ml-2 text-xs text-gray-400 capitalize">{d.dealerType}</span>
              {d.billingAddress?.city && (
                <span className="ml-1 text-xs text-gray-400">· {d.billingAddress.city}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── LineItemRow ──────────────────────────────────────────────────────────────

function LineItemRow({
  item, index, products, variants, dealerType, onUpdate, onRemove,
}: {
  item: ComputedLineItem;
  index: number;
  products: Product[];
  variants: ProductVariant[];
  dealerType: string;
  onUpdate: (id: string, updates: Partial<LineItemState>) => void;
  onRemove: (id: string) => void;
}) {
  const productVariants = useMemo(
    () => variants.filter(v => v.productId === item.productId),
    [variants, item.productId],
  );
  const selectedProduct = useMemo(
    () => products.find(p => p.id === item.productId),
    [products, item.productId],
  );

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-2 px-2 text-center text-gray-500 text-sm w-8">{index + 1}</td>
      <td className="py-2 px-2">
        <select
          value={item.productId ?? ''}
          onChange={e => onUpdate(item.id, { productId: e.target.value ? Number(e.target.value) : null })}
          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-600"
        >
          <option value="">— Select Model —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.productName}</option>)}
        </select>
      </td>
      <td className="py-2 px-2">
        <select
          value={item.variantId ?? ''}
          onChange={e => onUpdate(item.id, { variantId: e.target.value ? Number(e.target.value) : null })}
          disabled={!item.productId}
          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">— Select Variant —</option>
          {productVariants.map(v => (
            <option key={v.id} value={v.id}>
              {v.name} — {formatINR(getVariantPrice(v, dealerType))}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 px-2">
        <select
          value={item.colour}
          onChange={e => onUpdate(item.id, { colour: e.target.value })}
          disabled={!item.productId}
          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">— Select Colour —</option>
          {(selectedProduct?.colours ?? []).map(c => (
            <option key={c.colourName} value={c.colourName}>{c.colourName}</option>
          ))}
        </select>
      </td>
      <td className="py-2 px-2 w-20">
        <input
          type="number"
          min={1}
          value={item.qty}
          onChange={e => onUpdate(item.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-red-600"
        />
      </td>
      <td className="py-2 px-2 text-right text-sm text-gray-700 w-28 whitespace-nowrap">
        {item.rate > 0 ? formatINR(item.rate) : '—'}
      </td>
      <td className="py-2 px-2 text-right text-sm font-medium text-gray-800 w-28 whitespace-nowrap">
        {item.taxableAmount > 0 ? formatINR(item.taxableAmount) : '—'}
      </td>
      <td className="py-2 px-2 w-8 text-center">
        <button
          onClick={() => onRemove(item.id)}
          className="text-red-400 hover:text-red-600 transition-colors text-lg leading-none"
          title="Remove item"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({
  open,
  onClose,
  onSave,
  onPrint,
  saving,
  saved,
  saveError,
  previewProps,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onPrint: () => void;
  saving: boolean;
  saved: boolean;
  saveError: string;
  previewProps: InvoicePreviewProps;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4 print:hidden">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-xl">
          <div>
            <h2 className="text-base font-bold text-gray-900">Invoice Preview</h2>
            <p className="text-xs text-gray-500 mt-0.5">{previewProps.invoiceNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrint}
              className="flex items-center gap-1.5 text-sm text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            {saved ? (
              <span className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg font-medium">
                ✓ Saved
              </span>
            ) : (
              <button
                onClick={onSave}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm bg-red-700 text-white px-4 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Invoice
                  </>
                )}
              </button>
            )}
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

        {saveError && (
          <div className="mx-5 mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {saveError}
          </div>
        )}

        {/* Invoice Content */}
        <div className="p-5">
          <InvoicePreview {...previewProps} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PICreator({ dealers, products, variants, manufacturingUnits }: Props) {
  const router = useRouter();
  const [dealerSearch, setDealerSearch] = useState('');
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [selectedMU, setSelectedMU] = useState<ManufacturingUnit | null>(
    manufacturingUnits.length === 1 ? manufacturingUnits[0] : null,
  );
  const [taxType, setTaxType] = useState<'within_state' | 'other_state'>('within_state');
  const [lineItems, setLineItems] = useState<LineItemState[]>([
    { id: 'item-1', productId: null, variantId: null, colour: '', qty: 1 },
  ]);
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(futureDateISO(7));
  const [seqNumber, setSeqNumber] = useState('00001');
  const [discount, setDiscount] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Computed line items ──────────────────────────────────────────────────────
  const computedItems = useMemo<ComputedLineItem[]>(() => {
    return lineItems.map(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = variants.find(v => v.id === item.variantId);
      const rate = variant && selectedDealer ? getVariantPrice(variant, selectedDealer.dealerType) : 0;
      const taxableAmount = rate * item.qty;
      const sgstPct = product?.sgst ?? 0;
      const cgstPct = product?.cgst ?? 0;
      const igstPct = sgstPct + cgstPct;

      const sgstAmount = taxType === 'within_state' ? (taxableAmount * sgstPct) / 100 : 0;
      const cgstAmount = taxType === 'within_state' ? (taxableAmount * cgstPct) / 100 : 0;
      const igstAmount = taxType === 'other_state' ? (taxableAmount * igstPct) / 100 : 0;

      return {
        ...item,
        productName: product?.productName ?? '',
        variantName: variant?.name ?? '',
        HSN: product?.HSN ?? '',
        rate,
        sgstPct,
        cgstPct,
        igstPct,
        sgstAmount,
        cgstAmount,
        igstAmount,
        taxableAmount,
        totalAmount: taxableAmount + sgstAmount + cgstAmount + igstAmount,
      };
    });
  }, [lineItems, products, variants, selectedDealer, taxType]);

  const subTotal   = useMemo(() => computedItems.reduce((s, i) => s + i.taxableAmount, 0), [computedItems]);
  const totalSGST  = useMemo(() => computedItems.reduce((s, i) => s + i.sgstAmount, 0), [computedItems]);
  const totalCGST  = useMemo(() => computedItems.reduce((s, i) => s + i.cgstAmount, 0), [computedItems]);
  const totalIGST  = useMemo(() => computedItems.reduce((s, i) => s + i.igstAmount, 0), [computedItems]);
  const totalGST   = totalSGST + totalCGST + totalIGST;
  const insurance  = subTotal * INSURANCE_RATE;
  const total      = subTotal - discount + totalGST + insurance;

  // ── Invoice number ───────────────────────────────────────────────────────────
  const invoiceNumber = useMemo(() => {
    if (!selectedDealer) return `PO-INV-?-?-${new Date(invoiceDate).getFullYear()}-${seqNumber}`;
    const oemId     = selectedDealer.OEMProfileID;
    const dealerNum = selectedDealer.dealerId.replace(/\D/g, '').replace(/^0+/, '') || '0';
    const year      = new Date(invoiceDate).getFullYear();
    return `PO-INV-${oemId}-${dealerNum}-${year}-${seqNumber}`;
  }, [selectedDealer, invoiceDate, seqNumber]);

  // ── Line item CRUD ───────────────────────────────────────────────────────────
  const updateLineItem = useCallback((id: string, updates: Partial<LineItemState>) => {
    setLineItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        if ('productId' in updates && updates.productId !== item.productId) {
          updated.variantId = null;
          updated.colour = '';
        }
        return updated;
      }),
    );
  }, []);

  const addLineItem = useCallback(() => {
    setLineItems(prev => [
      ...prev,
      { id: `item-${Date.now()}`, productId: null, variantId: null, colour: '', qty: 1 },
    ]);
  }, []);

  const removeLineItem = useCallback((id: string) => {
    setLineItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }, [router]);

  // ── Dealer select ────────────────────────────────────────────────────────────
  const handleDealerSelect = useCallback((d: Dealer) => {
    setSelectedDealer(d);
    setDealerSearch(d.orgName);
  }, []);

  // ── Preview modal ────────────────────────────────────────────────────────────
  const handleOpenModal = useCallback(() => {
    setSaved(false);
    setSaveError('');
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => setShowModal(false), []);

  const handlePrint = useCallback(() => {
    setShowModal(false);
    setTimeout(() => window.print(), 100);
  }, []);

  // ── Save to DB ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!selectedDealer || !selectedMU) return;
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        invoiceNumber,
        invoiceDate,
        dueDate,
        seqNumber,
        manufacturingUnit: selectedMU,
        dealer: selectedDealer,
        lineItems: computedItems,
        taxType,
        subTotal,
        discount,
        totalSGST,
        totalCGST,
        totalIGST,
        totalGST,
        insurance,
        total,
      };
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message || 'Failed to save');
      setSaved(true);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  }, [
    selectedDealer, selectedMU, invoiceNumber, invoiceDate, dueDate, seqNumber,
    computedItems, taxType, subTotal, discount, totalSGST, totalCGST, totalIGST,
    totalGST, insurance, total,
  ]);

  // ── Preview props ────────────────────────────────────────────────────────────
  const previewProps: InvoicePreviewProps = {
    invoiceNumber,
    invoiceDate,
    dueDate,
    manufacturingUnit: selectedMU,
    dealer: selectedDealer,
    items: computedItems,
    taxType,
    subTotal,
    discount,
    totalSGST,
    totalCGST,
    totalIGST,
    totalGST,
    insurance,
    total,
  };

  const canConfirm = !!selectedDealer && !!selectedMU && computedItems.some(i => i.productId);

  return (
    <div className="min-h-screen bg-zinc-100 print:bg-white">

      {/* ── Print-only area (hidden on screen, shown when printing) ── */}
      <div className="hidden print:block">
        <InvoicePreview {...previewProps} />
      </div>

      {/* ── Top Bar ── */}
      <div className="bg-zinc-900 text-white border-b border-red-700 sticky top-0 z-40 print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-base font-bold text-white">Yakuza DMS</h1>
            <nav className="flex items-center gap-1">
              <Link
                href="/create-pi"
                className="text-sm px-3 py-1.5 rounded-md bg-red-700 text-white font-medium"
              >
                Create Invoice
              </Link>
              <Link
                href="/invoices"
                className="text-sm px-3 py-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
              >
                All Invoices
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenModal}
              disabled={!canConfirm}
              className="flex items-center gap-2 bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview &amp; Confirm
            </button>
            <button
              onClick={handleLogout}
              className="text-zinc-400 hover:text-white text-xs px-3 py-2 rounded-lg hover:bg-zinc-700 transition-colors"
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5 print:hidden">

        {/* Invoice Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            Invoice Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                readOnly
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
              />
              <div className="mt-1 flex items-center gap-1">
                <span className="text-[10px] text-gray-400">Seq:</span>
                <input
                  type="text"
                  value={seqNumber}
                  onChange={e => setSeqNumber(e.target.value.replace(/\D/g, '').padStart(5, '0').slice(-5))}
                  className="w-20 border border-zinc-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-red-600"
                  maxLength={5}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
          </div>
        </div>

        {/* Manufacturing Unit + Tax Type */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            Manufacturing Unit &amp; Tax Type
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* MU selector */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Manufacturing Unit</label>
              <select
                value={selectedMU?.id ?? ''}
                onChange={e => {
                  const mu = manufacturingUnits.find(m => m.id === Number(e.target.value));
                  setSelectedMU(mu ?? null);
                }}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <option value="">— Select Manufacturing Unit —</option>
                {manufacturingUnits.map(mu => (
                  <option key={mu.id} value={mu.id}>{mu.unitName} ({mu.state})</option>
                ))}
              </select>
              {selectedMU && (
                <div className="mt-2 text-xs text-gray-500 leading-relaxed bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                  {selectedMU.address}, {selectedMU.city} — GSTIN: {selectedMU.gstNo}
                </div>
              )}
            </div>

            {/* Tax Type toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tax Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTaxType('within_state')}
                  className={`flex-1 py-2 px-3 text-sm rounded-lg border font-medium transition-colors ${
                    taxType === 'within_state'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
                  }`}
                >
                  Within State
                  <span className="block text-[10px] font-normal opacity-80">SGST + CGST</span>
                </button>
                <button
                  onClick={() => setTaxType('other_state')}
                  className={`flex-1 py-2 px-3 text-sm rounded-lg border font-medium transition-colors ${
                    taxType === 'other_state'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  Other State
                  <span className="block text-[10px] font-normal opacity-80">IGST</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dealer Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Dealer</h2>
          <DealerSearch
            dealers={dealers}
            value={dealerSearch}
            onChange={v => { setDealerSearch(v); if (!v) setSelectedDealer(null); }}
            onSelect={handleDealerSelect}
          />
          {selectedDealer && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-red-50 rounded-lg border border-red-100">
              <div>
                <div className="text-[10px] uppercase font-semibold text-red-500 tracking-wide mb-1">Bill To</div>
                <div className="font-semibold text-gray-900 text-sm">{selectedDealer.orgName}</div>
                <div className="text-xs text-gray-600 mt-1 leading-relaxed">
                  {formatAddress(selectedDealer.billingAddress)}<br />
                  Ph: {selectedDealer.contact} · {selectedDealer.orgEmail}<br />
                  GSTIN: {selectedDealer.gstNo}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-red-500 tracking-wide mb-1">Ship To</div>
                <div className="font-semibold text-gray-900 text-sm">{selectedDealer.orgName}</div>
                <div className="text-xs text-gray-600 mt-1 leading-relaxed">
                  {formatAddress(selectedDealer.shippingAddress)}<br />
                  Ph: {selectedDealer.contact} · {selectedDealer.orgEmail}<br />
                  GSTIN: {selectedDealer.gstNo}
                </div>
              </div>
              <div className="sm:col-span-2 flex flex-wrap gap-3 pt-2 border-t border-red-100">
                <span className="text-xs text-gray-500">ID: <strong>{selectedDealer.dealerId}</strong></span>
                <span className="text-xs text-gray-500">Type: <strong className="capitalize">{selectedDealer.dealerType}</strong></span>
                <span className="text-xs text-gray-500">OEM: <strong>{selectedDealer.OEMProfileID}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100 flex items-center justify-between">
            Line Items
            {!selectedDealer && (
              <span className="text-xs text-amber-500 font-normal">Select a dealer first to see prices</span>
            )}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  {['#', 'Model', 'Variant', 'Colour', 'Qty', 'Rate', 'Taxable Amt', ''].map(h => (
                    <th key={h} className="text-[10px] uppercase text-gray-400 font-semibold text-left px-2 pb-2 tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {computedItems.map((item, idx) => (
                  <LineItemRow
                    key={item.id}
                    item={item}
                    index={idx}
                    products={products}
                    variants={variants}
                    dealerType={selectedDealer?.dealerType ?? 'dealer'}
                    onUpdate={updateLineItem}
                    onRemove={removeLineItem}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={addLineItem}
            className="mt-3 flex items-center gap-1.5 text-sm text-red-700 hover:text-red-800 font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Item
          </button>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Summary</h2>
          <div className="max-w-xs ml-auto space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Sub Total</span>
              <span className="font-medium">{formatINR(subTotal)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-gray-500">Discount (₹)</span>
              <input
                type="number"
                min={0}
                value={discount}
                onChange={e => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                className="w-28 border border-zinc-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-red-600"
              />
            </div>
            {taxType === 'within_state' ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">SGST</span>
                  <span className="font-medium">{formatINR(totalSGST)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">CGST</span>
                  <span className="font-medium">{formatINR(totalCGST)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">IGST</span>
                <span className="font-medium">{formatINR(totalIGST)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total GST</span>
              <span className="font-medium">{formatINR(totalGST)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Insurance <span className="text-[10px]">(@0.075%)</span></span>
              <span className="font-medium">{formatINR(insurance)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t-2 border-gray-800 pt-2">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold bg-gray-900 text-white px-3 py-2 rounded-lg">
              <span>Balance Due</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>
        </div>

        {/* Confirm button (bottom) */}
        <div className="flex justify-end pb-6">
          <button
            onClick={handleOpenModal}
            disabled={!canConfirm}
            className="flex items-center gap-2 bg-red-700 text-white text-base font-semibold px-8 py-3 rounded-xl hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Preview &amp; Confirm Invoice
          </button>
        </div>
      </div>

      {/* ── Preview Modal ── */}
      <PreviewModal
        open={showModal}
        onClose={handleCloseModal}
        onSave={handleSave}
        onPrint={handlePrint}
        saving={saving}
        saved={saved}
        saveError={saveError}
        previewProps={previewProps}
      />
    </div>
  );
}
