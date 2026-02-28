import { createInvoice } from "@/lib/firestoreCollections";
import type { Lease } from "@/types/lease";

/**
 * Creates invoice documents in Firestore for the next N months of a lease.
 */
export async function createMonthlyInvoicesForLease(
  lease: Lease,
  monthsAhead: number = 1
): Promise<void> {
  if (!lease.id) throw new Error("Lease must have an id");

  const today = new Date();

  for (let i = 0; i < monthsAhead; i++) {
    const targetDate = new Date(today.getFullYear(), today.getMonth() + i, lease.dueDayOfMonth);
    const dueDate = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD

    const status = targetDate < today ? "overdue" : "pending";

    await createInvoice({
      ownerId: lease.ownerId,
      leaseId: lease.id,
      tenantId: lease.tenantId,
      propertyId: lease.propertyId,
      amount: lease.rentAmount,
      currency: lease.currency,
      dueDate,
      status,
    });
  }
}

/**
 * Generates invoices for all active leases belonging to an owner.
 */
export async function generateInvoicesForOwner(
  leases: Lease[],
  monthsAhead: number = 1
): Promise<void> {
  await Promise.all(
    leases.map((lease) => createMonthlyInvoicesForLease(lease, monthsAhead))
  );
}
