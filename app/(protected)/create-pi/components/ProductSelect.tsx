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
  // Index of the keyboard-highlighted option within `filtered` (-1 = none yet).
  const [activeIndex, setActiveIndex] = useState(-1);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter(p => p.productName.toLowerCase().includes(q)) : products;
  }, [products, query]);

  // Reset the highlight whenever the result set changes (open/typing) so the
  // user starts fresh and steps into the list with the Down arrow.
  useEffect(() => { setActiveIndex(-1); }, [query, open]);

  // Keep the highlighted option scrolled into view as the user arrows through.
  useEffect(() => {
    if (activeIndex >= 0) itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const commit = useCallback((id: number | null) => {
    onChange(id);
    setOpen(false);
    setActiveIndex(-1);
  }, [onChange]);

  // Arrow keys move the highlight; Enter selects it; Escape closes the menu.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setQuery(''); place(); setOpen(true); return; }
      setActiveIndex(i => (filtered.length === 0 ? -1 : Math.min(i + 1, filtered.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && activeIndex < filtered.length) {
        e.preventDefault();
        commit(filtered[activeIndex].id);
      }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); setOpen(false); }
    }
  };

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
        onKeyDown={onKeyDown}
        className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
      />
      {open && !disabled && rect && (
        <ul
          style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
          className="z-50 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
        >
          {selected && (
            <li
              onMouseDown={() => commit(null)}
              className="px-3 py-2 hover:bg-red-50 cursor-pointer text-xs text-gray-400 border-b border-gray-100"
            >
              — Clear selection —
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400 italic">No models found</li>
          ) : (
            filtered.map((p, idx) => {
              const stock = stockAvailability?.[p.id];
              const isActive = idx === activeIndex;
              return (
                <li
                  key={p.id}
                  ref={el => { itemRefs.current[idx] = el; }}
                  onMouseDown={() => commit(p.id)}
                  onMouseMove={() => setActiveIndex(idx)}
                  className={`px-3 py-2 cursor-pointer text-sm flex items-center justify-between gap-2 ${
                    isActive ? 'bg-red-100' : 'hover:bg-red-50'
                  } ${p.id === value ? 'font-medium text-gray-900' : 'text-gray-700'}`}
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
