'use client';

import type { DealerAddress } from '../types';

// ─── EditableField (inline contentEditable, not an input box) ───────────────────

export function EditableField({
  value, onCommit, placeholder, className = '',
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      data-placeholder={placeholder}
      onBlur={e => onCommit((e.currentTarget.textContent || '').trim())}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
      }}
      className={`inline-block min-w-[2ch] rounded-sm px-1 outline-none border-b border-dashed border-gray-300 hover:bg-yellow-50 focus:bg-yellow-50 focus:border-red-500 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300 ${className}`}
    >
      {value}
    </span>
  );
}

// ─── EditableAddressBlock ───────────────────────────────────────────────────────

export function EditableAddressBlock({
  addr, onChange,
}: {
  addr: DealerAddress;
  onChange: (a: DealerAddress) => void;
}) {
  const set = (field: keyof DealerAddress) => (val: string) => onChange({ ...addr, [field]: val });
  return (
    <div className="text-xs text-gray-700 leading-loose">
      <div>
        <EditableField value={addr.address} onCommit={set('address')} placeholder="Address" />
      </div>
      <div>
        <EditableField value={addr.city} onCommit={set('city')} placeholder="City" />
        <span className="text-gray-400">, </span>
        <EditableField value={addr.state} onCommit={set('state')} placeholder="State" />
        <span className="text-gray-400"> · </span>
        <EditableField value={addr.pincode} onCommit={set('pincode')} placeholder="Pincode" />
      </div>
      <div>
        <EditableField value={addr.country} onCommit={set('country')} placeholder="Country" />
      </div>
    </div>
  );
}
