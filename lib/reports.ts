import { listInvoices } from "@/lib/firestoreCollections";

export interface DashboardSummary {
  totalDue: number;
  totalPaid: number;
  arrears: number;
  currency: string;
}

export async function getDashboardSummary(ownerId: string): Promise<DashboardSummary> {
  const invoices = await listInvoices(ownerId);

  let totalDue = 0;
  let totalPaid = 0;
  let arrears = 0;

  for (const inv of invoices) {
    totalDue += inv.amount;
    if (inv.status === "paid") totalPaid += inv.amount;
    if (inv.status === "overdue") arrears += inv.amount;
  }

  const currency = invoices[0]?.currency ?? "UGX";

  return { totalDue, totalPaid, arrears, currency };
}
