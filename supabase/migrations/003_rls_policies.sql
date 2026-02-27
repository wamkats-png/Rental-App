-- 003: Row Level Security policies for all business tables

-- PROPERTIES
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlords manage own properties"
  ON properties FOR ALL
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

-- UNITS (access via property's landlord_id)
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlords manage units of own properties"
  ON units FOR ALL
  USING (property_id IN (SELECT id FROM properties WHERE landlord_id = auth.uid()))
  WITH CHECK (property_id IN (SELECT id FROM properties WHERE landlord_id = auth.uid()));

-- TENANTS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlords manage own tenants"
  ON tenants FOR ALL
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

-- LEASES
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlords manage own leases"
  ON leases FOR ALL
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

-- PAYMENTS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlords manage own payments"
  ON payments FOR ALL
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

-- MAINTENANCE RECORDS
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlords manage own maintenance"
  ON maintenance_records FOR ALL
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

-- CONTRACTS (access via lease's landlord_id)
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlords manage contracts of own leases"
  ON contracts FOR ALL
  USING (lease_id IN (SELECT id FROM leases WHERE landlord_id = auth.uid()))
  WITH CHECK (lease_id IN (SELECT id FROM leases WHERE landlord_id = auth.uid()));

-- APPLICATIONS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlords manage own applications"
  ON applications FOR ALL
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

-- COMMUNICATION LOGS
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlords manage own comm logs"
  ON communication_logs FOR ALL
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());
