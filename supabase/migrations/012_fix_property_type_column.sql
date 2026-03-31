-- 012: Ensure property_type column exists on properties table
-- Root cause: migration 011 used RENAME COLUMN which silently no-ops if the
-- source column ('type') never existed, leaving the table without 'property_type'.
-- Safe to run multiple times.

-- If 'type' column exists but 'property_type' does not → rename it
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'property_type'
  ) THEN
    ALTER TABLE properties RENAME COLUMN type TO property_type;
  END IF;
END $$;

-- If 'property_type' still doesn't exist → add it
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS property_type text NOT NULL DEFAULT 'Residential';

-- Add CHECK constraint if not already present
DO $$ BEGIN
  ALTER TABLE properties
    ADD CONSTRAINT properties_property_type_check
    CHECK (property_type IN ('Residential', 'Commercial', 'Mixed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Force PostgREST schema cache reload (fixes stale column cache)
NOTIFY pgrst, 'reload schema';
