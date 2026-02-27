-- 001: Update landlords table with missing columns and RLS

ALTER TABLE landlords ADD COLUMN IF NOT EXISTS ura_tin text DEFAULT '';
ALTER TABLE landlords ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE landlords ALTER COLUMN created_at SET DEFAULT now();

-- Enable Row Level Security
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;

-- Landlords can only access their own row (id = auth.uid())
CREATE POLICY "Landlords can view own profile"
  ON landlords FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Landlords can update own profile"
  ON landlords FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Landlords can insert own profile"
  ON landlords FOR INSERT
  WITH CHECK (auth.uid() = id);
