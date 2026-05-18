'use client';

import type { ReactNode } from 'react';
import type { ManufacturingUnit } from '@/lib/csvData';

// ─── Types & constants ──────────────────────────────────────────────────────────

export interface InvoiceFilters {
  taxType: string;
  manufacturingUnitId: string;
  status: string;
  startDate: string;
  endDate: string;
}

export const EMPTY_FILTERS: InvoiceFilters = {
  taxType: '', manufacturingUnitId: '', status: '', startDate: '', endDate: '',
};

/** Status buckets offered in the list filter. "Pending" = not yet dispatched/cancelled. */
export const STATUS_FILTER_OPTIONS = ['Pending', 'Dispatched', 'Cancelled'] as const;

const fieldClass =
  'border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600';

// ─── Component ──────────────────────────────────────────────────────────────────

/**
 * The set of invoice filter fields, shared by the desktop inline bar
 * (`variant="bar"`) and the mobile filters drawer (`variant="drawer"`).
 */
export function InvoiceFilterControls({
  manufacturingUnits, filters, onChange, variant,
}: {
  manufacturingUnits: ManufacturingUnit[];
  filters: InvoiceFilters;
  onChange: (patch: Partial<InvoiceFilters>) => void;
  variant: 'bar' | 'drawer';
}) {
  const drawer = variant === 'drawer';
  const cls = `${fieldClass}${drawer ? ' w-full' : ''}`;

  // In the drawer each field gets a label; in the bar the field stands alone.
  const field = (label: string, node: ReactNode) =>
    drawer ? (
      <div key={label}>
        <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
        {node}
      </div>
    ) : (
      <span key={label}>{node}</span>
    );

  return (
    <>
      {field('Tax Type',
        <select
          value={filters.taxType}
          onChange={e => onChange({ taxType: e.target.value })}
          className={cls}
          aria-label="Tax Type"
        >
          <option value="">All Tax Types</option>
          <option value="within_state">Within State</option>
          <option value="other_state">Other State</option>
        </select>,
      )}
      {field('Status',
        <select
          value={filters.status}
          onChange={e => onChange({ status: e.target.value })}
          className={cls}
          aria-label="Status"
        >
          <option value="">All Statuses</option>
          {STATUS_FILTER_OPTIONS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>,
      )}
      {field('Manufacturing Unit',
        <select
          value={filters.manufacturingUnitId}
          onChange={e => onChange({ manufacturingUnitId: e.target.value })}
          className={cls}
          aria-label="Manufacturing Unit"
        >
          <option value="">All Units</option>
          {manufacturingUnits.map(mu => (
            <option key={mu.id} value={String(mu.id)}>
              {mu.unitName} ({mu.state})
            </option>
          ))}
        </select>,
      )}
      {field('From Date',
        <input
          type="date"
          value={filters.startDate}
          onChange={e => onChange({ startDate: e.target.value })}
          className={cls}
          aria-label="From Date"
        />,
      )}
      {field('To Date',
        <input
          type="date"
          value={filters.endDate}
          onChange={e => onChange({ endDate: e.target.value })}
          className={cls}
          aria-label="To Date"
        />,
      )}
    </>
  );
}
