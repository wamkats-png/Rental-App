"use client";

import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import AuthGuard from "@/lib/authGuard";
import TenantForm from "@/components/TenantForm";
import { listTenants } from "@/lib/firestoreCollections";
import type { Tenant } from "@/types/tenant";

export default function TenantsPage() {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const refresh = useCallback(async (uid: string) => {
    const data = await listTenants(uid);
    setTenants(data);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { setOwnerId(user.uid); refresh(user.uid); }
    });
    return () => unsub();
  }, [refresh]);

  return (
    <AuthGuard>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tenants</h1>
      {ownerId && (
        <TenantForm ownerId={ownerId} onCreated={() => refresh(ownerId)} />
      )}
      <div className="mt-6 space-y-2">
        {tenants.map((t) => (
          <div key={t.id} className="bg-white rounded shadow px-4 py-3">
            <p className="font-medium text-gray-800">{t.fullName}</p>
            <p className="text-sm text-gray-500">{t.email} · {t.phone}</p>
          </div>
        ))}
        {tenants.length === 0 && (
          <p className="text-gray-400 text-sm">No tenants yet. Add one above.</p>
        )}
      </div>
    </AuthGuard>
  );
}
