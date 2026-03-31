-- 004: Auto-update updated_at timestamps on all tables

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Use DROP IF EXISTS + CREATE to make triggers idempotent
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['landlords','properties','units','tenants','leases','payments','maintenance_records','contracts','applications','communication_logs'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
  END LOOP;
END $$;
