'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Dealer } from '@/lib/csvData';
import { USER_TYPE_LABELS, type DealerUserType } from '@/lib/dealers/referenceData';

/** Human-readable label for a dealer's classification — sourced from `userType` to match the dealers list page. */
function dealerTypeLabel(type: string | undefined): string {
  if (!type) return '';
  return USER_TYPE_LABELS[type as DealerUserType] ?? type;
}

/** Type-ahead dealer picker — filters by name, ID, email or city. */
export function DealerSearch({
  dealers, value, onChange, onSelect, placeholder,
}: {
  dealers: Dealer[];
  value: string;
  onChange: (v: string) => void;
  onSelect: (d: Dealer) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  // Index of the keyboard-highlighted option within `filtered` (-1 = none yet).
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  const filtered = useMemo(() => {
    if (!value) return dealers.slice(0, 8);
    const q = value.toLowerCase();
    return dealers
      .filter(d =>
        d.orgName.toLowerCase().includes(q) ||
        d.dealerId.toLowerCase().includes(q) ||
        d.orgEmail.toLowerCase().includes(q) ||
        (d.billingAddress?.city || '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [dealers, value]);

  // Reset the highlight whenever the result set changes (typing/open) so the
  // user starts fresh and steps into the list with the Down arrow.
  useEffect(() => { setActiveIndex(-1); }, [value, open]);

  // Keep the highlighted option scrolled into view as the user arrows through.
  useEffect(() => {
    if (activeIndex >= 0) itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const commit = useCallback((d: Dealer) => {
    onSelect(d);
    setOpen(false);
    setActiveIndex(-1);
  }, [onSelect]);

  // Arrow keys move the highlight; Enter selects it; Escape closes the menu.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActiveIndex(i => (filtered.length === 0 ? -1 : Math.min(i + 1, filtered.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && activeIndex < filtered.length) {
        e.preventDefault();
        commit(filtered[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); setOpen(false); }
    }
  };

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        placeholder={placeholder || 'Search dealer by name, ID or city…'}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 bg-white border border-zinc-200 rounded-lg shadow-lg mt-1 max-h-56 overflow-y-auto">
          {filtered.map((d, idx) => {
            const isActive = idx === activeIndex;
            return (
              <li
                key={d.id}
                ref={el => { itemRefs.current[idx] = el; }}
                onMouseDown={() => commit(d)}
                onMouseMove={() => setActiveIndex(idx)}
                className={`px-3 py-2 cursor-pointer text-sm ${isActive ? 'bg-red-100' : 'hover:bg-red-50'}`}
              >
                <span className="font-medium text-gray-900">{d.orgName}</span>
                <span className="ml-2 text-xs text-gray-500">{d.dealerId}</span>
                {dealerTypeLabel(d.userType) && (
                  <span className="ml-2 text-xs text-gray-500">{dealerTypeLabel(d.userType)}</span>
                )}
                {d.billingAddress?.city && (
                  <span className="ml-1 text-xs text-gray-400">· {d.billingAddress.city}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
