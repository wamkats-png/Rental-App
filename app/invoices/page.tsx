"use client";

import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import AuthGuard from "@/lib/authGuard";
import LeaseForm from "@/components/LeaseForm";
import InvoiceTable from "@/components/InvoiceTable";
import { listProperties, listTenants, listLeases, listInvoices } from "@/lib/firestoreCollections";
import { generateInvoicesForOwner } from "@/lib/rentLogic";
import type { Property } from "@/types/property";
import type { Tenant } from "@/types/tenant";
import type { Lease } from "@/types/lease";
import type { Invoice } from "@/types/invoice";

export default function InvoicesPage() {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [generating, setGenerating] = useState(false);

  const refresh = useCallback(async (uid: string) => {
    const [p, t, l, i] = await Promise.all([
      listProperties(uid), listTenants(uid), listLeases(uid), listInvoices(uid),
    ]);
    setProperties(p); setTenants(t); setLeases(l); setInvoices(i);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { setOwnerId(user.uid); refresh(user.uid); }
    });
    return () => unsub();
  }, [refresh]);

  async function handleGenerate() {
    if (!ownerId) return;
    setGenerating(true);
    try {
      await generateInvoicesForOwner(leases, 1);
      await refresh(ownerId);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AuthGuard>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Invoices & Leases</h1>
      {ownerId && (
        <LeaseForm ownerId={ownerId} properties={properties} tenants={tenants}
          onCreated={() => refresh(ownerId)} />
      )}
      <div className="mt-6">
        <button onClick={handleGenerate} disabled={generating}
          className="btn-primary">
          {generating ? "Generating…" : "Generate next month's invoices"}
        </button>
        <InvoiceTable invoices={invoices} onUpdated={() => ownerId && refresh(ownerId)} />
      </div>
    </AuthGuard>
  );
}
