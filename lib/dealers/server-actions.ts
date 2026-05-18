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
import type { CreateDealerState, DealerFormInitial, DealerListRow, ParentOption } from './types';

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

const ALLOWED_USER_TYPES: DealerUserType[] = [
  'distributor',
  'divisionaldistributor',
  'districtdealer',
  'areadealer',
];

interface AddressFields {
  country: string;
  state: string;
  address: string;
  city: string;
  pincode: string;
}

interface DealerFormFields {
  dealerId: string;
  salutation: 'mr' | 'miss' | 'mrs';
  userType: DealerUserType;
  firstName: string;
  lastName: string;
  orgName: string;
  gstNo: string;
  orgEmail: string;
  contact: string;
  regionId: string;
  zoneId: string;
  manufacturingUnitId: number | null;
  password: string;
  parentDistributorId: string;
  parentDealerId: string;
  billing: AddressFields;
  shipping: AddressFields;
  accountType: 'Current' | 'Savings';
  beneficiaryName: string;
  bankName: string;
  accountNumber: string;
  confirmAccount: string;
  IFSC: string;
  logoBase64: string;
  logoMimeType: string;
}

/** Pulls every dealer field out of the submitted FormData. */
function readDealerForm(formData: FormData): DealerFormFields {
  const userTypeRaw = String(formData.get('userType') || 'districtdealer');
  const userType = (ALLOWED_USER_TYPES.includes(userTypeRaw as DealerUserType)
    ? userTypeRaw
    : 'districtdealer') as DealerUserType;
  const mfgRaw = formData.get('manufacturingUnitId');
  const manufacturingUnitId = mfgRaw === '' || mfgRaw === null ? null : Number(mfgRaw);

  return {
    dealerId: String(formData.get('dealerId') || '').trim(),
    salutation: ((formData.get('salutation') as string) || 'mr') as 'mr' | 'miss' | 'mrs',
    userType,
    firstName: String(formData.get('firstName') || '').trim(),
    lastName: String(formData.get('lastName') || '').trim(),
    orgName: String(formData.get('orgName') || '').trim(),
    gstNo: String(formData.get('gstNo') || '').trim().toUpperCase(),
    orgEmail: String(formData.get('orgEmail') || '').trim().toLowerCase(),
    contact: String(formData.get('contact') || '').trim(),
    regionId: String(formData.get('regionId') || '').trim(),
    zoneId: String(formData.get('zoneId') || '').trim(),
    manufacturingUnitId,
    password: String(formData.get('password') || ''),
    parentDistributorId: String(formData.get('parentDistributorId') || '').trim(),
    parentDealerId: String(formData.get('parentDealerId') || '').trim(),
    billing: {
      country: String(formData.get('billingCountry') || 'India'),
      state: String(formData.get('billingState') || '').trim(),
      address: String(formData.get('billingAddress') || '').trim(),
      city: String(formData.get('billingCity') || '').trim(),
      pincode: String(formData.get('billingPincode') || '').trim(),
    },
    shipping: {
      country: String(formData.get('shippingCountry') || 'India'),
      state: String(formData.get('shippingState') || '').trim(),
      address: String(formData.get('shippingAddress') || '').trim(),
      city: String(formData.get('shippingCity') || '').trim(),
      pincode: String(formData.get('shippingPincode') || '').trim(),
    },
    accountType: ((formData.get('accountType') as 'Current' | 'Savings') || 'Current'),
    beneficiaryName: String(formData.get('beneficiaryName') || '').trim(),
    bankName: String(formData.get('bankName') || '').trim(),
    accountNumber: String(formData.get('accountNumber') || '').trim(),
    confirmAccount: String(formData.get('confirmAccount') || '').trim(),
    IFSC: String(formData.get('IFSC') || '').trim().toUpperCase(),
    logoBase64: String(formData.get('logoBase64') || '').trim(),
    logoMimeType: String(formData.get('logoMimeType') || '').trim(),
  };
}

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  return id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
}

/**
 * Reshapes submitted form fields into the form's initial-values shape, so an
 * error response can echo them back and the inputs keep what the user typed.
 */
function formFieldsToInitial(f: DealerFormFields): DealerFormInitial {
  return {
    id: f.dealerId,
    dealerId: f.dealerId,
    userType: f.userType,
    salutation: f.salutation,
    firstName: f.firstName,
    lastName: f.lastName,
    orgName: f.orgName,
    gstNo: f.gstNo,
    orgEmail: f.orgEmail,
    contact: f.contact,
    regionId: f.regionId,
    zoneId: f.zoneId,
    manufacturingUnitId: f.manufacturingUnitId,
    parentDistributorId: f.parentDistributorId,
    parentDealerId: f.parentDealerId,
    billingAddress: { ...f.billing },
    shippingAddress: { ...f.shipping },
    bankDetails: {
      accountType: f.accountType,
      beneficiaryName: f.beneficiaryName,
      bankName: f.bankName,
      accountNumber: f.accountNumber,
      IFSC: f.IFSC,
    },
    logoBase64: f.logoBase64,
    logoMimeType: f.logoMimeType,
    password: f.password,
  };
}

