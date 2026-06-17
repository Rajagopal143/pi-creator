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
import { buildPOCatalog } from './poCatalog';
import type { POAutofillResult } from './poTypes';

const MODEL = 'gemini-2.5-flash';
/**
 * Gemini-uploaded files expire after 48h. Re-upload comfortably before that so
 * an in-flight request never references an expired file.
 */
const FILE_TTL_MS = 40 * 60 * 60 * 1000;

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
// The dealer/product catalogs are uploaded to the Files API once and reused by
// URI across requests. Invalidated when the catalog content changes (hash) or
// the upload nears expiry (TTL).

interface UploadedFile { uri: string; mimeType: string }
interface CatalogFiles {
  dealers: UploadedFile;
  products: UploadedFile;
  hash: string;
  uploadedAt: number;
}

let cachedFiles: CatalogFiles | null = null;

async function uploadText(content: string, displayName: string): Promise<UploadedFile> {
  const ai = getClient();
  // Persist as a real file on disk before uploading — the Files API reads a path.
  const filePath = path.join(os.tmpdir(), `${displayName}-${Date.now()}.txt`);
  await fs.writeFile(filePath, content, 'utf8');
  try {
    const uploaded = await ai.files.upload({
      file: filePath,
      config: { mimeType: 'text/plain', displayName },
    });
    if (!uploaded.uri || !uploaded.mimeType) {
      throw new Error(`Upload for ${displayName} returned no usable file reference.`);
    }
    return { uri: uploaded.uri, mimeType: uploaded.mimeType };
  } finally {
    await fs.rm(filePath, { force: true });
  }
}

async function getCatalogFiles(now: number): Promise<CatalogFiles> {
  const { dealersJson, productsJson, hash } = await buildPOCatalog();

  const fresh =
    cachedFiles &&
    cachedFiles.hash === hash &&
    now - cachedFiles.uploadedAt < FILE_TTL_MS;
  if (fresh) return cachedFiles!;

  const [dealers, products] = await Promise.all([
    uploadText(dealersJson, 'pi-dealers-catalog'),
    uploadText(productsJson, 'pi-products-catalog'),
  ]);
  cachedFiles = { dealers, products, hash, uploadedAt: now };
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
 • the dealers catalog: a JSON array of { id, name, location, type }
 • the products catalog: a JSON array of { id, name, variants:[{ id, name }] }

Rules:
 • ALWAYS return ids that exist in the attached catalogs. Never invent an id.
 • Match dealer/product/variant names tolerantly (case-insensitive, ignore extra spaces, abbreviations, and minor typos). If you are not reasonably confident, leave the id null.
 • "To" / "bill to" / the buying party → billTo. Only set shipTo when the text clearly names a DIFFERENT ship destination; otherwise leave shipTo ids null (the form mirrors billTo automatically).
 • Each ordered product line → one lineItems entry. Resolve productId, then the variantId from THAT product's variants. qty must be a positive integer (default 1 if a line clearly orders a product but states no quantity).
 • piType: "accessory" only if the order is clearly accessories-only; otherwise "vehicle". accessory field is "steel" or "black" only for accessory orders, else "none".
 • priceTier: infer from the dealer's "type" when it maps cleanly, else null.
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

  const run = async (now: number): Promise<POAutofillResult> => {
    const files = await getCatalogFiles(now);
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

  const now = Date.now();
  try {
    return await run(now);
  } catch (err) {
    // A stale/expired uploaded file surfaces as a 4xx referencing the file.
    // Drop the cache and try one clean re-upload before giving up.
    cachedFiles = null;
    if (err instanceof SyntaxError) throw err; // bad JSON — re-running won't help
    return await run(Date.now());
  }
}
