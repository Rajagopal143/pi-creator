'use client';

import type { ManufacturingUnit } from '@/lib/csvData';
import type { TaxType } from '../types';

/** "Manufacturing Unit & Tax Type" card. */
export function ManufacturingTaxCard({
  manufacturingUnits, selectedMU, onSelectMU,
  taxType, onTaxTypeChange,
}: {
  manufacturingUnits: ManufacturingUnit[];
  selectedMU: ManufacturingUnit | null;
  onSelectMU: (mu: ManufacturingUnit | null) => void;
  taxType: TaxType;
  onTaxTypeChange: (t: TaxType) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
        Manufacturing Unit &amp; Tax Type
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* MU selector */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Manufacturing Unit</label>
          <select
            value={selectedMU?.id ?? ''}
            onChange={e => {
              const mu = manufacturingUnits.find(m => m.id === Number(e.target.value));
              onSelectMU(mu ?? null);
            }}
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
          >
            <option value="">— Select Manufacturing Unit —</option>
            {manufacturingUnits.map(mu => (
              <option key={mu.id} value={mu.id}>{mu.unitName} ({mu.state})</option>
            ))}
          </select>
          {selectedMU && (
            <div className="mt-2 text-xs text-gray-500 leading-relaxed bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              {selectedMU.address}, {selectedMU.city} — GSTIN: {selectedMU.gstNo}
            </div>
          )}
        </div>

        {/* Tax Type toggle */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tax Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => onTaxTypeChange('within_state')}
              className={`flex-1 py-2 px-3 text-sm rounded-lg border font-medium transition-colors ${
                taxType === 'within_state'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
              }`}
            >
              Within State
              <span className="block text-[10px] font-normal opacity-80">SGST + CGST</span>
            </button>
            <button
              onClick={() => onTaxTypeChange('other_state')}
              className={`flex-1 py-2 px-3 text-sm rounded-lg border font-medium transition-colors ${
                taxType === 'other_state'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              Other State
              <span className="block text-[10px] font-normal opacity-80">IGST</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
