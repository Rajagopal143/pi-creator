import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Invoice } from '@/lib/invoiceModel';
import { InvoiceCounter } from '@/lib/invoiceCounterModel';

/** Escapes a string for safe use inside a RegExp. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds the previous and next PI in the same manufacturing-unit series.
 *
 * A PI number is `<prefix>/<series>/<seq>` (e.g. `HR-PI/2627/803`). "Previous"
 * and "next" are the existing invoices with the closest lower / higher `seq`
 * that share the same `<prefix>/<series>/` — i.e. the same manufacturing unit's
 * running series. Gaps (deleted / cancelled numbers) are skipped, so the arrows
 * always land on a PI that exists.
 *
 * The upper end is capped by the per-state counter in settings: for every
 * series (WB-PI, MP-PI, TN-PI, HR-PI …) `next` is never a sequence at or above
 * that counter's `nextNumber`, so navigation stops at the last issued PI even
 * if a stray higher-numbered record exists.
 *
 *   GET /api/invoices/adjacent?invoiceNumber=HR-PI/2627/803
 *   → { success, data: { prev: { id, invoiceNumber } | null,
 *                        next: { id, invoiceNumber } | null } }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceNumber = (searchParams.get('invoiceNumber') || '').trim();
    if (!invoiceNumber) {
      return NextResponse.json(
        { success: false, message: 'invoiceNumber is required' },
        { status: 400 },
      );
    }

    // Split "<prefix>/<series>/<seq>" into its series prefix and numeric seq.
    const lastSlash = invoiceNumber.lastIndexOf('/');
    if (lastSlash === -1) {
      return NextResponse.json(
        { success: false, message: 'Malformed invoice number' },
        { status: 400 },
      );
    }
    const seriesPrefix = invoiceNumber.slice(0, lastSlash); // e.g. "HR-PI/2627"
    const seq = Number(invoiceNumber.slice(lastSlash + 1));
    if (!Number.isFinite(seq)) {
      return NextResponse.json(
        { success: false, message: 'Malformed invoice sequence' },
        { status: 400 },
      );
    }

    await connectDB();

    // Upper bound from settings: the counter whose prefix/series this PI belongs
    // to (WB-PI/2627, MP-PI/2627, TN-PI/2627, HR-PI/2627 …). Numbers from
    // `nextNumber` upwards have not been issued yet, so they are never a "next".
    const firstSlash = seriesPrefix.indexOf('/');
    const prefix = firstSlash === -1 ? seriesPrefix : seriesPrefix.slice(0, firstSlash);
    const series = firstSlash === -1 ? '' : seriesPrefix.slice(firstSlash + 1);
    const counter = await InvoiceCounter.findOne({
      prefix: new RegExp(`^${escapeRegex(prefix)}$`, 'i'),
      series,
    }).lean();
    const maxSeq =
      counter && Number.isFinite(counter.nextNumber) ? counter.nextNumber - 1 : null;

    // Match every PI in this series, derive its numeric seq from the segment
    // after the last slash, then pick the closest lower (prev) and higher (next).
    const [result] = await Invoice.aggregate<{
      prev: Array<{ _id: unknown; invoiceNumber: string }>;
      next: Array<{ _id: unknown; invoiceNumber: string }>;
    }>([
      { $match: { invoiceNumber: { $regex: `^${escapeRegex(seriesPrefix)}/` } } },
      {
        $addFields: {
          _seq: {
            $convert: {
              input: { $arrayElemAt: [{ $split: ['$invoiceNumber', '/'] }, -1] },
              to: 'int',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      { $match: { _seq: { $ne: null } } },
      {
        $facet: {
          prev: [
            { $match: { _seq: { $lt: seq } } },
            { $sort: { _seq: -1 } },
            { $limit: 1 },
            { $project: { invoiceNumber: 1 } },
          ],
          next: [
            {
              $match: {
                _seq: maxSeq === null ? { $gt: seq } : { $gt: seq, $lte: maxSeq },
              },
            },
            { $sort: { _seq: 1 } },
            { $limit: 1 },
            { $project: { invoiceNumber: 1 } },
          ],
        },
      },
    ]);

    const toRef = (d?: { _id: unknown; invoiceNumber: string }) =>
      d ? { id: String(d._id), invoiceNumber: d.invoiceNumber } : null;

    return NextResponse.json({
      success: true,
      data: {
        prev: toRef(result?.prev?.[0]),
        next: toRef(result?.next?.[0]),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch adjacent invoices';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
