import { NextRequest, NextResponse } from 'next/server';
import { parsePOText } from '@/lib/ai/gemini';

/**
 * POST /api/ai/po-parse
 * Body: { text: string }  — free-text PO pasted by the user.
 * Returns: { success, data: POAutofillResult } — ids resolved against the
 * create-PI dealer/product catalog so the client can autofill the form.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: unknown };
    const text = typeof body.text === 'string' ? body.text : '';
    if (!text.trim()) {
      return NextResponse.json(
        { success: false, message: 'Paste the PO details first.' },
        { status: 400 },
      );
    }

    const data = await parsePOText(text);
    console.log("🚀 ~ parsePOText ~ data:", data)
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to parse PO text';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
