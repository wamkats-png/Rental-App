import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

const PLAN_LIMITS = {
  Free: { properties: 3, tenants: 10, leases: 10, ai: false },
  AI_Assist: { properties: Infinity, tenants: Infinity, leases: Infinity, ai: true },
} as const;

export function useSubscription() {
  const { landlord, properties, tenants, leases } = useApp();
  const plan = landlord.subscription_plan ?? 'Free';
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.Free;

  const activeLeases = leases.filter(l => l.status === 'Active');

  return useMemo(() => ({
    plan,
    limits,
    isFree: plan === 'Free',
    canAddProperty: properties.length < limits.properties,
    canAddTenant: tenants.length < limits.tenants,
    canAddLease: activeLeases.length < limits.leases,
    canUseAI: limits.ai,
    propertiesUsed: properties.length,
    propertiesMax: limits.properties,
    tenantsUsed: tenants.length,
    tenantsMax: limits.tenants,
    leasesUsed: activeLeases.length,
    leasesMax: limits.leases,
  }), [plan, limits, properties.length, tenants.length, activeLeases.length]);
}
