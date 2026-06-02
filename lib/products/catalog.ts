import { connectDB } from '@/lib/mongodb';
import type { Product, ProductVariant } from '@/lib/csvData';
import {
  ProductRecord, DEFAULT_COLOURS,
  type DealerTierKey, type TierPrices,
} from './productModel';

/**
 * Builds the PI-creator catalog from the MongoDB product collection.
 *
 * Stored variant prices are GST-INCLUSIVE; the PI creator computes GST on top of
 * a base (GST-exclusive) rate, so each price is divided by (1 + gst%) here.
 * A `0` price (N/A) stays `0` — the PI creator hides variants priced 0.
 *
 * The MongoDB `products` collection is the sole source of truth for both old
 * (`variants[].prices`) and new (`variants[].newPrices`) price lists. Use the
 * Products page → "Sync New Prices" action to push the latest values from
 * `productPricingNew.json` into the DB.
 */

export interface PricedCatalog {
  products: Product[];
  variants: ProductVariant[];
}

const asTiers = (p: Partial<Record<DealerTierKey, number | null | undefined>> | undefined): TierPrices => ({
  areadealer:            p?.areadealer            ?? 0,
  districtdealer:        p?.districtdealer        ?? 0,
  distributor:           p?.distributor           ?? 0,
  divisionaldistributor: p?.divisionaldistributor ?? 0,
});

export async function getPricedCatalog(): Promise<PricedCatalog> {
  await connectDB();

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

    products.push({
      id: doc.code,
      productName: doc.name,
      HSN: doc.hsn,
      cgst: doc.cgst,
      sgst: doc.sgst,
      colours: doc.colours?.length ? doc.colours : DEFAULT_COLOURS,
    });

    doc.variants.forEach((v, idx) => {
      const oldP: TierPrices = asTiers(v.prices);
      const newP: TierPrices = asTiers(v.newPrices);

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
