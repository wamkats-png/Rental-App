export type LandlordType = 'Individual' | 'Company';
export type SubscriptionPlan = 'Free' | 'AI_Assist';
export type PropertyType = 'Residential' | 'Commercial' | 'Mixed';
export type UnitStatus = 'Available' | 'Occupied' | 'Under_maintenance';
export type CommPreference = 'WhatsApp' | 'Email' | 'SMS';
export type PaymentFrequency = 'Monthly' | 'Quarterly' | 'Yearly';
export type UtilitiesResponsibility = 'Landlord' | 'Tenant' | 'Shared';
export type LeaseStatus = 'Draft' | 'Pending_tenant_signature' | 'Pending_landlord_signature' | 'Active' | 'Terminated';
export type PaymentMethod = 'Cash' | 'Mobile_Money' | 'Bank';
export type MaintenanceCategory = 'Plumbing' | 'Electrical' | 'Structural' | 'Other';
export type MaintenancePayer = 'Landlord' | 'Tenant';
export type MaintenanceStatus = 'Open' | 'In Progress' | 'Resolved';
export type MaintenancePriority = 'Low' | 'Medium' | 'High';
export type ContractType = 'Residential' | 'Commercial' | 'Other';
export type ExpenseCategory = 'Insurance' | 'Council Rates' | 'Agent Fees' | 'Ground Rent' | 'Utilities' | 'Legal & Professional' | 'Bank Charges' | 'Other';

export interface Landlord {
  id: string;
  name: string;
  phone: string;
  email: string;
  landlord_type: LandlordType;
  ura_tin: string;
  subscription_plan: SubscriptionPlan;
  created_at: string;
  updated_at?: string;
}

export interface Property {
  id: string;
  landlord_id: string;
  name: string;
  address: string;
  district: string;
  lc_area: string;
  property_type: PropertyType;
  property_rates_ref: string;
  created_at: string;
}

export interface Unit {
  id: string;
  property_id: string;
  code: string;
  description: string;
  bedrooms: number;
  default_rent_amount: number;
  status: UnitStatus;
  created_at: string;
}

export interface Tenant {
  id: string;
  landlord_id: string;
  full_name: string;
  phone: string;
  email: string;
  national_id: string;
  address: string;
  comm_preference: CommPreference;
  created_at: string;
}

export interface Lease {
  id: string;
  landlord_id: string;
  property_id: string;
  unit_id: string;
  tenant_id: string;
  contract_type: ContractType;
  rent_amount: number;
  payment_frequency: PaymentFrequency;
  currency: string;
  start_date: string;
  end_date: string;
  due_day: number;
  grace_period_days: number;
  deposit_amount: number;
  utilities_responsibility: UtilitiesResponsibility;
  notice_period_days: number;
  status: LeaseStatus;
  late_fee_type?: 'percentage' | 'flat';
  late_fee_rate?: number;
  escalation_rate?: number;
  escalation_frequency?: 'Yearly' | '2 Years';
  next_review_date?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  landlord_id: string;
  tenant_id: string;
  property_id: string;
  unit_id: string;
  lease_id: string;
  date: string;
  amount: number;
  payment_method: PaymentMethod;
  period_start: string;
  period_end: string;
  withholding_tax_amount: number;
  receipt_number: string;
  created_at: string;
}

export interface MaintenanceRecord {
  id: string;
  landlord_id: string;
  property_id: string;
  unit_id: string;
  date: string;
  description: string;
  category: MaintenanceCategory;
  vendor: string;
  cost: number;
  payer: MaintenancePayer;
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
  resolved_date?: string;
  created_at: string;
}

export interface Contract {
  id: string;
  lease_id: string;
  template_type: string;
  version_number: number;
  body_html: string;
  landlord_signed_at: string | null;
  tenant_signed_at: string | null;
  signed_pdf_url: string | null;
  created_at: string;
}

export interface AIUsageLog {
  id: string;
  landlord_id: string;
  feature_type: string;
  created_at: string;
}

export interface Application {
  id: string;
  landlord_id: string;
  unit_id: string;
  applicant_name: string;
  applicant_phone: string;
  applicant_email: string;
  applicant_national_id: string;
  applicant_address: string;
  employment: string;
  references: string;
  desired_move_in: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}

export type CommunicationType = 'SMS' | 'Email' | 'Call' | 'WhatsApp';

export interface CommunicationLog {
  id: string;
  tenant_id: string;
  landlord_id: string;
  date: string;
  type: CommunicationType;
  note: string;
  created_at: string;
}

export interface Receipt {
  id: string;
  payment_id: string;
  receipt_number: string;
  generated_at: string;
}

export interface Expense {
  id: string;
  landlord_id: string;
  property_id?: string;
  date: string;
  category: ExpenseCategory;
  description?: string;
  amount: number;
  receipt_ref?: string;
  created_at: string;
}

export interface CommTemplate {
  id: string;
  landlord_id: string;
  name: string;
  category: string;
  body: string;
  created_at: string;
}
