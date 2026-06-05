import type { Dealer } from '@/lib/csvData';

// ─── Domain types shared across the PI creator ──────────────────────────────────

export type AccessoryType = 'none' | 'black' | 'steel';
/**
 * Line-item kind:
 *   • 'vehicle'   — pick a model + variant (the long-standing flow). The row's
 *                   accessory checkbox is optional and adds a Black/Steel
 *                   add-on at the legacy +₹1,000 / +₹1,500 (5% GST) rates.
 *   • 'accessory' — accessory-only row. The product is picked for labelling
 *                   (which vehicle the accessory is for); no variant or
 *                   vehicle price applies. Steel = ₹1,950, Black = ₹1,450,
 *                   both + 18% GST per unit.
 */
export type LineItemKind = 'vehicle' | 'accessory';
/**
 * PI type — drives both the line-item shape (vehicle rows vs. accessory rows)
 * and the print-template column headers.
 */
export type PIType = 'vehicle' | 'accessory';
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
  /** What this row represents — a vehicle (default) or a standalone accessory. */
  kind: LineItemKind;
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
