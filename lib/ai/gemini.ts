import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  GoogleGenAI,
  Type,
  createPartFromUri,
  createUserContent,
  type Schema,
} from '@google/genai';
import type { POAutofillResult } from './poTypes';

const MODEL = 'gemini-2.5-flash';
/**
 * Re-upload the catalog files to the Gemini Files API once per 24h. Uploaded
 * files expire after 48h, so a 24h refresh keeps a comfortable margin and means
 * any single request always references a live file id.
 */
const FILE_TTL_MS = 24 * 60 * 60 * 1000;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Add it to .env.local to enable PO autofill.',
    );
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

// ── Catalog file cache ────────────────────────────────────────────────────────
// The dealer/product JSON files in /data are uploaded to the Files API and
// reused by their file id (URI) across requests. They are re-uploaded once the
// upload passes the 24h TTL, or when a file on disk changes (fingerprint). The
// uploaded ids are also persisted to a small disk cache so they survive process
// restarts within the 24h window instead of re-uploading on every cold start.

const DEALER_FILE  = path.join(process.cwd(), 'data', 'dealer.json');
const PRODUCT_FILE = path.join(process.cwd(), 'data', 'product.json');
const CACHE_FILE   = path.join(os.tmpdir(), 'pi-gemini-catalog-files.json');

interface UploadedFile { name: string; uri: string; mimeType: string }
interface CatalogFiles {
  dealers: UploadedFile;
  products: UploadedFile;
  /** Fingerprint of the source files — re-uploads when /data changes. */
  fingerprint: string;
  uploadedAt: number;
}

let cachedFiles: CatalogFiles | null = null;

/** Cheap change-detector for the source files (size + mtime, no full read). */
async function sourceFingerprint(): Promise<string> {
  const [d, p] = await Promise.all([fs.stat(DEALER_FILE), fs.stat(PRODUCT_FILE)]);
  return `${d.size}:${Math.round(d.mtimeMs)}|${p.size}:${Math.round(p.mtimeMs)}`;
}

async function readDiskCache(): Promise<CatalogFiles | null> {
  try {
    return JSON.parse(await fs.readFile(CACHE_FILE, 'utf8')) as CatalogFiles;
  } catch {
    return null;
  }
}

async function writeDiskCache(c: CatalogFiles): Promise<void> {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(c), 'utf8');
  } catch {
    // A non-writable tmp dir just means we re-upload more often — not fatal.
  }
}

/** Uploads one /data file to the Files API and returns its file id (uri). */
async function uploadCatalogFile(filePath: string, displayName: string): Promise<UploadedFile> {
  const ai = getClient();
  const uploaded = await ai.files.upload({
    file: filePath,
    config: { mimeType: 'text/plain', displayName },
  });
  if (!uploaded.uri || !uploaded.mimeType) {
    throw new Error(`Upload for ${displayName} returned no usable file reference.`);
  }
  return { name: uploaded.name ?? '', uri: uploaded.uri, mimeType: uploaded.mimeType };
}

async function getCatalogFiles(now: number, forceFresh = false): Promise<CatalogFiles> {
  const fingerprint = await sourceFingerprint();
  const isFresh = (c: CatalogFiles | null): c is CatalogFiles =>
    !!c && c.fingerprint === fingerprint && now - c.uploadedAt < FILE_TTL_MS;

  if (!forceFresh) {
    if (isFresh(cachedFiles)) return cachedFiles;
    // Cold start: fall back to the persisted ids before paying for a re-upload.
    if (!cachedFiles) {
      const disk = await readDiskCache();
      if (isFresh(disk)) {
        cachedFiles = disk;
        return disk;
      }
    }
  }

  const [dealers, products] = await Promise.all([
    uploadCatalogFile(DEALER_FILE, 'pi-dealers-catalog'),
    uploadCatalogFile(PRODUCT_FILE, 'pi-products-catalog'),
  ]);
  cachedFiles = { dealers, products, fingerprint, uploadedAt: now };
  await writeDiskCache(cachedFiles);
  return cachedFiles;
}

// ── Structured-output schema ──────────────────────────────────────────────────

