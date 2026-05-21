import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Stock, StockLog, stockToDTO } from '@/lib/products/stockModel';
import { ProductRecord, ensureProductsSeeded } from '@/lib/products/productModel';

/**
 * Stock list — joins each `Stock` row with the product/variant label from the
 * products collection for convenient rendering. Optional filters: `muId`
 * (numeric), `productCode` (numeric), `search` (matches product name).
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    await ensureProductsSeeded();
    const { searchParams } = new URL(req.url);

    const muId = Number(searchParams.get('muId'));
    const productCode = Number(searchParams.get('productCode'));
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    const query: Record<string, unknown> = {};
    if (Number.isFinite(muId)) query.muId = muId;
    if (Number.isFinite(productCode)) query.productCode = productCode;

    const rows = await Stock.find(query).sort({ muId: 1, productCode: 1, variantKey: 1 }).lean();
    const products = await ProductRecord.find().select('code name variants').lean();
    const byCode = new Map(products.map(p => [p.code, p]));

    const data = rows
      .map(row => {
        const product = byCode.get(row.productCode);
        const variant = product?.variants.find(v => v.key === row.variantKey);
        return {
          ...stockToDTO(row),
          productName: product?.name ?? `#${row.productCode}`,
          variantLabel: variant?.label ?? row.variantKey,
        };
      })
      .filter(row =>
        !search || row.productName.toLowerCase().includes(search) || row.variantLabel.toLowerCase().includes(search),
      );

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load stock';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/**
 * Top up daily stock at an MU. Single upsert + ledger entry — atomic at the
 * document level, no transaction needed.
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json() as {
      muId?: number;
      productCode?: number;
      variantKey?: string;
      amount?: number;
      note?: string;
    };

    const muId = Number(body.muId);
    const productCode = Number(body.productCode);
    const variantKey = String(body.variantKey || '').trim();
    const amount = Math.floor(Number(body.amount));
    const note = String(body.note || '').trim();

    if (!Number.isFinite(muId) || !Number.isFinite(productCode) || !variantKey) {
      return NextResponse.json(
        { success: false, message: 'muId, productCode and variantKey are required.' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json(
        { success: false, message: 'Amount must be a non-zero integer.' },
        { status: 400 },
      );
    }

    const updated = await Stock.findOneAndUpdate(
      { muId, productCode, variantKey },
      { $inc: { onHand: amount }, $setOnInsert: { reserved: 0 } },
      { upsert: true, new: true },
    );
    await StockLog.create({
      muId, productCode, variantKey,
      delta: amount,
      reason: amount > 0 ? 'top_up' : 'adjustment',
      note,
      at: new Date(),
    });

    return NextResponse.json({ success: true, data: stockToDTO(updated) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update stock';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
