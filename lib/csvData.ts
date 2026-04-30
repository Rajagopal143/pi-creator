import fs from 'fs';
import path from 'path';

export interface Address {
  city: string;
  state: string;
  address: string;
  country: string;
  pincode: string;
}

export interface Dealer {
  id: number;
  dealerId: string;
  OEMProfileID: number;
  dealerType: 'dealer' | 'distributor' | 'subdealer' | 'areadealer';
  orgName: string;
  orgDisplayName: string;
  orgEmail: string;
  contact: string;
  gstNo: string;
  billingAddress: Address;
  shippingAddress: Address;
  firstName: string;
  lastName: string;
  state: string;
}

export interface ProductColour {
  colourCode: string;
  colourName: string;
}

export interface Product {
  id: number;
  productName: string;
  HSN: string;
  cgst: number;
  sgst: number;
  colours: ProductColour[];
}

export interface ProductVariant {
  id: number;
  productId: number;
  name: string;
  dealerPrice: number;
  distributorPrice: number;
  subdealerPrice: number;
  sellingPrice: number;
  areadealerPrice: number;
  isWBC: boolean;
}

/** RFC-4180 compliant CSV parser that handles quoted fields with escaped double-quotes. */
function parseCSVRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  const n = content.length;

  while (i < n) {
    if (content[i] === '\r') { i++; continue; }

    if (content[i] === '\n') {
      rows.push(row);
      row = [];
      i++;
      continue;
    }

    if (content[i] === '"') {
      i++; // skip opening quote
      let field = '';
      while (i < n) {
        if (content[i] === '"') {
          if (i + 1 < n && content[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          field += content[i];
          i++;
        }
      }
      row.push(field);
      if (i < n && content[i] === ',') i++;
    } else {
      let field = '';
      while (i < n && content[i] !== ',' && content[i] !== '\n' && content[i] !== '\r') {
        field += content[i];
        i++;
      }
      row.push(field);
      if (i < n && content[i] === ',') i++;
    }
  }

  if (row.length > 0) rows.push(row);
  return rows;
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows
    .slice(1)
    .filter(r => r.some(cell => cell.trim() !== ''))
    .map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => { obj[h] = (row[idx] ?? '').trim(); });
      return obj;
    });
}

function safeJSON<T>(str: string, fallback: T): T {
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

export function loadDealers(): Dealer[] {
  const filePath = path.join(process.cwd(), 'public', 'dealers (1).csv');
  const content = fs.readFileSync(filePath, 'utf-8');
  const objects = rowsToObjects(parseCSVRows(content));

  return objects
    .filter(o => o.id && o.dealerId)
    .map(o => ({
      id: Number(o.id),
      dealerId: o.dealerId,
      OEMProfileID: Number(o.OEMProfileID) || 1,
      dealerType: (o.dealerType || 'dealer') as Dealer['dealerType'],
      orgName: o.orgName || '',
      orgDisplayName: o.orgDisplayName || '',
      orgEmail: o.orgEmail || '',
      contact: o.contact || '',
      gstNo: o.gstNo || '',
      billingAddress: safeJSON<Address>(o.billingAddress, { city: '', state: '', address: '', country: '', pincode: '' }),
      shippingAddress: safeJSON<Address>(o.shippingAddress, { city: '', state: '', address: '', country: '', pincode: '' }),
      firstName: o.firstName || '',
      lastName: o.lastName || '',
      state: o.state || '',
    }));
}

export function loadProducts(): Product[] {
  const filePath = path.join(process.cwd(), 'public', 'vehicle-products(8).csv');
  const content = fs.readFileSync(filePath, 'utf-8');
  const objects = rowsToObjects(parseCSVRows(content));

  return objects
    .filter(o => o.id && o.productName && o.isActive === '1')
    .map(o => {
      // colours may be wrapped in {} braces from the DB dump; strip them before parsing
      let coloursStr = o.colours || '[]';
      if (coloursStr.startsWith('{') && !coloursStr.startsWith('{\"')) {
        coloursStr = coloursStr.slice(1, -1);
      }
      return {
        id: Number(o.id),
        productName: o.productName || '',
        HSN: o.HSN || '',
        cgst: parseFloat(o.cgst) || 0,
        sgst: parseFloat(o.sgst) || 0,
        colours: safeJSON<ProductColour[]>(coloursStr, []),
      };
    });
}

export function loadProductVariants(): ProductVariant[] {
  const filePath = path.join(process.cwd(), 'public', 'product_variants (1).csv');
  const content = fs.readFileSync(filePath, 'utf-8');
  const objects = rowsToObjects(parseCSVRows(content));

  return objects
    .filter(o => o.id && o.productId && o.isActive === '1')
    .map(o => ({
      id: Number(o.id),
      productId: Number(o.productId),
      name: o.name || '',
      dealerPrice: parseFloat(o.dealerPrice) || 0,
      distributorPrice: parseFloat(o.distributorPrice) || 0,
      subdealerPrice: parseFloat(o.subdealerPrice) || 0,
      sellingPrice: parseFloat(o.sellingPrice) || 0,
      areadealerPrice: parseFloat(o.areadealerPrice) || 0,
      isWBC: o.isWBC === '1',
    }));
}

export interface ManufacturingUnit {
  id: number;
  OEMProfileID: number;
  unitName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstNo: string;
  phoneNo: string;
  email: string;
  accountNumber: string;
}

export function loadManufacturingUnits(): ManufacturingUnit[] {
  const filePath = path.join(process.cwd(), 'public', 'manufacturing_units.csv');
  const content = fs.readFileSync(filePath, 'utf-8');
  const objects = rowsToObjects(parseCSVRows(content));

  return objects
    .filter(o => o.id && o.unitName && o.isActive === '1')
    .map(o => ({
      id: Number(o.id),
      OEMProfileID: Number(o.OEMProfileID) || 1,
      unitName: o.unitName || '',
      address: o.address || '',
      city: o.city || '',
      state: o.state || '',
      pincode: o.pincode || '',
      gstNo: o.gstNo || '',
      phoneNo: o.phoneNo || '',
      email: o.email || '',
      accountNumber: o.accountNumber || '',
    }));
}
