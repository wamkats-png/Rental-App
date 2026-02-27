-- 002: Create all business tables

-- PROPERTIES
CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  district text DEFAULT '',
  lc_area text DEFAULT '',
  property_type text NOT NULL DEFAULT 'Residential'
    CHECK (property_type IN ('Residential', 'Commercial', 'Mixed')),
  property_rates_ref text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_properties_landlord ON properties(landlord_id);

-- UNITS
CREATE TABLE units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text DEFAULT '',
  bedrooms integer DEFAULT 1,
  default_rent_amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'Available'
    CHECK (status IN ('Available', 'Occupied', 'Under_maintenance')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_units_property ON units(property_id);

-- TENANTS
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  national_id text DEFAULT '',
  address text DEFAULT '',
  comm_preference text DEFAULT 'WhatsApp'
    CHECK (comm_preference IN ('WhatsApp', 'Email', 'SMS')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tenants_landlord ON tenants(landlord_id);

-- LEASES
CREATE TABLE leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_type text DEFAULT 'Residential'
    CHECK (contract_type IN ('Residential', 'Commercial', 'Other')),
  rent_amount numeric NOT NULL DEFAULT 0,
  payment_frequency text DEFAULT 'Monthly'
    CHECK (payment_frequency IN ('Monthly', 'Quarterly', 'Yearly')),
  currency text DEFAULT 'UGX',
  start_date date NOT NULL,
  end_date date NOT NULL,
  due_day integer DEFAULT 1,
  grace_period_days integer DEFAULT 5,
  deposit_amount numeric DEFAULT 0,
  utilities_responsibility text DEFAULT 'Tenant'
    CHECK (utilities_responsibility IN ('Landlord', 'Tenant', 'Shared')),
  notice_period_days integer DEFAULT 30,
  status text DEFAULT 'Draft'
    CHECK (status IN ('Draft', 'Pending_tenant_signature', 'Pending_landlord_signature', 'Active', 'Terminated')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_leases_landlord ON leases(landlord_id);
CREATE INDEX idx_leases_tenant ON leases(tenant_id);
CREATE INDEX idx_leases_unit ON leases(unit_id);

-- PAYMENTS
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'Mobile_Money'
    CHECK (payment_method IN ('Cash', 'Mobile_Money', 'Bank')),
  period_start date,
  period_end date,
  withholding_tax_amount numeric DEFAULT 0,
  receipt_number text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_payments_landlord ON payments(landlord_id);
CREATE INDEX idx_payments_lease ON payments(lease_id);
CREATE INDEX idx_payments_date ON payments(date);

-- MAINTENANCE RECORDS
CREATE TABLE maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  date date NOT NULL,
  description text NOT NULL,
  category text DEFAULT 'Other'
    CHECK (category IN ('Plumbing', 'Electrical', 'Structural', 'Other')),
  vendor text DEFAULT '',
  cost numeric DEFAULT 0,
  payer text DEFAULT 'Landlord'
    CHECK (payer IN ('Landlord', 'Tenant')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_maintenance_landlord ON maintenance_records(landlord_id);
CREATE INDEX idx_maintenance_property ON maintenance_records(property_id);

-- CONTRACTS
CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  template_type text DEFAULT '',
  version_number integer DEFAULT 1,
  body_html text DEFAULT '',
  landlord_signed_at timestamptz,
  tenant_signed_at timestamptz,
  signed_pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_contracts_lease ON contracts(lease_id);

-- APPLICATIONS
CREATE TABLE applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  applicant_name text NOT NULL,
  applicant_phone text DEFAULT '',
  applicant_email text DEFAULT '',
  applicant_national_id text DEFAULT '',
  applicant_address text DEFAULT '',
  employment text DEFAULT '',
  "references" text DEFAULT '',
  desired_move_in date,
  status text DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_applications_landlord ON applications(landlord_id);

-- COMMUNICATION LOGS
CREATE TABLE communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  date date NOT NULL,
  type text NOT NULL
    CHECK (type IN ('SMS', 'Email', 'Call', 'WhatsApp')),
  note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_commlogs_tenant ON communication_logs(tenant_id);
CREATE INDEX idx_commlogs_landlord ON communication_logs(landlord_id);
