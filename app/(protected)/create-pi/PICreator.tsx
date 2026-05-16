'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Dealer, Product, ProductVariant, ManufacturingUnit } from '@/lib/csvData';
import InvoicePreview from './InvoicePreview';
import type { InvoicePreviewProps } from './InvoicePreview';

// ─── Types ────────────────────────────────────────────────────────────────────

type AccessoryType = 'none' | 'black' | 'steel';
type PriceTier = 'dealer' | 'distributor' | 'subdealer' | 'areadealer';
type DealerAddress = Dealer['billingAddress'];

interface LineItemState {
  id: string;
  productId: number | null;
  variantId: number | null;
  colour: string;
  qty: number;
  accessory: AccessoryType;
}

interface ComputedLineItem extends LineItemState {
  productName: string;
  variantName: string;
  HSN: string;
  rate: number;
  /** Per-unit price including GST. */
  rateWithGst: number;
  sgstPct: number;
  cgstPct: number;
  igstPct: number;
  sgstAmount: number;
  cgstAmount: number;
  igstAmount: number;
  taxableAmount: number;
  accessoryCharge: number;
  totalAmount: number;
}

interface Props {
  dealers: Dealer[];
  products: Product[];
  variants: ProductVariant[];
  manufacturingUnits: ManufacturingUnit[];
  editInvoiceId?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INSURANCE_RATE = 0.075 / 100;
/** GST folded into the insurance charge — included in the amount, not shown separately. */
const INSURANCE_GST_RATE = 0.18;

/** GST-inclusive flat charge added to a line total when an accessory is selected. */
const ACCESSORY_CHARGE: Record<AccessoryType, number> = {
  none: 0,
  black: 1000,
  steel: 1500,
};

/**
 * Price tiers map to the four dealer price-list PDFs. The internal `PriceTier`
 * keys are kept (they drive `ProductVariant` price fields), only the labels
 * reflect the real dealer types.
 */
const PRICE_TIERS: { value: PriceTier; label: string }[] = [
  { value: 'distributor', label: 'Distributor' },
  { value: 'subdealer',   label: 'Divisional Distributor' },
  { value: 'dealer',      label: 'District Dealer' },
  { value: 'areadealer',  label: 'Area Dealer' },
];

const EMPTY_ADDRESS: DealerAddress = { address: '', city: '', state: '', country: '', pincode: '' };

// ─── Utilities ────────────────────────────────────────────────────────────────

function getVariantPrice(variant: ProductVariant, tier: PriceTier): number {
  switch (tier) {
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

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function futureDateISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function normalizeAddress(addr?: Partial<DealerAddress> | null): DealerAddress {
  return { ...EMPTY_ADDRESS, ...(addr || {}) };
}

// ─── EditableField (inline contentEditable, not an input box) ───────────────────

function EditableField({
  value, onCommit, placeholder, className = '',
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      data-placeholder={placeholder}
      onBlur={e => onCommit((e.currentTarget.textContent || '').trim())}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
      }}
      className={`inline-block min-w-[2ch] rounded-sm px-1 outline-none border-b border-dashed border-gray-300 hover:bg-yellow-50 focus:bg-yellow-50 focus:border-red-500 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300 ${className}`}
    >
      {value}
    </span>
  );
}

// ─── EditableAddressBlock ───────────────────────────────────────────────────────

function EditableAddressBlock({
  addr, onChange,
}: {
  addr: DealerAddress;
  onChange: (a: DealerAddress) => void;
}) {
  const set = (field: keyof DealerAddress) => (val: string) => onChange({ ...addr, [field]: val });
  return (
    <div className="text-xs text-gray-700 leading-loose">
      <div>
        <EditableField value={addr.address} onCommit={set('address')} placeholder="Address" />
      </div>
      <div>
        <EditableField value={addr.city} onCommit={set('city')} placeholder="City" />
        <span className="text-gray-400">, </span>
        <EditableField value={addr.state} onCommit={set('state')} placeholder="State" />
        <span className="text-gray-400"> · </span>
        <EditableField value={addr.pincode} onCommit={set('pincode')} placeholder="Pincode" />
      </div>
      <div>
        <EditableField value={addr.country} onCommit={set('country')} placeholder="Country" />
      </div>
    </div>
  );
}

// ─── DealerSearch ─────────────────────────────────────────────────────────────

function DealerSearch({
  dealers, value, onChange, onSelect, placeholder,
}: {
  dealers: Dealer[];
  value: string;
  onChange: (v: string) => void;
  onSelect: (d: Dealer) => void;
  placeholder?: string;
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
        placeholder={placeholder || 'Search dealer by name, ID or city…'}
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
  item, index, products, variants, priceTier, onUpdate, onRemove,
}: {
  item: ComputedLineItem;
  index: number;
  products: Product[];
  variants: ProductVariant[];
  priceTier: PriceTier;
  onUpdate: (id: string, updates: Partial<LineItemState>) => void;
  onRemove: (id: string) => void;
}) {
  // Only variants priced for the selected tier are offered — N/A configs (price 0) are hidden.
  const productVariants = useMemo(
    () => variants.filter(v => v.productId === item.productId && getVariantPrice(v, priceTier) > 0),
    [variants, item.productId, priceTier],
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
              {v.name}
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
      <td className="py-2 px-2 w-40">
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={item.accessory === 'black'}
              onChange={e => onUpdate(item.id, { accessory: e.target.checked ? 'black' : 'none' })}
              className="h-3.5 w-3.5 accent-gray-800"
            />
            Black Accessory <span className="text-gray-400">+₹1,000</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={item.accessory === 'steel'}
              onChange={e => onUpdate(item.id, { accessory: e.target.checked ? 'steel' : 'none' })}
              className="h-3.5 w-3.5 accent-gray-800"
            />
            Steel Accessory <span className="text-gray-400">+₹1,500</span>
          </label>
        </div>
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
        {item.rateWithGst > 0 ? formatINR(item.rateWithGst) : '—'}
      </td>
      <td className="py-2 px-2 text-right text-sm font-medium text-gray-800 w-28 whitespace-nowrap">
        {item.totalAmount > 0 ? formatINR(item.totalAmount) : '—'}
        {item.accessoryCharge > 0 && (
          <span className="block text-[10px] text-gray-400 font-normal">
            incl. {formatINR(item.accessoryCharge)} accessory
          </span>
        )}
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

export default function PICreator({ dealers, products, variants, manufacturingUnits, editInvoiceId }: Props) {
  // Bill To dealer
  const [billToSearch, setBillToSearch] = useState('');
  const [billToDealer, setBillToDealer] = useState<Dealer | null>(null);
  const [billToAddr, setBillToAddr] = useState<DealerAddress>(EMPTY_ADDRESS);

  // Ship To dealer (separate from Bill To)
  const [shipToSearch, setShipToSearch] = useState('');
  const [shipToDealer, setShipToDealer] = useState<Dealer | null>(null);
  const [shipToAddr, setShipToAddr] = useState<DealerAddress>(EMPTY_ADDRESS);

  const [priceTier, setPriceTier] = useState<PriceTier>('dealer');

  const [selectedMU, setSelectedMU] = useState<ManufacturingUnit | null>(
    manufacturingUnits.length === 1 ? manufacturingUnits[0] : null,
  );
  const [taxType, setTaxType] = useState<'within_state' | 'other_state'>('within_state');
  const [lineItems, setLineItems] = useState<LineItemState[]>([
    { id: 'item-1', productId: null, variantId: null, colour: '', qty: 1, accessory: 'none' },
  ]);
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(futureDateISO(7));
  const [seqNumber, setSeqNumber] = useState('00001');
  const [discount, setDiscount] = useState(0);
  const [insuranceEnabled, setInsuranceEnabled] = useState(true);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const fetchNextSequence = useCallback(async () => {
    try {
      const res = await fetch('/api/invoices?nextSequence=true');
      const json = await res.json() as { success: boolean; data?: { nextSequence?: string } };
      if (json.success && json.data?.nextSequence) {
        setSeqNumber(json.data.nextSequence);
      }
    } catch {
      // fallback: keep default sequence when API is unavailable
    }
  }, []);

  useEffect(() => {
    void fetchNextSequence();
  }, [fetchNextSequence]);

  useEffect(() => {
    if (!editInvoiceId) return;
    const loadInvoiceForEdit = async () => {
      setLoadingInvoice(true);
      setSaveError('');
      try {
        const res = await fetch(`/api/invoices/${editInvoiceId}`);
        const json = await res.json() as { success: boolean; data?: Record<string, unknown>; message?: string };
        if (!json.success || !json.data) throw new Error(json.message || 'Failed to load invoice');
        const invoice = json.data;
        const billDealer = invoice.dealer as Dealer;
        const shipDealer = (invoice.shipToDealer as Dealer) || billDealer;
        const manufacturingUnit = invoice.manufacturingUnit as ManufacturingUnit;
        const loadedLineItems = (invoice.lineItems as LineItemState[]) || [];

        setBillToDealer(billDealer);
        setBillToSearch(billDealer.orgName);
        setBillToAddr(normalizeAddress(billDealer.billingAddress));

        setShipToDealer(shipDealer);
        setShipToSearch(shipDealer.orgName);
        // Legacy invoices stored the ship address on dealer.shippingAddress.
        setShipToAddr(normalizeAddress(shipDealer.shippingAddress || shipDealer.billingAddress));

        setSelectedMU(manufacturingUnit);
        setTaxType((invoice.taxType as 'within_state' | 'other_state') || 'within_state');
        setLineItems(
          loadedLineItems.length > 0
            ? loadedLineItems.map(item => ({
                id: item.id,
                productId: item.productId,
                variantId: item.variantId,
                colour: item.colour,
                qty: item.qty,
                accessory: (item.accessory as AccessoryType) || 'none',
              }))
            : [{ id: 'item-1', productId: null, variantId: null, colour: '', qty: 1, accessory: 'none' }],
        );
        setInvoiceDate((invoice.invoiceDate as string) || todayISO());
        setDueDate((invoice.dueDate as string) || futureDateISO(7));
        setSeqNumber((invoice.seqNumber as string) || '00001');
        setDiscount(Number(invoice.discount || 0));
        setInsuranceEnabled(invoice.insuranceEnabled !== false);
      } catch (err: unknown) {
        setSaveError(err instanceof Error ? err.message : 'Failed to load invoice');
      } finally {
        setLoadingInvoice(false);
      }
    };
    void loadInvoiceForEdit();
  }, [editInvoiceId]);

  // ── Computed line items ──────────────────────────────────────────────────────
  const computedItems = useMemo<ComputedLineItem[]>(() => {
    return lineItems.map(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = variants.find(v => v.id === item.variantId);
      const rate = variant ? getVariantPrice(variant, priceTier) : 0;
      const taxableAmount = rate * item.qty;
      const sgstPct = product?.sgst ?? 0;
      const cgstPct = product?.cgst ?? 0;
      const igstPct = sgstPct + cgstPct;

      // Per-unit price including GST (same whether SGST+CGST or IGST is applied).
      const rateWithGst = rate + (rate * igstPct) / 100;

      const sgstAmount = taxType === 'within_state' ? (taxableAmount * sgstPct) / 100 : 0;
      const cgstAmount = taxType === 'within_state' ? (taxableAmount * cgstPct) / 100 : 0;
      const igstAmount = taxType === 'other_state' ? (taxableAmount * igstPct) / 100 : 0;

      // Accessory charge is GST-inclusive — added flat to the line total.
      const accessoryCharge = ACCESSORY_CHARGE[item.accessory] ?? 0;

      return {
        ...item,
        productName: product?.productName ?? '',
        variantName: variant?.name ?? '',
        HSN: product?.HSN ?? '',
        rate,
        rateWithGst,
        sgstPct,
        cgstPct,
        igstPct,
        sgstAmount,
        cgstAmount,
        igstAmount,
        taxableAmount,
        accessoryCharge,
        totalAmount: taxableAmount + sgstAmount + cgstAmount + igstAmount + accessoryCharge,
      };
    });
  }, [lineItems, products, variants, priceTier, taxType]);

  const subTotal       = useMemo(() => computedItems.reduce((s, i) => s + i.taxableAmount, 0), [computedItems]);
  const totalSGST      = useMemo(() => computedItems.reduce((s, i) => s + i.sgstAmount, 0), [computedItems]);
  const totalCGST      = useMemo(() => computedItems.reduce((s, i) => s + i.cgstAmount, 0), [computedItems]);
  const totalIGST      = useMemo(() => computedItems.reduce((s, i) => s + i.igstAmount, 0), [computedItems]);
  const totalAccessory = useMemo(() => computedItems.reduce((s, i) => s + i.accessoryCharge, 0), [computedItems]);
  const totalGST   = totalSGST + totalCGST + totalIGST;
  const insurance  = insuranceEnabled ? subTotal * INSURANCE_RATE * (1 + INSURANCE_GST_RATE) : 0;
  const total      = subTotal - discount + totalGST + insurance + totalAccessory;

  // Effective dealers carry the inline-edited addresses for this PI only.
  const effectiveBillTo = useMemo<Dealer | null>(() => {
    if (!billToDealer) return null;
    return { ...billToDealer, billingAddress: billToAddr };
  }, [billToDealer, billToAddr]);

  const effectiveShipTo = useMemo<Dealer | null>(() => {
    if (!shipToDealer) return null;
    return { ...shipToDealer, shippingAddress: shipToAddr };
  }, [shipToDealer, shipToAddr]);

  // ── Invoice number ───────────────────────────────────────────────────────────
  const invoiceNumber = useMemo(() => {
    if (!billToDealer) return `PO-INV-?-?-${new Date(invoiceDate).getFullYear()}-${seqNumber}`;
    const oemId     = billToDealer.OEMProfileID;
    const dealerNum = billToDealer.dealerId.replace(/\D/g, '').replace(/^0+/, '') || '0';
    const year      = new Date(invoiceDate).getFullYear();
    return `PO-INV-${oemId}-${dealerNum}-${year}-${seqNumber}`;
  }, [billToDealer, invoiceDate, seqNumber]);

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
      { id: `item-${Date.now()}`, productId: null, variantId: null, colour: '', qty: 1, accessory: 'none' },
    ]);
  }, []);

  const removeLineItem = useCallback((id: string) => {
    setLineItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
  }, []);

  // When the price tier changes, drop any selected variant now N/A for that tier.
  useEffect(() => {
    setLineItems(prev => {
      let changed = false;
      const next = prev.map(item => {
        if (item.variantId == null) return item;
        const v = variants.find(x => x.id === item.variantId);
        if (v && getVariantPrice(v, priceTier) > 0) return item;
        changed = true;
        return { ...item, variantId: null };
      });
      return changed ? next : prev;
    });
  }, [priceTier, variants]);

  // ── Dealer select ────────────────────────────────────────────────────────────
  const handleBillToSelect = useCallback((d: Dealer) => {
    setBillToDealer(d);
    setBillToSearch(d.orgName);
    setBillToAddr(normalizeAddress(d.billingAddress));
  }, []);

  const handleShipToSelect = useCallback((d: Dealer) => {
    setShipToDealer(d);
    setShipToSearch(d.orgName);
    // Ship To is filled from the selected dealer's BILLING address, then editable.
    setShipToAddr(normalizeAddress(d.billingAddress));
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
    if (!effectiveBillTo || !effectiveShipTo || !selectedMU) return;
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        invoiceNumber,
        invoiceDate,
        dueDate,
        seqNumber,
        manufacturingUnit: selectedMU,
        dealer: effectiveBillTo,
        shipToDealer: effectiveShipTo,
        lineItems: computedItems,
        taxType,
        subTotal,
        discount,
        totalSGST,
        totalCGST,
        totalIGST,
        totalGST,
        totalAccessory,
        insurance,
        insuranceEnabled,
        total,
      };
      const endpoint = editInvoiceId ? `/api/invoices/${editInvoiceId}` : '/api/invoices';
      const method = editInvoiceId ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message || 'Failed to save');
      setSaved(true);
      await fetchNextSequence();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  }, [
    effectiveBillTo, effectiveShipTo, selectedMU, invoiceNumber, invoiceDate, dueDate, seqNumber,
    computedItems, taxType, subTotal, discount, totalSGST, totalCGST, totalIGST,
    totalGST, totalAccessory, insurance, insuranceEnabled, total, fetchNextSequence, editInvoiceId,
  ]);

  // ── Preview props ────────────────────────────────────────────────────────────
  const previewProps: InvoicePreviewProps = {
    invoiceNumber,
    invoiceDate,
    dueDate,
    manufacturingUnit: selectedMU,
    dealer: effectiveBillTo,
    shipToDealer: effectiveShipTo,
    items: computedItems,
    taxType,
    subTotal,
    discount,
    totalSGST,
    totalCGST,
    totalIGST,
    totalGST,
    totalAccessory,
    insurance,
    insuranceEnabled,
    total,
  };

  const canConfirm = !!billToDealer && !!shipToDealer && !!selectedMU && computedItems.some(i => i.productId);

  return (
    <div className="min-h-screen bg-zinc-100 print:bg-white">

      {/* ── Print-only area (hidden on screen, shown when printing) ── */}
      <div className="hidden print:block">
        <InvoicePreview {...previewProps} />
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
              <div className="mt-1 text-[10px] text-gray-400">Auto Sequence: {seqNumber}</div>
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

        {/* Bill To / Ship To */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            Bill To &amp; Ship To
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Bill To */}
            <div>
              <div className="text-[10px] uppercase font-semibold text-red-500 tracking-wide mb-1">Bill To Dealer</div>
              <DealerSearch
                dealers={dealers}
                value={billToSearch}
                onChange={v => {
                  setBillToSearch(v);
                  if (!v) { setBillToDealer(null); setBillToAddr(EMPTY_ADDRESS); }
                }}
                onSelect={handleBillToSelect}
                placeholder="Search Bill To dealer…"
              />
              {billToDealer && (
                <div key={`bill-${billToDealer.id}`} className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="font-semibold text-gray-900 text-sm">{billToDealer.orgName}</div>
                  <div className="text-[10px] text-gray-500 mb-2">
                    {billToDealer.dealerId} · Ph: {billToDealer.contact} · GSTIN: {billToDealer.gstNo}
                  </div>
                  <div className="text-[10px] uppercase font-semibold text-gray-400 tracking-wide">
                    Billing Address (click any value to edit)
                  </div>
                  <EditableAddressBlock addr={billToAddr} onChange={setBillToAddr} />
                </div>
              )}
            </div>

            {/* Ship To */}
            <div>
              <div className="text-[10px] uppercase font-semibold text-red-500 tracking-wide mb-1">Ship To Dealer</div>
              <DealerSearch
                dealers={dealers}
                value={shipToSearch}
                onChange={v => {
                  setShipToSearch(v);
                  if (!v) { setShipToDealer(null); setShipToAddr(EMPTY_ADDRESS); }
                }}
                onSelect={handleShipToSelect}
                placeholder="Search Ship To dealer…"
              />
              {shipToDealer && (
                <div key={`ship-${shipToDealer.id}`} className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="font-semibold text-gray-900 text-sm">{shipToDealer.orgName}</div>
                  <div className="text-[10px] text-gray-500 mb-2">
                    {shipToDealer.dealerId} · Ph: {shipToDealer.contact} · GSTIN: {shipToDealer.gstNo}
                  </div>
                  <div className="text-[10px] uppercase font-semibold text-gray-400 tracking-wide">
                    Shipping Address (click any value to edit)
                  </div>
                  <EditableAddressBlock addr={shipToAddr} onChange={setShipToAddr} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="mb-4 pb-2 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-700">Line Items</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">Price for Dealer Type</label>
              <select
                value={priceTier}
                onChange={e => setPriceTier(e.target.value as PriceTier)}
                className="border border-zinc-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                {PRICE_TIERS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            Prices below are shown for the <strong className="text-gray-600 capitalize">{priceTier}</strong> tier.
            Change the dropdown to re-price every product line.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  {['#', 'Model', 'Variant', 'Colour', 'Accessory', 'Qty', 'Rate (incl. GST)', 'Line Total', ''].map(h => (
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
                    priceTier={priceTier}
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
            {totalAccessory > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Accessories <span className="text-[10px]">(incl. GST)</span></span>
                <span className="font-medium">{formatINR(totalAccessory)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Insurance <span className="text-[10px]">(@0.075%)</span></span>
              <span className="font-medium">{formatINR(insurance)}</span>
            </div>
            <label className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Include Insurance</span>
              <input
                type="checkbox"
                checked={insuranceEnabled}
                onChange={e => setInsuranceEnabled(e.target.checked)}
                className="h-4 w-4 accent-red-700"
              />
            </label>
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
            {editInvoiceId ? 'Preview & Confirm PI Update' : 'Preview & Confirm Invoice'}
          </button>
        </div>
      </div>
      {loadingInvoice && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center print:hidden">
          <div className="bg-white rounded-lg px-4 py-3 text-sm font-medium text-gray-700 shadow-lg">
            Loading invoice for edit...
          </div>
        </div>
      )}

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
