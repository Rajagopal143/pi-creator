import mongoose, { Schema } from 'mongoose';
import { loadProducts, type ProductColour } from '@/lib/csvData';
import pricing from '@/lib/productPricing.json';
import newPricing from '@/lib/productPricingNew.json';

/**
 * Product catalog stored in MongoDB.
 *
 * Each product holds its variants inline. Variant `prices` are GST-INCLUSIVE
 * (straight from the dealer price-list PDFs); the PI creator converts them to
 * GST-exclusive base rates via `getPricedCatalog()`. A `0` price means N/A for
 * that dealer tier and the PI creator hides it.
 *
 * The collection is seeded once from `productPricing.json` (idempotent — see
 * `ensureProductsSeeded`). After that the DB is the source of truth, editable
 * from the Products pages.
 */

// ─── Shared constants ───────────────────────────────────────────────────────────

/** Default HSN when neither the JSON nor the CSV specifies one. */
export const DEFAULT_HSN = '87116020';
const DEFAULT_CGST = 2.5;
const DEFAULT_SGST = 2.5;

/** Fallback colour palette for products without colours in the CSV. */
export const DEFAULT_COLOURS: ProductColour[] = [
  { colourCode: '#000000', colourName: 'BLACK' },
  { colourCode: '#b61111', colourName: 'RED' },
  { colourCode: '#0e387c', colourName: 'BLUE' },
  { colourCode: '#2a8f05', colourName: 'GREEN' },
  { colourCode: '#f0eaea', colourName: 'WHITE' },
];

/** PDF model names that differ from the spelling in the products CSV. */
const NAME_ALIASES: Record<string, string> = { ARSHANA: 'ARSANA' };

const norm = (s: string) => s.trim().toUpperCase();

// ─── Types ──────────────────────────────────────────────────────────────────────

export type DealerTierKey =
  | 'areadealer'
  | 'districtdealer'
  | 'distributor'
  | 'divisionaldistributor';

/** GST-inclusive price per dealer tier. */
export type TierPrices = Record<DealerTierKey, number>;

/** A zero-filled tier-price set (treated as N/A everywhere). */
export const zeroTierPrices = (): TierPrices => ({
  areadealer: 0,
  districtdealer: 0,
  distributor: 0,
  divisionaldistributor: 0,
});

export interface ProductVariantSub {
  key: string;
  label: string;
  /** "Old" GST-inclusive price list (the long-standing dealer prices). */
  prices: TierPrices;
  /** "New" GST-inclusive price list (May 2026 onward); 0 = not on the new list. */
  newPrices?: TierPrices;
}

