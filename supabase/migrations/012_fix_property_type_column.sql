-- 012: Fix property_type column on properties table
-- Root cause: production DB has property_type as a PostgreSQL ENUM type,
-- but the app code sends text values ('Residential', 'Commercial', 'Mixed').
-- The enum type's values may differ in casing, causing "invalid input value for enum".
-- Fix: convert to plain text + CHECK constraint (matches code expectations).
-- Safe to run multiple times.

-- Step 1: If 'type' column exists but 'property_type' does not → rename it
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

-- Step 2: If property_type still doesn't exist → add it as text
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS property_type text NOT NULL DEFAULT 'Residential';

-- Step 3: If property_type is an enum type → convert it to plain text
-- (enum causes "invalid input value" errors when casing doesn't match exactly)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'property_type'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE properties
      ALTER COLUMN property_type TYPE text USING property_type::text;
    ALTER TABLE properties
      ALTER COLUMN property_type SET DEFAULT 'Residential';
  END IF;
END $$;

-- Step 4: Add CHECK constraint for valid values (idempotent)
DO $$ BEGIN
  ALTER TABLE properties
    ADD CONSTRAINT properties_property_type_check
    CHECK (property_type IN ('Residential', 'Commercial', 'Mixed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Step 5: Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
