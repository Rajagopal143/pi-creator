'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import type { Dealer, Product, ProductVariant } from '@/lib/csvData';

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
  sgstAmount: number;
  cgstAmount: number;
  taxableAmount: number;
  totalAmount: number;
}

interface Props {
  dealers: Dealer[];
  products: Product[];
  variants: ProductVariant[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OEM = {
  name: 'Yakuza E-Vehicles Private Limited (Tamil Nadu)',
  address: '7/261 Petrol Bunk Opposite Bypass Road, Deevattipat, Salem, TN',
  phone: '9991702942',
  email: 'info2@yakuzaev.com',
  gstin: '06AANCM0950F1ZK',
  website: 'www.yakuzaev.com',
};

const INSURANCE_RATE = 0.075 / 100;

// ─── Utilities ────────────────────────────────────────────────────────────────

function getVariantPrice(variant: ProductVariant, dealerType: string): number {
  switch (dealerType) {
    case 'dealer': return variant.dealerPrice;
    case 'distributor': return variant.distributorPrice;
    case 'subdealer': return variant.subdealerPrice;
    case 'areadealer': return variant.areadealerPrice;
    default: return variant.dealerPrice;
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
  const parts = [addr.address, addr.city, addr.state, addr.country, addr.pincode].filter(Boolean);
  return parts.join(', ');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DealerSearch({
  dealers,
  value,
  onChange,
  onSelect,
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
      .filter(
        d =>
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

function LineItemRow({
  item,
  index,
  products,
  variants,
  dealerType,
  onUpdate,
  onRemove,
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

      {/* Product */}
      <td className="py-2 px-2">
        <select
          value={item.productId ?? ''}
          onChange={e => onUpdate(item.id, { productId: e.target.value ? Number(e.target.value) : null })}
          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-600"
        >
          <option value="">— Select Model —</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.productName}</option>
          ))}
        </select>
      </td>

      {/* Variant */}
      <td className="py-2 px-2">
        <select
          value={item.variantId ?? ''}
          onChange={e => onUpdate(item.id, { variantId: e.target.value ? Number(e.target.value) : null })}
          disabled={!item.productId}
          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">— Select Variant —</option>
          {productVariants.map(v => {
            const price = getVariantPrice(v, dealerType);
            return (
              <option key={v.id} value={v.id}>
                {v.name} — {formatINR(price)}
              </option>
            );
          })}
        </select>
      </td>

      {/* Colour */}
      <td className="py-2 px-2">
        <select
          value={item.colour}
          onChange={e => onUpdate(item.id, { colour: e.target.value })}
          disabled={!item.productId}
          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">— Select Colour —</option>
          {(selectedProduct?.colours ?? []).map(c => (
            <option key={c.colourName} value={c.colourName}>
              {c.colourName}
            </option>
          ))}
        </select>
      </td>

      {/* Qty */}
      <td className="py-2 px-2 w-20">
        <input
          type="number"
          min={1}
          value={item.qty}
          onChange={e => onUpdate(item.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-red-600"
        />
      </td>

      {/* Rate */}
      <td className="py-2 px-2 text-right text-sm text-gray-700 w-28 whitespace-nowrap">
        {item.rate > 0 ? formatINR(item.rate) : '—'}
      </td>

      {/* Amount */}
      <td className="py-2 px-2 text-right text-sm font-medium text-gray-800 w-28 whitespace-nowrap">
        {item.taxableAmount > 0 ? formatINR(item.taxableAmount) : '—'}
      </td>

      {/* Remove */}
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

// ─── Invoice Preview ──────────────────────────────────────────────────────────

function InvoicePreview({
  quotationNumber,
  quotationDate,
  dueDate,
  dealer,
  items,
  subTotal,
  discount,
  totalGST,
  totalSGST,
  totalCGST,
  insurance,
  total,
  printRef,
}: {
  quotationNumber: string;
  quotationDate: string;
  dueDate: string;
  dealer: Dealer | null;
  items: ComputedLineItem[];
  subTotal: number;
  discount: number;
  totalGST: number;
  totalSGST: number;
  totalCGST: number;
  insurance: number;
  total: number;
  printRef: React.RefObject<HTMLDivElement | null>;
}) {
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalLineAmount = items.reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div
      ref={printRef}
      className="bg-white border border-gray-300 text-[11px] text-gray-800 font-sans"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {/* ── Header ── */}
      <div className="flex justify-between items-start p-5 border-b-2 border-black">
        <div className="flex items-start gap-3">
          <Image src="/logo.svg" alt="Yakuza Logo" width={128} height={32} className="h-8 w-auto" priority />
          <div>
            <div className="text-base font-bold text-black">{OEM.name}</div>
            <div className="mt-1 text-[10px] text-gray-700 leading-relaxed">
              {OEM.address}<br />
              Ph: {OEM.phone} · {OEM.email} · GSTIN: {OEM.gstin}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-red-700">Yakuza DMS</div>
          <div className="text-2xl font-bold text-black tracking-widest">INVOICE</div>
        </div>
      </div>

      {/* ── Meta ── */}
      <div className="flex flex-wrap gap-6 px-5 py-3 border-b border-gray-200 bg-gray-50 text-[10px]">
        <div>
          <div className="text-gray-400 uppercase font-semibold tracking-wide text-[9px]">Invoice #</div>
          <div className="font-semibold text-gray-900 mt-0.5">{quotationNumber}</div>
        </div>
        <div>
          <div className="text-gray-400 uppercase font-semibold tracking-wide text-[9px]">Date</div>
          <div className="font-semibold text-gray-900 mt-0.5">{formatDate(quotationDate)}</div>
        </div>
        <div>
          <div className="text-gray-400 uppercase font-semibold tracking-wide text-[9px]">Due Date</div>
          <div className="font-semibold text-gray-900 mt-0.5">{formatDate(dueDate)}</div>
        </div>
        <div>
          <div className="text-gray-400 uppercase font-semibold tracking-wide text-[9px]">Portal</div>
          <div className="font-semibold text-gray-900 mt-0.5">{OEM.website}</div>
        </div>
      </div>

      {/* ── Parties ── */}
      <div className="grid grid-cols-2 gap-0 border-b border-gray-200">
        <div className="px-5 py-3 border-r border-gray-200">
          <div className="text-[9px] uppercase text-gray-400 font-semibold tracking-wider mb-1">Bill To (Dealer)</div>
          <div className="font-bold text-gray-900 text-[11px]">{dealer?.orgName || '—'}</div>
          {dealer && (
            <div className="text-[10px] text-gray-600 mt-1 leading-relaxed">
              {formatAddress(dealer.billingAddress)}<br />
              Ph: {dealer.contact} · Email: {dealer.orgEmail}<br />
              GSTIN: {dealer.gstNo}
            </div>
          )}
        </div>
        <div className="px-5 py-3">
          <div className="text-[9px] uppercase text-gray-400 font-semibold tracking-wider mb-1">Ship To (Dealer)</div>
          <div className="font-bold text-gray-900 text-[11px]">{dealer?.orgName || '—'}</div>
          {dealer && (
            <div className="text-[10px] text-gray-600 mt-1 leading-relaxed">
              {formatAddress(dealer.shippingAddress)}<br />
              Ph: {dealer.contact} · Email: {dealer.orgEmail}<br />
              GSTIN: {dealer.gstNo}
            </div>
          )}
        </div>
      </div>

      {/* ── Items Table ── */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-800 bg-gray-50">
            {['#', 'MODEL', 'VARIANT', 'COLOUR', 'QTY', 'RATE', 'SGST', 'CGST', 'AMOUNT'].map(h => (
              <th
                key={h}
                className="px-3 py-2 text-[9px] font-bold uppercase tracking-wide text-gray-700 text-left"
                style={['QTY', 'RATE', 'SGST', 'CGST', 'AMOUNT'].includes(h) ? { textAlign: 'right' } : {}}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-3 py-4 text-center text-gray-400 italic">
                No items added yet
              </td>
            </tr>
          ) : (
            items.map((item, idx) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="px-3 py-1.5">{idx + 1}</td>
                <td className="px-3 py-1.5 font-semibold uppercase">{item.productName || '—'}</td>
                <td className="px-3 py-1.5 uppercase">{item.variantName || '—'}</td>
                <td className="px-3 py-1.5 uppercase">{item.colour || '—'}</td>
                <td className="px-3 py-1.5 text-right">{item.qty}</td>
                <td className="px-3 py-1.5 text-right">{item.rate > 0 ? formatINR(item.rate) : '—'}</td>
                <td className="px-3 py-1.5 text-right">{item.sgstAmount > 0 ? formatINR(item.sgstAmount) : '—'}</td>
                <td className="px-3 py-1.5 text-right">{item.cgstAmount > 0 ? formatINR(item.cgstAmount) : '—'}</td>
                <td className="px-3 py-1.5 text-right font-medium">{item.totalAmount > 0 ? formatINR(item.totalAmount) : '—'}</td>
              </tr>
            ))
          )}

          {/* Totals row */}
          {items.length > 0 && (
            <tr className="border-t-2 border-gray-800 font-semibold bg-gray-50">
              <td className="px-3 py-2 text-[10px]">Totals</td>
              <td colSpan={3} />
              <td className="px-3 py-2 text-right text-[10px]">{totalQty}</td>
              <td className="px-3 py-2 text-right text-[10px]">{formatINR(subTotal)}</td>
              <td className="px-3 py-2 text-right text-[10px]">{formatINR(totalSGST)}</td>
              <td className="px-3 py-2 text-right text-[10px]">{formatINR(totalCGST)}</td>
              <td className="px-3 py-2 text-right text-[10px]">{formatINR(totalLineAmount)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── Bottom ── */}
      <div className="flex justify-end px-5 py-4 border-t border-gray-200">
        <div className="w-56 space-y-1.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500 uppercase tracking-wide">Sub Total</span>
            <span className="font-medium">{formatINR(subTotal)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500 uppercase tracking-wide">Discount</span>
            <span className="font-medium">{formatINR(discount)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500 uppercase tracking-wide">GST</span>
            <span className="font-medium">{formatINR(totalGST)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500 uppercase tracking-wide">Insurance</span>
            <span className="font-medium">{formatINR(insurance)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t-2 border-gray-800 pt-1.5">
            <span className="uppercase tracking-wide">Total</span>
            <span>{formatINR(total)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold bg-gray-900 text-white px-2 py-1 rounded">
            <span className="uppercase tracking-wide text-[10px]">Balance Due</span>
            <span>{formatINR(total)}</span>
          </div>
        </div>
      </div>

      {/* ── Terms ── */}
      {insurance > 0 && (
        <div className="px-5 pb-4">
          <div className="text-[9px] font-bold uppercase text-gray-600 mb-1">Terms &amp; Conditions</div>
          <div className="text-[9px] text-red-700">
            Insurance charge @0.075%: {formatINR(insurance)}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="text-center text-[9px] text-gray-400 border-t border-gray-100 py-2 px-5">
        Powered by OHOH Products Pvt. Ltd. &nbsp;·&nbsp; Generated {formatDate(quotationDate)}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PICreator({ dealers, products, variants }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const [dealerSearch, setDealerSearch] = useState('');
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [lineItems, setLineItems] = useState<LineItemState[]>([
    { id: 'item-1', productId: null, variantId: null, colour: '', qty: 1 },
  ]);
  const [quotationDate, setQuotationDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(futureDateISO(7));
  const [seqNumber, setSeqNumber] = useState('00001');
  const [discount, setDiscount] = useState(0);

  // ── Computed line items ──────────────────────────────────────────────────────
  const computedItems = useMemo<ComputedLineItem[]>(() => {
    return lineItems.map(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = variants.find(v => v.id === item.variantId);
      const rate = variant && selectedDealer ? getVariantPrice(variant, selectedDealer.dealerType) : 0;
      const taxableAmount = rate * item.qty;
      const sgstPct = product?.sgst ?? 0;
      const cgstPct = product?.cgst ?? 0;
      const sgstAmount = (taxableAmount * sgstPct) / 100;
      const cgstAmount = (taxableAmount * cgstPct) / 100;

      return {
        ...item,
        productName: product?.productName ?? '',
        variantName: variant?.name ?? '',
        HSN: product?.HSN ?? '',
        rate,
        sgstPct,
        cgstPct,
        sgstAmount,
        cgstAmount,
        taxableAmount,
        totalAmount: taxableAmount + sgstAmount + cgstAmount,
      };
    });
  }, [lineItems, products, variants, selectedDealer]);

  const subTotal = useMemo(() => computedItems.reduce((s, i) => s + i.taxableAmount, 0), [computedItems]);
  const totalSGST = useMemo(() => computedItems.reduce((s, i) => s + i.sgstAmount, 0), [computedItems]);
  const totalCGST = useMemo(() => computedItems.reduce((s, i) => s + i.cgstAmount, 0), [computedItems]);
  const totalGST = totalSGST + totalCGST;
  const insurance = subTotal * INSURANCE_RATE;
  const total = subTotal - discount + totalGST + insurance;

  // ── Invoice number ───────────────────────────────────────────────────────────
  const quotationNumber = useMemo(() => {
    if (!selectedDealer) return `PO-INV-?-?-${new Date(quotationDate).getFullYear()}-${seqNumber}`;
    const oemId = selectedDealer.OEMProfileID;
    const dealerNum = selectedDealer.dealerId.replace(/\D/g, '').replace(/^0+/, '') || '0';
    const year = new Date(quotationDate).getFullYear();
    return `PO-INV-${oemId}-${dealerNum}-${year}-${seqNumber}`;
  }, [selectedDealer, quotationDate, seqNumber]);

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
    setLineItems(prev => (prev.length > 1 ? prev.filter(i => i.id !== id) : prev));
  }, []);

  // ── Print ────────────────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    const root = printRef.current;
    if (!root) return;
    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) { alert('Allow pop-ups to print.'); return; }
    const doc = win.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><meta charset="utf-8">');
    doc.write(`<title>${quotationNumber}</title>`);
    doc.write(`<base href="${document.baseURI}">`);
    document.querySelectorAll('link[rel="stylesheet"]').forEach((node) => {
      doc.write(node.outerHTML);
    });
    document.querySelectorAll('style').forEach((node) => {
      doc.write(node.outerHTML);
    });
    doc.write(`
      <style>
        @page { size: A4; margin: 12mm; }
        body {
          margin: 0;
          padding: 20px;
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @media print {
          body { padding: 0; }
        }
      </style>
    `);
    doc.write('</head><body>');
    doc.write(root.outerHTML);
    doc.write('</body></html>');
    doc.close();
    const schedulePrint = () => {
      win.focus();
      win.print();
      win.close();
    };
    if (win.document.readyState === 'complete') {
      window.setTimeout(schedulePrint, 300);
    } else {
      win.addEventListener('load', () => window.setTimeout(schedulePrint, 300));
    }
  }, [quotationNumber]);

  // ── Dealer select ────────────────────────────────────────────────────────────
  const handleDealerSelect = useCallback((d: Dealer) => {
    setSelectedDealer(d);
    setDealerSearch(d.orgName);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-100">
      {/* Top Bar */}
      <div className="bg-white border-b border-red-700 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold ">Create Purchase Order Invoice</h1>
            <p className="text-xs text-red-200 mt-0.5">Fill in the details to generate a PI invoice</p>
          </div>
          <button
            onClick={handlePrint}
            disabled={!selectedDealer || computedItems.every(i => !i.productId)}
            className="flex items-center gap-2 bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Download
          </button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-6 grid grid-cols-1 xl:grid-cols-[1fr_580px] gap-6">
        {/* ── Left: Form ── */}
        <div className="space-y-5">

          {/* Invoice Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
              Invoice Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Number</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={quotationNumber}
                    readOnly
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                </div>
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
                  value={quotationDate}
                  onChange={e => setQuotationDate(e.target.value)}
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

          {/* Dealer Selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
              Dealer
            </h2>
            <DealerSearch
              dealers={dealers}
              value={dealerSearch}
              onChange={v => {
                setDealerSearch(v);
                if (!v) setSelectedDealer(null);
              }}
              onSelect={handleDealerSelect}
            />

            {selectedDealer && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-red-50 rounded-lg border border-red-100">
                <div>
                  <div className="text-[10px] uppercase font-semibold text-red-500 tracking-wide mb-1">Bill To</div>
                  <div className="font-semibold text-gray-900 text-sm">{selectedDealer.orgName}</div>
                  <div className="text-xs text-gray-600 mt-1 leading-relaxed">
                    {formatAddress(selectedDealer.billingAddress)}<br />
                    Ph: {selectedDealer.contact} · Email: {selectedDealer.orgEmail}<br />
                    GSTIN: {selectedDealer.gstNo}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-red-500 tracking-wide mb-1">Ship To</div>
                  <div className="font-semibold text-gray-900 text-sm">{selectedDealer.orgName}</div>
                  <div className="text-xs text-gray-600 mt-1 leading-relaxed">
                    {formatAddress(selectedDealer.shippingAddress)}<br />
                    Ph: {selectedDealer.contact} · Email: {selectedDealer.orgEmail}<br />
                    GSTIN: {selectedDealer.gstNo}
                  </div>
                </div>
                <div className="sm:col-span-2 flex flex-wrap gap-3 pt-2 border-t border-red-100">
                  <span className="text-xs text-gray-500">Dealer ID: <strong>{selectedDealer.dealerId}</strong></span>
                  <span className="text-xs text-gray-500">Type: <strong className="capitalize">{selectedDealer.dealerType}</strong></span>
                  <span className="text-xs text-gray-500">OEM Profile: <strong>{selectedDealer.OEMProfileID}</strong></span>
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
            <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
              Summary
            </h2>
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
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">SGST</span>
                <span className="font-medium">{formatINR(totalSGST)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">CGST</span>
                <span className="font-medium">{formatINR(totalCGST)}</span>
              </div>
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
        </div>

        {/* ── Right: Preview ── */}
        <div className="xl:sticky xl:top-[72px] xl:h-[calc(100vh-88px)] xl:overflow-y-auto">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Invoice Preview</h2>
              <button
                onClick={handlePrint}
                disabled={!selectedDealer}
                className="text-xs text-red-700 hover:text-red-800 font-medium disabled:opacity-40"
              >
                Print ↗
              </button>
            </div>
            <div className="border border-gray-200 rounded overflow-hidden">
              <InvoicePreview
                quotationNumber={quotationNumber}
                quotationDate={quotationDate}
                dueDate={dueDate}
                dealer={selectedDealer}
                items={computedItems}
                subTotal={subTotal}
                discount={discount}
                totalGST={totalGST}
                totalSGST={totalSGST}
                totalCGST={totalCGST}
                insurance={insurance}
                total={total}
                printRef={printRef}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
