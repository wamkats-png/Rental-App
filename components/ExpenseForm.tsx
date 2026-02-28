"use client";

import { useState } from "react";
import { createExpense } from "@/lib/firestoreCollections";
import type { PropertyExpense } from "@/types/expense";
import type { Property } from "@/types/property";

const CATEGORIES = ["Maintenance", "Utilities", "Insurance", "Taxes", "Management", "Other"];

interface ExpenseFormProps {
  ownerId: string;
  properties: Property[];
  onCreated: () => void;
}

export default function ExpenseForm({ ownerId, properties, onCreated }: ExpenseFormProps) {
  const [propertyId, setPropertyId] = useState("");
  const [category, setCategory] = useState("Maintenance");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UGX");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data: Omit<PropertyExpense, "id" | "createdAt"> = {
        ownerId, propertyId, category, description,
        amount: Number(amount), currency, date,
      };
      await createExpense(data);
      setDescription(""); setAmount(""); setDate("");
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow space-y-3 max-w-md">
      <h2 className="font-semibold text-gray-700">Log Expense</h2>
      <select required value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="input">
        <option value="">Select property</option>
        {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
      </select>
      <input required value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="Description" className="input" />
      <input required type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount" className="input" />
      <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input">
        <option value="UGX">UGX</option>
        <option value="USD">USD</option>
        <option value="KES">KES</option>
      </select>
      <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
      <button type="submit" disabled={loading}
        className="btn-primary w-full">{loading ? "Saving…" : "Log Expense"}</button>
    </form>
  );
}
