'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { POAutofillResult } from '@/lib/ai/poTypes';

/**
 * "AI Autofill" — a button that opens a popover (below the button) to paste raw
 * PO text, send it to Gemini, and apply the id-resolved result onto the form.
 * The user reviews everything before saving.
 */
export function AIAutofillCard({
  onApply,
}: {
  onApply: (res: POAutofillResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<POAutofillResult | null>(null);

  const handleAutofill = async () => {
    if (!text.trim()) {
      toast.error('Paste the PO details first.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ai/po-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: POAutofillResult;
        message?: string;
      };
      if (!json.success || !json.data) {
        throw new Error(json.message || 'Failed to read the PO.');
      }
      onApply(json.data);
      setLastResult(json.data);

      const matchedLines = json.data.lineItems.filter(li => li.productId != null).length;
      const unmatched = json.data.unmatched.length;
      toast.success(
        `Filled ${matchedLines} item${matchedLines === 1 ? '' : 's'}` +
          (unmatched > 0 ? ` · ${unmatched} couldn't be matched` : ''),
      );
      // Close on a clean result; keep open so the user can read any unmatched notes.
      if (unmatched === 0) setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to read the PO.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
        >
          <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-red-700 text-white text-[10px]">
            ✦
          </span>
          AI Autofill
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={6} className="w-96 p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-50 text-red-700 text-xs">
              ✦
            </span>
            AI Autofill
          </h2>
          <span className="text-[10px] text-gray-400">Powered by Gemini</span>
        </div>

        <p className="text-xs text-gray-500 mb-2">
          Paste the PO text (dealer, products, variants, quantities). The form is
          filled automatically — review it before saving.
        </p>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          placeholder={'e.g. To: Sri Balaji Motors, Chennai\n2 × Pi Electric — Red\n1 × Pi Plus — Blue'}
          className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 resize-y"
        />

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleAutofill}
            disabled={loading || !text.trim()}
            className="flex items-center gap-2 bg-red-700 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Reading…' : 'Autofill form'}
          </button>
          {text.trim() && !loading && (
            <button
              type="button"
              onClick={() => { setText(''); setLastResult(null); }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>

        {lastResult && lastResult.unmatched.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-xs font-medium text-amber-800 mb-1">
              Couldn&apos;t match — please add these manually:
            </div>
            <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5">
              {lastResult.unmatched.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
