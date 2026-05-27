import type { AccessoryType, PriceTier, PriceList, DealerAddress } from './types';

// ─── Tax & charge rates ─────────────────────────────────────────────────────────

export const INSURANCE_RATE = 0.075 / 100;
/** GST folded into the insurance charge — included in the amount, not shown separately. */
export const INSURANCE_GST_RATE = 0.18;

/** Accessory prices are quoted GST-inclusive at this rate (%). */
export const ACCESSORY_GST_RATE = 5;

/** The due date is auto-set this many days after the invoice date. */
export const DUE_DATE_OFFSET_DAYS = 15;

/** GST rate (%) applied on the (GST-exclusive) transportation charge. */
export const TRANSPORT_GST_RATE = 18;

/** GST-inclusive per-unit accessory price (the quoted figure, 5% GST already baked in). */
export const ACCESSORY_CHARGE: Record<AccessoryType, number> = {
  none: 0,
  black: 1000,
  steel: 1500,
};

/**
 * Price tiers map to the four dealer price-list PDFs. The internal `PriceTier`
 * keys are kept (they drive `ProductVariant` price fields), only the labels
 * reflect the real dealer types.
 */
export const PRICE_TIERS: { value: PriceTier; label: string }[] = [
  { value: 'distributor', label: 'Distributor' },
  { value: 'subdealer',   label: 'Divisional Distributor' },
  { value: 'dealer',      label: 'District Dealer' },
  { value: 'areadealer',  label: 'Area Dealer' },
];

/**
 * Price lists the line items can be priced from. "Old" is the long-standing
 * dealer price list; "New" is the May-2026 revision.
 */
export const PRICE_LISTS: { value: PriceList; label: string }[] = [
  { value: 'old', label: 'Old Price' },
  { value: 'new', label: 'New Price' },
];

export const EMPTY_ADDRESS: DealerAddress = {
  address: '', city: '', state: '', country: '', pincode: '',
};
