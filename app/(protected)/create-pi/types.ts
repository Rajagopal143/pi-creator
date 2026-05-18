import type { Dealer } from '@/lib/csvData';

// ─── Domain types shared across the PI creator ──────────────────────────────────

export type AccessoryType = 'none' | 'black' | 'steel';
export type PriceTier = 'dealer' | 'distributor' | 'subdealer' | 'areadealer';
export type TaxType = 'within_state' | 'other_state';
export type DealerAddress = Dealer['billingAddress'];

/** A line item as held in component state — the user-editable fields only. */
export interface LineItemState {
  id: string;
  productId: number | null;
  variantId: number | null;
  qty: number;
  accessory: AccessoryType;
}

/** A line item enriched with its resolved product/variant pricing and tax. */
export interface ComputedLineItem extends LineItemState {
  productName: string;
  variantName: string;
  HSN: string;
  rate: number;
  /** Per-unit price including GST. */
  rateWithGst: number;
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
