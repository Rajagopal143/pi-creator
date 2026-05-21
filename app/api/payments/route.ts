import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Invoice } from '@/lib/invoiceModel';

/**
 * Payments ledger — first payments recorded against invoices, each linked to
 * its dealer and PI. The payment itself lives embedded on the invoice
 * (`firstPayment`); this endpoint projects them into a flat, filterable list.
 *
 * Filters: `search` (invoice # / dealer / token), `manufacturingUnitId`,
 * `mode`, `startDate`/`endDate` (on the payment date). `export=true` returns
 * every match (no pagination).
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    const search = (searchParams.get('search') || '').trim();
    const muIdRaw = searchParams.get('manufacturingUnitId') || '';
    const mode = (searchParams.get('mode') || '').trim();
    const startDate = (searchParams.get('startDate') || '').trim();
    const endDate = (searchParams.get('endDate') || '').trim();
    const isExport = searchParams.get('export') === 'true';
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)));

    const query: Record<string, unknown> = { firstPayment: { $exists: true } };

    if (muIdRaw) {
      const muId = Number(muIdRaw);
      if (!Number.isNaN(muId)) query['manufacturingUnit.id'] = muId;
    }
    if (mode) query['firstPayment.mode'] = mode;
    if (startDate || endDate) {
      const range: Record<string, string> = {};
      if (startDate) range.$gte = startDate;
      if (endDate) range.$lte = endDate;
      query['firstPayment.date'] = range;
    }
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { tokenLabel: { $regex: search, $options: 'i' } },
        { 'dealer.orgName': { $regex: search, $options: 'i' } },
        { 'dealer.dealerId': { $regex: search, $options: 'i' } },
      ];
    }

    // Most recent payments first.
    const cursor = Invoice.find(query)
      .sort({ 'firstPayment.recordedAt': -1, _id: -1 })
      .select('invoiceNumber tokenLabel dealer manufacturingUnit total firstPayment expectedDeliveryDate status');

    const [docsRaw, total] = await Promise.all([
      isExport ? cursor.lean() : cursor.skip((page - 1) * limit).limit(limit).lean(),
      Invoice.countDocuments(query),
    ]);

    type LeanDoc = {
      _id: unknown;
      invoiceNumber?: string;
      tokenLabel?: string;
      dealer?: { orgName?: string; dealerId?: string };
      manufacturingUnit?: { unitName?: string; state?: string };
      total?: number;
      expectedDeliveryDate?: string;
      status?: string;
      firstPayment?: { amount?: number; mode?: string; date?: string; reference?: string; recordedAt?: string };
    };

    const data = (docsRaw as LeanDoc[]).map(d => ({
      invoiceId: String(d._id),
      invoiceNumber: d.invoiceNumber ?? '',
      tokenLabel: d.tokenLabel ?? '',
      dealerName: d.dealer?.orgName ?? '—',
      dealerId: d.dealer?.dealerId ?? '',
      muName: d.manufacturingUnit?.unitName ?? '',
      muState: d.manufacturingUnit?.state ?? '',
      invoiceTotal: d.total ?? 0,
      status: d.status ?? 'Pending',
      expectedDeliveryDate: d.expectedDeliveryDate ?? '',
      amount: d.firstPayment?.amount ?? 0,
      mode: d.firstPayment?.mode ?? '',
      date: d.firstPayment?.date ?? '',
      reference: d.firstPayment?.reference ?? '',
      recordedAt: d.firstPayment?.recordedAt ?? '',
    }));

    // Sum of payment amounts across the entire filter (all pages).
    const totalAgg = await Invoice.aggregate<{ totalAmount: number }>([
      { $match: query },
      { $group: { _id: null, totalAmount: { $sum: '$firstPayment.amount' } } },
    ]);
    const totalAmount = totalAgg[0]?.totalAmount ?? 0;

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total,
        page: isExport ? 1 : page,
        limit: isExport ? data.length : limit,
        totalPages: isExport ? 1 : Math.ceil(total / limit),
        totalAmount,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load payments';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