/** Builds the fields shared by create + update writes (everything except identity/auth). */
function buildDealerWritePayload(f: DealerFormFields) {
  return {
    userType: f.userType,
    pricingDealerType: userTypeToPricingType(f.userType),
    salutation: f.salutation,
    firstName: f.firstName,
    lastName: f.lastName,
    orgName: f.orgName,
    orgDisplayName: f.orgName,
    gstNo: f.gstNo,
    orgEmail: f.orgEmail,
    contact: f.contact,
    parentDistributorId: toObjectId(f.parentDistributorId),
    parentDealerId: toObjectId(f.parentDealerId),
    regionId: f.regionId,
    zoneId: f.zoneId,
    manufacturingUnitId: Number.isFinite(f.manufacturingUnitId as number) ? f.manufacturingUnitId : null,
    billingAddress: { ...f.billing },
    shippingAddress: { ...f.shipping },
    bankDetails: {
      accountType: f.accountType,
      beneficiaryName: f.beneficiaryName,
      bankName: f.bankName,
      accountNumber: f.accountNumber,
      IFSC: f.IFSC,
    },
    logoBase64: f.logoBase64 || '',
    logoMimeType: f.logoMimeType || '',
  };
}

// Dealer form validation is intentionally omitted — no field is required to
// create or edit a dealer.

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

/** Loads a single dealer's values for the edit form. Returns null when not found. */
export async function getDealerForEditAction(id: string): Promise<DealerFormInitial | null> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const d = await DealerRecord.findById(id).lean();
  if (!d) return null;

  const emptyAddress = { country: 'India', state: '', address: '', city: '', pincode: '' };
  return {
    id: String(d._id),
    dealerId: d.dealerId,
    userType: d.userType,
    salutation: d.salutation || 'mr',
    firstName: d.firstName || '',
    lastName: d.lastName || '',
    orgName: d.orgName || '',
    gstNo: d.gstNo || '',
    orgEmail: d.orgEmail || '',
    contact: d.contact || '',
    regionId: d.regionId || '',
    zoneId: d.zoneId || '',
    manufacturingUnitId: d.manufacturingUnitId ?? null,
    parentDistributorId: d.parentDistributorId ? String(d.parentDistributorId) : '',
    parentDealerId: d.parentDealerId ? String(d.parentDealerId) : '',
    billingAddress: { ...emptyAddress, ...(d.billingAddress || {}) },
    shippingAddress: { ...emptyAddress, ...(d.shippingAddress || {}) },
    bankDetails: {
      accountType: d.bankDetails?.accountType || 'Current',
      beneficiaryName: d.bankDetails?.beneficiaryName || '',
      bankName: d.bankDetails?.bankName || '',
      accountNumber: d.bankDetails?.accountNumber || '',
      IFSC: d.bankDetails?.IFSC || '',
    },
    logoBase64: d.logoBase64 || '',
    logoMimeType: d.logoMimeType || '',
  };
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
  const f = readDealerForm(formData);

  await connectDB();

  try {
    const numericId = await nextDealerNumericId();
    const dealerId = await nextDDealerId();
    const passwordHash = await bcrypt.hash(f.password, 10);

    await DealerRecord.create({
      ...buildDealerWritePayload(f),
      dealerNumericId: numericId,
      dealerId,
      OEMProfileID: 1,
      passwordHash,
      logoBase64: f.logoBase64 || undefined,
      logoMimeType: f.logoMimeType || undefined,
      isActive: true,
      source: 'manual',
    });
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to create dealer.',
      fieldErrors: {},
      values: formFieldsToInitial(f),
    };
  }

  revalidatePath('/dealers');
  revalidatePath('/create-pi');
  redirect('/dealers');
}

// ─── Update dealer (form) ────────────────────────────────────────────────────

export async function updateDealerAction(
  _prev: CreateDealerState,
  formData: FormData,
): Promise<CreateDealerState> {
  const f = readDealerForm(formData);

  if (!f.dealerId || !mongoose.Types.ObjectId.isValid(f.dealerId)) {
    return {
      ok: false, message: 'Invalid dealer reference.', fieldErrors: {},
      values: formFieldsToInitial(f),
    };
  }

  await connectDB();

  const existing = await DealerRecord.findById(f.dealerId).lean();
  if (!existing) {
    return {
      ok: false, message: 'Dealer not found.', fieldErrors: {},
      values: formFieldsToInitial(f),
    };
  }

  const update: Record<string, unknown> = buildDealerWritePayload(f);
  // Only change the password when a new one was supplied.
  if (f.password) {
    update.passwordHash = await bcrypt.hash(f.password, 10);
  }

  try {
    await DealerRecord.updateOne({ _id: existing._id }, { $set: update }, { runValidators: true });
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to update dealer.',
      fieldErrors: {},
      values: formFieldsToInitial(f),
    };
  }

  revalidatePath('/dealers');
  revalidatePath('/create-pi');
  revalidatePath(`/dealers/${f.dealerId}/edit`);
  redirect('/dealers');
}
