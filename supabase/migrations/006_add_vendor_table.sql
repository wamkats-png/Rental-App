-- Migration 006: Add vendors table for maintenance vendor management
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS vendors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id   UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  category      TEXT NOT NULL DEFAULT 'General', -- e.g. Plumbing, Electrical, Structural, Cleaning
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: landlords can only see their own vendors
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors: landlord owns" ON vendors
  FOR ALL USING (landlord_id = auth.uid());

-- Auto-update updated_at
CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for fast lookup by landlord
CREATE INDEX IF NOT EXISTS vendors_landlord_id_idx ON vendors(landlord_id);
