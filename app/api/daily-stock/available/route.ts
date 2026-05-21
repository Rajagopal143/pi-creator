import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import {
  DailyStock,
  computeBalances,
  type DailyStockDoc,
} from '@/lib/products/dailyStockModel';
import { ProductRecord, ensureProductsSeeded } from '@/lib/products/productModel';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Available-to-commit stock for the PI creator.
 *
 * For the given MU, returns only products whose committable balance (today's
 * closing = opening − delivered − reserved + received) is greater than zero,
 * with how many units are available. The PI creator uses this to (a) show only
 * in-stock models in the line-item dropdown and (b) cap each line's qty.
 *
 * Query: `muId` (required), `date` (optional, defaults today).
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    await ensureProductsSeeded();
    const { searchParams } = new URL(req.url);
    const muId = Number(searchParams.get('muId'));
    const date = (searchParams.get('date') || todayISO()).trim();

    if (!Number.isFinite(muId)) {
      return NextResponse.json({ success: false, message: 'muId is required.' }, { status: 400 });
    }

    // Latest known row per product, up to & including the target date.
    const latestByProduct = await DailyStock.aggregate<{ _id: number; latest: DailyStockDoc }>([
      { $match: { muId, date: { $lte: date } } },
      { $sort: { productCode: 1, date: -1 } },
      { $group: { _id: '$productCode', latest: { $first: '$$ROOT' } } },
    ]);
    const byCode = new Map<number, DailyStockDoc>(latestByProduct.map(r => [r._id, r.latest]));

    const products = await ProductRecord.find({ isActive: true })
      .sort({ sortOrder: 1, code: 1 })
      .select('code name')
      .lean();

    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

    const data = products
      .map(p => {
        const latest = byCode.get(p.code);
        let available: number;
        if (latest?.date === date) {
          available = computeBalances({
            opening: num(latest.opening),
            delivered: num(latest.delivered),
            reserved: num(latest.reserved),
            received: num(latest.received),
            inTransit: num(latest.inTransit),
          }).closing;
        } else {
          // No row today — committable stock is the carried-forward closing.
          available = num(latest?.closing);
        }
        return { productCode: p.code, productName: p.name, available };
      })
      .filter(row => row.available > 0);

    return NextResponse.json({ success: true, data, meta: { muId, date } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load available stock';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
