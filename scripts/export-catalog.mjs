/**
 * Exports dealer.json and product.json from the live MongoDB, holding only the
 * fields the AI PO-autofill needs: id, name, price, variants.
 *
 * IDs match the create-PI form exactly:
 *   • dealer id   = dealerNumericId
 *   • product id  = product code
 *   • variant id  = code * 1000 + variant index
 *
 * Run: node --env-file=.env.local scripts/export-catalog.mjs
 */
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set. Run with: node --env-file=.env.local scripts/export-catalog.mjs');
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

// ── Dealers ───────────────────────────────────────────────────────────────────
const dealerDocs = await db
  .collection('dealers')
  .find({ isActive: true })
  .sort({ dealerNumericId: 1 })
  .toArray();

const dealers = dealerDocs.map(d => ({
  id: d.dealerNumericId,
  name: d.orgName,
}));

// ── Products ──────────────────────────────────────────────────────────────────
const productDocs = await db
  .collection('products')
  .find({ isActive: true })
  .sort({ sortOrder: 1, code: 1 })
  .toArray();

const products = productDocs.map(p => ({
  id: p.code,
  name: p.name,
  variants: (p.variants ?? []).map((v, idx) => ({
    id: p.code * 1000 + idx,
    name: v.label,
    // Representative dealer price (old GST-inclusive district-dealer rate).
    price: v.prices?.districtdealer ?? 0,
  })),
}));

const outDir = path.join(process.cwd(), 'data');
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'dealer.json'), JSON.stringify(dealers, null, 2));
await fs.writeFile(path.join(outDir, 'product.json'), JSON.stringify(products, null, 2));

console.log(`Wrote data/dealer.json  (${dealers.length} dealers)`);
console.log(`Wrote data/product.json (${products.length} products, ${products.reduce((s, p) => s + p.variants.length, 0)} variants)`);

await mongoose.disconnect();
