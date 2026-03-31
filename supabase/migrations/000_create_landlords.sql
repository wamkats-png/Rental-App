-- 000: Create landlords base table (must run before all other migrations)

CREATE TABLE IF NOT EXISTS landlords (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  email text NOT NULL DEFAULT '',
  landlord_type text NOT NULL DEFAULT 'Individual'
    CHECK (landlord_type IN ('Individual', 'Company')),
  ura_tin text DEFAULT '',
  subscription_plan text NOT NULL DEFAULT 'Free'
    CHECK (subscription_plan IN ('Free', 'AI_Assist', 'Pro')),
  logo_url text DEFAULT '',
  primary_color text DEFAULT '#2563eb',
  company_tagline text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;

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
