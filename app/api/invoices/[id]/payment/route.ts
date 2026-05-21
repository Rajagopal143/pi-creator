import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { Invoice } from '@/lib/invoiceModel';
import { TokenCounter, formatTokenLabel } from '@/lib/tokenCounterModel';
import { assertSufficientStock, bumpDailyStock } from '@/lib/products/dailyStockModel';

/**
 * Record the first payment on an invoice.
 *
 *   • Allocates a per-MU token (atomic `$inc`, concurrency-safe).
 *   • Reserves the line-item qty against each variant's MU stock.
 *   • Sets the expected delivery date.
 *
 * Everything runs inside `withTransaction` so the token, the invoice mutation,
 * and every stock reservation commit together — or all roll back if any one
 * step fails.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid invoice id' }, { status: 400 });
    }

    const body = await req.json() as {
      amount?: number;
      mode?: string;
      date?: string;
      reference?: string;
      expectedDeliveryDate?: string;
    };

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Amount must be a positive number.' }, { status: 400 });
    }
    const mode = String(body.mode || '').trim();
    if (!mode) {
      return NextResponse.json({ success: false, message: 'Payment mode is required.' }, { status: 400 });
    }
    const date = String(body.date || '').trim() || new Date().toISOString().split('T')[0];
    const reference = String(body.reference || '').trim();
    const expectedDeliveryDate = String(body.expectedDeliveryDate || '').trim();

    // Pre-flight checks outside the transaction (cheap fail-fast).
    const invoice = await Invoice.findById(id).lean();
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found.' }, { status: 404 });
    }
    if (invoice.firstPayment) {
      return NextResponse.json(
        { success: false, message: 'First payment already recorded for this invoice.' },
        { status: 409 },
      );
    }
    const muId = Number((invoice.manufacturingUnit as { id?: number } | undefined)?.id);
    const muState = String((invoice.manufacturingUnit as { state?: string } | undefined)?.state || '').toUpperCase();
    if (!Number.isFinite(muId)) {
      return NextResponse.json(
        { success: false, message: 'Invoice has no manufacturing unit id.' },
        { status: 400 },
      );
    }

    // Ensure the MU's token counter doc exists before the transaction runs.
    await TokenCounter.updateOne(
      { muId },
      { $setOnInsert: { muId, muState, nextNumber: 1 } },
      { upsert: true },
    );

    const session = await mongoose.startSession();
    let updated;
    try {
      await session.withTransaction(async () => {
        // 0) Reservation requires enough committable stock today — otherwise
        //    we'd reserve more than the MU can fulfil. Throws → rolls back.
        const lineItems = (invoice.lineItems ?? []) as Array<{
          productId?: number; productName?: string; qty?: number;
        }>;
        await assertSufficientStock(muId, lineItems, 'commit', { session });

        // 1) Reserve the next token (atomic $inc, returns the pre-increment value).
        const counter = await TokenCounter.findOneAndUpdate(
          { muId },
          { $inc: { nextNumber: 1 } },
          { new: false, session },
        );
        if (!counter) throw new Error('Token counter missing.');
        const tokenNumber = counter.nextNumber;
        const tokenLabel = formatTokenLabel(tokenNumber);
        const recordedAt = new Date().toISOString();

        // 2) Mutate the invoice — guard against a race where another request
        //    has already paid first by checking firstPayment is still unset.
        const result = await Invoice.findOneAndUpdate(
          { _id: id, firstPayment: { $exists: false } },
          {
            $set: {
              firstPayment: { amount, mode, date, reference, recordedAt },
              tokenNumber,
              tokenLabel,
              ...(expectedDeliveryDate ? { expectedDeliveryDate } : {}),
            },
            $push: {
              statusHistory: {
                status: 'Pending',
                description: `First payment ₹${amount} (${mode}) recorded — token ${tokenLabel}`,
                updatedAt: recordedAt,
              },
            },
          },
          { new: true, session },
        );
        if (!result) {
          // Concurrent submit beat us to it — roll back.
          throw new Error('First payment already recorded for this invoice.');
        }

        // 3) Reserve stock on today's DailyStock `reserved` column per product
        //    so the daily ledger reflects the payment (and Closing drops).
        const reservedByProduct = new Map<number, number>();
        for (const item of lineItems) {
          const productCode = Number(item.productId);
          const qty = Number(item.qty) || 0;
          if (!Number.isFinite(productCode) || qty <= 0) continue;
          reservedByProduct.set(productCode, (reservedByProduct.get(productCode) ?? 0) + qty);
        }
        for (const [productCode, qty] of reservedByProduct) {
          await bumpDailyStock(muId, productCode, 'reserved', qty, { session });
        }

        updated = result.toObject();
      });
    } finally {
      await session.endSession();
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to record payment';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
