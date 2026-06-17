import type { PriceTier, PIType, AccessoryType } from '@/app/(protected)/create-pi/types';

/**
 * Shape Gemini is asked to return for one pasted PO. IDs reference the SAME
 * catalog the create-PI form holds (dealer.id, product.id, variant.id), so the
 * client can autofill by id without any further lookups. Anything Gemini can't
 * confidently map is left null and surfaced via `unmatched`.
 */
export interface POAutofillResult {
  /** Bill-To dealer — the party the PI is raised for ("to" in the pasted text). */
  billTo: { dealerId: number | null; matchedName: string | null };
  /** Ship-To dealer — only set when a different ship destination is mentioned. */
  shipTo: { dealerId: number | null; matchedName: string | null };
  /** Price tier; null when not stated (the form keeps its current tier). */
  priceTier: PriceTier | null;
  /** Vehicle PI vs accessory-only PI; null when ambiguous. */
  piType: PIType | null;
  lineItems: POAutofillLineItem[];
  /** Fragments of the input Gemini could not resolve, shown to the user. */
  unmatched: string[];
}

export interface POAutofillLineItem {
  productId: number | null;
  productName: string | null;
  variantId: number | null;
  variantName: string | null;
  qty: number;
  accessory: AccessoryType;
}
