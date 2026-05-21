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

/** Builds the grouped CSV text for the given invoices. */
export function buildInvoiceCsv(invoices: SavedInvoice[]): string {
  const rows: (string | number)[][] = [[...COLUMNS]];

  // The export API already returns invoices in oldest-first chronological order.
  const ordered = invoices;

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

  return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
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
