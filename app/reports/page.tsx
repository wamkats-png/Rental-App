"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import AuthGuard from "@/lib/authGuard";

export default function ReportsPage() {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setOwnerId(user.uid);
    });
    return () => unsub();
  }, []);

  async function handleDownload() {
    if (!ownerId) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/reports/export?ownerId=${ownerId}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rentflow-invoices-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AuthGuard>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Reports</h1>
      <div className="bg-white rounded-xl shadow p-6 max-w-sm">
        <h2 className="font-semibold text-gray-700 mb-2">Invoice Export</h2>
        <p className="text-sm text-gray-500 mb-4">
          Download all your invoices as a CSV file.
        </p>
        <button onClick={handleDownload} disabled={downloading}
          className="btn-primary w-full">
          {downloading ? "Preparing…" : "Download Invoices CSV"}
        </button>
      </div>
    </AuthGuard>
  );
}
