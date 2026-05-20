'use client';

import { useEffect } from 'react';
import InvoicePreview from '../InvoicePreview';
import type { InvoicePreviewProps } from '../InvoicePreview';

/**
 * Read-only invoice preview modal. Save and Print live on the PI creator page
 * itself — this dialog only renders the invoice for review. The PI number is
 * shown only after the invoice has been saved.
 */
export function PreviewModal({
  open, onClose, saved, previewProps,
}: {
  open: boolean;
  onClose: () => void;
  saved: boolean;
  previewProps: InvoicePreviewProps;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4 print:hidden">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-xl">
          <div>
            <h2 className="text-base font-bold text-gray-900">Invoice Preview</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {saved
                ? previewProps.invoiceNumber
                : 'Invoice number is assigned on save'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Invoice Content */}
        <div className="p-5">
          <InvoicePreview {...previewProps} />
        </div>
      </div>
    </div>
  );
}
