'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { Dealer, Product, ProductVariant, ManufacturingUnit } from '@/lib/csvData';
import type { InvoiceCounterDTO } from '@/lib/invoiceCounterModel';
import type { InvoicePreviewProps } from './InvoicePreview';
import type {
  AccessoryType, ComputedLineItem, DealerAddress, LineItemKind, LineItemState, PIType, PriceList, PriceTier, TaxType,
} from './types';
import {
  ACCESSORY_CHARGE, ACCESSORY_GST_RATE, ACCESSORY_ONLY_BASE_PRICE, ACCESSORY_ONLY_GST_RATE,
  DUE_DATE_OFFSET_DAYS, EMPTY_ADDRESS, INSURANCE_GST_RATE, INSURANCE_RATE, TRANSPORT_GST_RATE,
} from './constants';
import { addDaysISO, getVariantPrice, normalizeAddress, todayISO } from './utils';
import type { POAutofillResult } from '@/lib/ai/poTypes';

export interface PICreatorInput {
  dealers: Dealer[];
  products: Product[];
  variants: ProductVariant[];
  manufacturingUnits: ManufacturingUnit[];
  editInvoiceId?: string;
}

/**
 * Holds all PI-creator state, derived totals, effects and handlers.
 * Keeping this in a hook keeps `PICreator` itself a thin composition layer.
 */
