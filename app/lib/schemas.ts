// Form validation schemas — lightweight alternative to Zod
// Returns { valid: boolean; errors: Record<string, string> }

export type ValidationResult<T extends object> = {
  valid: boolean;
  errors: Partial<Record<keyof T, string>>;
};

function required(value: unknown, label: string): string | null {
  if (value === undefined || value === null || String(value).trim() === '') return `${label} is required.`;
  return null;
}

function minLength(value: string, min: number, label: string): string | null {
  if (value.trim().length < min) return `${label} must be at least ${min} characters.`;
  return null;
}

function positiveNumber(value: unknown, label: string): string | null {
  const n = Number(value);
  if (isNaN(n) || n <= 0) return `${label} must be a positive number.`;
  return null;
}

function ugandaPhone(value: string): string | null {
  const cleaned = value.replace(/\s+/g, '');
  // Accept 0XXXXXXXXX, +256XXXXXXXXX, 256XXXXXXXXX (9-13 digits)
  if (!/^(\+256|256|0)\d{9}$/.test(cleaned)) return 'Enter a valid Uganda phone number (e.g. 0701234567).';
  return null;
}

function validDate(value: string, label: string): string | null {
  if (!value) return null; // optional dates pass
  const d = new Date(value);
  if (isNaN(d.getTime())) return `${label} must be a valid date.`;
  return null;
}

function dateOrder(start: string, end: string): string | null {
  if (!start || !end) return null;
  if (new Date(end) <= new Date(start)) return 'End date must be after start date.';
  return null;
}

// ── Specific form schemas ────────────────────────────────────────────────────

export interface PropertyForm {
  name: string;
  address: string;
  district: string;
  property_type: string;
}

export function validateProperty(f: PropertyForm): ValidationResult<PropertyForm> {
  const errors: Partial<Record<keyof PropertyForm, string>> = {};
  errors.name = required(f.name, 'Property name') ?? minLength(f.name, 2, 'Property name') ?? undefined;
  errors.address = required(f.address, 'Address') ?? undefined;
  errors.district = required(f.district, 'District') ?? undefined;
  Object.keys(errors).forEach(k => { if (!errors[k as keyof PropertyForm]) delete errors[k as keyof PropertyForm]; });
  return { valid: Object.keys(errors).length === 0, errors };
}

export interface TenantForm {
  full_name: string;
  phone: string;
  email: string;
}

export function validateTenant(f: TenantForm): ValidationResult<TenantForm> {
  const errors: Partial<Record<keyof TenantForm, string>> = {};
  errors.full_name = required(f.full_name, 'Full name') ?? minLength(f.full_name, 2, 'Full name') ?? undefined;
  errors.phone = required(f.phone, 'Phone number') ?? ugandaPhone(f.phone) ?? undefined;
  if (f.email && f.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
    errors.email = 'Enter a valid email address.';
  }
  Object.keys(errors).forEach(k => { if (!errors[k as keyof TenantForm]) delete errors[k as keyof TenantForm]; });
  return { valid: Object.keys(errors).length === 0, errors };
}

export interface LeaseForm {
  tenant_id: string;
  property_id: string;
  unit_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  due_day: number;
}

export function validateLease(f: LeaseForm): ValidationResult<LeaseForm> {
  const errors: Partial<Record<keyof LeaseForm, string>> = {};
  errors.tenant_id = required(f.tenant_id, 'Tenant') ?? undefined;
  errors.property_id = required(f.property_id, 'Property') ?? undefined;
  errors.unit_id = required(f.unit_id, 'Unit') ?? undefined;
  errors.start_date = required(f.start_date, 'Start date') ?? validDate(f.start_date, 'Start date') ?? undefined;
  errors.end_date = validDate(f.end_date, 'End date') ?? dateOrder(f.start_date, f.end_date) ?? undefined;
  errors.rent_amount = positiveNumber(f.rent_amount, 'Rent amount') ?? undefined;
  if (f.due_day < 1 || f.due_day > 31) errors.due_day = 'Due day must be between 1 and 31.';
  Object.keys(errors).forEach(k => { if (!errors[k as keyof LeaseForm]) delete errors[k as keyof LeaseForm]; });
  return { valid: Object.keys(errors).length === 0, errors };
}

export interface PaymentForm {
  lease_id: string;
  amount: number;
  date: string;
  payment_method: string;
}

export function validatePayment(f: PaymentForm): ValidationResult<PaymentForm> {
  const errors: Partial<Record<keyof PaymentForm, string>> = {};
  errors.lease_id = required(f.lease_id, 'Lease') ?? undefined;
  errors.amount = positiveNumber(f.amount, 'Amount') ?? undefined;
  errors.date = required(f.date, 'Payment date') ?? validDate(f.date, 'Payment date') ?? undefined;
  if (f.date) {
    const d = new Date(f.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d > today) errors.date = 'Payment date cannot be in the future.';
  }
  errors.payment_method = required(f.payment_method, 'Payment method') ?? undefined;
  Object.keys(errors).forEach(k => { if (!errors[k as keyof PaymentForm]) delete errors[k as keyof PaymentForm]; });
  return { valid: Object.keys(errors).length === 0, errors };
}
