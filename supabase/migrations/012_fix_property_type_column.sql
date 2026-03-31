-- 012: Schema alignment — fix all mismatches between production DB and app code
-- Applied directly via Supabase Management API on 2026-03-31.
-- This file documents what was run; safe to re-run (idempotent).

-- ── PROPERTIES: convert property_type from old enum to text ──────────────────
-- The production DB had property_type as a PostgreSQL ENUM with old values
-- (single_family, apartment, etc.) instead of the expected text values
-- (Residential, Commercial, Mixed), causing 400 "invalid input value for enum".

DO $$ BEGIN
  -- If still an enum, convert to text preserving existing data as 'Residential'
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties'
      AND column_name = 'property_type' AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE properties
      ALTER COLUMN property_type TYPE text
      USING CASE property_type::text
        WHEN 'single_family' THEN 'Residential'
        WHEN 'multi_family'  THEN 'Residential'
        WHEN 'apartment'     THEN 'Residential'
        WHEN 'condo'         THEN 'Residential'
        WHEN 'townhouse'     THEN 'Residential'
        ELSE 'Residential'
      END;
    ALTER TABLE properties ALTER COLUMN property_type SET DEFAULT 'Residential';
  END IF;
END $$;

-- If property_type column still missing, add it
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS property_type text NOT NULL DEFAULT 'Residential';

-- Add CHECK constraint for valid values
DO $$ BEGIN
  ALTER TABLE properties
    ADD CONSTRAINT properties_property_type_check
    CHECK (property_type IN ('Residential', 'Commercial', 'Mixed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── LEASES: add missing columns used by the app ───────────────────────────────
ALTER TABLE leases ADD COLUMN IF NOT EXISTS late_fee_type   text    DEFAULT NULL;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS late_fee_rate   numeric DEFAULT 0;

-- ── MAINTENANCE: add missing columns used by the app ─────────────────────────
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'Open';
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS priority      text NOT NULL DEFAULT 'Medium';
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS resolved_date date DEFAULT NULL;

-- ── Reload PostgREST schema cache ─────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
