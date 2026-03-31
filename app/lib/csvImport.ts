/**
 * CSV Import utilities for RentFlow Uganda.
 * Handles parsing, validation, and field mapping for Tenants, Properties, and Payments.
 */

export type ParsedRow = Record<string, string>;

/** Parse a CSV text string into an array of row objects keyed by header names. */
export function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines
    .slice(1)
    .filter(l => l.trim())
    .map(line => {
      const values = splitCSVLine(line);
      return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]));
    });
}

/** Handle quoted fields with commas inside them. */
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── TENANT IMPORT ──

export const TENANT_REQUIRED = ['full_name', 'phone', 'national_id'] as const;
export const TENANT_SAMPLE_HEADERS = 'full_name,phone,email,national_id,address,comm_preference';
export const TENANT_SAMPLE_ROWS = [
  'John Mukasa,+256700000001,john@email.com,CM900000001001,Kampala,WhatsApp',
  'Grace Nanteza,+256700000002,grace@email.com,CF900000002002,Entebbe,SMS',
];

export interface TenantImportRow {
  full_name: string;
  phone: string;
  email: string;
  national_id: string;
  address: string;
  comm_preference: 'WhatsApp' | 'Email' | 'SMS';
  errors: string[];
}

export function validateTenantRow(row: ParsedRow): string[] {
  const errors: string[] = [];
  if (!row.full_name) errors.push('full_name is required');
  if (!row.phone) errors.push('phone is required');
  if (!row.national_id) errors.push('national_id is required');
  return errors;
}

export function mapTenantRow(row: ParsedRow, landlordId: string): TenantImportRow & { landlord_id: string } {
  const validComm: ('WhatsApp' | 'Email' | 'SMS')[] = ['WhatsApp', 'Email', 'SMS'];
  const rawComm = row.comm_preference ?? '';
  const comm = validComm.includes(rawComm as 'WhatsApp' | 'Email' | 'SMS') ? (rawComm as 'WhatsApp' | 'Email' | 'SMS') : 'WhatsApp';
  return {
    landlord_id: landlordId,
    full_name: row.full_name ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    national_id: row.national_id ?? '',
    address: row.address ?? '',
    comm_preference: comm,
    errors: validateTenantRow(row),
  };
}

// ── PROPERTY IMPORT ──

export const PROPERTY_REQUIRED = ['name', 'address', 'district'] as const;
export const PROPERTY_SAMPLE_HEADERS = 'name,address,district,lc_area,property_type,property_rates_ref';
export const PROPERTY_SAMPLE_ROWS = [
  'Sunrise Apartments,Plot 12 Ntinda Road,Kampala,LC1 Ntinda,Residential,KCC/2024/001',
  'Office Block Nakawa,Industrial Area Plot 5,Kampala,LC1 Nakawa,Commercial,KCC/2024/002',
];

export interface PropertyImportRow {
  name: string;
  address: string;
  district: string;
  lc_area: string;
  property_type: 'Residential' | 'Commercial' | 'Mixed';
  property_rates_ref: string;
  errors: string[];
}

export function validatePropertyRow(row: ParsedRow): string[] {
  const errors: string[] = [];
  if (!row.name) errors.push('name is required');
  if (!row.address) errors.push('address is required');
  if (!row.district) errors.push('district is required');
  return errors;
}

export function mapPropertyRow(row: ParsedRow, landlordId: string): PropertyImportRow & { landlord_id: string } {
  const validTypes: ('Residential' | 'Commercial' | 'Mixed')[] = ['Residential', 'Commercial', 'Mixed'];
  const rawType = row.property_type ?? '';
  const type = validTypes.includes(rawType as 'Residential' | 'Commercial' | 'Mixed') ? (rawType as 'Residential' | 'Commercial' | 'Mixed') : 'Residential';
  return {
    landlord_id: landlordId,
    name: row.name ?? '',
    address: row.address ?? '',
    district: row.district ?? '',
    lc_area: row.lc_area ?? '',
    property_type: type,
    property_rates_ref: row.property_rates_ref ?? '',
    errors: validatePropertyRow(row),
  };
}

// ── UNIT IMPORT ──

export const UNIT_REQUIRED = ['code', 'property_name'] as const;
export const UNIT_SAMPLE_HEADERS = 'property_name,code,description,bedrooms,default_rent_amount,status';
export const UNIT_SAMPLE_ROWS = [
  'Sunrise Apartments,A1,Master bedroom with ensuite bathroom,2,450000,Available',
  'Sunrise Apartments,A2,Standard single room,1,250000,Available',
  'Office Block Nakawa,B1,Open-plan office space,0,1200000,Available',
];

export interface UnitImportRow {
  property_name: string;
  code: string;
  description: string;
  bedrooms: string;
  default_rent_amount: string;
  status: string;
  errors: string[];
}

export function validateUnitRow(row: ParsedRow): string[] {
  const errors: string[] = [];
  const code = row.code || row.unit_code || row.unit || '';
  const property = row.property_name || row.property || row.building || '';
  if (!code) errors.push('code is required');
  if (!property) errors.push('property_name is required');
  return errors;
}

export function mapUnitRow(row: ParsedRow): UnitImportRow {
  const code = row.code || row.unit_code || row.unit || '';
  const property_name = row.property_name || row.property || row.building || row.estate || '';
  const validStatuses = ['Available', 'Occupied', 'Under_maintenance'];
  const rawStatus = row.status || row.unit_status || '';
  const status = validStatuses.includes(rawStatus) ? rawStatus : 'Available';
  return {
    property_name,
    code,
    description: row.description || row.desc || row.details || '',
    bedrooms: row.bedrooms || row.beds || row.rooms || '',
    default_rent_amount: row.default_rent_amount || row.rent_amount || row.rent || row.monthly_rent || '',
    status,
    errors: validateUnitRow(row),
  };
}

/** Generate a downloadable CSV sample string. */
export function buildSampleCSV(headers: string, rows: string[]): string {
  return [headers, ...rows].join('\n');
}

export function downloadSample(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
