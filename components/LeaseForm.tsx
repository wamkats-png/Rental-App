"use client";

import { useState } from "react";
import { createLease } from "@/lib/firestoreCollections";
import type { Lease } from "@/types/lease";
import type { Property } from "@/types/property";
import type { Tenant } from "@/types/tenant";

interface LeaseFormProps {
  ownerId: string;
  properties: Property[];
  tenants: Tenant[];
  onCreated: () => void;
}

export default function LeaseForm({ ownerId, properties, tenants, onCreated }: LeaseFormProps) {
  const [propertyId, setPropertyId] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [currency, setCurrency] = useState("UGX");
  const [dueDayOfMonth, setDueDayOfMonth] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data: Omit<Lease, "id" | "createdAt"> = {
        ownerId, propertyId, unitLabel, tenantId,
        rentAmount: Number(rentAmount), currency,
        dueDayOfMonth: Number(dueDayOfMonth),
        rentFrequency: "monthly",
        startDate,
        status: "active",
      };
      await createLease(data);
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow space-y-3 max-w-md">
      <h2 className="font-semibold text-gray-700">New Lease</h2>
      <select required value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="input">
        <option value="">Select property</option>
        {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input required value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)}
        placeholder="Unit label (e.g. Unit 1A)" className="input" />
      <select required value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="input">
        <option value="">Select tenant</option>
        {tenants.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
      </select>
      <input required type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)}
        placeholder="Rent amount" className="input" />
      <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input">
        <option value="UGX">UGX</option>
        <option value="USD">USD</option>
        <option value="KES">KES</option>
      </select>
      <input required type="number" min="1" max="28" value={dueDayOfMonth}
        onChange={(e) => setDueDayOfMonth(e.target.value)}
        placeholder="Due day of month (1–28)" className="input" />
      <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
      <button type="submit" disabled={loading}
        className="btn-primary w-full">{loading ? "Saving…" : "Create Lease"}</button>
    </form>
  );
}
