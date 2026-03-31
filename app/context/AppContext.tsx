'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

function friendlyError(err: any): string {
  const msg: string = err?.message ?? String(err);
  if (msg.includes('duplicate') || msg.includes('unique')) return 'This record already exists.';
  if (msg.includes('foreign key') || msg.includes('violates')) return 'Cannot complete — related data is in use.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Network error — please check your connection.';
  if (msg.includes('permission') || msg.includes('policy')) return 'You do not have permission to do that.';
  return 'Something went wrong. Please try again.';
}
import { Property, Unit, Tenant, Lease, Payment, MaintenanceRecord, Landlord, Contract, Application, CommunicationLog, Expense, CommTemplate } from '../types';
import { useAuth } from '../components/AuthProvider';
import { supabase } from '../lib/supabase';
import {
  fetchLandlord, updateLandlordDB,
  fetchProperties, insertProperty, updatePropertyDB, deletePropertyDB,
  fetchUnits, insertUnit, updateUnitDB, deleteUnitDB,
  fetchTenants, insertTenant, updateTenantDB, deleteTenantDB,
  fetchLeases, insertLease, updateLeaseDB, deleteLeaseDB,
  fetchPayments, insertPayment, deletePaymentDB,
  fetchMaintenance, insertMaintenance, updateMaintenanceDB, deleteMaintenanceDB,
  fetchContracts,
  fetchApplications, insertApplication, updateApplicationDB,
  fetchCommLogs, insertCommLog,
  fetchExpenses, insertExpense, updateExpenseDB, deleteExpenseDB,
  fetchCommTemplates, insertCommTemplate, updateCommTemplateDB, deleteCommTemplateDB,
  insertAuditLog,
} from '../lib/database';

