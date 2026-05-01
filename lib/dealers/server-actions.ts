'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import { connectDB } from '@/lib/mongodb';
import { loadDealers } from '@/lib/csvData';
import { DealerRecord } from './dealerRecordModel';
import { csvDealerRowToRecordPayload } from './csvImportPayload';
import { dealerRecordToPICreatorDealer } from './toPICreatorDealer';
import { userTypeToPricingType } from './mapUserTypeToPricing';
import type { DealerUserType } from './referenceData';
import type { Dealer } from '@/lib/csvData';
import type { CreateDealerState, DealerListRow, ParentOption } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function nextDealerNumericId(): Promise<number> {
  const last = await DealerRecord.findOne()
    .sort({ dealerNumericId: -1 })
    .select('dealerNumericId')
    .lean();
  return (last?.dealerNumericId ?? 0) + 1;
}

/** Public dealer id: D000001, D000002, … (increments from max existing `D` + digits). */
async function nextDDealerId(): Promise<string> {
  const docs = await DealerRecord.find({
    dealerId: { $regex: /^D\d+$/i },
  })
    .select('dealerId')
    .lean();
  let max = 0;
  for (const d of docs) {
    const m = /^D(\d+)$/i.exec(d.dealerId);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    }
  }
  const next = max + 1;
  return `D${String(next).padStart(6, '0')}`;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

const PIN_RE = /^\d{6}$/;
const ALLOWED_USER_TYPES: DealerUserType[] = [
  'distributor',
  'divisionaldistributor',
  'districtdealer',
  'areadealer',
];

// ─── Read actions ─────────────────────────────────────────────────────────────

export async function getDealersForPIAction(): Promise<Dealer[]> {
  await connectDB();
  const docs = await DealerRecord.find({ isActive: true })
    .sort({ dealerNumericId: 1 })
    .lean();
  return docs.map(d => dealerRecordToPICreatorDealer(d as Parameters<typeof dealerRecordToPICreatorDealer>[0]));
}

export async function listDealersForAdminAction(): Promise<DealerListRow[]> {
  await connectDB();
  const docs = await DealerRecord.find({})
    .sort({ dealerNumericId: -1 })
    .select('dealerNumericId dealerId orgName userType orgEmail contact source')
    .lean();
  return docs.map(d => ({
    id: String(d._id),
    dealerNumericId: d.dealerNumericId,
    dealerId: d.dealerId,
    orgName: d.orgName,
    userType: d.userType,
    orgEmail: d.orgEmail,
    contact: d.contact,
    source: d.source,
  }));
}

export async function getDistributorsForFormAction(): Promise<ParentOption[]> {
  await connectDB();
  const docs = await DealerRecord.find({ isActive: true, userType: 'distributor' })
    .select('_id orgName')
    .sort({ orgName: 1 })
    .lean();
  return docs.map(d => ({ id: String(d._id), orgName: d.orgName }));
}

export async function getDealersForParentFormAction(): Promise<ParentOption[]> {
  await connectDB();
  const docs = await DealerRecord.find({
    isActive: true,
    userType: { $in: ['districtdealer', 'distributor'] },
  })
    .select('_id orgName userType')
    .sort({ orgName: 1 })
    .lean();
  return docs.map(d => ({ id: String(d._id), orgName: `${d.orgName} (${d.userType})` }));
}

// ─── Import CSV (bundled public file) ──────────────────────────────────────────

export async function importDealersFromCsvAction(): Promise<{
  ok: boolean;
  imported: number;
  message: string;
}> {
  await connectDB();
  const rows = loadDealers();
  let imported = 0;
  for (const row of rows) {
    const payload = csvDealerRowToRecordPayload(row);
    await DealerRecord.updateOne(
      { dealerId: row.dealerId },
      { $set: { ...payload, dealerNumericId: row.id, dealerId: row.dealerId } },
      { upsert: true },
    );
    imported++;
  }
  revalidatePath('/dealers');
  revalidatePath('/dealers/add');
  revalidatePath('/create-pi');
  return { ok: true, imported, message: `Imported / updated ${imported} dealers from CSV.` };
}

