import { connectDB } from '@/lib/mongodb';
import type { Product, ProductVariant } from '@/lib/csvData';
import { ProductRecord, ensureProductsSeeded, DEFAULT_COLOURS } from './productModel';

/**
 * Builds the PI-creator catalog from the MongoDB product collection.
 *
 * Stored variant prices are GST-INCLUSIVE; the PI creator computes GST on top of
 * a base (GST-exclusive) rate, so each price is divided by (1 + gst%) here.
 * A `0` price (N/A) stays `0` — the PI creator hides variants priced 0.
 */

export interface PricedCatalog {
  products: Product[];
  variants: ProductVariant[];
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

    products.push({
      id: doc.code,
      productName: doc.name,
      HSN: doc.hsn,
      cgst: doc.cgst,
      sgst: doc.sgst,
      colours: doc.colours?.length ? doc.colours : DEFAULT_COLOURS,
    });

    doc.variants.forEach((v, idx) => {
      const np = v.newPrices;
      variants.push({
        // Deterministic id derived from the stable product code + variant slot.
        id: doc.code * 1000 + idx,
        productId: doc.code,
        name: v.label,
        // "Old" price list (the long-standing dealer prices).
        dealerPrice: baseRate(v.prices.districtdealer),
        distributorPrice: baseRate(v.prices.distributor),
        subdealerPrice: baseRate(v.prices.divisionaldistributor),
        areadealerPrice: baseRate(v.prices.areadealer),
        sellingPrice: v.prices.districtdealer || 0,
        // "New" price list (May 2026); 0 when the model isn't on the new list.
        newDealerPrice: baseRate(np?.districtdealer ?? 0),
        newDistributorPrice: baseRate(np?.distributor ?? 0),
        newSubdealerPrice: baseRate(np?.divisionaldistributor ?? 0),
        newAreadealerPrice: baseRate(np?.areadealer ?? 0),
        isWBC: v.key === 'wobc',
      });
    });
  }

  return { products, variants };
}
