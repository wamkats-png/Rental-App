-- Migration 007: Add balance_due column to leases for partial payment tracking
-- Run in Supabase SQL editor

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS balance_due INTEGER NOT NULL DEFAULT 0;

-- balance_due represents outstanding UGX owed on this lease
-- Positive = tenant owes money, 0 = fully paid up, negative = overpaid (credit)
-- Updated when a partial payment is recorded

COMMENT ON COLUMN leases.balance_due IS
  'Outstanding balance in UGX. Positive = amount owed, 0 = current, negative = credit/overpaid.';