// ─── Create dealer (form) ────────────────────────────────────────────────────

export async function createDealerAction(
  _prev: CreateDealerState,
  formData: FormData,
): Promise<CreateDealerState> {
  const fieldErrors: Record<string, string> = {};

  const salutation = (formData.get('salutation') as string) || 'mr';
  const userTypeRaw = String(formData.get('userType') || 'districtdealer');
  const userType = (ALLOWED_USER_TYPES.includes(userTypeRaw as DealerUserType)
    ? userTypeRaw
    : 'districtdealer') as DealerUserType;
  const firstName = String(formData.get('firstName') || '').trim();
  const lastName = String(formData.get('lastName') || '').trim();
  const orgName = String(formData.get('orgName') || '').trim();
  const gstNo = String(formData.get('gstNo') || '').trim().toUpperCase();
  const orgEmail = String(formData.get('orgEmail') || '').trim().toLowerCase();
  const contact = String(formData.get('contact') || '').trim();
  const regionId = String(formData.get('regionId') || '').trim();
  const zoneId = String(formData.get('zoneId') || '').trim();
  const mfgRaw = formData.get('manufacturingUnitId');
  const manufacturingUnitId =
    mfgRaw === '' || mfgRaw === null ? null : Number(mfgRaw);
  const password = String(formData.get('password') || '');
  const parentDistributorId = String(formData.get('parentDistributorId') || '').trim();
  const parentDealerId = String(formData.get('parentDealerId') || '').trim();

  const billingCountry = String(formData.get('billingCountry') || 'India');
  const billingState = String(formData.get('billingState') || '').trim();
  const billingAddress = String(formData.get('billingAddress') || '').trim();
  const billingCity = String(formData.get('billingCity') || '').trim();
  const billingPincode = String(formData.get('billingPincode') || '').trim();

  const shippingCountry = String(formData.get('shippingCountry') || 'India');
  const shippingState = String(formData.get('shippingState') || '').trim();
  const shippingAddress = String(formData.get('shippingAddress') || '').trim();
  const shippingCity = String(formData.get('shippingCity') || '').trim();
  const shippingPincode = String(formData.get('shippingPincode') || '').trim();

  const accountType = (formData.get('accountType') as 'Current' | 'Savings') || 'Current';
  const beneficiaryName = String(formData.get('beneficiaryName') || '').trim();
  const bankName = String(formData.get('bankName') || '').trim();
  const accountNumber = String(formData.get('accountNumber') || '').trim();
  const confirmAccount = String(formData.get('confirmAccount') || '').trim();
  const IFSC = String(formData.get('IFSC') || '').trim().toUpperCase();

  const logoBase64 = String(formData.get('logoBase64') || '').trim();
  const logoMimeType = String(formData.get('logoMimeType') || '').trim();

  if (!firstName) fieldErrors.firstName = 'First name is required';
  if (!lastName) fieldErrors.lastName = 'Last name is required';
  if (!orgName) fieldErrors.orgName = 'Please fill the Dealer name';
  if (!gstNo) fieldErrors.gstNo = 'GST number is required';
  else if (gstNo.replace(/\s/g, '').length !== 15) {
    fieldErrors.gstNo = 'GSTIN must be 15 characters';
  }
  if (!orgEmail) fieldErrors.orgEmail = 'Organization email is required';
  else if (!isValidEmail(orgEmail)) fieldErrors.orgEmail = 'Enter a valid email address';
  if (!contact) fieldErrors.contact = 'Contact number is required';
  if (!regionId) fieldErrors.regionId = 'Region is required';
  if (!zoneId) fieldErrors.zoneId = 'Zone is required';
  if (!password || password.length < 6) fieldErrors.password = 'Password is required (min 6 characters)';

  if (userType === 'districtdealer' && !parentDistributorId) {
    fieldErrors.parentDistributorId = 'Select a distributor';
  }

  if (!billingState) fieldErrors['billing.state'] = 'State is required';
  if (!billingAddress) fieldErrors['billing.address'] = 'Address is required';
  if (!billingCity) fieldErrors['billing.city'] = 'City is required';
  if (!billingPincode) fieldErrors['billing.pincode'] = 'Pincode is required';
  else if (!PIN_RE.test(billingPincode)) fieldErrors['billing.pincode'] = 'Pincode must be 6 digits';

  if (!shippingState) fieldErrors['shipping.state'] = 'State is required';
  if (!shippingAddress) fieldErrors['shipping.address'] = 'Address is required';
  if (!shippingCity) fieldErrors['shipping.city'] = 'City is required';
  if (!shippingPincode) fieldErrors['shipping.pincode'] = 'Pincode is required';
  else if (!PIN_RE.test(shippingPincode)) fieldErrors['shipping.pincode'] = 'Pincode must be 6 digits';

  if (!beneficiaryName) fieldErrors['bank.beneficiaryName'] = 'Beneficiary name is required';
  if (!bankName) fieldErrors['bank.bankName'] = 'Bank name is required';
  if (!accountNumber) fieldErrors['bank.accountNumber'] = 'Account number is required';
  if (!confirmAccount) fieldErrors['bank.confirmAccount'] = 'Re-enter the account number';
  else if (confirmAccount !== accountNumber) fieldErrors['bank.confirmAccount'] = 'Account numbers do not match';
  if (!IFSC) fieldErrors['bank.IFSC'] = 'IFSC code is required';

  if (logoBase64 && logoBase64.length > 1_400_000) {
    fieldErrors.logo = 'Logo file too large (max ~1MB)';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: '', fieldErrors };
  }

  await connectDB();

  const dupEmail = await DealerRecord.findOne({ orgEmail }).lean();
  if (dupEmail) {
    return {
      ok: false,
      message: '',
      fieldErrors: { orgEmail: 'A dealer with this email already exists' },
    };
  }

  const numericId = await nextDealerNumericId();
  const dealerId = await nextDDealerId();
  const passwordHash = await bcrypt.hash(password, 10);

  const pricingDealerType = userTypeToPricingType(userType);

  let parentDistOid: mongoose.Types.ObjectId | null = null;
  let parentDealerOid: mongoose.Types.ObjectId | null = null;
  if (parentDistributorId && mongoose.Types.ObjectId.isValid(parentDistributorId)) {
    parentDistOid = new mongoose.Types.ObjectId(parentDistributorId);
  }
  if (parentDealerId && mongoose.Types.ObjectId.isValid(parentDealerId)) {
    parentDealerOid = new mongoose.Types.ObjectId(parentDealerId);
  }

  await DealerRecord.create({
    dealerNumericId: numericId,
    dealerId,
    OEMProfileID: 1,
    userType,
    pricingDealerType,
    salutation: salutation as 'mr' | 'miss' | 'mrs',
    firstName,
    lastName,
    orgName,
    orgDisplayName: orgName,
    gstNo,
    orgEmail,
    contact,
    passwordHash,
    parentDistributorId: parentDistOid,
    parentDealerId: parentDealerOid,
    regionId,
    zoneId,
    manufacturingUnitId: Number.isFinite(manufacturingUnitId as number) ? manufacturingUnitId : null,
    billingAddress: {
      country: billingCountry,
      state: billingState,
      address: billingAddress,
      city: billingCity,
      pincode: billingPincode,
    },
    shippingAddress: {
      country: shippingCountry,
      state: shippingState,
      address: shippingAddress,
      city: shippingCity,
      pincode: shippingPincode,
    },
    bankDetails: {
      accountType,
      beneficiaryName,
      bankName,
      accountNumber,
      IFSC,
    },
    logoBase64: logoBase64 || undefined,
    logoMimeType: logoMimeType || undefined,
    isActive: true,
    source: 'manual',
  });

  revalidatePath('/dealers');
  revalidatePath('/create-pi');
  redirect('/dealers');
}
