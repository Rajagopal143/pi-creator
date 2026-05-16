import pricing from './productPricing.json';
import { loadProducts, type Product, type ProductColour, type ProductVariant } from './csvData';

/**
 * Builds the PI-creator product catalog from `productPricing.json`.
 *
 * The JSON holds GST-INCLUSIVE prices straight from the dealer price-list PDFs.
 * The PI creator computes GST on top of a base (GST-exclusive) rate, so each
 * price is divided by (1 + gst%) here. A `null` price (N/A in the PDF) becomes
 * `0` — the PI creator hides variants whose price is 0 for the chosen tier.
 */

type DealerTypeKey = 'areadealer' | 'districtdealer' | 'distributor' | 'divisionaldistributor';

interface PricingVariant {
  key: string;
  label: string;
  prices: Record<DealerTypeKey, number | null>;
}
interface PricingProduct {
  name: string;
  variants: PricingVariant[];
}

const DEFAULT_HSN = '87116020';
const DEFAULT_CGST = 2.5;
const DEFAULT_SGST = 2.5;
const DEFAULT_COLOURS: ProductColour[] = [
  { colourCode: '#000000', colourName: 'BLACK' },
  { colourCode: '#b61111', colourName: 'RED' },
  { colourCode: '#0e387c', colourName: 'BLUE' },
  { colourCode: '#2a8f05', colourName: 'GREEN' },
  { colourCode: '#f0eaea', colourName: 'WHITE' },
];

/** PDF model names that differ from the spelling in the products CSV. */
const NAME_ALIASES: Record<string, string> = {
  ARSHANA: 'ARSANA',
};

const norm = (s: string) => s.trim().toUpperCase();

export interface PricedCatalog {
  products: Product[];
  variants: ProductVariant[];
}

export function loadPricedCatalog(): PricedCatalog {
  const csvProducts = loadProducts();
  const byName = new Map(csvProducts.map(p => [norm(p.productName), p]));

  const products: Product[] = [];
  const variants: ProductVariant[] = [];

  // Stable synthetic IDs for products / variants not matched to the CSV.
  let fallbackProductId = 900001;
  let variantId = 800001;

  for (const prod of (pricing.products as PricingProduct[])) {
    const csv =
      byName.get(norm(prod.name)) ??
      byName.get(norm(NAME_ALIASES[norm(prod.name)] ?? ''));

    const cgst = csv?.cgst ?? DEFAULT_CGST;
    const sgst = csv?.sgst ?? DEFAULT_SGST;
    const gstFactor = 1 + (cgst + sgst) / 100;
    const productId = csv?.id ?? fallbackProductId++;

    products.push({
      id: productId,
      productName: prod.name,
      HSN: csv?.HSN || DEFAULT_HSN,
      cgst,
      sgst,
      colours: csv?.colours?.length ? csv.colours : DEFAULT_COLOURS,
    });

    /** GST-inclusive price -> GST-exclusive base rate (0 when N/A). */
    const baseRate = (inclusive: number | null): number =>
      inclusive == null ? 0 : Math.round((inclusive / gstFactor) * 100) / 100;

    for (const v of prod.variants) {
      variants.push({
        id: variantId++,
        productId,
        name: v.label,
        dealerPrice: baseRate(v.prices.districtdealer),
        distributorPrice: baseRate(v.prices.distributor),
        subdealerPrice: baseRate(v.prices.divisionaldistributor),
        areadealerPrice: baseRate(v.prices.areadealer),
        sellingPrice: v.prices.districtdealer ?? 0,
        isWBC: v.key === 'wobc',
      });
    }
  }

  return { products, variants };
}