const dealerRef: Schema = {
  type: Type.OBJECT,
  properties: {
    dealerId: { type: Type.INTEGER, nullable: true },
    matchedName: { type: Type.STRING, nullable: true },
  },
  propertyOrdering: ['dealerId', 'matchedName'],
  required: ['dealerId', 'matchedName'],
};

const RESULT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    billTo: dealerRef,
    shipTo: dealerRef,
    priceTier: {
      type: Type.STRING,
      enum: ['dealer', 'distributor', 'subdealer', 'areadealer'],
      nullable: true,
    },
    piType: { type: Type.STRING, enum: ['vehicle', 'accessory'], nullable: true },
    lineItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          productId: { type: Type.INTEGER, nullable: true },
          productName: { type: Type.STRING, nullable: true },
          variantId: { type: Type.INTEGER, nullable: true },
          variantName: { type: Type.STRING, nullable: true },
          qty: { type: Type.INTEGER },
          accessory: { type: Type.STRING, enum: ['none', 'black', 'steel'] },
        },
        propertyOrdering: [
          'productId', 'productName', 'variantId', 'variantName', 'qty', 'accessory',
        ],
        required: [
          'productId', 'productName', 'variantId', 'variantName', 'qty', 'accessory',
        ],
      },
    },
    unmatched: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  propertyOrdering: ['billTo', 'shipTo', 'priceTier', 'piType', 'lineItems', 'unmatched'],
  required: ['billTo', 'shipTo', 'priceTier', 'piType', 'lineItems', 'unmatched'],
};

const SYSTEM_INSTRUCTION = `You extract structured purchase-order data from free-text pasted by a sales user, mapping it onto a fixed catalog of dealers and products.

You are given two attached files:
 • the dealers catalog: a JSON array of { id, name }
 • the products catalog: a JSON array of { id, name, variants:[{ id, name, price }] }

Rules:
 • ALWAYS return ids that exist in the attached catalogs. Never invent an id.
 • Match dealer/product/variant names tolerantly (case-insensitive, ignore extra spaces, abbreviations, and minor typos). If you are not reasonably confident, leave the id null.
 • "To" / "bill to" / the buying party → billTo. Only set shipTo when the text clearly names a DIFFERENT ship destination; otherwise leave shipTo ids null (the form mirrors billTo automatically).
 • Each ordered product line → one lineItems entry. Resolve productId, then the variantId from THAT product's variants. qty must be a positive integer (default 1 if a line clearly orders a product but states no quantity).
 • piType: "accessory" only if the order is clearly accessories-only; otherwise "vehicle". accessory field is "steel" or "black" only for accessory orders, else "none".
 • priceTier: infer only from explicit wording in the PO text (e.g. "distributor price"); otherwise null.
 • Put any text you could not confidently map (unknown dealer, unknown product/variant, ambiguous lines) into "unmatched".
 • Always include matchedName as the catalog name you matched (null if unmatched).`;

/**
 * Parses pasted PO text into a structured, id-resolved autofill result using
 * Gemini. Retries once with fresh uploads if the cached files have gone stale
 * on the server side.
 */
export async function parsePOText(text: string): Promise<POAutofillResult> {
  const ai = getClient();
  const trimmed = text.trim();
  if (!trimmed) throw new Error('No PO text provided.');

  const run = async (now: number, forceFresh: boolean): Promise<POAutofillResult> => {
    const files = await getCatalogFiles(now, forceFresh);
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: createUserContent([
        createPartFromUri(files.dealers.uri, files.dealers.mimeType),
        createPartFromUri(files.products.uri, files.products.mimeType),
        `Extract the purchase order details from this text and map them to the catalogs:\n\n${trimmed}`,
      ]),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: RESULT_SCHEMA,
        temperature: 0,
      },
    });
    const raw = response.text;
    if (!raw) throw new Error('Gemini returned an empty response.');
    return JSON.parse(raw) as POAutofillResult;
  };

  try {
    return await run(Date.now(), false);
  } catch (err) {
    // A stale/expired uploaded file surfaces as a 4xx referencing the file.
    // Drop the cache and force one clean re-upload before giving up.
    cachedFiles = null;
    if (err instanceof SyntaxError) throw err; // bad JSON — re-running won't help
    return await run(Date.now(), true);
  }
}
