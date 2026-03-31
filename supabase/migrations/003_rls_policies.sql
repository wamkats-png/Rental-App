-- 003: Row Level Security policies for all business tables

-- PROPERTIES
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own properties" ON properties FOR ALL
    USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UNITS
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage units of own properties" ON units FOR ALL
    USING (property_id IN (SELECT id FROM properties WHERE landlord_id = auth.uid()))
    WITH CHECK (property_id IN (SELECT id FROM properties WHERE landlord_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TENANTS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own tenants" ON tenants FOR ALL
    USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LEASES
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own leases" ON leases FOR ALL
    USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PAYMENTS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own payments" ON payments FOR ALL
    USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MAINTENANCE RECORDS
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own maintenance" ON maintenance_records FOR ALL
    USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CONTRACTS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage contracts of own leases" ON contracts FOR ALL
    USING (lease_id IN (SELECT id FROM leases WHERE landlord_id = auth.uid()))
    WITH CHECK (lease_id IN (SELECT id FROM leases WHERE landlord_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- APPLICATIONS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own applications" ON applications FOR ALL
    USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMUNICATION LOGS
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Landlords manage own comm logs" ON communication_logs FOR ALL
    USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
