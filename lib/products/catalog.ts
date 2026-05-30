import { connectDB } from '@/lib/mongodb';
import type { Product, ProductVariant } from '@/lib/csvData';
import {
  ProductRecord, ensureProductsSeeded, DEFAULT_COLOURS,
  type DealerTierKey, type TierPrices,
} from './productModel';
import oldPricing from '@/lib/productPricing.json';
import newPricing from '@/lib/productPricingNew.json';

/**
 * Builds the PI-creator catalog from the MongoDB product collection.
 *
 * Stored variant prices are GST-INCLUSIVE; the PI creator computes GST on top of
 * a base (GST-exclusive) rate, so each price is divided by (1 + gst%) here.
 * A `0` price (N/A) stays `0` — the PI creator hides variants priced 0.
 *
 * Pricing source-of-truth:
 *   • Products listed in `productPricing.json` / `productPricingNew.json` —
 *     the JSON values are used (DB prices are ignored even if hand-edited).
 *   • Products that aren't in either JSON (added via the Products form later) —
 *     the DB-stored variant prices are used as-is.
 */

export interface PricedCatalog {
  products: Product[];
  variants: ProductVariant[];
}

const norm = (s: string) => s.trim().toUpperCase();

// Normalise a possibly-null/undefined tier set into the strict TierPrices shape.
const asTiers = (p: Partial<Record<DealerTierKey, number | null | undefined>> | undefined): TierPrices => ({
  areadealer:            p?.areadealer            ?? 0,
  districtdealer:        p?.districtdealer        ?? 0,
  distributor:           p?.distributor           ?? 0,
  divisionaldistributor: p?.divisionaldistributor ?? 0,
});

// ── JSON lookup tables (built once at module load) ────────────────────────────

interface OldPricingFile {
  products: Array<{
    name: string;
    variants: Array<{
      key: string;
      prices: Partial<Record<DealerTierKey, number | null>>;
    }>;
  }>;
}
interface NewPricingFile {
  newPricesByProduct: Record<string, Record<string, TierPrices>>;
  newProducts: Array<{
    name: string;
    variants: Array<{ key: string; newPrices?: TierPrices }>;
  }>;
}

/** uppercase product name → variant key → GST-inclusive tier prices (old list). */
const OLD_BY_NAME = new Map<string, Map<string, TierPrices>>();
for (const p of (oldPricing as OldPricingFile).products) {
  const m = new Map<string, TierPrices>();
  for (const v of p.variants) m.set(v.key, asTiers(v.prices));
  OLD_BY_NAME.set(norm(p.name), m);
}

/** uppercase product name → variant key → GST-inclusive tier prices (new list). */
const NEW_BY_NAME = new Map<string, Map<string, TierPrices>>();
for (const [name, byKey] of Object.entries((newPricing as NewPricingFile).newPricesByProduct)) {
  const m = new Map<string, TierPrices>();
  for (const [k, prices] of Object.entries(byKey)) m.set(k, asTiers(prices));
  NEW_BY_NAME.set(norm(name), m);
}
// New-only models (ADDA / Y1 / Y2) carry their new-list prices inline.
for (const p of (newPricing as NewPricingFile).newProducts) {
  const key = norm(p.name);
  const m = NEW_BY_NAME.get(key) ?? new Map<string, TierPrices>();
  for (const v of p.variants) if (v.newPrices) m.set(v.key, asTiers(v.newPrices));
  NEW_BY_NAME.set(key, m);
}

export async function getPricedCatalog(): Promise<PricedCatalog> {
  await connectDB();
  await ensureProductsSeeded();

  const docs = await ProductRecord.find({ isActive: true })
    .sort({ sortOrder: 1, code: 1 })
    .lean();

  const products: Product[] = [];
  const variants: ProductVariant[] = [];

  for (const doc of docs) {
    const gstFactor = 1 + (doc.cgst + doc.sgst) / 100;
    /** GST-inclusive price -> GST-exclusive base rate (0 stays 0). */
    const baseRate = (inclusive: number): number =>
      inclusive > 0 ? Math.round((inclusive / gstFactor) * 100) / 100 : 0;

    const oldOverride = OLD_BY_NAME.get(norm(doc.name));
    const newOverride = NEW_BY_NAME.get(norm(doc.name));

    products.push({
      id: doc.code,
      productName: doc.name,
      HSN: doc.hsn,
      cgst: doc.cgst,
      sgst: doc.sgst,
      colours: doc.colours?.length ? doc.colours : DEFAULT_COLOURS,
    });

    doc.variants.forEach((v, idx) => {
      // For products listed in the JSON, the JSON wins; otherwise fall back
      // to whatever was stored on the variant (a later DB-only product).
      const oldP: TierPrices = oldOverride?.get(v.key) ?? asTiers(v.prices);
      const newP: TierPrices = newOverride?.get(v.key) ?? asTiers(v.newPrices);

      variants.push({
        // Deterministic id derived from the stable product code + variant slot.
        id: doc.code * 1000 + idx,
        productId: doc.code,
        name: v.label,
        // "Old" price list (the long-standing dealer prices).
        dealerPrice:        baseRate(oldP.districtdealer),
        distributorPrice:   baseRate(oldP.distributor),
        subdealerPrice:     baseRate(oldP.divisionaldistributor),
        areadealerPrice:    baseRate(oldP.areadealer),
        sellingPrice:       oldP.districtdealer || 0,
        // "New" price list (May 2026); 0 when the model isn't on the new list.
        newDealerPrice:     baseRate(newP.districtdealer),
        newDistributorPrice:baseRate(newP.distributor),
        newSubdealerPrice:  baseRate(newP.divisionaldistributor),
        newAreadealerPrice: baseRate(newP.areadealer),
        isWBC: v.key === 'wobc',
      });
    });
  }

  return { products, variants };
}