interface AppContextType {
  landlord: Landlord;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  payments: Payment[];
  maintenance: MaintenanceRecord[];
  contracts: Contract[];
  applications: Application[];
  communicationLogs: CommunicationLog[];
  expenses: Expense[];
  commTemplates: CommTemplate[];
  loading: boolean;
  error: string | null;
  toast: { message: string; type: 'success' | 'error' } | null;
  dismissToast: () => void;
  updateLandlord: (data: Partial<Landlord>) => void;
  addProperty: (p: Omit<Property, 'id' | 'landlord_id' | 'created_at'>) => void;
  updateProperty: (id: string, p: Partial<Property>) => void;
  deleteProperty: (id: string) => void;
  addUnit: (u: Omit<Unit, 'id' | 'created_at'>) => void;
  updateUnit: (id: string, u: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;
  addTenant: (t: Omit<Tenant, 'id' | 'landlord_id' | 'created_at'>) => void;
  updateTenant: (id: string, t: Partial<Tenant>) => void;
  deleteTenant: (id: string) => void;
  addLease: (l: Omit<Lease, 'id' | 'landlord_id' | 'created_at'>) => void;
  updateLease: (id: string, l: Partial<Lease>) => void;
  deleteLease: (id: string) => void;
  addPayment: (p: Omit<Payment, 'id' | 'created_at'>) => void;
  deletePayment: (id: string) => void;
  addMaintenance: (m: Omit<MaintenanceRecord, 'id' | 'created_at'>) => void;
  updateMaintenance: (id: string, m: Partial<MaintenanceRecord>) => void;
  deleteMaintenance: (id: string) => void;
  addApplication: (a: Omit<Application, 'id' | 'landlord_id' | 'created_at'>) => void;
  updateApplication: (id: string, a: Partial<Application>) => void;
  addCommunicationLog: (c: Omit<CommunicationLog, 'id' | 'landlord_id' | 'created_at'>) => void;
  addExpense: (e: Omit<Expense, 'id' | 'created_at'>) => void;
  updateExpense: (id: string, e: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  addCommTemplate: (t: Omit<CommTemplate, 'id' | 'created_at'>) => void;
  updateCommTemplate: (id: string, t: Partial<CommTemplate>) => void;
  deleteCommTemplate: (id: string) => void;
}

const defaultLandlord: Landlord = {
  id: '',
  name: '',
  phone: '',
  email: '',
  landlord_type: 'Individual',
  ura_tin: '',
  subscription_plan: 'Free',
  created_at: new Date().toISOString(),
};

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [landlord, setLandlord] = useState<Landlord>(defaultLandlord);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [commTemplates, setCommTemplates] = useState<CommTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  // Load all data from Supabase when user is available
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const landlordData = await fetchLandlord(user.id);
        if (landlordData) {
          setLandlord(landlordData);
        } else {
          setLandlord({ ...defaultLandlord, id: user.id, email: user.email || '' });
        }

        const props = await fetchProperties(user.id);
        setProperties(props);

        const propertyIds = props.map(p => p.id);

        const [unitData, tenantData, leaseData, paymentData, maintData, contractData, appData, commData, expenseData, templateData] =
          await Promise.all([
            fetchUnits(propertyIds),
            fetchTenants(user.id),
            fetchLeases(user.id),
            fetchPayments(user.id),
            fetchMaintenance(user.id),
            fetchContracts(user.id),
            fetchApplications(user.id),
            fetchCommLogs(user.id),
            fetchExpenses(user.id),
            fetchCommTemplates(user.id),
          ]);

        setUnits(unitData);
        setTenants(tenantData);
        setLeases(leaseData);
        setPayments(paymentData);
        setMaintenance(maintData);
        setContracts(contractData);
        setApplications(appData);
        setCommunicationLogs(commData);
        setExpenses(expenseData);
        setCommTemplates(templateData);
      } catch (err: any) {
        console.error('Failed to load data:', err);
        setError(friendlyError(err));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // ── CRUD Functions ──

  const updateLandlord = useCallback(async (data: Partial<Landlord>) => {
    setLandlord(prev => ({ ...prev, ...data }));
    try {
      setError(null);
      if (supabase && user) await updateLandlordDB(user.id, data);
      showToast('Profile updated');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [user, showToast]);

  const addProperty = useCallback(async (p: Omit<Property, 'id' | 'landlord_id' | 'created_at'>) => {
    try {
      setError(null);
      // Prevent duplicate property names for this landlord
      const isDuplicate = properties.some(
        existing => existing.name.trim().toLowerCase() === p.name.trim().toLowerCase()
      );
      if (isDuplicate) {
        setError(`A property named "${p.name}" already exists.`);
        return;
      }
      if (supabase && user) {
        const newProp = await insertProperty({ ...p, landlord_id: user.id });
        setProperties(prev => [newProp, ...prev]);
        insertAuditLog({ landlord_id: user.id, user_id: user.id, user_email: user.email ?? '', action: 'create', entity_type: 'property', entity_id: newProp.id, summary: `Added property: ${p.name}` });
        showToast('Property added');
      }
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [user, properties, showToast]);

  const updateProperty = useCallback(async (id: string, p: Partial<Property>) => {
    try {
      setError(null);
      if (supabase) await updatePropertyDB(id, p);
      setProperties(prev => prev.map(x => x.id === id ? { ...x, ...p } : x));
      showToast('Property updated');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const deleteProperty = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deletePropertyDB(id);
      setProperties(prev => prev.filter(x => x.id !== id));
      setUnits(prev => prev.filter(u => u.property_id !== id));
      showToast('Property deleted');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const addUnit = useCallback(async (u: Omit<Unit, 'id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase) {
        const newUnit = await insertUnit(u);
        setUnits(prev => [newUnit, ...prev]);
        showToast('Unit added');
      }
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const updateUnit = useCallback(async (id: string, u: Partial<Unit>) => {
    try {
      setError(null);
      if (supabase) await updateUnitDB(id, u);
      setUnits(prev => prev.map(x => x.id === id ? { ...x, ...u } : x));
      showToast('Unit updated');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const deleteUnit = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deleteUnitDB(id);
      setUnits(prev => prev.filter(x => x.id !== id));
      showToast('Unit deleted');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const addTenant = useCallback(async (t: Omit<Tenant, 'id' | 'landlord_id' | 'created_at'>) => {
    try {
      setError(null);
      // Prevent duplicate tenants by phone number (most reliable identifier in Uganda)
      if (t.phone) {
        const phoneNormalised = t.phone.replace(/\s+/g, '');
        const isDuplicate = tenants.some(
          existing => existing.phone.replace(/\s+/g, '') === phoneNormalised
        );
        if (isDuplicate) {
          setError(`A tenant with phone number ${t.phone} already exists.`);
          return;
        }
      }
      if (supabase && user) {
        const newTenant = await insertTenant({ ...t, landlord_id: user.id });
        setTenants(prev => [newTenant, ...prev]);
        insertAuditLog({ landlord_id: user.id, user_id: user.id, user_email: user.email ?? '', action: 'create', entity_type: 'tenant', entity_id: newTenant.id, summary: `Added tenant: ${t.full_name}` });
        showToast('Tenant added');
      }
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [user, tenants, showToast]);

  const updateTenant = useCallback(async (id: string, t: Partial<Tenant>) => {
    try {
      setError(null);
      if (supabase) await updateTenantDB(id, t);
      setTenants(prev => prev.map(x => x.id === id ? { ...x, ...t } : x));
      showToast('Tenant updated');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const deleteTenant = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deleteTenantDB(id);
      setTenants(prev => prev.filter(x => x.id !== id));
      showToast('Tenant deleted');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const addLease = useCallback(async (l: Omit<Lease, 'id' | 'landlord_id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase && user) {
        const newLease = await insertLease({ ...l, landlord_id: user.id });
        setLeases(prev => [newLease, ...prev]);
        insertAuditLog({ landlord_id: user.id, user_id: user.id, user_email: user.email ?? '', action: 'create', entity_type: 'lease', entity_id: newLease.id, summary: `Created lease — UGX ${l.rent_amount.toLocaleString()}/mo` });
        showToast('Lease created');
      }
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [user, showToast]);

  const updateLease = useCallback(async (id: string, l: Partial<Lease>) => {
    try {
      setError(null);
      if (supabase) await updateLeaseDB(id, l);
      setLeases(prev => prev.map(x => x.id === id ? { ...x, ...l } : x));
      showToast('Lease updated');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const deleteLease = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deleteLeaseDB(id);
      setLeases(prev => prev.filter(x => x.id !== id));
      showToast('Lease deleted');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const addPayment = useCallback(async (p: Omit<Payment, 'id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase) {
        const newPayment = await insertPayment(p);
        setPayments(prev => [newPayment, ...prev]);
        if (user) insertAuditLog({ landlord_id: p.landlord_id, user_id: user.id, user_email: user.email ?? '', action: 'create', entity_type: 'payment', entity_id: newPayment.id, summary: `Payment recorded — UGX ${p.amount.toLocaleString()} (${p.receipt_number})` });
        showToast('Payment recorded');
      }
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [user, showToast]);

  const deletePayment = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deletePaymentDB(id);
      setPayments(prev => prev.filter(x => x.id !== id));
      showToast('Payment deleted');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const addMaintenance = useCallback(async (m: Omit<MaintenanceRecord, 'id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase) {
        const newRecord = await insertMaintenance(m);
        setMaintenance(prev => [newRecord, ...prev]);
        showToast('Maintenance request added');
      }
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const updateMaintenance = useCallback(async (id: string, m: Partial<MaintenanceRecord>) => {
    try {
      setError(null);
      if (supabase) await updateMaintenanceDB(id, m);
      setMaintenance(prev => prev.map(x => x.id === id ? { ...x, ...m } : x));
      showToast('Maintenance updated');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const deleteMaintenance = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deleteMaintenanceDB(id);
      setMaintenance(prev => prev.filter(x => x.id !== id));
      showToast('Maintenance request deleted');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const addApplication = useCallback(async (a: Omit<Application, 'id' | 'landlord_id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase && user) {
        const newApp = await insertApplication({ ...a, landlord_id: user.id });
        setApplications(prev => [newApp, ...prev]);
        showToast('Application submitted');
      }
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [user, showToast]);

  const updateApplication = useCallback(async (id: string, a: Partial<Application>) => {
    try {
      setError(null);
      if (supabase) await updateApplicationDB(id, a);
      setApplications(prev => prev.map(x => x.id === id ? { ...x, ...a } : x));
      showToast('Application updated');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const addCommunicationLog = useCallback(async (c: Omit<CommunicationLog, 'id' | 'landlord_id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase && user) {
        const newLog = await insertCommLog({ ...c, landlord_id: user.id });
        setCommunicationLogs(prev => [newLog, ...prev]);
        showToast('Message logged');
      }
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [user, showToast]);

  const addExpense = useCallback(async (e: Omit<Expense, 'id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase) {
        const newExpense = await insertExpense(e);
        setExpenses(prev => [newExpense, ...prev]);
        showToast('Expense added');
      }
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const updateExpense = useCallback(async (id: string, e: Partial<Expense>) => {
    try {
      setError(null);
      if (supabase) await updateExpenseDB(id, e);
      setExpenses(prev => prev.map(x => x.id === id ? { ...x, ...e } : x));
      showToast('Expense updated');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const deleteExpense = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deleteExpenseDB(id);
      setExpenses(prev => prev.filter(x => x.id !== id));
      showToast('Expense deleted');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const addCommTemplate = useCallback(async (t: Omit<CommTemplate, 'id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase) {
        const newTemplate = await insertCommTemplate(t);
        setCommTemplates(prev => [newTemplate, ...prev]);
        showToast('Template saved');
      }
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const updateCommTemplate = useCallback(async (id: string, t: Partial<CommTemplate>) => {
    try {
      setError(null);
      if (supabase) await updateCommTemplateDB(id, t);
      setCommTemplates(prev => prev.map(x => x.id === id ? { ...x, ...t } : x));
      showToast('Template updated');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const deleteCommTemplate = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deleteCommTemplateDB(id);
      setCommTemplates(prev => prev.filter(x => x.id !== id));
      showToast('Template deleted');
    } catch (err: any) { setError(friendlyError(err)); showToast(friendlyError(err), 'error'); }
  }, [showToast]);

  const value: AppContextType = {
    landlord, properties, units, tenants, leases, payments, maintenance, contracts, applications, communicationLogs,
    expenses, commTemplates,
    loading, error, toast, dismissToast,
    updateLandlord, addProperty, updateProperty, deleteProperty,
    addUnit, updateUnit, deleteUnit, addTenant, updateTenant, deleteTenant,
    addLease, updateLease, deleteLease, addPayment, deletePayment,
    addMaintenance, updateMaintenance, deleteMaintenance,
    addApplication, updateApplication, addCommunicationLog,
    addExpense, updateExpense, deleteExpense,
    addCommTemplate, updateCommTemplate, deleteCommTemplate,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
