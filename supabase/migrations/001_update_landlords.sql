-- 001: Update landlords table with missing columns and RLS

ALTER TABLE landlords ADD COLUMN IF NOT EXISTS ura_tin text DEFAULT '';
ALTER TABLE landlords ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE landlords ALTER COLUMN created_at SET DEFAULT now();

-- Enable Row Level Security
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;

-- Policies (safe: DO...EXCEPTION handles duplicates from migration 000)
DO $$ BEGIN
  CREATE POLICY "Landlords can view own profile"
    ON landlords FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Landlords can update own profile"
    ON landlords FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Landlords can insert own profile"
    ON landlords FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
