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
    try {
      setError(null);
      if (supabase && user) await updateLandlordDB(user.id, data);
      setLandlord(prev => ({ ...prev, ...data }));
    } catch (err: any) { setError(friendlyError(err)); }
  }, [user]);

  const addProperty = useCallback(async (p: Omit<Property, 'id' | 'landlord_id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase && user) {
        const newProp = await insertProperty({ ...p, landlord_id: user.id });
        setProperties(prev => [newProp, ...prev]);
      }
    } catch (err: any) { setError(friendlyError(err)); }
  }, [user]);

  const updateProperty = useCallback(async (id: string, p: Partial<Property>) => {
    try {
      setError(null);
      if (supabase) await updatePropertyDB(id, p);
      setProperties(prev => prev.map(x => x.id === id ? { ...x, ...p } : x));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const deleteProperty = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deletePropertyDB(id);
      setProperties(prev => prev.filter(x => x.id !== id));
      setUnits(prev => prev.filter(u => u.property_id !== id));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const addUnit = useCallback(async (u: Omit<Unit, 'id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase) {
        const newUnit = await insertUnit(u);
        setUnits(prev => [newUnit, ...prev]);
      }
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const updateUnit = useCallback(async (id: string, u: Partial<Unit>) => {
    try {
      setError(null);
      if (supabase) await updateUnitDB(id, u);
      setUnits(prev => prev.map(x => x.id === id ? { ...x, ...u } : x));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const deleteUnit = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deleteUnitDB(id);
      setUnits(prev => prev.filter(x => x.id !== id));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const addTenant = useCallback(async (t: Omit<Tenant, 'id' | 'landlord_id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase && user) {
        const newTenant = await insertTenant({ ...t, landlord_id: user.id });
        setTenants(prev => [newTenant, ...prev]);
      }
    } catch (err: any) { setError(friendlyError(err)); }
  }, [user]);

  const updateTenant = useCallback(async (id: string, t: Partial<Tenant>) => {
    try {
      setError(null);
      if (supabase) await updateTenantDB(id, t);
      setTenants(prev => prev.map(x => x.id === id ? { ...x, ...t } : x));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const deleteTenant = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deleteTenantDB(id);
      setTenants(prev => prev.filter(x => x.id !== id));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const addLease = useCallback(async (l: Omit<Lease, 'id' | 'landlord_id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase && user) {
        const newLease = await insertLease({ ...l, landlord_id: user.id });
        setLeases(prev => [newLease, ...prev]);
      }
    } catch (err: any) { setError(friendlyError(err)); }
  }, [user]);

  const updateLease = useCallback(async (id: string, l: Partial<Lease>) => {
    try {
      setError(null);
      if (supabase) await updateLeaseDB(id, l);
      setLeases(prev => prev.map(x => x.id === id ? { ...x, ...l } : x));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const deleteLease = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deleteLeaseDB(id);
      setLeases(prev => prev.filter(x => x.id !== id));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const addPayment = useCallback(async (p: Omit<Payment, 'id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase) {
        const newPayment = await insertPayment(p);
        setPayments(prev => [newPayment, ...prev]);
      }
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const deletePayment = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deletePaymentDB(id);
      setPayments(prev => prev.filter(x => x.id !== id));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const addMaintenance = useCallback(async (m: Omit<MaintenanceRecord, 'id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase) {
        const newRecord = await insertMaintenance(m);
        setMaintenance(prev => [newRecord, ...prev]);
      }
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const updateMaintenance = useCallback(async (id: string, m: Partial<MaintenanceRecord>) => {
    try {
      setError(null);
      if (supabase) await updateMaintenanceDB(id, m);
      setMaintenance(prev => prev.map(x => x.id === id ? { ...x, ...m } : x));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const deleteMaintenance = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deleteMaintenanceDB(id);
      setMaintenance(prev => prev.filter(x => x.id !== id));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const addApplication = useCallback(async (a: Omit<Application, 'id' | 'landlord_id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase && user) {
        const newApp = await insertApplication({ ...a, landlord_id: user.id });
        setApplications(prev => [newApp, ...prev]);
      }
    } catch (err: any) { setError(friendlyError(err)); }
  }, [user]);

  const updateApplication = useCallback(async (id: string, a: Partial<Application>) => {
    try {
      setError(null);
      if (supabase) await updateApplicationDB(id, a);
      setApplications(prev => prev.map(x => x.id === id ? { ...x, ...a } : x));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const addCommunicationLog = useCallback(async (c: Omit<CommunicationLog, 'id' | 'landlord_id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase && user) {
        const newLog = await insertCommLog({ ...c, landlord_id: user.id });
        setCommunicationLogs(prev => [newLog, ...prev]);
      }
    } catch (err: any) { setError(friendlyError(err)); }
  }, [user]);

  const addExpense = useCallback(async (e: Omit<Expense, 'id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase) {
        const newExpense = await insertExpense(e);
        setExpenses(prev => [newExpense, ...prev]);
      }
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const updateExpense = useCallback(async (id: string, e: Partial<Expense>) => {
    try {
      setError(null);
      if (supabase) await updateExpenseDB(id, e);
      setExpenses(prev => prev.map(x => x.id === id ? { ...x, ...e } : x));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deleteExpenseDB(id);
      setExpenses(prev => prev.filter(x => x.id !== id));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const addCommTemplate = useCallback(async (t: Omit<CommTemplate, 'id' | 'created_at'>) => {
    try {
      setError(null);
      if (supabase) {
        const newTemplate = await insertCommTemplate(t);
        setCommTemplates(prev => [newTemplate, ...prev]);
      }
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const updateCommTemplate = useCallback(async (id: string, t: Partial<CommTemplate>) => {
    try {
      setError(null);
      if (supabase) await updateCommTemplateDB(id, t);
      setCommTemplates(prev => prev.map(x => x.id === id ? { ...x, ...t } : x));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const deleteCommTemplate = useCallback(async (id: string) => {
    try {
      setError(null);
      if (supabase) await deleteCommTemplateDB(id);
      setCommTemplates(prev => prev.filter(x => x.id !== id));
    } catch (err: any) { setError(friendlyError(err)); }
  }, []);

  const value: AppContextType = {
    landlord, properties, units, tenants, leases, payments, maintenance, contracts, applications, communicationLogs,
    expenses, commTemplates,
    loading, error,
    updateLandlord, addProperty, updateProperty, deleteProperty,
    addUnit, updateUnit, deleteUnit, addTenant, updateTenant, deleteTenant,
    addLease, updateLease, deleteLease, addPayment, deletePayment,
    addMaintenance, updateMaintenance, deleteMaintenance,
    addApplication, updateApplication, addCommunicationLog,
    addExpense, updateExpense, deleteExpense,
    addCommTemplate, updateCommTemplate, deleteCommTemplate,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading your data...</p>
        </div>
      </div>
    );
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
