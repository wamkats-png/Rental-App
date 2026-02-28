"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthed(true);
      } else {
        router.replace("/auth/signin");
      }
      setChecking(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Checking authentication…
      </div>
    );
  }

  if (!authed) return null;

  return <>{children}</>;
}
