'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Product } from '@/lib/csvData';

/** Searchable model dropdown — fixed-positioned so table scroll never clips it. */
export function ProductSelect({
  products, value, stockAvailability, disabled, placeholder, onChange,
}: {
  products: Product[];
  value: number | null;
  /** When provided, each option shows its available qty (committable stock). */
  stockAvailability?: Record<number, number>;
  /** Disables selection (e.g. until a manufacturing unit is chosen). */
  disabled?: boolean;
  /** Placeholder text shown when nothing is selected. */
  placeholder?: string;
  onChange: (id: number | null) => void;
}) {
  const selected = products.find(p => p.id === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter(p => p.productName.toLowerCase().includes(q)) : products;
  }, [products, query]);

  // The dropdown is fixed-positioned so the table's horizontal scroll never clips it.
  const place = useCallback(() => {
    const r = inputRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  return (
    <div className="relative" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        value={open ? query : (selected?.productName ?? '')}
        placeholder={disabled ? (placeholder ?? '— Select unit first —') : '— Select Model —'}
        onFocus={() => { if (disabled) return; setQuery(''); place(); setOpen(true); }}
        onChange={e => { if (disabled) return; setQuery(e.target.value); place(); setOpen(true); }}
        className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
      />
      {open && !disabled && rect && (
        <ul
          style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
          className="z-50 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
        >
          {selected && (
            <li
              onMouseDown={() => { onChange(null); setOpen(false); }}
              className="px-3 py-2 hover:bg-red-50 cursor-pointer text-xs text-gray-400 border-b border-gray-100"
            >
              — Clear selection —
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400 italic">No models found</li>
          ) : (
            filtered.map(p => {
              const stock = stockAvailability?.[p.id];
              return (
                <li
                  key={p.id}
                  onMouseDown={() => { onChange(p.id); setOpen(false); }}
                  className={`px-3 py-2 hover:bg-red-50 cursor-pointer text-sm flex items-center justify-between gap-2 ${
                    p.id === value ? 'bg-red-50 font-medium text-gray-900' : 'text-gray-700'
                  }`}
                >
                  <span>{p.productName}</span>
                  {stockAvailability && (
                    <span className={`text-[10px] font-medium whitespace-nowrap ${
                      (stock ?? 0) > 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {(stock ?? 0) > 0 ? `${stock} in stock` : 'out'}
                    </span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
