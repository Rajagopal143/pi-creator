import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Invoice } from '@/lib/invoiceModel';

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
    const status = (body.status as string) || 'Approved';
    const statusDescription = (body.statusDescription as string) || 'Invoice updated';

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

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
    invoice.status = body.status;
    invoice.statusDescription = description;
    invoice.statusHistory = [
      ...(invoice.statusHistory || []),
      { status: body.status, description, updatedAt: now },
    ];
    await invoice.save();

    return NextResponse.json({ success: true, data: invoice });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update status';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
