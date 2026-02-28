"use client";

import { useState } from "react";
import { createProperty } from "@/lib/firestoreCollections";
import type { Property } from "@/types/property";

interface PropertyFormProps {
  ownerId: string;
  onCreated: () => void;
}

export default function PropertyForm({ ownerId, onCreated }: PropertyFormProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("UGX");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data: Omit<Property, "id" | "createdAt"> = { ownerId, name, address, currency };
      await createProperty(data);
      setName(""); setAddress(""); setCurrency("UGX");
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow space-y-3 max-w-md">
      <h2 className="font-semibold text-gray-700">Add Property</h2>
      <input required value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Property name" className="input" />
      <input required value={address} onChange={(e) => setAddress(e.target.value)}
        placeholder="Address" className="input" />
      <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input">
        <option value="UGX">UGX</option>
        <option value="USD">USD</option>
        <option value="KES">KES</option>
      </select>
      <button type="submit" disabled={loading}
        className="btn-primary w-full">{loading ? "Saving…" : "Add Property"}</button>
    </form>
  );
}
