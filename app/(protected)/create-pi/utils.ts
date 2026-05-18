import type { ProductVariant } from '@/lib/csvData';
import type { PriceTier, DealerAddress } from './types';
import { EMPTY_ADDRESS } from './constants';

/** Resolves a variant's base (GST-exclusive) price for the selected dealer tier. */
export function getVariantPrice(variant: ProductVariant, tier: PriceTier): number {
  switch (tier) {
    case 'dealer':      return variant.dealerPrice;
    case 'distributor': return variant.distributorPrice;
    case 'subdealer':   return variant.subdealerPrice;
    case 'areadealer':  return variant.areadealerPrice;
    default:            return variant.dealerPrice;
  }
}

/** Formats a number as Indian-rupee currency, e.g. `₹1,23,456.00`. */
export function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Today's date as an ISO `YYYY-MM-DD` string. */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Returns the ISO date `days` after the given ISO date. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Fills in any missing address fields so the shape is always complete. */
export function normalizeAddress(addr?: Partial<DealerAddress> | null): DealerAddress {
  return { ...EMPTY_ADDRESS, ...(addr || {}) };
}
