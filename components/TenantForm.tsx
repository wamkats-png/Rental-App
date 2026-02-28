"use client";

import { useState } from "react";
import { createTenant } from "@/lib/firestoreCollections";
import type { Tenant } from "@/types/tenant";

interface TenantFormProps {
  ownerId: string;
  onCreated: () => void;
}

export default function TenantForm({ ownerId, onCreated }: TenantFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data: Omit<Tenant, "id" | "createdAt"> = { ownerId, fullName, email, phone };
      await createTenant(data);
      setFullName(""); setEmail(""); setPhone("");
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow space-y-3 max-w-md">
      <h2 className="font-semibold text-gray-700">Add Tenant</h2>
      <input required value={fullName} onChange={(e) => setFullName(e.target.value)}
        placeholder="Full name" className="input" />
      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="Email" className="input" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone" className="input" />
      <button type="submit" disabled={loading}
        className="btn-primary w-full">{loading ? "Saving…" : "Add Tenant"}</button>
    </form>
  );
}
