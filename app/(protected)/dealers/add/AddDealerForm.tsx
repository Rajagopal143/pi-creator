'use client';

import { useActionState, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Trash2, Upload } from 'lucide-react';

import { PageTitleBar } from '@/components/app/PageTitleBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { createDealerAction, updateDealerAction } from '@/lib/dealers/server-actions';
import { initialCreateState, type DealerFormInitial, type ParentOption } from '@/lib/dealers/types';
import type { ManufacturingUnit, Address } from '@/lib/csvData';
import type { StateOption, DealerUserType } from '@/lib/dealers/referenceData';
import { cn } from '@/lib/utils';

const SUBMIT_LABELS: Record<DealerUserType, string> = {
  distributor: 'Create Distributor',
  divisionaldistributor: 'Create Divisional Distributor',
  districtdealer: 'Create District Dealer',
  areadealer: 'Create Area Dealer',
};

interface Props {
  manufacturingUnits: ManufacturingUnit[];
  distributors: ParentOption[];
  parentDealers: ParentOption[];
  states: StateOption[];
  /** When provided, the form runs in edit mode against this dealer. */
  dealer?: DealerFormInitial;
}

export default function AddDealerForm({
  manufacturingUnits,
  distributors,
  parentDealers,
  states,
  dealer,
}: Props) {
  const isEdit = !!dealer;
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateDealerAction : createDealerAction,
    initialCreateState,
  );
  const fe = state.fieldErrors;

  const [userType, setUserType] = useState<DealerUserType>(dealer?.userType ?? 'distributor');
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState<'Current' | 'Savings'>(
    dealer?.bankDetails.accountType ?? 'Current',
  );
  const [logoPreview, setLogoPreview] = useState<string | null>(
    dealer?.logoBase64
      ? `data:${dealer.logoMimeType || 'image/png'};base64,${dealer.logoBase64}`
      : null,
  );
  const [logoName, setLogoName] = useState(dealer?.logoBase64 ? 'Current logo' : '');
  const [logoBase64, setLogoBase64] = useState(dealer?.logoBase64 ?? '');
  const [logoMime, setLogoMime] = useState(dealer?.logoMimeType ?? '');
  const [logoError, setLogoError] = useState('');

  const onLogo = useCallback((files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Please choose an image file');
      return;
    }
    if (file.size > 1_000_000) {
      setLogoError('Maximum file size is 1MB');
      return;
    }
    setLogoError('');
    setLogoName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      setLogoPreview(r);
      const parts = r.split(',');
      setLogoBase64(parts[1] ?? '');
      setLogoMime(file.type);
    };
    reader.readAsDataURL(file);
  }, []);

  const clearLogo = () => {
    setLogoPreview(null);
    setLogoName('');
    setLogoBase64('');
    setLogoMime('');
    setLogoError('');
  };

  const copyBillingToShipping = () => {
    const form = formRef.current;
    if (!form) return;
    const get = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)?.value ?? '';
    (form.elements.namedItem('shippingCountry') as HTMLSelectElement).value = get('billingCountry');
    (form.elements.namedItem('shippingState') as HTMLSelectElement).value = get('billingState');
    (form.elements.namedItem('shippingAddress') as HTMLTextAreaElement).value = get('billingAddress');
    (form.elements.namedItem('shippingCity') as HTMLInputElement).value = get('billingCity');
    (form.elements.namedItem('shippingPincode') as HTMLInputElement).value = get('billingPincode');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <PageTitleBar
        pageTitle={isEdit ? `Edit Dealer — ${dealer.dealerId}` : 'Add New Dealer'}
        browserBack
        fallbackURL="/dealers"
      />

      <form ref={formRef} action={formAction} className="space-y-6">
        {isEdit && <input type="hidden" name="dealerId" value={dealer.id} />}
        <input type="hidden" name="logoBase64" value={logoBase64} />
        <input type="hidden" name="logoMimeType" value={logoMime} />
        <input type="hidden" name="accountType" value={accountType} />

        {state.message ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.message}
          </p>
        ) : null}

        {/* User type */}
        <section className="space-y-2">
          <div className="grid gap-2 md:grid-cols-[minmax(0,180px)_1fr] md:items-start">
            <label className="text-sm font-medium">
              User Type <span className="text-destructive">*</span>
            </label>
            <div className="flex flex-wrap gap-4 pt-1">
              {(
                [
                  'distributor',
                  'divisionaldistributor',
                  'districtdealer',
                  'areadealer',
                ] as DealerUserType[]
              ).map(v => (
                <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="userType"
                    value={v}
                    checked={userType === v}
                    onChange={() => setUserType(v)}
                    className="accent-primary"
                  />
                  <span>{SUBMIT_LABELS[v].replace(/^Create /, '')}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <Separator />

        {/* Owner name */}
        <section className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[minmax(0,180px)_1fr] md:items-start">
            <label className="text-sm font-medium">
              Owner Name <span className="text-destructive">*</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-[100px_1fr_1fr]">
              <select
                name="salutation"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                defaultValue={dealer?.salutation ?? 'mr'}
              >
                <option value="mr">Mr.</option>
                <option value="miss">Miss.</option>
                <option value="mrs">Mrs.</option>
              </select>
              <div>
                <Input
                  name="firstName"
                  placeholder="First Name"
                  autoComplete="given-name"
                  defaultValue={dealer?.firstName}
                  className={cn(fe.firstName && 'border-destructive')}
                />
                {fe.firstName ? <p className="mt-1 text-xs text-destructive">{fe.firstName}</p> : null}
              </div>
              <div>
                <Input
                  name="lastName"
                  placeholder="Last Name"
                  autoComplete="family-name"
                  defaultValue={dealer?.lastName}
                  className={cn(fe.lastName && 'border-destructive')}
                />
                {fe.lastName ? <p className="mt-1 text-xs text-destructive">{fe.lastName}</p> : null}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-4">
            <Field label="Firm Name" required>
              <Input
                name="orgName"
                placeholder="Enter Firm Name"
                autoComplete="organization"
                defaultValue={dealer?.orgName}
                className={cn(fe.orgName && 'border-destructive')}
              />
              {fe.orgName ? <p className="mt-1 text-xs text-destructive">{fe.orgName}</p> : null}
            </Field>

            <Field label="GST No" required>
              <Input
                name="gstNo"
                placeholder="Enter GST No"
                defaultValue={dealer?.gstNo}
                className={cn(fe.gstNo && 'border-destructive')}
              />
              {fe.gstNo ? <p className="mt-1 text-xs text-destructive">{fe.gstNo}</p> : null}
            </Field>

            <Field label="Org Email ID" required>
              <Input
                name="orgEmail"
                type="email"
                placeholder="Enter Email ID"
                autoComplete="email"
                defaultValue={dealer?.orgEmail}
                className={cn(fe.orgEmail && 'border-destructive')}
              />
              {fe.orgEmail ? <p className="mt-1 text-xs text-destructive">{fe.orgEmail}</p> : null}
            </Field>

            <Field label="Org Contact" required>
              <Input
                name="contact"
                placeholder="Contact number"
                autoComplete="tel"
                defaultValue={dealer?.contact}
                className={cn(fe.contact && 'border-destructive')}
              />
              {fe.contact ? <p className="mt-1 text-xs text-destructive">{fe.contact}</p> : null}
            </Field>

            {userType === 'districtdealer' && (
              <Field label="Select Distributor" required>
                <select
                  name="parentDistributorId"
                  className={cn(
                    'h-9 w-full rounded-md border border-input bg-background px-2 text-sm',
                    fe.parentDistributorId && 'border-destructive',
                  )}
                  defaultValue={dealer?.parentDistributorId ?? ''}
                >
                  <option value="" disabled>
                    Select Distributor
                  </option>
                  {distributors.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.orgName}
                    </option>
                  ))}
                </select>
                {fe.parentDistributorId ? (
                  <p className="mt-1 text-xs text-destructive">{fe.parentDistributorId}</p>
                ) : null}
              </Field>
            )}

            {userType === 'areadealer' && (
              <Field label="Select Dealer (optional)">
                <select
                  name="parentDealerId"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  defaultValue={dealer?.parentDealerId ?? ''}
                >
                  <option value="">— None —</option>
                  {parentDealers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.orgName}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Region" required>
              <Input
                name="regionId"
                placeholder="Enter region"
                defaultValue={dealer?.regionId}
                className={cn(fe.regionId && 'border-destructive')}
              />
              {fe.regionId ? <p className="mt-1 text-xs text-destructive">{fe.regionId}</p> : null}
            </Field>

            <Field label="Zone" required>
              <Input
                name="zoneId"
                placeholder="Enter zone"
                defaultValue={dealer?.zoneId}
                className={cn(fe.zoneId && 'border-destructive')}
              />
              {fe.zoneId ? <p className="mt-1 text-xs text-destructive">{fe.zoneId}</p> : null}
            </Field>

            <Field label="Manufacturing Unit">
              <select
                name="manufacturingUnitId"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                defaultValue={dealer?.manufacturingUnitId != null ? String(dealer.manufacturingUnitId) : ''}
              >
                <option value="">— None —</option>
                {manufacturingUnits.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.unitName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Password" required={!isEdit}>
              <div className="relative">
                <Input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isEdit ? 'Leave blank to keep current' : '••••••••'}
                  autoComplete="new-password"
                  className={cn('pr-10', fe.password && 'border-destructive')}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(s => !s)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {fe.password ? <p className="mt-1 text-xs text-destructive">{fe.password}</p> : null}
              {isEdit && !fe.password ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave blank to keep the existing password.
                </p>
              ) : null}
            </Field>
          </div>

          {/* Logo */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Organization Logo</h3>
            {!logoPreview ? (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground hover:bg-muted/50">
                <Upload className="mb-2 size-8 opacity-50" />
                <span>Drop image or click to upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => onLogo(e.target.files)}
                />
              </label>
            ) : (
              <div className="rounded-lg border border-border p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPreview} alt="Logo preview" className="mx-auto size-24 object-contain" />
                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{logoName}</span>
                  <Button type="button" variant="ghost" size="icon-xs" onClick={clearLogo} className="text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            )}
            {logoError ? <p className="text-xs text-destructive">{logoError}</p> : null}
            {fe.logo ? <p className="text-xs text-destructive">{fe.logo}</p> : null}
            <p className="text-xs text-muted-foreground">
              Shown on PDFs and emails. Preferred 240×240 @72 DPI, max 1MB.
            </p>
          </div>
        </div>

        <Separator />

        {/* Addresses */}
        <div className="grid gap-8 lg:grid-cols-2">
          <AddressBlock
            title="Billing Address"
            prefix="billing"
            states={states}
            errors={fe}
            address={dealer?.billingAddress}
          />
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">Shipping Address</h3>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-primary"
                onClick={copyBillingToShipping}
              >
                Copy Billing Address here
              </Button>
            </div>
            <AddressBlock
              title=""
              prefix="shipping"
              states={states}
              errors={fe}
              address={dealer?.shippingAddress}
              hideTitle
            />
          </div>
        </div>

        <Separator />

        {/* Bank */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Bank Details</h3>
          <div className="grid gap-2 md:grid-cols-[minmax(0,180px)_1fr] md:items-center">
            <span className="text-sm font-medium">
              Account Type <span className="text-destructive">*</span>
            </span>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={accountType === 'Current'}
                  onChange={() => setAccountType('Current')}
                  className="accent-primary"
                />
                Current
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={accountType === 'Savings'}
                  onChange={() => setAccountType('Savings')}
                  className="accent-primary"
                />
                Saving
              </label>
            </div>
          </div>
          <Field label="Beneficiary Name" required>
            <Input
              name="beneficiaryName"
              defaultValue={dealer?.bankDetails.beneficiaryName}
              className={cn(fe['bank.beneficiaryName'] && 'border-destructive')}
            />
            {fe['bank.beneficiaryName'] ? (
              <p className="mt-1 text-xs text-destructive">{fe['bank.beneficiaryName']}</p>
            ) : null}
          </Field>
          <Field label="Bank Name" required>
            <Input
              name="bankName"
              defaultValue={dealer?.bankDetails.bankName}
              className={cn(fe['bank.bankName'] && 'border-destructive')}
            />
            {fe['bank.bankName'] ? <p className="mt-1 text-xs text-destructive">{fe['bank.bankName']}</p> : null}
          </Field>
          <Field label="Account Number" required>
            <Input
              name="accountNumber"
              defaultValue={dealer?.bankDetails.accountNumber}
              className={cn(fe['bank.accountNumber'] && 'border-destructive')}
            />
            {fe['bank.accountNumber'] ? (
              <p className="mt-1 text-xs text-destructive">{fe['bank.accountNumber']}</p>
            ) : null}
          </Field>
          <Field label="Re-enter Account Number" required>
            <Input
              name="confirmAccount"
              defaultValue={dealer?.bankDetails.accountNumber}
              className={cn(fe['bank.confirmAccount'] && 'border-destructive')}
            />
            {fe['bank.confirmAccount'] ? (
              <p className="mt-1 text-xs text-destructive">{fe['bank.confirmAccount']}</p>
            ) : null}
          </Field>
          <Field label="IFSC" required>
            <Input
              name="IFSC"
              defaultValue={dealer?.bankDetails.IFSC}
              className={cn(fe['bank.IFSC'] && 'border-destructive')}
            />
            {fe['bank.IFSC'] ? <p className="mt-1 text-xs text-destructive">{fe['bank.IFSC']}</p> : null}
          </Field>
        </div>

        <div className="flex flex-wrap justify-end gap-3 pb-8">
          <Button type="button" variant="outline" asChild>
            <Link href="/dealers">Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending} className="min-w-[160px]">
            {pending ? 'Saving…' : isEdit ? 'Update Dealer' : SUBMIT_LABELS[userType]}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 md:grid-cols-[minmax(0,180px)_1fr] md:items-center">
      <label className="text-sm font-medium">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </label>
      <div>{children}</div>
    </div>
  );
}

function AddressBlock({
  title,
  prefix,
  states,
  errors,
  address,
  hideTitle,
}: {
  title: string;
  prefix: 'billing' | 'shipping';
  states: StateOption[];
  errors: Record<string, string>;
  address?: Address;
  hideTitle?: boolean;
}) {
  const p = (k: string) => errors[`${prefix}.${k}`];
  return (
    <div className="space-y-3">
      {!hideTitle && <h3 className="text-sm font-semibold">{title}</h3>}
      <Field label="Country / Region" required>
        <select
          name={`${prefix}Country`}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          defaultValue={address?.country || 'India'}
        >
          <option value="India">India</option>
        </select>
      </Field>
      <Field label="State" required>
        <select
          name={`${prefix}State`}
          className={cn('h-9 w-full rounded-md border border-input bg-background px-2 text-sm', p('state') && 'border-destructive')}
          defaultValue={address?.state || ''}
        >
          <option value="" disabled>
            Select Dealer State
          </option>
          {states.map(s => (
            <option key={s.state_code} value={s.state_code}>
              {s.name}
            </option>
          ))}
        </select>
        {p('state') ? <p className="mt-1 text-xs text-destructive">{p('state')}</p> : null}
      </Field>
      <Field label="Address" required>
        <textarea
          name={`${prefix}Address`}
          rows={3}
          placeholder="Enter Address Here"
          defaultValue={address?.address || ''}
          className={cn(
            'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
            p('address') && 'border-destructive',
          )}
        />
        {p('address') ? <p className="mt-1 text-xs text-destructive">{p('address')}</p> : null}
      </Field>
      <Field label="City" required>
        <Input name={`${prefix}City`} defaultValue={address?.city || ''} className={cn(p('city') && 'border-destructive')} />
        {p('city') ? <p className="mt-1 text-xs text-destructive">{p('city')}</p> : null}
      </Field>
      <Field label="Pincode" required>
        <Input name={`${prefix}Pincode`} defaultValue={address?.pincode || ''} className={cn(p('pincode') && 'border-destructive')} />
        {p('pincode') ? <p className="mt-1 text-xs text-destructive">{p('pincode')}</p> : null}
      </Field>
    </div>
  );
}
