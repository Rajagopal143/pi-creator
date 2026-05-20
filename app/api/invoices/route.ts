import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Invoice } from '@/lib/invoiceModel';
import {
  InvoiceCounter,
  ensureCountersSeeded,
  formatInvoiceNumber,
} from '@/lib/invoiceCounterModel';

/**
 * Atomically reserves the next invoice number for the given state's counter.
 * `$inc` with `new: false` returns the counter as it was *before* the bump,
 * so its `nextNumber` is exactly the number to use — concurrency-safe.
 */
async function reserveInvoiceNumber(state: string): Promise<{ invoiceNumber: string; seqNumber: string } | null> {
  if (!state) return null;
  let counter = await InvoiceCounter.findOneAndUpdate(
    { state },
    { $inc: { nextNumber: 1 } },
    { new: false },
  );
  if (!counter) {
    // Unknown state — create a counter on the fly, then reserve from it.
    await InvoiceCounter.create({
      state, stateName: state, prefix: `${state}-PI`, series: '2627', nextNumber: 1,
    });
    counter = await InvoiceCounter.findOneAndUpdate(
      { state },
      { $inc: { nextNumber: 1 } },
      { new: false },
    );
  }
  if (!counter) return null;
  const used = counter.nextNumber;
  return { invoiceNumber: formatInvoiceNumber(counter, used), seqNumber: String(used) };
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json() as Record<string, unknown>;
    const now = new Date().toISOString();
    const status = (body.status as string) || 'Pending';
    const statusDescription = (body.statusDescription as string) || 'Invoice created';

    // The invoice number is assigned server-side from the per-state counter so
    // it is sequential and collision-free, regardless of the client preview.
    await ensureCountersSeeded();
    const muState = String(
      (body.manufacturingUnit as { state?: string } | undefined)?.state || '',
    ).toUpperCase().trim();
    const reserved = await reserveInvoiceNumber(muState);
    if (reserved) {
      body.invoiceNumber = reserved.invoiceNumber;
      body.seqNumber = reserved.seqNumber;
    }

    const invoice = await Invoice.create(body);
    if (!invoice.statusHistory || invoice.statusHistory.length === 0) {
      invoice.status = status;
      invoice.statusDescription = statusDescription;
      invoice.statusHistory = [{ status, description: statusDescription, updatedAt: now }];
      await invoice.save();
    }
    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to save invoice';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const nextSequence = searchParams.get('nextSequence') === 'true';

    if (nextSequence) {
      const latest = await Invoice.aggregate([
        {
          $project: {
            seqAsNumber: {
              $convert: { input: '$seqNumber', to: 'int', onError: 0, onNull: 0 },
            },
          },
        },
        { $sort: { seqAsNumber: -1 } },
        { $limit: 1 },
      ]);

      const lastSequence = latest[0]?.seqAsNumber ?? 0;
      return NextResponse.json({
        success: true,
        data: { nextSequence: String(lastSequence + 1).padStart(5, '0') },
      });
    }

    // `export=true` returns every matching invoice for a spreadsheet download —
    // it ignores pagination so the file contains all filtered rows across pages.
    const isExport = searchParams.get('export') === 'true';

    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
    const search = searchParams.get('search') || '';
    const taxType = searchParams.get('taxType') || '';
    const status = searchParams.get('status') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const manufacturingUnitId = searchParams.get('manufacturingUnitId') || '';

    const query: Record<string, unknown> = {};

    if (manufacturingUnitId) {
      const id = Number(manufacturingUnitId);
      if (!Number.isNaN(id)) query['manufacturingUnit.id'] = id;
    }

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'dealer.orgName': { $regex: search, $options: 'i' } },
        { 'dealer.dealerId': { $regex: search, $options: 'i' } },
        { 'manufacturingUnit.unitName': { $regex: search, $options: 'i' } },
      ];
    }
    if (taxType) query.taxType = taxType;
    // "Pending" is a bucket for any invoice not yet dispatched or cancelled.
    if (status === 'Pending') {
      query.status = { $nin: ['Dispatched', 'Cancelled'] };
    } else if (status) {
      query.status = status;
    }
    if (startDate || endDate) {
      const dateFilter: Record<string, string> = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      query.invoiceDate = dateFilter;
    }

    const total = await Invoice.countDocuments(query);

    if (isExport) {
      // No `.limit()` — return every invoice matching the filters across all pages.
      const invoices = await Invoice.find(query)
        .sort({ invoiceDate: 1, _id: 1 })
        .lean();
      return NextResponse.json({
        success: true,
        data: invoices,
        meta: { total: invoices.length, page: 1, limit: invoices.length, totalPages: 1 },
      });
    }

    // List invoices by invoice date, oldest to newest (`_id` breaks ties).
    const invoices = await Invoice.find(query)
      .sort({ invoiceDate: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data: invoices,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch invoices';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
