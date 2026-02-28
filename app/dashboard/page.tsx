"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import AuthGuard from "@/lib/authGuard";
import { getDashboardSummary, DashboardSummary } from "@/lib/reports";

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`bg-white rounded-xl shadow p-6 border-l-4 ${color}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const s = await getDashboardSummary(user.uid);
        setSummary(s);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <AuthGuard>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>
      {loading ? (
        <p className="text-gray-400">Loading summary…</p>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Rent Billed"
            value={`${summary.currency} ${summary.totalDue.toLocaleString()}`}
            color="border-teal-500" />
          <StatCard label="Total Collected"
            value={`${summary.currency} ${summary.totalPaid.toLocaleString()}`}
            color="border-green-500" />
          <StatCard label="Arrears"
            value={`${summary.currency} ${summary.arrears.toLocaleString()}`}
            color="border-red-500" />
        </div>
      ) : (
        <p className="text-gray-400">No data yet. Create properties and generate invoices.</p>
      )}
    </AuthGuard>
  );
}
