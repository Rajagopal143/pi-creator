import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import {
  InvoiceCounter,
  ensureCountersSeeded,
  counterToDTO,
} from '@/lib/invoiceCounterModel';

/** List all per-state invoice counters (seeding defaults on first run). */
export async function GET() {
  try {
    await connectDB();
    await ensureCountersSeeded();
    const counters = await InvoiceCounter.find().sort({ stateName: 1 }).lean();
    return NextResponse.json({ success: true, data: counters.map(counterToDTO) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load counters';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/** Add a counter for a new state. */
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json() as Record<string, unknown>;
    const state = String(body.state || '').toUpperCase().trim();
    if (!state) {
      return NextResponse.json({ success: false, message: 'State code is required' }, { status: 400 });
    }
    const exists = await InvoiceCounter.findOne({ state });
    if (exists) {
      return NextResponse.json(
        { success: false, message: `State ${state} already exists` },
        { status: 409 },
      );
    }
    const created = await InvoiceCounter.create({
      state,
      stateName: String(body.stateName || state),
      prefix: String(body.prefix || `${state}-PI`).trim(),
      series: String(body.series || '2627').trim(),
      nextNumber: Math.max(0, Math.floor(Number(body.nextNumber)) || 1),
    });
    return NextResponse.json({ success: true, data: counterToDTO(created) }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create counter';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/** Update an existing counter (prefix, series, next number, name). */
export async function PUT(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json() as Record<string, unknown>;
    const state = String(body.state || '').toUpperCase().trim();
    if (!state) {
      return NextResponse.json({ success: false, message: 'State code is required' }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    if (body.stateName !== undefined) updates.stateName = String(body.stateName);
    if (body.prefix !== undefined) updates.prefix = String(body.prefix).trim();
    if (body.series !== undefined) updates.series = String(body.series).trim();
    if (body.nextNumber !== undefined) {
      updates.nextNumber = Math.max(0, Math.floor(Number(body.nextNumber)) || 0);
    }

    const counter = await InvoiceCounter.findOneAndUpdate({ state }, updates, { new: true });
    if (!counter) {
      return NextResponse.json(
        { success: false, message: `No counter found for state ${state}` },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: counterToDTO(counter) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update counter';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
