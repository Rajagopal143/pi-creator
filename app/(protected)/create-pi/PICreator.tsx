'use client';

import InvoicePreview from './InvoicePreview';
import { usePICreator, type PICreatorInput } from './usePICreator';
import { InvoiceDetailsCard } from './components/InvoiceDetailsCard';
import { ManufacturingTaxCard } from './components/ManufacturingTaxCard';
import { PartiesCard } from './components/PartiesCard';
import { LineItemsCard } from './components/LineItemsCard';
import { SummaryCard } from './components/SummaryCard';
import { PreviewModal } from './components/PreviewModal';

/**
 * Proforma-invoice creator. All state and business logic live in
 * `usePICreator`; this component composes the form section cards.
 */
export default function PICreator(props: PICreatorInput) {
  const pi = usePICreator(props);

  return (
    <div className="min-h-screen bg-zinc-100 print:bg-white">

      {/* ── Print-only area (hidden on screen, shown when printing) ── */}
      <div className="hidden print:block">
        <InvoicePreview {...pi.previewProps} />
      </div>

      {/* ── Form ── */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5 print:hidden">

        <InvoiceDetailsCard
          invoiceNumber={pi.invoiceNumber}
          assignedNumber={pi.assignedNumber}
          selectedMU={pi.selectedMU}
          invoiceDate={pi.invoiceDate}
          onInvoiceDateChange={pi.setInvoiceDate}
          dueDate={pi.dueDate}
          onDueDateChange={pi.setDueDate}
        />

        <ManufacturingTaxCard
          manufacturingUnits={pi.manufacturingUnits}
          selectedMU={pi.selectedMU}
          onSelectMU={pi.setSelectedMU}
          taxType={pi.taxType}
          onTaxTypeChange={pi.setTaxType}
        />

        <PartiesCard
          billTo={{
            label: 'Bill To Dealer',
            keyPrefix: 'bill',
            addressLabel: 'Billing Address',
            dealers: pi.dealers,
            ...pi.billTo,
          }}
          shipTo={{
            label: 'Ship To Dealer',
            keyPrefix: 'ship',
            addressLabel: 'Shipping Address',
            dealers: pi.dealers,
            ...pi.shipTo,
          }}
        />

        <LineItemsCard
          items={pi.computedItems}
          products={pi.products}
          variants={pi.variants}
          priceTier={pi.priceTier}
          onPriceTierChange={pi.setPriceTier}
          onUpdateItem={pi.updateLineItem}
          onRemoveItem={pi.removeLineItem}
          onAddItem={pi.addLineItem}
        />

        <SummaryCard
          totals={{
            subTotal: pi.subTotal,
            taxType: pi.taxType,
            totalSGST: pi.totalSGST,
            totalCGST: pi.totalCGST,
            totalIGST: pi.totalIGST,
            totalGST: pi.totalGST,
            transportGST: pi.transportGST,
            insurance: pi.insurance,
            roundOff: pi.roundOff,
            total: pi.total,
          }}
          discount={pi.discount}
          onDiscountChange={pi.setDiscount}
          transportCharge={pi.transportCharge}
          onTransportChargeChange={pi.setTransportCharge}
          insuranceEnabled={pi.insuranceEnabled}
          onInsuranceToggle={pi.setInsuranceEnabled}
        />

        {/* Confirm button (bottom) */}
        <div className="flex justify-end pb-6">
          <button
            onClick={pi.handleOpenModal}
            disabled={!pi.canConfirm}
            className="flex items-center gap-2 bg-red-700 text-white text-base font-semibold px-8 py-3 rounded-xl hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {pi.editInvoiceId ? 'Preview & Confirm PI Update' : 'Preview & Confirm Invoice'}
          </button>
        </div>
      </div>

      {pi.loadingInvoice && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center print:hidden">
          <div className="bg-white rounded-lg px-4 py-3 text-sm font-medium text-gray-700 shadow-lg">
            Loading invoice for edit...
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      <PreviewModal
        open={pi.showModal}
        onClose={pi.handleCloseModal}
        onSave={pi.handleSave}
        onPrint={pi.handlePrint}
        saving={pi.saving}
        saved={pi.saved}
        previewProps={pi.previewProps}
      />
    </div>
  );
}