export interface ProductDoc {
  _id?: mongoose.Types.ObjectId;
  /** Stable numeric id used by the PI creator catalog. */
  code: number;
  name: string;
  hsn: string;
  cgst: number;
  sgst: number;
  colours: ProductColour[];
  variants: ProductVariantSub[];
  isActive: boolean;
  sortOrder: number;
  /** True once the variant `newPrices` have been back-filled from the new list. */
  newPricesSeeded?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Plain serialisable shape sent to client components. */
export interface ProductDTO {
  id: string;
  code: number;
  name: string;
  hsn: string;
  cgst: number;
  sgst: number;
  isActive: boolean;
  /** Variants always carry both `prices` (old) and `newPrices` for the edit form. */
  variants: ProductVariantSub[];
}

// ─── Schema ─────────────────────────────────────────────────────────────────────

const TierPricesSchema = new Schema<TierPrices>(
  {
    areadealer: { type: Number, default: 0 },
    districtdealer: { type: Number, default: 0 },
    distributor: { type: Number, default: 0 },
    divisionaldistributor: { type: Number, default: 0 },
  },
  { _id: false },
);

const VariantSchema = new Schema<ProductVariantSub>(
  {
    key: { type: String, default: '' },
    label: { type: String, required: true },
    prices: { type: TierPricesSchema, default: () => ({}) },
    // Left undefined until back-filled from the new price list (see
    // `ensureNewPricingApplied`); a 0-filled set means "not on the new list".
    newPrices: { type: TierPricesSchema, default: undefined },
  },
  { _id: false },
);

const ColourSchema = new Schema<ProductColour>(
  {
    colourCode: { type: String, default: '' },
    colourName: { type: String, default: '' },
  },
  { _id: false },
);

const ProductSchema = new Schema<ProductDoc>(
  {
    code: { type: Number, required: true, unique: true },
    name: { type: String, required: true, unique: true, trim: true },
    hsn: { type: String, default: DEFAULT_HSN },
    cgst: { type: Number, default: DEFAULT_CGST },
    sgst: { type: Number, default: DEFAULT_SGST },
    colours: { type: [ColourSchema], default: [] },
    variants: { type: [VariantSchema], default: [] },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    newPricesSeeded: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Re-register on every module load so schema additions (newPrices,
// newPricesSeeded) take effect immediately during dev hot-reload — Mongoose's
// `strict: true` would otherwise silently drop them from the cached schema.
if (mongoose.models.ProductRecord) mongoose.deleteModel('ProductRecord');
export const ProductRecord = mongoose.model<ProductDoc>(
  'ProductRecord',
  ProductSchema,
  'products',
);

// ─── Seeding ────────────────────────────────────────────────────────────────────

interface PricingVariant {
  key: string;
  label: string;
  prices: Record<DealerTierKey, number | null>;
}
interface PricingProduct {
  name: string;
  cgst?: number;
  sgst?: number;
  hsn?: string;
  variants: PricingVariant[];
}

/** Builds the seed product set from `productPricing.json`, enriched by the CSV. */
function buildSeedProducts(): ProductDoc[] {
  const csvProducts = loadProducts();
  const byName = new Map(csvProducts.map(p => [norm(p.productName), p]));

  return (pricing.products as PricingProduct[]).map((prod, index) => {
    const csv =
      byName.get(norm(prod.name)) ??
      byName.get(norm(NAME_ALIASES[norm(prod.name)] ?? ''));

    const cgst = prod.cgst ?? csv?.cgst ?? DEFAULT_CGST;
    const sgst = prod.sgst ?? csv?.sgst ?? DEFAULT_SGST;

    return {
      code: index + 1,
      name: prod.name,
      hsn: prod.hsn || csv?.HSN || DEFAULT_HSN,
      cgst,
      sgst,
      colours: csv?.colours?.length ? csv.colours : DEFAULT_COLOURS,
      variants: prod.variants.map(v => ({
        key: v.key,
        label: v.label,
        prices: {
          areadealer: v.prices.areadealer ?? 0,
          districtdealer: v.prices.districtdealer ?? 0,
          distributor: v.prices.distributor ?? 0,
          divisionaldistributor: v.prices.divisionaldistributor ?? 0,
        },
      })),
      isActive: true,
      sortOrder: index,
    } as ProductDoc;
  });
}

/** Idempotently inserts any missing seed products without overwriting edits. */
export async function ensureProductsSeeded(): Promise<void> {
  const seed = buildSeedProducts();
  await Promise.all(
    seed.map(p =>
      ProductRecord.updateOne({ name: p.name }, { $setOnInsert: p }, { upsert: true }),
    ),
  );
  await ensureNewPricingApplied();
}

// ─── New price list (May 2026) ────────────────────────────────────────────────────

interface NewPricingFile {
  /** Upper-cased product name → variant key → new GST-inclusive tier prices. */
  newPricesByProduct: Record<string, Record<string, TierPrices>>;
  /** Models that only exist on the new list (no old prices). */
  newProducts: Array<{
    name: string;
    hsn: string;
    cgst: number;
    sgst: number;
    variants: ProductVariantSub[];
  }>;
}

/**
 * Back-fills `newPrices` onto existing variants and inserts the new-list-only
 * models (ADDA / Y1 / Y2). Runs idempotently:
 *
 * - Existing products are back-filled exactly once (guarded by `newPricesSeeded`)
 *   so later manual edits to `newPrices` are never clobbered.
 * - New-only products are created once, matched by their unique name.
 */
export async function ensureNewPricingApplied(): Promise<void> {
  const data = newPricing as unknown as NewPricingFile;

  // 1. Back-fill new prices onto products not yet seeded.
  const pending = await ProductRecord.find({ newPricesSeeded: { $ne: true } }).lean();
  for (const doc of pending) {
    const byKey = data.newPricesByProduct[norm(doc.name)] ?? {};
    const variants = (doc.variants ?? []).map(v => ({
      key: v.key,
      label: v.label,
      prices: v.prices,
      newPrices: byKey[v.key] ?? zeroTierPrices(),
    }));
    await ProductRecord.updateOne(
      { _id: doc._id },
      { $set: { variants, newPricesSeeded: true } },
    );
  }

  // 2. Create new-list-only models (idempotent via the unique `name` index).
  for (const np of data.newProducts) {
    const exists = await ProductRecord.findOne({ name: np.name }).select('_id').lean();
    if (exists) continue;
    try {
      const code = await nextProductCode();
      await ProductRecord.create({
        code,
        name: np.name,
        hsn: np.hsn || DEFAULT_HSN,
        cgst: np.cgst,
        sgst: np.sgst,
        colours: DEFAULT_COLOURS,
        variants: np.variants.map(v => ({
          key: v.key,
          label: v.label,
          prices: v.prices ?? zeroTierPrices(),
          newPrices: v.newPrices ?? zeroTierPrices(),
        })),
        isActive: true,
        sortOrder: code,
        newPricesSeeded: true,
      });
    } catch (err: unknown) {
      // A concurrent seed won the race — the unique name index rejected the dup.
      if (!(err instanceof Error && err.message.includes('E11000'))) throw err;
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

export function productToDTO(d: ProductDoc): ProductDTO {
  const tier = (p?: Partial<TierPrices>): TierPrices => ({
    areadealer: p?.areadealer ?? 0,
    districtdealer: p?.districtdealer ?? 0,
    distributor: p?.distributor ?? 0,
    divisionaldistributor: p?.divisionaldistributor ?? 0,
  });
  return {
    id: String(d._id),
    code: d.code,
    name: d.name,
    hsn: d.hsn,
    cgst: d.cgst,
    sgst: d.sgst,
    isActive: d.isActive,
    variants: (d.variants ?? []).map(v => ({
      key: v.key,
      label: v.label,
      prices: tier(v.prices),
      newPrices: tier(v.newPrices),
    })),
  };
}

/** Next free product code — used when creating a brand-new product. */
export async function nextProductCode(): Promise<number> {
  const top = await ProductRecord.findOne().sort({ code: -1 }).select('code').lean();
  return (top?.code ?? 0) + 1;
}
