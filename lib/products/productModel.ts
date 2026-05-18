import mongoose, { Schema } from 'mongoose';
import { loadProducts, type ProductColour } from '@/lib/csvData';
import pricing from '@/lib/productPricing.json';

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

export interface ProductVariantSub {
  key: string;
  label: string;
  prices: TierPrices;
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
  },
  { timestamps: true },
);

export const ProductRecord =
  (mongoose.models.ProductRecord as mongoose.Model<ProductDoc>) ||
  mongoose.model<ProductDoc>('ProductRecord', ProductSchema, 'products');

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
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

export function productToDTO(d: ProductDoc): ProductDTO {
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
      prices: {
        areadealer: v.prices?.areadealer ?? 0,
        districtdealer: v.prices?.districtdealer ?? 0,
        distributor: v.prices?.distributor ?? 0,
        divisionaldistributor: v.prices?.divisionaldistributor ?? 0,
      },
    })),
  };
}

/** Next free product code — used when creating a brand-new product. */
export async function nextProductCode(): Promise<number> {
  const top = await ProductRecord.findOne().sort({ code: -1 }).select('code').lean();
  return (top?.code ?? 0) + 1;
}
