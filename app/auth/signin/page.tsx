"use client";

import { signInWithGoogle } from "@/lib/firebaseClient";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useEffect } from "react";

export default function SignInPage() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.replace("/dashboard");
    });
    return () => unsub();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
      <h1 className="text-3xl font-bold text-teal-700">RentFlow</h1>
      <p className="text-gray-500 text-sm">Property management, simplified.</p>
      <button
        onClick={signInWithGoogle}
        className="bg-teal-700 text-white px-6 py-3 rounded-lg hover:bg-teal-800 font-semibold shadow"
      >
        Sign in with Google
      </button>
    </div>
  );
}
