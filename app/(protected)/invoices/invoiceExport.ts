import type { SavedInvoice } from '@/lib/invoiceModel';

/**
 * Builds and downloads a spreadsheet of the given invoices.
 *
 * The layout mirrors the manual register: one row per line item, grouped by
 * invoice — DATE / Order / Party are shown only on the first item of each
 * invoice, with a blank separator row between invoices. The file is CSV, which
 * Excel opens directly as a worksheet.
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const COLUMNS = [
  'DATE', 'Order', 'Token', 'Bill To', 'Ship To',
  'Name of Item', 'Ordered', 'Rate', 'Expected Delivery',
] as const;

/** Formats an ISO date as `DD-MMM-YY`, e.g. `2026-04-20` → `20-Apr-26`. */
function formatExportDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const month = MONTHS[Number(m) - 1] ?? m;
  return `${d}-${month}-${y.slice(2)}`;
}

/** Escapes a value for safe inclusion in a CSV cell. */
function csvCell(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Distinct product models across the export, in first-seen order. */
function collectModels(invoices: SavedInvoice[]): string[] {
  const models: string[] = [];
  const seen = new Set<string>();
  for (const inv of invoices) {
    for (const item of inv.lineItems ?? []) {
      const name = (item.productName ?? '').trim();
      if (name && !seen.has(name)) { seen.add(name); models.push(name); }
    }
  }
  return models;
}

/** Sums line-item quantities by product model for a single invoice. */
function modelQtyMap(inv: SavedInvoice): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of inv.lineItems ?? []) {
    const name = (item.productName ?? '').trim();
    if (!name) continue;
    map[name] = (map[name] ?? 0) + (item.qty ?? 0);
  }
  return map;
}

/** Builds the grouped line-item rows (the left-hand table). */
function buildLineItemRows(ordered: SavedInvoice[]): (string | number)[][] {
  const rows: (string | number)[][] = [[...COLUMNS]];

  ordered.forEach((inv, invIndex) => {
    const items = inv.lineItems ?? [];
    const date = formatExportDate(inv.invoiceDate);
    const billTo = inv.dealer?.orgName ?? '';
    // Ship To falls back to the Bill To dealer for legacy invoices.
    const shipTo = inv.shipToDealer?.orgName ?? billTo;
    const token = inv.tokenLabel ?? '';
    const delivery = inv.expectedDeliveryDate ? formatExportDate(inv.expectedDeliveryDate) : '';

    if (items.length === 0) {
      rows.push([date, inv.invoiceNumber, token, billTo, shipTo, '', '', '', delivery]);
    } else {
      items.forEach((item, i) => {
        rows.push([
          i === 0 ? date : '',
          i === 0 ? inv.invoiceNumber : '',
          i === 0 ? token : '',
          i === 0 ? billTo : '',
          i === 0 ? shipTo : '',
          `${item.productName ?? ''} ${item.variantName ?? ''}`.trim(),
          `${item.qty ?? 0} NOS`,
          (item.totalAmount ?? 0).toFixed(2),
          i === 0 ? delivery : '',
        ]);
      });
    }

    // Blank row visually separates one invoice block from the next.
    if (invIndex < ordered.length - 1) {
      rows.push(['', '', '', '', '', '', '', '', '']);
    }
  });

  return rows;
}

/**
 * Builds the standalone per-model quantity matrix (the right-hand block):
 * a totals row, a model-name header, then one row per invoice. It is its own
 * grid — rows are NOT aligned to the dated line-item rows on the left.
 */
function buildModelMatrixRows(ordered: SavedInvoice[], models: string[]): (string | number)[][] {
  const maps = ordered.map(modelQtyMap);
  const totals = models.map(m => maps.reduce((s, map) => s + (map[m] ?? 0), 0));

  const rows: (string | number)[][] = [];
  rows.push(totals.map(t => t || ''));               // grand totals, on top
  rows.push([...models]);                             // model-name header
  for (const map of maps) {
    rows.push(models.map(m => (map[m] ? map[m] : ''))); // blank for zero
  }
  return rows;
}

/** Builds the grouped CSV text for the given invoices. */
export function buildInvoiceCsv(invoices: SavedInvoice[]): string {
  // The export API already returns invoices in oldest-first chronological order.
  const ordered = invoices;

  const left = buildLineItemRows(ordered);
  const models = collectModels(ordered);

  // No products → just the line-item table.
  if (models.length === 0) {
    return left.map(r => r.map(csvCell).join(',')).join('\r\n');
  }

  // The matrix is a separate grid placed to the right, with one spacer column.
  const right = buildModelMatrixRows(ordered, models);
  const blankLeft = COLUMNS.map(() => '');
  const blankRight = models.map(() => '');
  const maxLen = Math.max(left.length, right.length);

  const merged: (string | number)[][] = [];
  for (let i = 0; i < maxLen; i++) {
    merged.push([...(left[i] ?? blankLeft), '', ...(right[i] ?? blankRight)]);
  }

  return merged.map(r => r.map(csvCell).join(',')).join('\r\n');
}

/** Triggers a browser download of the invoices as a CSV (Excel-compatible) file. */
export function downloadInvoicesExcel(invoices: SavedInvoice[]): void {
  // The BOM makes Excel read the file as UTF-8.
  const csv = '﻿' + buildInvoiceCsv(invoices);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
