"use client";

import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import AuthGuard from "@/lib/authGuard";
import ExpenseForm from "@/components/ExpenseForm";
import { listExpenses, listProperties } from "@/lib/firestoreCollections";
import type { PropertyExpense } from "@/types/expense";
import type { Property } from "@/types/property";
import AIInputPanel from "@/components/AIInputPanel";

export default function ExpensesPage() {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<PropertyExpense[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  const refresh = useCallback(async (uid: string) => {
    const [e, p] = await Promise.all([listExpenses(uid), listProperties(uid)]);
    setExpenses(e); setProperties(p);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { setOwnerId(user.uid); refresh(user.uid); }
    });
    return () => unsub();
  }, [refresh]);

  return (
    <AuthGuard>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Expenses</h1>
      {ownerId && (
        <>
          <ExpenseForm ownerId={ownerId} properties={properties} onCreated={() => refresh(ownerId)} />
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">AI Expense Input</h2>
            <AIInputPanel ownerId={ownerId} />
          </div>
        </>
      )}
      <div className="mt-6 space-y-2">
        {expenses.map((ex) => (
          <div key={ex.id} className="bg-white rounded shadow px-4 py-3 flex justify-between items-start">
            <div>
              <p className="font-medium text-gray-800">{ex.description}</p>
              <p className="text-sm text-gray-500">{ex.category} · {ex.date}</p>
            </div>
            <span className="text-sm font-semibold text-teal-700">
              {ex.currency} {ex.amount.toLocaleString()}
            </span>
          </div>
        ))}
        {expenses.length === 0 && (
          <p className="text-gray-400 text-sm">No expenses logged yet.</p>
        )}
      </div>
    </AuthGuard>
  );
}
