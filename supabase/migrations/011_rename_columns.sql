-- 011: Rename legacy columns to match current app schema
-- Safe: uses IF EXISTS checks via DO blocks

-- ── PAYMENTS ─────────────────────────────────────────────────────────────────
-- Rename payment_date → date
DO $$ BEGIN
  ALTER TABLE payments RENAME COLUMN payment_date TO date;
EXCEPTION WHEN undefined_column THEN NULL; WHEN duplicate_column THEN NULL; END $$;

-- Rename method → payment_method
DO $$ BEGIN
  ALTER TABLE payments RENAME COLUMN method TO payment_method;
EXCEPTION WHEN undefined_column THEN NULL; WHEN duplicate_column THEN NULL; END $$;

-- Add missing columns
ALTER TABLE payments ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES units(id) ON DELETE CASCADE;

-- Fix index now that date column exists
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
CREATE INDEX IF NOT EXISTS idx_payments_lease ON payments(lease_id);

-- ── LEASES ───────────────────────────────────────────────────────────────────
-- Rename monthly_rent_ugx → rent_amount
DO $$ BEGIN
  ALTER TABLE leases RENAME COLUMN monthly_rent_ugx TO rent_amount;
EXCEPTION WHEN undefined_column THEN NULL; WHEN duplicate_column THEN NULL; END $$;

-- Add missing property_id
ALTER TABLE leases ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id) ON DELETE CASCADE;

-- ── TENANTS ──────────────────────────────────────────────────────────────────
-- Rename name → full_name
DO $$ BEGIN
  ALTER TABLE tenants RENAME COLUMN name TO full_name;
EXCEPTION WHEN undefined_column THEN NULL; WHEN duplicate_column THEN NULL; END $$;

-- Add missing address column
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address text DEFAULT '';

-- ── PROPERTIES ───────────────────────────────────────────────────────────────
-- Rename type → property_type
DO $$ BEGIN
  ALTER TABLE properties RENAME COLUMN type TO property_type;
EXCEPTION WHEN undefined_column THEN NULL; WHEN duplicate_column THEN NULL; END $$;

-- ── UNITS ────────────────────────────────────────────────────────────────────
-- Rename unit_name → code
DO $$ BEGIN
  ALTER TABLE units RENAME COLUMN unit_name TO code;
EXCEPTION WHEN undefined_column THEN NULL; WHEN duplicate_column THEN NULL; END $$;

-- Add missing unit columns
ALTER TABLE units ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE units ADD COLUMN IF NOT EXISTS bedrooms integer DEFAULT 1;
ALTER TABLE units ADD COLUMN IF NOT EXISTS default_rent_amount numeric DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── Re-apply RLS policies now columns are correct ─────────────────────────────
-- Properties (landlord_id already exists, policy might have failed in 010)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Landlords manage own properties" ON properties;
  CREATE POLICY "Landlords manage own properties" ON properties FOR ALL
    USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());
END $$;

-- Tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Landlords manage own tenants" ON tenants;
  CREATE POLICY "Landlords manage own tenants" ON tenants FOR ALL
    USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());
END $$;

-- Leases
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Landlords manage own leases" ON leases;
  CREATE POLICY "Landlords manage own leases" ON leases FOR ALL
    USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());
END $$;

-- Payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Landlords manage own payments" ON payments;
  CREATE POLICY "Landlords manage own payments" ON payments FOR ALL
    USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());
END $$;
