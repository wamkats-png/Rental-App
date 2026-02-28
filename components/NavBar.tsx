"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, signOutUser } from "@/lib/firebaseClient";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/properties", label: "Properties" },
  { href: "/tenants", label: "Tenants" },
  { href: "/invoices", label: "Invoices" },
  { href: "/expenses", label: "Expenses" },
  { href: "/reports", label: "Reports" },
];

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  return (
    <nav className="bg-teal-700 text-white px-6 py-3 flex items-center justify-between flex-wrap gap-3">
      <span className="text-xl font-bold tracking-tight">RentFlow</span>
      <div className="flex items-center gap-4 flex-wrap text-sm">
        {navLinks.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-teal-200 transition-colors">
            {l.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3 text-sm">
        {user && <span className="text-teal-200">{user.displayName}</span>}
        <button
          onClick={() => signOutUser()}
          className="bg-white text-teal-700 px-3 py-1 rounded hover:bg-teal-100 font-medium"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
