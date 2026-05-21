import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Invoice } from '@/lib/invoiceModel';

/**
 * Lists the open reservations that make up a product's Reserved qty at an MU.
 *
 * A reservation is a paid PI (first payment recorded → stock reserved) that
 * hasn't dispatched or been cancelled yet. One row per matching line item, so
 * a PI with two variants of the same model shows twice.
 *
 * Query: `muId` + `productCode` (both required).
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const muId = Number(searchParams.get('muId'));
    const productCode = Number(searchParams.get('productCode'));

    if (!Number.isFinite(muId) || !Number.isFinite(productCode)) {
      return NextResponse.json(
        { success: false, message: 'muId and productCode are required.' },
        { status: 400 },
      );
    }

    const invoices = await Invoice.find({
      'manufacturingUnit.id': muId,
      firstPayment: { $exists: true },
      status: { $nin: ['Dispatched', 'Cancelled'] },
    })
      .sort({ tokenNumber: 1, _id: 1 })
      .select('invoiceNumber tokenLabel dealer lineItems')
      .lean();

    type LeanInvoice = {
      _id: unknown;
      invoiceNumber?: string;
      tokenLabel?: string;
      dealer?: { orgName?: string; dealerId?: string };
      lineItems?: Array<{ productId?: number; variantName?: string; productName?: string; qty?: number }>;
    };

    const data: Array<{
      invoiceId: string;
      invoiceNumber: string;
      tokenLabel: string;
      dealerName: string;
      dealerId: string;
      variantName: string;
      qty: number;
    }> = [];

    for (const inv of invoices as LeanInvoice[]) {
      for (const li of inv.lineItems ?? []) {
        if (Number(li.productId) !== productCode) continue;
        const qty = Number(li.qty) || 0;
        if (qty <= 0) continue;
        data.push({
          invoiceId: String(inv._id),
          invoiceNumber: inv.invoiceNumber ?? '',
          tokenLabel: inv.tokenLabel ?? '',
          dealerName: inv.dealer?.orgName ?? '—',
          dealerId: inv.dealer?.dealerId ?? '',
          variantName: li.variantName || '—',
          qty,
        });
      }
    }

    const totalQty = data.reduce((s, r) => s + r.qty, 0);

    return NextResponse.json({ success: true, data, meta: { totalQty } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load reservations';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
