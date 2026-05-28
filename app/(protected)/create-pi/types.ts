import type { Dealer } from '@/lib/csvData';

// ─── Domain types shared across the PI creator ──────────────────────────────────

export type AccessoryType = 'none' | 'black' | 'steel';
export type PriceTier = 'dealer' | 'distributor' | 'subdealer' | 'areadealer';
/** Which price list the line items are priced from. */
export type PriceList = 'old' | 'new';
export type TaxType = 'within_state' | 'other_state';
export type DealerAddress = Dealer['billingAddress'];

/** A line item as held in component state — the user-editable fields only. */
export interface LineItemState {
  id: string;
  productId: number | null;
  variantId: number | null;
  qty: number;
  accessory: AccessoryType;
  /** Per-line override for which price list this row is priced from. */
  priceList: PriceList;
}

/** A line item enriched with its resolved product/variant pricing and tax. */
export interface ComputedLineItem extends LineItemState {
  productName: string;
  variantName: string;
  HSN: string;
  rate: number;
  /** Per-unit price including GST. */
  rateWithGst: number;
  /** Per-unit rate with the per-unit accessory base folded in (shown in the row). */
  displayRate: number;
  /** Per-unit GST-inclusive rate with the per-unit accessory price folded in. */
  displayRateWithGst: number;
  sgstPct: number;
  cgstPct: number;
  igstPct: number;
  sgstAmount: number;
  cgstAmount: number;
  igstAmount: number;
  taxableAmount: number;
  accessoryCharge: number;
  totalAmount: number;
}
