-- Migration 009: Add notification_dismissals table
-- Used by NotificationCenter to allow landlords to dismiss individual alerts
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS notification_dismissals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id   UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,       -- e.g. "overdue-<lease_id>", "expiry-<lease_id>"
  dismissed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(landlord_id, key)
);

-- RLS: landlords can only manage their own dismissals
ALTER TABLE notification_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_dismissals: landlord owns" ON notification_dismissals
  FOR ALL USING (landlord_id = auth.uid());

CREATE INDEX IF NOT EXISTS notification_dismissals_landlord_idx
  ON notification_dismissals(landlord_id);

COMMENT ON TABLE notification_dismissals IS
  'Tracks which notification alerts a landlord has dismissed in the NotificationCenter.';
