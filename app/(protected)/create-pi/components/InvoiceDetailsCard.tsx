'use client';

import type { ManufacturingUnit } from '@/lib/csvData';
import { DUE_DATE_OFFSET_DAYS } from '../constants';
import { addDaysISO } from '../utils';
import { AIAutofillCard } from './AIAutofillCard';
import type { POAutofillResult } from '@/lib/ai/poTypes';

/** "Invoice Details" card — number preview plus invoice/due dates. */
export function InvoiceDetailsCard({
  invoiceNumber, assignedNumber, selectedMU,
  invoiceDate, onInvoiceDateChange,
  dueDate, onDueDateChange,
  otherReferenceNumber, onOtherReferenceNumberChange,
  onApplyAutofill,
}: {
  invoiceNumber: string;
  assignedNumber: string | null;
  selectedMU: ManufacturingUnit | null;
  invoiceDate: string;
  onInvoiceDateChange: (v: string) => void;
  dueDate: string;
  onDueDateChange: (v: string) => void;
  otherReferenceNumber: string;
  onOtherReferenceNumberChange: (v: string) => void;
  onApplyAutofill: (res: POAutofillResult) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">
          Invoice Details
        </h2>
        <AIAutofillCard onApply={onApplyAutofill} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Number</label>
          <input
            type="text"
            value={invoiceNumber}
            readOnly
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
          />
          <div className="mt-1 text-[10px] text-gray-400">
            {assignedNumber
              ? 'Assigned number'
              : selectedMU
                ? `Auto-generated on save · ${selectedMU.state} series`
                : 'Auto-generated on save from the manufacturing unit state'}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Date</label>
          <input
            type="date"
            value={invoiceDate}
            onChange={e => {
              onInvoiceDateChange(e.target.value);
              // Due date auto-follows: 15 days after the invoice date.
              if (e.target.value) {
                onDueDateChange(addDaysISO(e.target.value, DUE_DATE_OFFSET_DAYS));
              }
            }}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={e => onDueDateChange(e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
          />
          <div className="mt-1 text-[10px] text-gray-400">
            Auto-set {DUE_DATE_OFFSET_DAYS} days after the invoice date
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Other Reference Number</label>
          <input
            type="text"
            value={otherReferenceNumber}
            onChange={e => onOtherReferenceNumberChange(e.target.value)}
            placeholder="e.g. customer PO / external ref"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
          />
        </div>
      </div>
    </div>
  );
}
