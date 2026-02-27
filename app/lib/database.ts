import { supabase } from './supabase';
import type {
  Landlord, Property, Unit, Tenant, Lease, Payment,
  MaintenanceRecord, Contract, Application, CommunicationLog
} from '../types';

// Helper: throw on error for void operations
async function exec(builder: PromiseLike<{ error: any }>): Promise<void> {
  const { error } = await builder;
  if (error) throw new Error(error.message);
}

// Helper: throw on error, return data
async function query<T>(builder: PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return data as T;
}

// ── LANDLORD ──

export async function fetchLandlord(userId: string): Promise<Landlord | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('landlords').select('*').eq('id', userId).single();
  return data;
}

export async function updateLandlordDB(userId: string, updates: Partial<Landlord>): Promise<void> {
  if (!supabase) return;
  await exec(supabase.from('landlords').update(updates).eq('id', userId));
}

// ── PROPERTIES ──

export async function fetchProperties(landlordId: string): Promise<Property[]> {
  if (!supabase) return [];
  return query(
    supabase.from('properties').select('*')
      .eq('landlord_id', landlordId)
      .order('created_at', { ascending: false })
  );
}

export async function insertProperty(property: Omit<Property, 'id' | 'created_at'>): Promise<Property> {
  return query(supabase!.from('properties').insert(property).select().single());
}

export async function updatePropertyDB(id: string, updates: Partial<Property>): Promise<void> {
  await exec(supabase!.from('properties').update(updates).eq('id', id));
}

export async function deletePropertyDB(id: string): Promise<void> {
  await exec(supabase!.from('properties').delete().eq('id', id));
}

// ── UNITS ──

export async function fetchUnits(propertyIds: string[]): Promise<Unit[]> {
  if (!supabase || propertyIds.length === 0) return [];
  return query(
    supabase.from('units').select('*')
      .in('property_id', propertyIds)
      .order('created_at', { ascending: false })
  );
}

export async function insertUnit(unit: Omit<Unit, 'id' | 'created_at'>): Promise<Unit> {
  return query(supabase!.from('units').insert(unit).select().single());
}

export async function updateUnitDB(id: string, updates: Partial<Unit>): Promise<void> {
  await exec(supabase!.from('units').update(updates).eq('id', id));
}

export async function deleteUnitDB(id: string): Promise<void> {
  await exec(supabase!.from('units').delete().eq('id', id));
}

// ── TENANTS ──

export async function fetchTenants(landlordId: string): Promise<Tenant[]> {
  if (!supabase) return [];
  return query(
    supabase.from('tenants').select('*')
      .eq('landlord_id', landlordId)
      .order('created_at', { ascending: false })
  );
}

export async function insertTenant(tenant: Omit<Tenant, 'id' | 'created_at'>): Promise<Tenant> {
  return query(supabase!.from('tenants').insert(tenant).select().single());
}

export async function updateTenantDB(id: string, updates: Partial<Tenant>): Promise<void> {
  await exec(supabase!.from('tenants').update(updates).eq('id', id));
}

export async function deleteTenantDB(id: string): Promise<void> {
  await exec(supabase!.from('tenants').delete().eq('id', id));
}

// ── LEASES ──

export async function fetchLeases(landlordId: string): Promise<Lease[]> {
  if (!supabase) return [];
  return query(
    supabase.from('leases').select('*')
      .eq('landlord_id', landlordId)
      .order('created_at', { ascending: false })
  );
}

export async function insertLease(lease: Omit<Lease, 'id' | 'created_at'>): Promise<Lease> {
  return query(supabase!.from('leases').insert(lease).select().single());
}

export async function updateLeaseDB(id: string, updates: Partial<Lease>): Promise<void> {
  await exec(supabase!.from('leases').update(updates).eq('id', id));
}

export async function deleteLeaseDB(id: string): Promise<void> {
  await exec(supabase!.from('leases').delete().eq('id', id));
}

// ── PAYMENTS ──

export async function fetchPayments(landlordId: string): Promise<Payment[]> {
  if (!supabase) return [];
  return query(
    supabase.from('payments').select('*')
      .eq('landlord_id', landlordId)
      .order('date', { ascending: false })
  );
}

export async function insertPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
  return query(supabase!.from('payments').insert(payment).select().single());
}

export async function deletePaymentDB(id: string): Promise<void> {
  await exec(supabase!.from('payments').delete().eq('id', id));
}

// ── MAINTENANCE ──

export async function fetchMaintenance(landlordId: string): Promise<MaintenanceRecord[]> {
  if (!supabase) return [];
  return query(
    supabase.from('maintenance_records').select('*')
      .eq('landlord_id', landlordId)
      .order('date', { ascending: false })
  );
}

export async function insertMaintenance(record: Omit<MaintenanceRecord, 'id' | 'created_at'>): Promise<MaintenanceRecord> {
  return query(supabase!.from('maintenance_records').insert(record).select().single());
}

export async function updateMaintenanceDB(id: string, updates: Partial<MaintenanceRecord>): Promise<void> {
  await exec(supabase!.from('maintenance_records').update(updates).eq('id', id));
}

export async function deleteMaintenanceDB(id: string): Promise<void> {
  await exec(supabase!.from('maintenance_records').delete().eq('id', id));
}

// ── CONTRACTS ──

export async function fetchContracts(landlordId: string): Promise<Contract[]> {
  if (!supabase) return [];
  const leases = await fetchLeases(landlordId);
  if (leases.length === 0) return [];
  return query(
    supabase.from('contracts').select('*')
      .in('lease_id', leases.map(l => l.id))
      .order('created_at', { ascending: false })
  );
}

// ── APPLICATIONS ──

export async function fetchApplications(landlordId: string): Promise<Application[]> {
  if (!supabase) return [];
  return query(
    supabase.from('applications').select('*')
      .eq('landlord_id', landlordId)
      .order('created_at', { ascending: false })
  );
}

export async function insertApplication(app: Omit<Application, 'id' | 'created_at'>): Promise<Application> {
  return query(supabase!.from('applications').insert(app).select().single());
}

export async function updateApplicationDB(id: string, updates: Partial<Application>): Promise<void> {
  await exec(supabase!.from('applications').update(updates).eq('id', id));
}

// ── COMMUNICATION LOGS ──

export async function fetchCommLogs(landlordId: string): Promise<CommunicationLog[]> {
  if (!supabase) return [];
  return query(
    supabase.from('communication_logs').select('*')
      .eq('landlord_id', landlordId)
      .order('date', { ascending: false })
  );
}

export async function insertCommLog(log: Omit<CommunicationLog, 'id' | 'created_at'>): Promise<CommunicationLog> {
  return query(supabase!.from('communication_logs').insert(log).select().single());
}
