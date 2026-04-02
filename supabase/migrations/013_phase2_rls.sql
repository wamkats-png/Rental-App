-- =============================================================================
-- MIGRATION 013: Row Level Security — Phase 2 (granular per-operation policies)
-- FILE: supabase/migrations/013_phase2_rls.sql
--
-- PURPOSE:
--   Replace the broad FOR ALL catch-all policies (from 003_rls_policies.sql)
--   with explicit per-operation policies. Key security change: payments become
--   immutable (no UPDATE or DELETE at DB level — corrections must be reversals).
--
-- TABLES: properties, units, tenants, leases, payments
-- NOTE:   maintenance_records, contracts, applications, communication_logs
--         keep their existing FOR ALL policies (not changed here).
-- =============================================================================


-- ─── STEP 1: Drop old catch-all policies ─────────────────────────────────────
-- These were created by 003_rls_policies.sql as FOR ALL policies.

DO $$ BEGIN
  DROP POLICY IF EXISTS "Landlords manage own properties"             ON public.properties;
  DROP POLICY IF EXISTS "Landlords manage units of own properties"    ON public.units;
  DROP POLICY IF EXISTS "Landlords manage own tenants"                ON public.tenants;
  DROP POLICY IF EXISTS "Landlords manage own leases"                 ON public.leases;
  DROP POLICY IF EXISTS "Landlords manage own payments"               ON public.payments;
END $$;

-- Also drop new-name policies if this migration is re-run (idempotency)
DO $$ BEGIN
  -- properties
  DROP POLICY IF EXISTS "Landlord: select own properties"  ON public.properties;
  DROP POLICY IF EXISTS "Landlord: insert own properties"  ON public.properties;
  DROP POLICY IF EXISTS "Landlord: update own properties"  ON public.properties;
  DROP POLICY IF EXISTS "Landlord: delete own properties"  ON public.properties;
  -- units
  DROP POLICY IF EXISTS "Landlord: select own units"       ON public.units;
  DROP POLICY IF EXISTS "Landlord: insert own units"       ON public.units;
  DROP POLICY IF EXISTS "Landlord: update own units"       ON public.units;
  DROP POLICY IF EXISTS "Landlord: delete own units"       ON public.units;
  -- tenants
  DROP POLICY IF EXISTS "Landlord: select own tenants"     ON public.tenants;
  DROP POLICY IF EXISTS "Landlord: insert own tenants"     ON public.tenants;
  DROP POLICY IF EXISTS "Landlord: update own tenants"     ON public.tenants;
  DROP POLICY IF EXISTS "Landlord: delete own tenants"     ON public.tenants;
  -- leases
  DROP POLICY IF EXISTS "Landlord: select own leases"      ON public.leases;
  DROP POLICY IF EXISTS "Landlord: insert own leases"      ON public.leases;
  DROP POLICY IF EXISTS "Landlord: update own leases"      ON public.leases;
  DROP POLICY IF EXISTS "Landlord: delete own leases"      ON public.leases;
  -- payments
  DROP POLICY IF EXISTS "Landlord: select own payments"    ON public.payments;
  DROP POLICY IF EXISTS "Landlord: insert own payments"    ON public.payments;
END $$;


-- ─── STEP 2: Ensure RLS is enabled (idempotent) ──────────────────────────────

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments   ENABLE ROW LEVEL SECURITY;


-- ─── STEP 3: PROPERTIES policies ─────────────────────────────────────────────

CREATE POLICY "Landlord: select own properties"
  ON public.properties FOR SELECT
  USING (landlord_id = auth.uid());

CREATE POLICY "Landlord: insert own properties"
  ON public.properties FOR INSERT
  WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlord: update own properties"
  ON public.properties FOR UPDATE
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlord: delete own properties"
  ON public.properties FOR DELETE
  USING (landlord_id = auth.uid());


-- ─── STEP 4: UNITS policies ──────────────────────────────────────────────────
-- units don't have landlord_id directly — ownership via properties

CREATE POLICY "Landlord: select own units"
  ON public.units FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = units.property_id
        AND p.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Landlord: insert own units"
  ON public.units FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = units.property_id
        AND p.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Landlord: update own units"
  ON public.units FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = units.property_id
        AND p.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Landlord: delete own units"
  ON public.units FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = units.property_id
        AND p.landlord_id = auth.uid()
    )
  );


-- ─── STEP 5: TENANTS policies ────────────────────────────────────────────────

CREATE POLICY "Landlord: select own tenants"
  ON public.tenants FOR SELECT
  USING (landlord_id = auth.uid());

CREATE POLICY "Landlord: insert own tenants"
  ON public.tenants FOR INSERT
  WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlord: update own tenants"
  ON public.tenants FOR UPDATE
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlord: delete own tenants"
  ON public.tenants FOR DELETE
  USING (landlord_id = auth.uid());


-- ─── STEP 6: LEASES policies ─────────────────────────────────────────────────

CREATE POLICY "Landlord: select own leases"
  ON public.leases FOR SELECT
  USING (landlord_id = auth.uid());

CREATE POLICY "Landlord: insert own leases"
  ON public.leases FOR INSERT
  WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlord: update own leases"
  ON public.leases FOR UPDATE
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlord: delete own leases"
  ON public.leases FOR DELETE
  USING (landlord_id = auth.uid());


-- ─── STEP 7: PAYMENTS policies (immutable — no UPDATE or DELETE) ─────────────
-- Payment records are a financial audit trail.
-- To correct an error: insert a new payment with negative amount + notes.

CREATE POLICY "Landlord: select own payments"
  ON public.payments FOR SELECT
  USING (landlord_id = auth.uid());

CREATE POLICY "Landlord: insert own payments"
  ON public.payments FOR INSERT
  WITH CHECK (landlord_id = auth.uid());

-- NOTE: No UPDATE or DELETE policies on payments — intentional.
-- Supabase will reject any UPDATE/DELETE attempt at the DB level.


-- ─── STEP 8: Additional performance indexes ──────────────────────────────────
-- Only add indexes that don't already exist (from 002_create_business_tables.sql)

CREATE INDEX IF NOT EXISTS idx_properties_landlord_id  ON public.properties(landlord_id);
CREATE INDEX IF NOT EXISTS idx_units_status            ON public.units(status);
CREATE INDEX IF NOT EXISTS idx_tenants_unit_id         ON public.tenants(unit_id);
CREATE INDEX IF NOT EXISTS idx_leases_status           ON public.leases(status);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id      ON public.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_period_start   ON public.payments(period_start);


-- ─── VERIFICATION ─────────────────────────────────────────────────────────────
-- Run after migration to confirm:
--
-- 1. RLS enabled on all 5 tables:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('properties','units','tenants','leases','payments');
-- Expected: rowsecurity = true for all 5
--
-- 2. Correct number of policies per table:
-- SELECT tablename, cmd, count(*)
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('properties','units','tenants','leases','payments')
-- GROUP BY tablename, cmd ORDER BY tablename, cmd;
-- Expected:
--   properties  → SELECT/INSERT/UPDATE/DELETE (4 rows)
--   units       → SELECT/INSERT/UPDATE/DELETE (4 rows)
--   tenants     → SELECT/INSERT/UPDATE/DELETE (4 rows)
--   leases      → SELECT/INSERT/UPDATE/DELETE (4 rows)
--   payments    → SELECT/INSERT only (2 rows — immutable)
