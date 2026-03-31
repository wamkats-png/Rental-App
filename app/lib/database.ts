import { supabase } from './supabase';
import type {
  Landlord, Property, Unit, Tenant, Lease, Payment,
  MaintenanceRecord, Contract, Application, CommunicationLog,
  Expense, CommTemplate, TeamMember, AuditLog
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
  const { data, error } = await supabase
    .from('landlords').select('*').eq('id', userId).single();
  // 406 = no row found (user signed up before auto-create trigger) — upsert a default row
  if (error && error.code === 'PGRST116') {
    const { data: created } = await supabase
      .from('landlords')
      .upsert({ id: userId, name: '', email: '', phone: '', landlord_type: 'Individual', ura_tin: '', subscription_plan: 'Free' }, { onConflict: 'id' })
      .select().single();
    return created;
  }
  return data;
}

export async function updateLandlordDB(userId: string, updates: Partial<Landlord>): Promise<void> {
  if (!supabase) return;
  await exec(supabase.from('landlords').upsert({ id: userId, ...updates }, { onConflict: 'id' }));
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

// ── EXPENSES ──

export async function fetchExpenses(landlordId: string): Promise<Expense[]> {
  if (!supabase) return [];
  return query(
    supabase.from('expenses').select('*')
      .eq('landlord_id', landlordId)
      .order('date', { ascending: false })
  );
}

export async function insertExpense(expense: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> {
  return query(supabase!.from('expenses').insert(expense).select().single());
}

export async function updateExpenseDB(id: string, updates: Partial<Expense>): Promise<void> {
  await exec(supabase!.from('expenses').update(updates).eq('id', id));
}

export async function deleteExpenseDB(id: string): Promise<void> {
  await exec(supabase!.from('expenses').delete().eq('id', id));
}

// ── COMM TEMPLATES ──

export async function fetchCommTemplates(landlordId: string): Promise<CommTemplate[]> {
  if (!supabase) return [];
  return query(
    supabase.from('comm_templates').select('*')
      .eq('landlord_id', landlordId)
      .order('created_at', { ascending: false })
  );
}

export async function insertCommTemplate(template: Omit<CommTemplate, 'id' | 'created_at'>): Promise<CommTemplate> {
  return query(supabase!.from('comm_templates').insert(template).select().single());
}

export async function updateCommTemplateDB(id: string, updates: Partial<CommTemplate>): Promise<void> {
  await exec(supabase!.from('comm_templates').update(updates).eq('id', id));
}

export async function deleteCommTemplateDB(id: string): Promise<void> {
  await exec(supabase!.from('comm_templates').delete().eq('id', id));
}

// ── TEAM MEMBERS ──────────────────────────────────────────────────────────────

export async function fetchTeamMembers(ownerId: string): Promise<TeamMember[]> {
  if (!supabase) return [];
  return query(supabase.from('team_members').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }));
}

export async function insertTeamMember(m: Omit<TeamMember, 'id' | 'created_at'>): Promise<TeamMember> {
  return query(supabase!.from('team_members').insert(m).select().single());
}

export async function updateTeamMemberDB(id: string, updates: Partial<TeamMember>): Promise<void> {
  await exec(supabase!.from('team_members').update(updates).eq('id', id));
}

export async function deleteTeamMemberDB(id: string): Promise<void> {
  await exec(supabase!.from('team_members').delete().eq('id', id));
}

export async function findTeamMemberByToken(token: string): Promise<TeamMember | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('team_members').select('*').eq('invite_token', token).single();
  return data;
}

export async function findTeamMemberByUserId(userId: string): Promise<TeamMember | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('team_members').select('*').eq('user_id', userId).eq('status', 'Active').single();
  return data;
}

// ── AUDIT LOGS ──────────────────────────────────────────────────────────────

export async function fetchAuditLogs(landlordId: string): Promise<AuditLog[]> {
  if (!supabase) return [];
  return query(supabase.from('audit_logs').select('*').eq('landlord_id', landlordId).order('created_at', { ascending: false }).limit(200));
}

export async function insertAuditLog(log: Omit<AuditLog, 'id' | 'created_at'>): Promise<void> {
  if (!supabase) return;
  // Fire-and-forget — never block UI
  void supabase.from('audit_logs').insert(log);
}
