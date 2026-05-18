'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import type { Dealer } from '@/lib/csvData';

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
  const containerRef = useRef<HTMLDivElement>(null);

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
        className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 bg-white border border-zinc-200 rounded-lg shadow-lg mt-1 max-h-56 overflow-y-auto">
          {filtered.map(d => (
            <li
              key={d.id}
              onMouseDown={() => { onSelect(d); setOpen(false); }}
              className="px-3 py-2 hover:bg-red-50 cursor-pointer text-sm"
            >
              <span className="font-medium text-gray-900">{d.orgName}</span>
              <span className="ml-2 text-xs text-gray-500">{d.dealerId}</span>
              <span className="ml-2 text-xs text-gray-400 capitalize">{d.dealerType}</span>
              {d.billingAddress?.city && (
                <span className="ml-1 text-xs text-gray-400">· {d.billingAddress.city}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
