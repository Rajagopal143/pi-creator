'use server';

import mongoose from 'mongoose';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/mongodb';
import {
  ProductRecord,
  ensureProductsSeeded,
  nextProductCode,
  productToDTO,
  DEFAULT_COLOURS,
  type ProductDTO,
  type ProductVariantSub,
  type TierPrices,
} from './productModel';
import type { ProductFormState } from './formState';

// ─── Reads ──────────────────────────────────────────────────────────────────────

/** Loads a single product for the edit form, or `null` when not found. */
export async function getProductForEditAction(id: string): Promise<ProductDTO | null> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const doc = await ProductRecord.findById(id).lean();
  return doc ? productToDTO(doc) : null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const toTier = (n: unknown): number => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
};

/** Parses the client-serialised variants payload into validated subdocuments. */
function parseVariants(raw: FormDataEntryValue | null): ProductVariantSub[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const tiers = (p?: Partial<TierPrices>): TierPrices => ({
    areadealer: toTier(p?.areadealer),
    districtdealer: toTier(p?.districtdealer),
    distributor: toTier(p?.distributor),
    divisionaldistributor: toTier(p?.divisionaldistributor),
  });

  return parsed
    .map((v): ProductVariantSub | null => {
      const row = v as Partial<ProductVariantSub> & {
        prices?: Partial<TierPrices>;
        newPrices?: Partial<TierPrices>;
      };
      const label = String(row.label ?? '').trim();
      if (!label) return null;
      const key = String(row.key ?? '').trim() ||
        label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return {
        key,
        label,
        prices: tiers(row.prices),
        newPrices: tiers(row.newPrices),
      };
    })
    .filter((v): v is ProductVariantSub => v !== null);
}

// ─── Mutations ──────────────────────────────────────────────────────────────────

/**
 * Creates a brand-new product. Auto-assigns the next numeric `code` (used by
 * the PI-creator catalog) and revalidates everywhere the catalog is read so
 * the new model shows up immediately (Products list, PI creator, Stock pages).
 */
export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const name = String(formData.get('name') || '').trim();
  const hsn = String(formData.get('hsn') || '').trim();
  if (!name) return { ok: false, message: 'Product name is required.' };
  if (!hsn) return { ok: false, message: 'HSN number is required.' };

  const cgst = toTier(formData.get('cgst'));
  const sgst = toTier(formData.get('sgst'));
  const isActive = formData.get('isActive') === 'on';
  const variants = parseVariants(formData.get('variantsJson'));
  if (variants.length === 0) return { ok: false, message: 'Add at least one variant with a price.' };

  await connectDB();

  const clash = await ProductRecord.findOne({ name }).select('_id').lean();
  if (clash) return { ok: false, message: `A product named "${name}" already exists.` };

  const code = await nextProductCode();
  await ProductRecord.create({
    code,
    name,
    hsn,
    cgst,
    sgst,
    colours: DEFAULT_COLOURS,
    variants,
    isActive,
    sortOrder: code,
    // The form already supplies new prices — keep the new-list back-fill away.
    newPricesSeeded: true,
  });

  revalidatePath('/products');
  revalidatePath('/create-pi');
  revalidatePath('/stock');
  revalidatePath('/transit');
  redirect('/products');
}

/** Updates a product's details (name, HSN, GST, active flag, variants). */
export async function updateProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const id = String(formData.get('id') || '');
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, message: 'Invalid product reference.' };
  }

  const name = String(formData.get('name') || '').trim();
  const hsn = String(formData.get('hsn') || '').trim();
  if (!name) return { ok: false, message: 'Product name is required.' };
  if (!hsn) return { ok: false, message: 'HSN number is required.' };

  const cgst = toTier(formData.get('cgst'));
  const sgst = toTier(formData.get('sgst'));
  const isActive = formData.get('isActive') === 'on';
  const variants = parseVariants(formData.get('variantsJson'));

  await connectDB();

  const existing = await ProductRecord.findById(id).lean();
  if (!existing) return { ok: false, message: 'Product not found.' };

  // Guard the unique name constraint against another product.
  const clash = await ProductRecord.findOne({
    name,
    _id: { $ne: existing._id },
  }).select('_id').lean();
  if (clash) return { ok: false, message: `Another product is already named "${name}".` };

  await ProductRecord.updateOne(
    { _id: existing._id },
    // `newPricesSeeded: true` makes the edited new prices authoritative — the
    // new-list back-fill never re-runs over a hand-edited product.
    { $set: { name, hsn, cgst, sgst, isActive, variants, newPricesSeeded: true } },
  );

  revalidatePath('/products');
  revalidatePath(`/products/${id}/edit`);
  revalidatePath('/create-pi');
  redirect('/products');
}

/** Toggles a product's active flag (active products show in the PI creator). */
export async function setProductActiveAction(id: string, isActive: boolean): Promise<void> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await ProductRecord.updateOne({ _id: id }, { $set: { isActive } });
  revalidatePath('/products');
  revalidatePath('/create-pi');
}

/** Ensures the catalog is seeded — called by the list page on first load. */
export async function seedProductsAction(): Promise<void> {
  await connectDB();
  await ensureProductsSeeded();
}
