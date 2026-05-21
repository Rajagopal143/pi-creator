import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { Invoice } from '@/lib/invoiceModel';
import type { PIStatus } from '@/lib/invoiceStatus';
import { assertSufficientStock, bumpDailyStock } from '@/lib/products/dailyStockModel';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const invoice = await Invoice.findById(id).lean();
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: invoice });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch invoice';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json() as Record<string, unknown>;
    const now = new Date().toISOString();
    const statusDescription = (body.statusDescription as string) || 'Invoice updated';

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    // Editing a PI keeps its current status — only an explicit body.status changes it.
    // `status` is intentionally typed loosely server-side (the schema dropped
    // the enum so legacy invoices stay loadable); cast back to `PIStatus` for
    // assignment to the strictly-typed model.
    const status = ((body.status as string) || invoice.status || 'Pending') as PIStatus;

    Object.assign(invoice, body);
    invoice.status = status;
    invoice.statusDescription = statusDescription;
    invoice.statusHistory = [
      ...(invoice.statusHistory || []),
      { status, description: statusDescription, updatedAt: now },
    ];
    await invoice.save();

    return NextResponse.json({ success: true, data: invoice });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update invoice';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const invoice = await Invoice.findByIdAndDelete(id);
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Invoice deleted' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete invoice';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json() as { status?: string; description?: string };
    if (!body.status) {
      return NextResponse.json({ success: false, message: 'Status is required' }, { status: 400 });
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const description = body.description || `Status changed to ${body.status}`;
    const previousStatus = invoice.status;

    // Dispatch: consume the reserved stock for each line item. Runs in a
    // transaction with the status update so a stock failure rolls everything
    // back. Skipped if the invoice was already dispatched (idempotent).
    if (body.status === 'Dispatched' && previousStatus !== 'Dispatched') {
      const muId = Number((invoice.manufacturingUnit as unknown as { id?: number })?.id);
      const items = (invoice.lineItems ?? []) as Array<{
        productId?: number; productName?: string; qty?: number;
      }>;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Gate dispatch on the daily ledger: there must be enough physical
          // stock (opening + received − delivered) for every product. Throws
          // and rolls back the whole transaction if any product is short.
          await assertSufficientStock(muId, items, 'dispatch', { session });

          // Daily ledger: bump Delivered + release the matching Reserved (the
          // hold placed at first payment is now consumed) per product.
          const deliveredByProduct = new Map<number, number>();
          for (const item of items) {
            const productCode = Number(item.productId);
            const qty = Number(item.qty) || 0;
            if (!Number.isFinite(productCode) || qty <= 0) continue;
            deliveredByProduct.set(productCode, (deliveredByProduct.get(productCode) ?? 0) + qty);
          }
          for (const [productCode, qty] of deliveredByProduct) {
            await bumpDailyStock(muId, productCode, 'delivered', qty, { session });
            await bumpDailyStock(muId, productCode, 'reserved', -qty, { session });
          }

          invoice.status = body.status as PIStatus;
          invoice.statusDescription = description;
          invoice.statusHistory = [
            ...(invoice.statusHistory || []),
            { status: body.status as PIStatus, description, updatedAt: now },
          ];
          await invoice.save({ session });
        });
      } finally {
        await session.endSession();
      }
      return NextResponse.json({ success: true, data: invoice });
    }

    invoice.status = body.status as PIStatus;
    invoice.statusDescription = description;
    invoice.statusHistory = [
      ...(invoice.statusHistory || []),
      { status: body.status as PIStatus, description, updatedAt: now },
    ];
    await invoice.save();

    return NextResponse.json({ success: true, data: invoice });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update status';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