export function usePICreator({
  dealers, products, variants, manufacturingUnits, editInvoiceId,
}: PICreatorInput) {
  // ── Bill To / Ship To dealers ──────────────────────────────────────────────
  const [billToSearch, setBillToSearch] = useState('');
  const [billToDealer, setBillToDealer] = useState<Dealer | null>(null);
  const [billToAddr, setBillToAddr] = useState<DealerAddress>(EMPTY_ADDRESS);

  const [shipToSearch, setShipToSearch] = useState('');
  const [shipToDealer, setShipToDealer] = useState<Dealer | null>(null);
  const [shipToAddr, setShipToAddr] = useState<DealerAddress>(EMPTY_ADDRESS);

  // ── Invoice meta ───────────────────────────────────────────────────────────
  const [priceTier, setPriceTier] = useState<PriceTier>('dealer');
  // Which price list the line items are priced from (default: the old list).
  const [priceList, setPriceList] = useState<PriceList>('old');
  const [selectedMU, setSelectedMU] = useState<ManufacturingUnit | null>(
    manufacturingUnits.length === 1 ? manufacturingUnits[0] : null,
  );
  const [taxType, setTaxType] = useState<TaxType>('within_state');
  const [piType, setPiTypeState] = useState<PIType>('vehicle');
  const [lineItems, setLineItems] = useState<LineItemState[]>([
    { id: 'item-1', productId: null, variantId: null, qty: 0, accessory: 'none', priceList: 'old', kind: 'vehicle' },
  ]);

  /**
   * Toggling the PI type rewrites every line item to match: vehicle rows clear
   * the standalone-accessory selection; accessory rows clear the variant and
   * seed Steel as the default type so the row is immediately priceable.
   */
  const setPiType = useCallback((next: PIType) => {
    setPiTypeState(next);
    setLineItems(prev => prev.map(item => {
      if (next === 'accessory') {
        return {
          ...item,
          kind: 'accessory',
          variantId: null,
          accessory: (item.accessory === 'black' || item.accessory === 'steel') ? item.accessory : 'steel',
        };
      }
      return { ...item, kind: 'vehicle', accessory: 'none' };
    }));
  }, []);

  /**
   * PI-level Old/New toggle — acts as a bulk-set: flipping it propagates to
   * every existing line item, while each row may still override it per-item.
   */
  const handleSetPriceList = useCallback((p: PriceList) => {
    setPriceList(p);
    setLineItems(prev => prev.map(item => ({ ...item, priceList: p })));
  }, []);

  // When both the manufacturing unit and the Bill To dealer are chosen, the tax
  // type is fixed by their states — same state → SGST+CGST, different → IGST.
  const autoTaxType = useMemo<TaxType | null>(() => {
    if (!selectedMU || !billToDealer) return null;
    const norm = (s: string) => s.trim().toLowerCase();
    const muState = norm(selectedMU.state || '');
    const dealerState = norm(billToDealer.state || billToDealer.billingAddress?.state || '');
    if (!muState || !dealerState) return null;
    return muState === dealerState ? 'within_state' : 'other_state';
  }, [selectedMU, billToDealer]);
  /** The tax type actually applied — auto-derived from states when both are set. */
  const effectiveTaxType: TaxType = autoTaxType ?? taxType;
  /** True once states drive the tax type — the manual toggle is then locked. */
  const taxTypeLocked = autoTaxType !== null;
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDaysISO(todayISO(), DUE_DATE_OFFSET_DAYS));
  const [seqNumber, setSeqNumber] = useState('');
  const [counters, setCounters] = useState<InvoiceCounterDTO[]>([]);
  // The invoice number assigned by the server on save, or loaded when editing.
  const [assignedNumber, setAssignedNumber] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  // Transportation charge entered GST-exclusive; 18% GST is added automatically.
  const [transportCharge, setTransportCharge] = useState(0);
  const [insuranceEnabled, setInsuranceEnabled] = useState(true);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // ── Preview modal / save state ─────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Available stock for the selected MU (productCode → committable qty) ──────
  // Drives which models appear in the line-item dropdown and the per-line qty
  // cap — enforced for both new PIs and edits.
  const [stockAvailability, setStockAvailability] = useState<Record<number, number>>({});
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  // True while the available-stock fetch is in flight (e.g. after the MU is
  // switched) — the line-items table shows an inline loading state.
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  // When editing a PI that already RESERVED stock (first payment recorded), its
  // own quantities are baked into the stock `reserved` column — so the API's
  // "available" already excludes them. Add them back per product so the edit
  // form treats this PI's existing allocation as usable rather than gone.
  const [editBaselineQty, setEditBaselineQty] = useState<Record<number, number>>({});
  const enforceStock = availabilityLoaded;

  // Availability the form actually enforces against: API availability plus this
  // PI's own already-reserved quantities (only set when editing a paid PI).
  const effectiveAvailability = useMemo<Record<number, number>>(() => {
    const codes = Object.keys(editBaselineQty);
    if (codes.length === 0) return stockAvailability;
    const merged: Record<number, number> = { ...stockAvailability };
    for (const code of codes) {
      const c = Number(code);
      merged[c] = (merged[c] ?? 0) + editBaselineQty[c];
    }
    return merged;
  }, [stockAvailability, editBaselineQty]);

  useEffect(() => {
    if (!selectedMU) {
      setStockAvailability({});
      setAvailabilityLoaded(false);
      setAvailabilityLoading(false);
      return;
    }
    let cancelled = false;
    setAvailabilityLoading(true);
    setAvailabilityLoaded(false);
    (async () => {
      try {
        const res = await fetch(`/api/daily-stock/available?muId=${selectedMU.id}`);
        const json = await res.json() as {
          success: boolean;
          data?: Array<{ productCode: number; available: number }>;
        };
        if (cancelled) return;
        const map: Record<number, number> = {};
        if (json.success && json.data) for (const r of json.data) map[r.productCode] = r.available;
        setStockAvailability(map);
        setAvailabilityLoaded(true);
      } catch {
        if (!cancelled) { setStockAvailability({}); setAvailabilityLoaded(false); }
      } finally {
        if (!cancelled) setAvailabilityLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedMU]);

  // ── Invoice-number counters ────────────────────────────────────────────────
  const fetchCounters = useCallback(async () => {
    try {
      const res = await fetch('/api/invoice-counters');
      const json = await res.json() as { success: boolean; data?: InvoiceCounterDTO[] };
      if (json.success && json.data) setCounters(json.data);
    } catch {
      // fallback: the invoice-number preview stays generic when the API is down
    }
  }, []);

  useEffect(() => {
    void fetchCounters();
  }, [fetchCounters]);

  // After saving, pressing Escape (with the preview modal closed) loads a fresh
  // PI creator page. The modal owns its own Escape handler for closing itself.
  useEffect(() => {
    if (!saved || showModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.location.href = '/create-pi';
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [saved, showModal]);

  // ── Load an existing invoice when editing ──────────────────────────────────
  useEffect(() => {
    if (!editInvoiceId) return;
    const loadInvoiceForEdit = async () => {
      setLoadingInvoice(true);
      try {
        const res = await fetch(`/api/invoices/${editInvoiceId}`);
        const json = await res.json() as { success: boolean; data?: Record<string, unknown>; message?: string };
        if (!json.success || !json.data) throw new Error(json.message || 'Failed to load invoice');
        const invoice = json.data;
        const billDealer = invoice.dealer as Dealer;
        const shipDealer = (invoice.shipToDealer as Dealer) || billDealer;
        const manufacturingUnit = invoice.manufacturingUnit as ManufacturingUnit;
        const loadedLineItems = (invoice.lineItems as LineItemState[]) || [];

        setBillToDealer(billDealer);
        setBillToSearch(billDealer.orgName);
        setBillToAddr(normalizeAddress(billDealer.billingAddress));

        setShipToDealer(shipDealer);
        setShipToSearch(shipDealer.orgName);
        // Legacy invoices stored the ship address on dealer.shippingAddress.
        setShipToAddr(normalizeAddress(shipDealer.shippingAddress || shipDealer.billingAddress));

        setSelectedMU(manufacturingUnit);
        // Restore the dealer-type price tier the PI was created with (legacy
        // invoices without one keep the default 'dealer').
        if (typeof invoice.priceTier === 'string' && invoice.priceTier) {
          setPriceTier(invoice.priceTier as PriceTier);
        }
        // Restore the price list (Old/New) the PI was priced from; legacy
        // invoices without one keep the default 'old'.
        if (typeof invoice.priceList === 'string' && invoice.priceList) {
          setPriceList(invoice.priceList as PriceList);
        }
        setTaxType((invoice.taxType as TaxType) || 'within_state');
        // Fall back per-row priceList to the PI-level value for legacy invoices.
        const invoicePriceList = (typeof invoice.priceList === 'string' && invoice.priceList)
          ? (invoice.priceList as PriceList)
          : 'old';
        const restoredItems: LineItemState[] = loadedLineItems.length > 0
          ? loadedLineItems.map(item => ({
              id: item.id,
              productId: item.productId,
              variantId: item.variantId,
              qty: item.qty,
              accessory: (item.accessory as AccessoryType) || 'none',
              priceList: (item as { priceList?: PriceList }).priceList ?? invoicePriceList,
              kind: ((item as { kind?: LineItemKind }).kind ?? 'vehicle'),
            }))
          : [{ id: 'item-1', productId: null, variantId: null, qty: 0, accessory: 'none', priceList: 'old', kind: 'vehicle' }];
        setLineItems(restoredItems);
        // Derive PI type from the rows — an all-accessory invoice is an accessory PI.
        const restoredPiType: PIType = restoredItems.length > 0 && restoredItems.every(i => i.kind === 'accessory')
          ? 'accessory'
          : 'vehicle';
        setPiTypeState(restoredPiType);
        // A paid PI's quantities are already held in the stock `reserved`
        // column, so the API's "available" excludes them — capture them as the
        // edit baseline to add back, keeping this PI's own allocation usable.
        if (invoice.firstPayment) {
          const baseline: Record<number, number> = {};
          for (const it of loadedLineItems) {
            const pid = Number(it.productId);
            const q = Number(it.qty) || 0;
            if (Number.isFinite(pid) && q > 0) baseline[pid] = (baseline[pid] ?? 0) + q;
          }
          setEditBaselineQty(baseline);
        }
        const loadedInvoiceDate = (invoice.invoiceDate as string) || todayISO();
        setInvoiceDate(loadedInvoiceDate);
        setDueDate(
          (invoice.dueDate as string) || addDaysISO(loadedInvoiceDate, DUE_DATE_OFFSET_DAYS),
        );
        setSeqNumber((invoice.seqNumber as string) || '');
        setAssignedNumber((invoice.invoiceNumber as string) || null);
        setDiscount(Number(invoice.discount || 0));
        setTransportCharge(Number(invoice.transportCharge || 0));
        setInsuranceEnabled(invoice.insuranceEnabled !== false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load invoice');
      } finally {
        setLoadingInvoice(false);
      }
    };
    void loadInvoiceForEdit();
  }, [editInvoiceId]);

  // ── Computed line items ────────────────────────────────────────────────────
  const computedItems = useMemo<ComputedLineItem[]>(() => {
    return lineItems.map(item => {
      const product = products.find(p => p.id === item.productId);

      // ─ Accessory-only row ────────────────────────────────────────────────
      // No vehicle price, no variant; the row prices a standalone Black/Steel
      // accessory at ₹1,450 / ₹1,950 + 18% GST per unit.
      if (item.kind === 'accessory') {
        const basePerUnit = ACCESSORY_ONLY_BASE_PRICE[item.accessory] ?? 0;
        const accessoryCharge = basePerUnit * item.qty;
        const accessoryGst = (accessoryCharge * ACCESSORY_ONLY_GST_RATE) / 100;
        const sgstPct = ACCESSORY_ONLY_GST_RATE / 2;
        const cgstPct = ACCESSORY_ONLY_GST_RATE / 2;
        const igstPct = ACCESSORY_ONLY_GST_RATE;
        const sgstAmount = effectiveTaxType === 'within_state' ? accessoryGst / 2 : 0;
        const cgstAmount = effectiveTaxType === 'within_state' ? accessoryGst / 2 : 0;
        const igstAmount = effectiveTaxType === 'other_state' ? accessoryGst : 0;
        const displayRate = basePerUnit;
        const displayRateWithGst = basePerUnit * (1 + ACCESSORY_ONLY_GST_RATE / 100);
        return {
          ...item,
          productName: product?.productName ?? '',
          variantName: '',
          HSN: product?.HSN ?? '',
          rate: 0,
          rateWithGst: 0,
          displayRate,
          displayRateWithGst,
          sgstPct,
          cgstPct,
          igstPct,
          sgstAmount,
          cgstAmount,
          igstAmount,
          taxableAmount: accessoryCharge,
          accessoryCharge,
          totalAmount: accessoryCharge + sgstAmount + cgstAmount + igstAmount,
        };
      }

      const variant = variants.find(v => v.id === item.variantId);
      const rate = variant ? getVariantPrice(variant, priceTier, item.priceList) : 0;
      const productTaxable = rate * item.qty;
      const sgstPct = product?.sgst ?? 0;
      const cgstPct = product?.cgst ?? 0;
      const igstPct = sgstPct + cgstPct;

      // Per-unit price including GST (same whether SGST+CGST or IGST is applied).
      const rateWithGst = rate + (rate * igstPct) / 100;

      // Accessory price already includes 5% GST — split it into a pre-tax base
      // (shown in the sub total) and the GST component (added to total GST).
      const accessoryPerUnit = ACCESSORY_CHARGE[item.accessory] ?? 0; // GST-inclusive
      const accessoryInclusive = accessoryPerUnit * item.qty;
      const accessoryCharge = accessoryInclusive / (1 + ACCESSORY_GST_RATE / 100);
      const accessoryGst = accessoryInclusive - accessoryCharge;

      // Per-row rates with the accessory folded in — shown when an accessory is set.
      const displayRate = rate + accessoryPerUnit / (1 + ACCESSORY_GST_RATE / 100);
      const displayRateWithGst = rateWithGst + accessoryPerUnit;

      // Sub total carries the product value plus the pre-tax accessory base.
      const taxableAmount = productTaxable + accessoryCharge;

      // Product GST applies to the product value only; the accessory's own 5%
      // GST is split into SGST/CGST (within state) or IGST (other state) so it
      // rolls into the total GST.
      const sgstAmount = effectiveTaxType === 'within_state'
        ? (productTaxable * sgstPct) / 100 + accessoryGst / 2
        : 0;
      const cgstAmount = effectiveTaxType === 'within_state'
        ? (productTaxable * cgstPct) / 100 + accessoryGst / 2
        : 0;
      const igstAmount = effectiveTaxType === 'other_state'
        ? (productTaxable * igstPct) / 100 + accessoryGst
        : 0;

      return {
        ...item,
        productName: product?.productName ?? '',
        variantName: variant?.name ?? '',
        HSN: product?.HSN ?? '',
        rate,
        rateWithGst,
        displayRate,
        displayRateWithGst,
        sgstPct,
        cgstPct,
        igstPct,
        sgstAmount,
        cgstAmount,
        igstAmount,
        taxableAmount,
        accessoryCharge,
        totalAmount: taxableAmount + sgstAmount + cgstAmount + igstAmount,
      };
    });
  }, [lineItems, products, variants, priceTier, effectiveTaxType]);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const subTotal       = useMemo(() => computedItems.reduce((s, i) => s + i.taxableAmount, 0), [computedItems]);
  const totalSGST      = useMemo(() => computedItems.reduce((s, i) => s + i.sgstAmount, 0), [computedItems]);
  const totalCGST      = useMemo(() => computedItems.reduce((s, i) => s + i.cgstAmount, 0), [computedItems]);
  const totalIGST      = useMemo(() => computedItems.reduce((s, i) => s + i.igstAmount, 0), [computedItems]);
  const totalAccessory = useMemo(() => computedItems.reduce((s, i) => s + i.accessoryCharge, 0), [computedItems]);
  // Transportation: the entered charge is GST-exclusive; 18% GST is auto-added.
  // It is kept separate from the product GST so the SGST/CGST/IGST breakdown stays exact.
  const transportGST = transportCharge * (TRANSPORT_GST_RATE / 100);
  const totalGST   = totalSGST + totalCGST + totalIGST;
  const insurance  = insuranceEnabled ? subTotal * INSURANCE_RATE * (1 + INSURANCE_GST_RATE) : 0;
  const rawTotal   = subTotal - discount + totalGST + insurance + transportCharge + transportGST;
  // Round to the nearest rupee — a fraction over .5 rounds up, otherwise down.
  const total      = Math.round(rawTotal);
  // Signed adjustment applied to reach the rounded total (shown on the invoice).
  const roundOff   = total - rawTotal;

  // Effective dealers carry the inline-edited addresses for this PI only.
  const effectiveBillTo = useMemo<Dealer | null>(() => {
    if (!billToDealer) return null;
    return { ...billToDealer, billingAddress: billToAddr };
  }, [billToDealer, billToAddr]);

  const effectiveShipTo = useMemo<Dealer | null>(() => {
    if (!shipToDealer) return null;
    return { ...shipToDealer, shippingAddress: shipToAddr };
  }, [shipToDealer, shipToAddr]);

  // ── Invoice number ─────────────────────────────────────────────────────────
  // The number is assigned by the server on save; before that we show a preview
  // built from the selected manufacturing unit's state counter.
  const invoiceNumber = useMemo(() => {
    if (assignedNumber) return assignedNumber;
    const counter = selectedMU ? counters.find(c => c.state === selectedMU.state) : null;
    if (counter) return `${counter.prefix}/${counter.series}/${counter.nextNumber}`;
    if (selectedMU) return `${selectedMU.state}-PI/2627/—`;
    return 'Select a manufacturing unit';
  }, [assignedNumber, counters, selectedMU]);

  // ── Line item CRUD ─────────────────────────────────────────────────────────
  const updateLineItem = useCallback((id: string, updates: Partial<LineItemState>) => {
    setLineItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        if ('productId' in updates && updates.productId !== item.productId) {
          updated.variantId = null;
        }
        // Cap qty to the product's available stock minus what other rows of
        // the same product already consume, so the PI total never exceeds it.
        // Accessory-only rows never consume vehicle stock.
        if (enforceStock && updated.productId != null && updated.kind !== 'accessory') {
          const available = effectiveAvailability[updated.productId] ?? 0;
          const usedByOthers = prev
            .filter(i => i.id !== id && i.productId === updated.productId)
            .reduce((s, i) => s + i.qty, 0);
          const cap = Math.max(0, available - usedByOthers);
          if (updated.qty > cap) updated.qty = cap;
        }
        return updated;
      }),
    );
  }, [enforceStock, effectiveAvailability]);

  /**
   * Adds a row matching the current PI type — accessory PIs default the row to
   * the Steel type so it's immediately priceable, vehicle PIs start blank.
   */
  const addLineItem = useCallback(() => {
    setLineItems(prev => [
      ...prev,
      piType === 'accessory'
        ? { id: `item-${Date.now()}`, productId: null, variantId: null, qty: 0, accessory: 'steel', priceList, kind: 'accessory' }
        : { id: `item-${Date.now()}`, productId: null, variantId: null, qty: 0, accessory: 'none', priceList, kind: 'vehicle' },
    ]);
  }, [piType, priceList]);

  const removeLineItem = useCallback((id: string) => {
    setLineItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
  }, []);

  // When availability changes (e.g. the MU is switched), trim any line whose
  // qty now exceeds what's available — running per-product so the sum across
  // rows stays within stock. Uses effective availability so a paid PI's own
  // existing quantities are never trimmed while editing.
  useEffect(() => {
    if (!enforceStock) return;
    setLineItems(prev => {
      let changed = false;
      const usage: Record<number, number> = {};
      const next = prev.map(item => {
        if (item.productId == null) return item;
        // Accessory-only rows don't consume vehicle stock.
        if (item.kind === 'accessory') return item;
        const available = effectiveAvailability[item.productId] ?? 0;
        const already = usage[item.productId] ?? 0;
        const cap = Math.max(0, available - already);
        const qty = Math.min(item.qty, cap);
        usage[item.productId] = already + qty;
        if (qty !== item.qty) { changed = true; return { ...item, qty }; }
        return item;
      });
      return changed ? next : prev;
    });
  }, [effectiveAvailability, enforceStock]);

  // When the price tier changes (or any row's priceList flips), drop selected
  // variants that are now N/A (price 0) under the active tier/list combo.
  useEffect(() => {
    setLineItems(prev => {
      let changed = false;
      const next = prev.map(item => {
        if (item.variantId == null) return item;
        const v = variants.find(x => x.id === item.variantId);
        if (v && getVariantPrice(v, priceTier, item.priceList) > 0) return item;
        changed = true;
        return { ...item, variantId: null };
      });
      return changed ? next : prev;
    });
  }, [priceTier, variants]);

  // ── Dealer search / select ─────────────────────────────────────────────────
  const handleBillToSearchChange = useCallback((v: string) => {
    setBillToSearch(v);
    if (!v) { setBillToDealer(null); setBillToAddr(EMPTY_ADDRESS); }
  }, []);

  const handleShipToSearchChange = useCallback((v: string) => {
    setShipToSearch(v);
    if (!v) { setShipToDealer(null); setShipToAddr(EMPTY_ADDRESS); }
  }, []);

  const handleBillToSelect = useCallback((d: Dealer) => {
    setBillToDealer(d);
    setBillToSearch(d.orgName);
    setBillToAddr(normalizeAddress(d.billingAddress));
    // Mirror to Ship To by default — the user can change it after if they ship
    // to a different dealer. Bill→Ship mirroring is what almost every PI needs.
    setShipToDealer(d);
    setShipToSearch(d.orgName);
    setShipToAddr(normalizeAddress(d.billingAddress));
  }, []);

  const handleShipToSelect = useCallback((d: Dealer) => {
    setShipToDealer(d);
    setShipToSearch(d.orgName);
    // Ship To is filled from the selected dealer's BILLING address, then editable.
    setShipToAddr(normalizeAddress(d.billingAddress));
  }, []);

  // ── AI autofill ─────────────────────────────────────────────────────────────
  // Applies a Gemini-parsed PO result onto the form. Every id is re-validated
  // against the loaded catalog before use, so a hallucinated id is dropped
  // rather than silently breaking pricing. The user then reviews and saves.
  const applyAutofill = useCallback((res: POAutofillResult) => {
    const nextPiType: PIType = res.piType ?? 'vehicle';
    if (res.priceTier) setPriceTier(res.priceTier);
    setPiType(nextPiType);

    // Dealers — resolve by id against the loaded catalog.
    const bill = res.billTo.dealerId != null
      ? dealers.find(d => d.id === res.billTo.dealerId) ?? null
      : null;
    if (bill) handleBillToSelect(bill); // also mirrors to Ship To
    const ship = res.shipTo.dealerId != null
      ? dealers.find(d => d.id === res.shipTo.dealerId) ?? null
      : null;
    if (ship) handleShipToSelect(ship);

    // Line items — keep only rows whose product resolved against the catalog.
    const rows: LineItemState[] = res.lineItems
      .filter(li => li.productId != null && products.some(p => p.id === li.productId))
      .map((li, i) => {
        const kind: LineItemKind = nextPiType === 'accessory' ? 'accessory' : 'vehicle';
        // Keep the variant only if it actually belongs to the resolved product.
        const variantId =
          li.variantId != null &&
          variants.some(v => v.id === li.variantId && v.productId === li.productId)
            ? li.variantId
            : null;
        return {
          id: `ai-${Date.now()}-${i}`,
          productId: li.productId!,
          variantId: kind === 'accessory' ? null : variantId,
          qty: li.qty > 0 ? Math.floor(li.qty) : 1,
          accessory: kind === 'accessory'
            ? (li.accessory === 'black' ? 'black' : 'steel')
            : 'none',
          priceList,
          kind,
        };
      });
    if (rows.length > 0) setLineItems(rows);
  }, [dealers, products, variants, priceList, setPriceTier, setPiType, handleBillToSelect, handleShipToSelect]);

  // ── Preview modal ──────────────────────────────────────────────────────────
  // `saved` is intentionally NOT reset here — once an invoice is saved it stays
  // saved, so the Save action can only run once (no duplicate invoices).
  const handleOpenModal = useCallback(() => {
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => setShowModal(false), []);

  const handlePrint = useCallback(() => {
    setShowModal(false);
    setTimeout(() => window.print(), 100);
  }, []);

  // ── Save to DB ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!effectiveBillTo || !effectiveShipTo || !selectedMU) return;
    setSaving(true);
    try {
      const payload = {
        invoiceNumber,
        invoiceDate,
        dueDate,
        seqNumber,
        manufacturingUnit: selectedMU,
        dealer: effectiveBillTo,
        shipToDealer: effectiveShipTo,
        lineItems: computedItems,
        priceTier,
        priceList,
        taxType: effectiveTaxType,
        subTotal,
        discount,
        totalSGST,
        totalCGST,
        totalIGST,
        totalGST,
        totalAccessory,
        transportCharge,
        transportGST,
        insurance,
        insuranceEnabled,
        roundOff,
        total,
      };
      const endpoint = editInvoiceId ? `/api/invoices/${editInvoiceId}` : '/api/invoices';
      const method = editInvoiceId ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as {
        success: boolean;
        code?: string;
        message?: string;
        data?: { invoiceNumber?: string; seqNumber?: string };
      };
      if (!json.success) {
        // The stock was claimed by another order between loading the form and
        // saving — tell the user and offer to reload the latest availability.
        if (json.code === 'INSUFFICIENT_STOCK') {
          toast.error(json.message || 'Stock no longer available.', {
            description: 'Someone placed an order for this stock just now. Refresh the page to load the latest availability before creating this PI.',
            duration: 12000,
            action: {
              label: 'Refresh',
              onClick: () => { window.location.href = '/create-pi'; },
            },
          });
          return;
        }
        throw new Error(json.message || 'Failed to save');
      }
      // Reflect the server-assigned number (it is authoritative over the preview).
      if (json.data?.invoiceNumber) setAssignedNumber(json.data.invoiceNumber);
      if (json.data?.seqNumber) setSeqNumber(json.data.seqNumber);
      setSaved(true);
      toast.success(editInvoiceId ? 'Invoice updated.' : 'Invoice saved.');
      await fetchCounters();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  }, [
    effectiveBillTo, effectiveShipTo, selectedMU, invoiceNumber, invoiceDate, dueDate, seqNumber,
    computedItems, priceTier, priceList, effectiveTaxType, subTotal, discount, totalSGST, totalCGST, totalIGST,
    totalGST, totalAccessory, transportCharge, transportGST, insurance, insuranceEnabled,
    roundOff, total, fetchCounters, editInvoiceId,
  ]);

  // ── Preview props ──────────────────────────────────────────────────────────
  const previewProps: InvoicePreviewProps = {
    invoiceNumber,
    // The invoice number is only revealed in the preview after the PI is saved.
    hideInvoiceNumber: !saved,
    invoiceDate,
    dueDate,
    manufacturingUnit: selectedMU,
    dealer: effectiveBillTo,
    shipToDealer: effectiveShipTo,
    piType,
    items: computedItems,
    taxType: effectiveTaxType,
    subTotal,
    discount,
    totalSGST,
    totalCGST,
    totalIGST,
    totalGST,
    totalAccessory,
    transportCharge,
    transportGST,
    insurance,
    insuranceEnabled,
    roundOff,
    total,
  };

  const canConfirm =
    !!billToDealer && !!shipToDealer && !!selectedMU && computedItems.some(i => i.productId);

  return {
    // catalog inputs
    dealers, products, variants, manufacturingUnits, editInvoiceId,
    // invoice meta
    invoiceNumber, assignedNumber, selectedMU, setSelectedMU,
    invoiceDate, setInvoiceDate, dueDate, setDueDate,
    taxType: effectiveTaxType, setTaxType, taxTypeLocked, priceTier, setPriceTier,
    priceList, setPriceList: handleSetPriceList,
    // parties
    billTo: {
      search: billToSearch, dealer: billToDealer, addr: billToAddr,
      onSearchChange: handleBillToSearchChange, onSelect: handleBillToSelect, onAddrChange: setBillToAddr,
    },
    shipTo: {
      search: shipToSearch, dealer: shipToDealer, addr: shipToAddr,
      onSearchChange: handleShipToSearchChange, onSelect: handleShipToSelect, onAddrChange: setShipToAddr,
    },
    // line items
    piType, setPiType,
    computedItems, updateLineItem, addLineItem, removeLineItem,
    // AI autofill
    applyAutofill,
    // stock availability (for the line-item dropdown + qty caps)
    stockAvailability: effectiveAvailability, stockEnforced: enforceStock, stockLoading: availabilityLoading,
    // summary figures
    subTotal, totalSGST, totalCGST, totalIGST, totalGST,
    discount, setDiscount, transportCharge, setTransportCharge, transportGST,
    insurance, insuranceEnabled, setInsuranceEnabled, roundOff, total,
    // preview / save
    previewProps, canConfirm, loadingInvoice,
    showModal, saving, saved,
    handleOpenModal, handleCloseModal, handlePrint, handleSave,
  };
}
