-- =============================================================================
-- MIGRATION 014: Drop legacy RLS policies
-- FILE: supabase/migrations/014_drop_legacy_policies.sql
--
-- PURPOSE:
--   Remove leftover policies from earlier migrations that conflict with or
--   undermine the Phase 2 per-operation policies from 013.
--
--   Policies removed:
--   - "allow_all_anon"           — granted full unauthenticated access (CRITICAL)
--   - "authenticated_can_*"      — granted per-operation access to ANY auth user
--                                  (not scoped to landlord_id)
--
--   After this migration, only the "Landlord: ..." policies from 013 remain.
-- =============================================================================

DROP POLICY IF EXISTS "allow_all_anon" ON public.properties;
DROP POLICY IF EXISTS "allow_all_anon" ON public.units;
DROP POLICY IF EXISTS "allow_all_anon" ON public.tenants;
DROP POLICY IF EXISTS "allow_all_anon" ON public.leases;
DROP POLICY IF EXISTS "allow_all_anon" ON public.payments;

DROP POLICY IF EXISTS "authenticated_can_select_properties" ON public.properties;
DROP POLICY IF EXISTS "authenticated_can_insert_properties" ON public.properties;
DROP POLICY IF EXISTS "authenticated_can_update_properties" ON public.properties;
DROP POLICY IF EXISTS "authenticated_can_delete_properties" ON public.properties;

DROP POLICY IF EXISTS "authenticated_can_select_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_can_insert_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_can_update_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_can_delete_tenants" ON public.tenants;

DROP POLICY IF EXISTS "authenticated_can_select_payments" ON public.payments;
DROP POLICY IF EXISTS "authenticated_can_insert_payments" ON public.payments;
DROP POLICY IF EXISTS "authenticated_can_update_payments" ON public.payments;
DROP POLICY IF EXISTS "authenticated_can_delete_payments" ON public.payments;
