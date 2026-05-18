'use client';

import type { TaxType } from '../types';
import { TRANSPORT_GST_RATE } from '../constants';
import { formatINR } from '../utils';

/** All monetary figures the summary renders. */
export interface SummaryTotals {
  subTotal: number;
  taxType: TaxType;
  totalSGST: number;
  totalCGST: number;
  totalIGST: number;
  totalGST: number;
  transportGST: number;
  insurance: number;
  roundOff: number;
  total: number;
}

/** "Summary" card — totals breakdown with editable discount & transportation. */
export function SummaryCard({
  totals, discount, onDiscountChange,
  transportCharge, onTransportChargeChange,
  insuranceEnabled, onInsuranceToggle,
}: {
  totals: SummaryTotals;
  discount: number;
  onDiscountChange: (v: number) => void;
  transportCharge: number;
  onTransportChargeChange: (v: number) => void;
  insuranceEnabled: boolean;
  onInsuranceToggle: (v: boolean) => void;
}) {
  const {
    subTotal, taxType, totalSGST, totalCGST, totalIGST,
    totalGST, transportGST, insurance, roundOff, total,
  } = totals;

  return (
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
            onChange={e => onDiscountChange(Math.max(0, Number(e.target.value) || 0))}
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
        <div className="flex justify-between text-sm items-center">
          <span className="text-gray-500">Transportation <span className="text-[10px]">(excl. GST)</span></span>
          <input
            type="number"
            min={0}
            value={transportCharge}
            onChange={e => onTransportChargeChange(Math.max(0, Number(e.target.value) || 0))}
            className="w-28 border border-zinc-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-red-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        {transportCharge > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Transportation GST <span className="text-[10px]">(@{TRANSPORT_GST_RATE}%)</span></span>
            <span className="font-medium">{formatINR(transportGST)}</span>
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
            onChange={e => onInsuranceToggle(e.target.checked)}
            className="h-4 w-4 accent-red-700"
          />
        </label>
        {Math.abs(roundOff) > 0.0001 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Round Off</span>
            <span className="font-medium">
              {roundOff >= 0 ? '+ ' : '− '}{formatINR(Math.abs(roundOff))}
            </span>
          </div>
        )}
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
  );
}
