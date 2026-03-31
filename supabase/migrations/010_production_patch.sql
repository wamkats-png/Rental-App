-- 010: Production patch — adds missing columns and tables
-- Safe to run multiple times (uses IF NOT EXISTS everywhere)

-- ── LANDLORDS: add columns added in phase 1–5 ────────────────────────────────
ALTER TABLE landlords ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'Free';
ALTER TABLE landlords ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '';
ALTER TABLE landlords ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#2563eb';
ALTER TABLE landlords ADD COLUMN IF NOT EXISTS company_tagline text DEFAULT '';

-- ── PROPERTIES: add landlord_id if missing ───────────────────────────────────
ALTER TABLE properties ADD COLUMN IF NOT EXISTS landlord_id uuid REFERENCES landlords(id) ON DELETE CASCADE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS district text DEFAULT '';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS lc_area text DEFAULT '';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_rates_ref text DEFAULT '';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_properties_landlord ON properties(landlord_id);

-- ── TENANTS: add landlord_id if missing ──────────────────────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS landlord_id uuid REFERENCES landlords(id) ON DELETE CASCADE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS national_id text DEFAULT '';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS comm_preference text DEFAULT 'WhatsApp';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_tenants_landlord ON tenants(landlord_id);

-- ── LEASES: add landlord_id + missing columns ────────────────────────────────
ALTER TABLE leases ADD COLUMN IF NOT EXISTS landlord_id uuid REFERENCES landlords(id) ON DELETE CASCADE;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'Residential';
ALTER TABLE leases ADD COLUMN IF NOT EXISTS payment_frequency text DEFAULT 'Monthly';
ALTER TABLE leases ADD COLUMN IF NOT EXISTS currency text DEFAULT 'UGX';
ALTER TABLE leases ADD COLUMN IF NOT EXISTS due_day integer DEFAULT 1;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS grace_period_days integer DEFAULT 5;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS deposit_amount numeric DEFAULT 0;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS utilities_responsibility text DEFAULT 'Tenant';
ALTER TABLE leases ADD COLUMN IF NOT EXISTS notice_period_days integer DEFAULT 30;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_leases_landlord ON leases(landlord_id);

-- ── PAYMENTS: add landlord_id + missing columns ──────────────────────────────
ALTER TABLE payments ADD COLUMN IF NOT EXISTS landlord_id uuid REFERENCES landlords(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS period_start date;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS period_end date;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS withholding_tax_amount numeric DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_number text DEFAULT '';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_payments_landlord ON payments(landlord_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);

-- ── MAINTENANCE: add landlord_id + missing columns ───────────────────────────
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS landlord_id uuid REFERENCES landlords(id) ON DELETE CASCADE;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS vendor text DEFAULT '';
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS payer text DEFAULT 'Landlord';
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_maintenance_landlord ON maintenance_records(landlord_id);

-- ── APPLICATIONS: add landlord_id + missing columns ──────────────────────────
ALTER TABLE applications ADD COLUMN IF NOT EXISTS landlord_id uuid REFERENCES landlords(id) ON DELETE CASCADE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS applicant_national_id text DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS applicant_address text DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS employment text DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS "references" text DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS desired_move_in date;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_applications_landlord ON applications(landlord_id);

-- ── COMMUNICATION LOGS: add landlord_id if missing ───────────────────────────
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS landlord_id uuid REFERENCES landlords(id) ON DELETE CASCADE;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_commlogs_landlord ON communication_logs(landlord_id);

-- ── EXPENSES (create if not exists) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  date date NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  description text DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  receipt_ref text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_landlord ON expenses(landlord_id);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own expenses"
    ON expenses FOR ALL
    USING (landlord_id = auth.uid())
    WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── COMM TEMPLATES (create if not exists) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS comm_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  body text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comm_templates_landlord ON comm_templates(landlord_id);
ALTER TABLE comm_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own comm templates"
    ON comm_templates FOR ALL
    USING (landlord_id = auth.uid())
    WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── TEAM MEMBERS (create if not exists) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'Viewer'
    CHECK (role IN ('Owner', 'Manager', 'Viewer')),
  status text NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Active', 'Revoked')),
  invite_token text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_members_owner ON team_members(owner_id);
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Owners manage their team"
    ON team_members FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Members can view own row"
    ON team_members FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── AUDIT LOGS (create if not exists) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_email text NOT NULL DEFAULT '',
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  summary text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_landlord ON audit_logs(landlord_id);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords view own audit logs"
    ON audit_logs FOR ALL
    USING (landlord_id = auth.uid())
    WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── RLS policies for patched tables (safe: DO ... EXCEPTION) ─────────────────
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own properties"
    ON properties FOR ALL
    USING (landlord_id = auth.uid())
    WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own tenants"
    ON tenants FOR ALL
    USING (landlord_id = auth.uid())
    WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own leases"
    ON leases FOR ALL
    USING (landlord_id = auth.uid())
    WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own payments"
    ON payments FOR ALL
    USING (landlord_id = auth.uid())
    WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own maintenance"
    ON maintenance_records FOR ALL
    USING (landlord_id = auth.uid())
    WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own applications"
    ON applications FOR ALL
    USING (landlord_id = auth.uid())
    WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own comm logs"
    ON communication_logs FOR ALL
    USING (landlord_id = auth.uid())
    WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
