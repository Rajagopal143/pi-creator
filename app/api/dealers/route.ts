import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { DealerRecord } from '@/lib/dealers/dealerRecordModel';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
    const search = searchParams.get('search') || '';

    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { dealerId: { $regex: search, $options: 'i' } },
        { orgName: { $regex: search, $options: 'i' } },
        { orgEmail: { $regex: search, $options: 'i' } },
        { contact: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await DealerRecord.countDocuments(query);
    const docs = await DealerRecord.find(query)
      .sort({ dealerNumericId: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('dealerNumericId dealerId orgName userType orgEmail contact source')
      .lean();

    const data = docs.map(d => ({
      id: String(d._id),
      dealerNumericId: d.dealerNumericId,
      dealerId: d.dealerId,
      orgName: d.orgName,
      userType: d.userType,
      orgEmail: d.orgEmail,
      contact: d.contact,
      source: d.source,
    }));

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch dealers';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
