import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { Invoice } from '@/lib/invoiceModel';
import {
  InvoiceCounter,
  ensureCountersSeeded,
  formatInvoiceNumber,
} from '@/lib/invoiceCounterModel';
import { assertSufficientStock, InsufficientStockError } from '@/lib/products/dailyStockModel';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json() as Record<string, unknown>;
    const now = new Date().toISOString();
    const status = (body.status as string) || 'Pending';
    const statusDescription = (body.statusDescription as string) || 'Invoice created';

    const muState = String(
      (body.manufacturingUnit as { state?: string } | undefined)?.state || '',
    ).toUpperCase().trim();
    if (!muState) {
      return NextResponse.json(
        { success: false, message: 'Manufacturing unit state is required to assign an invoice number.' },
        { status: 400 },
      );
    }

    // Make sure default counters exist, and that *this* state has a counter doc
    // ready (covers unknown states). Both are idempotent.
    await ensureCountersSeeded();
    await InvoiceCounter.updateOne(
      { state: muState },
      {
        $setOnInsert: {
          state: muState, stateName: muState, prefix: `${muState}-PI`,
          series: '2627', nextNumber: 1,
        },
      },
      { upsert: true },
    );

    // Stamp status onto the body so the create is a single atomic insert —
    // no follow-up save() needed.
    if (!body.statusHistory || (Array.isArray(body.statusHistory) && body.statusHistory.length === 0)) {
      body.status = status;
      body.statusDescription = statusDescription;
      body.statusHistory = [{ status, description: statusDescription, updatedAt: now }];
    }

    /**
     * Run the counter reservation and the invoice insert inside a single
     * MongoDB transaction:
     *
     *   • `findOneAndUpdate` with `$inc` is atomic at the document level, so
     *     two concurrent submissions can never read the same `nextNumber` —
     *     one transaction wins, the other is retried by `withTransaction`
     *     (which automatically handles transient WriteConflict errors).
     *   • Both writes commit together: if `Invoice.create` fails for any
     *     reason, the counter increment is rolled back, so the series never
     *     advances without producing an invoice (no gaps, no duplicate IDs).
     */
    const session = await mongoose.startSession();
    let invoice: Awaited<ReturnType<typeof Invoice.create>>[number] | undefined;
    try {
      await session.withTransaction(async () => {
        // A PI can only be raised if the MU has enough committable stock today
        // for every line item. Throws → rolls back the counter increment too.
        const muId = Number((body.manufacturingUnit as { id?: number } | undefined)?.id);
        if (Number.isFinite(muId)) {
          const lineItems = (body.lineItems ?? []) as Array<{
            productId?: number; productName?: string; qty?: number;
          }>;
          await assertSufficientStock(muId, lineItems, 'commit', { session });
        }

        const counter = await InvoiceCounter.findOneAndUpdate(
          { state: muState },
          { $inc: { nextNumber: 1 } },
          { new: false, session },
        );
        if (!counter) {
          throw new Error(`No invoice counter found for state ${muState}.`);
        }
        const used = counter.nextNumber;
        body.invoiceNumber = formatInvoiceNumber(counter, used);
        body.seqNumber = String(used);

        const docs = await Invoice.create([body], { session });
        invoice = docs[0];
      });
    } finally {
      await session.endSession();
    }

    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (error: unknown) {
    // Stock ran out between loading the form and saving (someone else ordered
    // it first) — surface a distinct 409 so the client can prompt a refresh.
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: 409 },
      );
    }
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
    // `hasToken=true` restricts the list to invoices ready for dispatch (i.e.
    // ones that have received first payment and been issued a token).
    const hasToken = searchParams.get('hasToken') === 'true';

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
    if (hasToken) query.tokenNumber = { $exists: true };
    if (startDate || endDate) {
      const dateFilter: Record<string, string> = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      query.invoiceDate = dateFilter;
    }

    const [total, qtyAgg] = await Promise.all([
      Invoice.countDocuments(query),
      // `totalQty` is summed across every matching invoice so the All Invoices
      // page can show a "Total Qty" chip that reflects the entire filter — not
      // just the current page.
      Invoice.aggregate<{ totalQty: number }>([
        { $match: query },
        { $unwind: { path: '$lineItems', preserveNullAndEmptyArrays: false } },
        { $group: { _id: null, totalQty: { $sum: '$lineItems.qty' } } },
      ]),
    ]);
    const totalQty = qtyAgg[0]?.totalQty ?? 0;

    // Dispatch list groups by MU then token; everywhere else stays chronological.
    const sort: Record<string, 1 | -1> = hasToken
      ? { 'manufacturingUnit.id': 1, tokenNumber: 1 }
      : { invoiceDate: 1, _id: 1 };

    if (isExport) {
      // No `.limit()` — return every invoice matching the filters across all pages.
      const invoices = await Invoice.find(query).sort(sort).lean();
      return NextResponse.json({
        success: true,
        data: invoices,
        meta: { total: invoices.length, page: 1, limit: invoices.length, totalPages: 1, totalQty },
      });
    }

    const invoices = await Invoice.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data: invoices,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), totalQty },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch invoices';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
