import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Invoice } from '@/lib/invoiceModel';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const invoice = await Invoice.create(body);
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

    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
    const search = searchParams.get('search') || '';
    const taxType = searchParams.get('taxType') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    const query: Record<string, unknown> = {};

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'dealer.orgName': { $regex: search, $options: 'i' } },
        { 'dealer.dealerId': { $regex: search, $options: 'i' } },
        { 'manufacturingUnit.unitName': { $regex: search, $options: 'i' } },
      ];
    }
    if (taxType) query.taxType = taxType;
    if (startDate || endDate) {
      const dateFilter: Record<string, string> = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      query.invoiceDate = dateFilter;
    }

    const total = await Invoice.countDocuments(query);
    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
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
