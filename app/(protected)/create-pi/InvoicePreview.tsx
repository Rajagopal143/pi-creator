'use client';

import Image from 'next/image';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PreviewManufacturingUnit {
  id: number;
  unitName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstNo: string;
  phoneNo: string;
  email: string;
  accountNumber: string;
}

export interface PreviewAddress {
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

export interface PreviewDealer {
  orgName: string;
  contact: string;
  orgEmail: string;
  gstNo: string;
  billingAddress: PreviewAddress;
  shippingAddress: PreviewAddress;
}

export type AccessoryType = 'none' | 'black' | 'steel';

export interface PreviewLineItem {
  id: string;
  productName: string;
  variantName: string;
  HSN: string;
  qty: number;
  rate: number;
  /** Per-unit price including GST. Optional for legacy invoices. */
  rateWithGst?: number;
  /** Per-unit rate with the accessory folded in. Optional for legacy invoices. */
  displayRate?: number;
  /** Per-unit GST-inclusive rate with the accessory folded in. Optional for legacy invoices. */
  displayRateWithGst?: number;
  sgstPct: number;
  cgstPct: number;
  igstPct: number;
  sgstAmount: number;
  cgstAmount: number;
  igstAmount: number;
  taxableAmount: number;
  accessory?: AccessoryType;
  accessoryCharge?: number;
  totalAmount: number;
}

export interface InvoicePreviewProps {
  invoiceNumber: string;
  /** When true the invoice-number field is masked — the number is only revealed after save. */
  hideInvoiceNumber?: boolean;
  invoiceDate: string;
  dueDate: string;
  manufacturingUnit: PreviewManufacturingUnit | null;
  /** Bill To dealer */
  dealer: PreviewDealer | null;
  /** Ship To dealer (separate from Bill To). Falls back to `dealer` for legacy invoices. */
  shipToDealer?: PreviewDealer | null;
  items: PreviewLineItem[];
  taxType: 'within_state' | 'other_state';
  subTotal: number;
  discount: number;
  totalSGST: number;
  totalCGST: number;
  totalIGST: number;
  totalGST: number;
  totalAccessory?: number;
  /** GST-exclusive transportation charge. Optional for legacy invoices. */
  transportCharge?: number;
  /** 18% GST computed on the transportation charge. */
  transportGST?: number;
  insurance: number;
  insuranceEnabled?: boolean;
  /** Signed rounding adjustment applied to reach the whole-rupee total. */
  roundOff?: number;
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCESSORY_LABEL: Record<AccessoryType, string> = {
  none: '—',
  black: 'Black Accessory',
  steel: 'Steel Accessory',
};

function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatAddr(addr: PreviewAddress | undefined | null): string {
  if (!addr) return '';
  return [addr.address, addr.city, addr.state, addr.country, addr.pincode]
    .filter(Boolean)
    .join(', ');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvoicePreview({
  invoiceNumber,
  hideInvoiceNumber = false,
  invoiceDate,
  dueDate,
  manufacturingUnit,
  dealer,
  shipToDealer,
  items,
  taxType,
  subTotal,
  discount,
  totalSGST,
  totalCGST,
  totalIGST,
  totalGST,
  transportCharge = 0,
  transportGST = 0,
  insurance,
  insuranceEnabled = true,
  roundOff = 0,
  total,
}: InvoicePreviewProps) {
  const isOtherState = taxType === 'other_state';
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalLineAmount = items.reduce((s, i) => s + i.totalAmount, 0);
  const hasAccessory = items.some(i => i.accessory && i.accessory !== 'none');

  // Column headers — the ACCESSORY column is dropped when no item has an accessory.
  const headers = [
    '#', 'MODEL', 'VARIANT',
    ...(hasAccessory ? ['ACCESSORY'] : []),
    'HSN', 'QTY', 'RATE', 'RATE (INCL GST)',
    ...(isOtherState ? ['IGST%', 'IGST'] : ['SGST%', 'SGST', 'CGST%', 'CGST']),
    'AMOUNT',
  ];
  const RIGHT_ALIGNED = ['QTY', 'RATE', 'RATE (INCL GST)', 'SGST%', 'SGST', 'CGST%', 'CGST', 'IGST%', 'IGST', 'AMOUNT'];

  // Ship To is a separate dealer; legacy invoices fall back to the Bill To dealer.
  const shipTo = shipToDealer ?? dealer;

  const muAddress = manufacturingUnit
    ? [manufacturingUnit.address, manufacturingUnit.city, manufacturingUnit.state, manufacturingUnit.pincode]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <div
      className="bg-white border border-gray-300 text-[11px] text-gray-800 font-sans "
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {/* ── Header ── */}
      <div className="flex justify-between items-start p-5 border-b-2 border-black">
        <div className="flex items-start gap-3">
          <Image src="/logo.svg" alt="Logo" width={128} height={32} className="h-8 w-auto" priority />
          <div>
            <div className="text-base font-bold text-black">
              {manufacturingUnit?.unitName || 'Yakuza E-Vehicles Private Limited'}
            </div>
            <div className="mt-1 text-[10px] text-gray-700 leading-relaxed">
              {muAddress || '—'}<br />
              {manufacturingUnit && (
                <>Ph: {manufacturingUnit.phoneNo} · {manufacturingUnit.email} · GSTIN: {manufacturingUnit.gstNo}</>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-red-700">Yakuza DMS</div>
          <div className="text-2xl font-bold text-black tracking-widest">PROFORMA INVOICE</div>
        </div>
      </div>

      {/* ── Meta ── */}
      <div className="flex flex-wrap gap-6 px-5 py-3 border-b border-gray-200 bg-gray-50 text-[10px]">
        <div>
          <div className="text-gray-400 uppercase font-semibold tracking-wide text-[9px]">Invoice #</div>
          <div className="font-semibold text-gray-900 mt-0.5">
            {hideInvoiceNumber
              ? <span className="italic font-normal text-gray-400">(assigned on save)</span>
              : invoiceNumber}
          </div>
        </div>
        <div>
          <div className="text-gray-400 uppercase font-semibold tracking-wide text-[9px]">Date</div>
          <div className="font-semibold text-gray-900 mt-0.5">{formatDate(invoiceDate)}</div>
        </div>
        <div>
          <div className="text-gray-400 uppercase font-semibold tracking-wide text-[9px]">Due Date</div>
          <div className="font-semibold text-gray-900 mt-0.5">{formatDate(dueDate)}</div>
        </div>
        {manufacturingUnit && (
          <div>
            <div className="text-gray-400 uppercase font-semibold tracking-wide text-[9px]">MFG Unit GSTIN</div>
            <div className="font-semibold text-gray-900 mt-0.5">{manufacturingUnit.gstNo}</div>
          </div>
        )}
      </div>

      {/* ── Parties ── */}
      <div className="grid grid-cols-2 gap-0 border-b border-gray-200">
        <div className="px-5 py-3 border-r border-gray-200">
          <div className="text-[9px] uppercase text-gray-400 font-semibold tracking-wider mb-1">Bill To (Dealer)</div>
          <div className="font-bold text-gray-900 text-[11px]">{dealer?.orgName || '—'}</div>
          {dealer && (
            <div className="text-[10px] text-gray-600 mt-1 leading-relaxed">
              {formatAddr(dealer.billingAddress)}<br />
              Ph: {dealer.contact} · {dealer.orgEmail}<br />
              GSTIN: {dealer.gstNo}
            </div>
          )}
        </div>
        <div className="px-5 py-3">
          <div className="text-[9px] uppercase text-gray-400 font-semibold tracking-wider mb-1">Ship To (Dealer)</div>
          <div className="font-bold text-gray-900 text-[11px]">{shipTo?.orgName || '—'}</div>
          {shipTo && (
            <div className="text-[10px] text-gray-600 mt-1 leading-relaxed">
              {formatAddr(shipTo.shippingAddress)}<br />
              Ph: {shipTo.contact} · {shipTo.orgEmail}<br />
              GSTIN: {shipTo.gstNo}
            </div>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
      {/* ── Items Table ── */}
      <table className="w-full border-collapse overflow-x-auto">
        <thead>
          <tr className="border-b-2 border-gray-800 bg-gray-50">
            {headers.map(h => (
              <th
                key={h}
                className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-gray-700"
                style={RIGHT_ALIGNED.includes(h) ? { textAlign: 'right' } : { textAlign: 'left' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-4 text-center text-gray-400 italic">
                No items added yet
              </td>
            </tr>
          ) : (
            items.map((item, idx) => {
              const accessory = item.accessory ?? 'none';
              const accessoryCharge = item.accessoryCharge ?? 0;
              // Rate columns include the accessory amount when one is selected.
              const rate = item.displayRate ?? item.rate;
              const rateWithGst =
                item.displayRateWithGst ?? item.rateWithGst ?? item.rate + (item.rate * item.igstPct) / 100;
              return (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="px-2 py-1.5">{idx + 1}</td>
                <td className="px-2 py-1.5 font-semibold uppercase">{item.productName || '—'}</td>
                <td className="px-2 py-1.5 uppercase">{item.variantName || '—'}</td>
                {hasAccessory && (
                  <td className="px-2 py-1.5">
                    {accessory === 'none' ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span className="font-medium">
                        {ACCESSORY_LABEL[accessory]}
                        <span className="block text-[8px] text-gray-500">
                          + {formatINR(accessoryCharge)} (pre-tax)
                        </span>
                      </span>
                    )}
                  </td>
                )}
                <td className="px-2 py-1.5">{item.HSN || '—'}</td>
                <td className="px-2 py-1.5 text-right">{item.qty}</td>
                <td className="px-2 py-1.5 text-right">{rate > 0 ? formatINR(rate) : '—'}</td>
                <td className="px-2 py-1.5 text-right">{rateWithGst > 0 ? formatINR(rateWithGst) : '—'}</td>
                {isOtherState ? (
                  <>
                    <td className="px-2 py-1.5 text-right">{item.igstPct > 0 ? `${item.igstPct}%` : '—'}</td>
                    <td className="px-2 py-1.5 text-right">{item.igstAmount > 0 ? formatINR(item.igstAmount) : '—'}</td>
                  </>
                ) : (
                  <>
                    <td className="px-2 py-1.5 text-right">{item.sgstPct > 0 ? `${item.sgstPct}%` : '—'}</td>
                    <td className="px-2 py-1.5 text-right">{item.sgstAmount > 0 ? formatINR(item.sgstAmount) : '—'}</td>
                    <td className="px-2 py-1.5 text-right">{item.cgstPct > 0 ? `${item.cgstPct}%` : '—'}</td>
                    <td className="px-2 py-1.5 text-right">{item.cgstAmount > 0 ? formatINR(item.cgstAmount) : '—'}</td>
                  </>
                )}
                <td className="px-2 py-1.5 text-right font-medium">
                  {item.totalAmount > 0 ? formatINR(item.totalAmount) : '—'}
                </td>
              </tr>
              );
            })
          )}

          {items.length > 0 && (
            <tr className="border-t-2 border-gray-800 font-semibold bg-gray-50">
              <td className="px-2 py-2 text-[10px]">Totals</td>
              <td colSpan={hasAccessory ? 4 : 3} />
              <td className="px-2 py-2 text-right text-[10px]">{totalQty}</td>
              <td className="px-2 py-2 text-right text-[10px]">{formatINR(subTotal)}</td>
              <td />
              {isOtherState ? (
                <>
                  <td />
                  <td className="px-2 py-2 text-right text-[10px]">{formatINR(totalIGST)}</td>
                </>
              ) : (
                <>
                  <td />
                  <td className="px-2 py-2 text-right text-[10px]">{formatINR(totalSGST)}</td>
                  <td />
                  <td className="px-2 py-2 text-right text-[10px]">{formatINR(totalCGST)}</td>
                </>
              )}
              <td className="px-2 py-2 text-right text-[10px]">{formatINR(totalLineAmount)}</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      {hasAccessory && (
        <div className="px-5 py-2 border-t border-gray-200 text-[9px] text-gray-500">
          <strong className="text-gray-700">Note:</strong> Accessory prices (Black Accessory ₹1,000/unit ·
          Steel Accessory ₹1,500/unit) include 5% GST. The pre-tax value is shown in the sub total and the
          5% GST is included in the total GST.
        </div>
      )}

      {/* ── Summary ── */}
      <div className="flex justify-end px-5 py-4 border-t border-gray-200">
        <div className="w-60 space-y-1.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500 uppercase tracking-wide">Sub Total</span>
            <span className="font-medium">{formatINR(subTotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500 uppercase tracking-wide">Discount</span>
              <span className="font-medium text-red-600">− {formatINR(discount)}</span>
            </div>
          )}
          {isOtherState ? (
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500 uppercase tracking-wide">IGST</span>
              <span className="font-medium">{formatINR(totalIGST)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500 uppercase tracking-wide">SGST</span>
                <span className="font-medium">{formatINR(totalSGST)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500 uppercase tracking-wide">CGST</span>
                <span className="font-medium">{formatINR(totalCGST)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500 uppercase tracking-wide">Total GST</span>
            <span className="font-medium">{formatINR(totalGST)}</span>
          </div>
          {transportCharge > 0 && (
            <>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500 uppercase tracking-wide">Transportation</span>
                <span className="font-medium">{formatINR(transportCharge)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500 uppercase tracking-wide">Transportation GST (18%)</span>
                <span className="font-medium">{formatINR(transportGST)}</span>
              </div>
            </>
          )}
          {insuranceEnabled && (
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500 uppercase tracking-wide">Insurance (@0.075%)</span>
              <span className="font-medium">{formatINR(insurance)}</span>
            </div>
          )}
          {Math.abs(roundOff) > 0.0001 && (
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500 uppercase tracking-wide">Round Off</span>
              <span className="font-medium">
                {roundOff >= 0 ? '+ ' : '− '}{formatINR(Math.abs(roundOff))}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold border-t-2 border-gray-800 pt-1.5">
            <span className="uppercase tracking-wide">Total</span>
            <span>{formatINR(total)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold bg-gray-900 text-white px-2 py-1.5 rounded">
            <span className="uppercase tracking-wide text-[10px]">Balance Due</span>
            <span>{formatINR(total)}</span>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="text-center text-[9px] text-gray-400 border-t border-gray-100 py-2 px-5">
        Powered by OHOH Products Pvt. Ltd. &nbsp;·&nbsp; Generated {formatDate(invoiceDate)}
        &nbsp;·&nbsp; {isOtherState ? 'IGST Applied' : 'CGST + SGST Applied'}
      </div>
    </div>
  );
}
