"use client";

import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import AuthGuard from "@/lib/authGuard";
import PropertyForm from "@/components/PropertyForm";
import { listProperties } from "@/lib/firestoreCollections";
import type { Property } from "@/types/property";

export default function PropertiesPage() {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);

  const refresh = useCallback(async (uid: string) => {
    const data = await listProperties(uid);
    setProperties(data);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { setOwnerId(user.uid); refresh(user.uid); }
    });
    return () => unsub();
  }, [refresh]);

  return (
    <AuthGuard>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Properties</h1>
      {ownerId && (
        <PropertyForm ownerId={ownerId} onCreated={() => refresh(ownerId)} />
      )}
      <div className="mt-6 space-y-2">
        {properties.map((p) => (
          <div key={p.id} className="bg-white rounded shadow px-4 py-3 flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-800">{p.name}</p>
              <p className="text-sm text-gray-500">{p.address}</p>
            </div>
            <span className="text-xs text-teal-700 font-semibold bg-teal-50 px-2 py-1 rounded">
              {p.currency}
            </span>
          </div>
        ))}
        {properties.length === 0 && (
          <p className="text-gray-400 text-sm">No properties yet. Add one above.</p>
        )}
      </div>
    </AuthGuard>
  );
}
