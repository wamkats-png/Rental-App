"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/auth/signin");
      }
    });
    return () => unsub();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-gray-400 text-sm">Redirecting…</p>
    </div>
  );
}
