import crypto from 'crypto';
import { loadDealers } from '@/lib/csvData';
import { getDealersForPIAction } from '@/lib/dealers/server-actions';
import { getPricedCatalog } from '@/lib/products/catalog';

/**
 * Reference catalogs handed to Gemini so it can resolve free-text dealer /
 * product / variant names back to the numeric IDs the create-PI form uses.
 *
 * These are built from the EXACT same server sources the page loads
 * (getDealersForPIAction + getPricedCatalog) so the IDs Gemini returns line up
 * 1:1 with the dealers/products/variants the form already holds.
 */

export interface DealerCatalogEntry {
  id: number;
  name: string;
  location: string;
  type: string;
}

export interface ProductCatalogEntry {
  id: number;
  name: string;
  variants: { id: number; name: string }[];
}

export interface POCatalog {
  dealersJson: string;
  productsJson: string;
  /** Stable hash of both catalogs — used to invalidate uploaded Gemini files. */
  hash: string;
}

export async function buildPOCatalog(): Promise<POCatalog> {
  // Mirror the create-PI page: prefer DB dealers, fall back to the CSV seed.
  let dealers = await getDealersForPIAction();
  if (dealers.length === 0) dealers = loadDealers();

  const dealerEntries: DealerCatalogEntry[] = dealers.map(d => ({
    id: d.id,
    name: d.orgName,
    location: [d.billingAddress?.city, d.billingAddress?.state]
      .filter(Boolean)
      .join(', '),
    type: d.dealerType,
  }));

  const { products, variants } = await getPricedCatalog();
  const productEntries: ProductCatalogEntry[] = products.map(p => ({
    id: p.id,
    name: p.productName,
    variants: variants
      .filter(v => v.productId === p.id)
      .map(v => ({ id: v.id, name: v.name })),
  }));

  const dealersJson = JSON.stringify(dealerEntries);
  const productsJson = JSON.stringify(productEntries);
  const hash = crypto
    .createHash('sha1')
    .update(dealersJson)
    .update(productsJson)
    .digest('hex');

  return { dealersJson, productsJson, hash };
}
