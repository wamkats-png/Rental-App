import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import type { Property } from "@/types/property";
import type { Tenant } from "@/types/tenant";
import type { Lease } from "@/types/lease";
import type { Invoice } from "@/types/invoice";
import type { PropertyExpense } from "@/types/expense";

// ── Helpers ──────────────────────────────────────────────────────────────────

function toISO(ts: unknown): string {
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof ts === "string") return ts;
  return new Date().toISOString();
}

// ── Properties ────────────────────────────────────────────────────────────────

export async function createProperty(
  data: Omit<Property, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "properties"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listProperties(ownerId: string): Promise<Property[]> {
  const q = query(collection(db, "properties"), where("ownerId", "==", ownerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISO((d.data() as Record<string, unknown>).createdAt) } as Property));
}

// ── Tenants ───────────────────────────────────────────────────────────────────

export async function createTenant(
  data: Omit<Tenant, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "tenants"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listTenants(ownerId: string): Promise<Tenant[]> {
  const q = query(collection(db, "tenants"), where("ownerId", "==", ownerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISO((d.data() as Record<string, unknown>).createdAt) } as Tenant));
}

// ── Leases ────────────────────────────────────────────────────────────────────

export async function createLease(
  data: Omit<Lease, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "leases"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listLeases(ownerId: string): Promise<Lease[]> {
  const q = query(
    collection(db, "leases"),
    where("ownerId", "==", ownerId),
    where("status", "==", "active")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISO((d.data() as Record<string, unknown>).createdAt) } as Lease));
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export async function createInvoice(
  data: Omit<Invoice, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "invoices"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listInvoices(ownerId: string): Promise<Invoice[]> {
  const q = query(collection(db, "invoices"), where("ownerId", "==", ownerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISO((d.data() as Record<string, unknown>).createdAt) } as Invoice));
}

export async function markInvoicePaid(invoiceId: string, paidDate: string): Promise<void> {
  const ref = doc(db, "invoices", invoiceId);
  await updateDoc(ref, { status: "paid", paidDate });
}

// ── Property Expenses ─────────────────────────────────────────────────────────

export async function createExpense(
  data: Omit<PropertyExpense, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "propertyExpenses"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listExpenses(ownerId: string): Promise<PropertyExpense[]> {
  const q = query(collection(db, "propertyExpenses"), where("ownerId", "==", ownerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISO((d.data() as Record<string, unknown>).createdAt) } as PropertyExpense));
}
