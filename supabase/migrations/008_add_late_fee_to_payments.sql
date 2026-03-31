-- Migration 008: Add late_fee_amount column to payments
-- Run in Supabase SQL editor

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS late_fee_amount INTEGER NOT NULL DEFAULT 0;

-- late_fee_amount: additional UGX charged as a late fee when payment is recorded
-- after the grace period. Already present as a UI suggestion in payments/page.tsx —
-- this column persists it in the database for reporting purposes.

COMMENT ON COLUMN payments.late_fee_amount IS
  'Late fee amount in UGX charged on this payment. 0 if payment was on time.';
