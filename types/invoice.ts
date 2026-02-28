export type InvoiceStatus = "pending" | "paid" | "overdue";

export interface Invoice {
  id?: string;
  ownerId: string;
  leaseId: string;
  tenantId: string;
  propertyId: string;
  amount: number;
  currency: string;
  dueDate: string; // ISO date string
  paidDate?: string;
  status: InvoiceStatus;
  createdAt: string;
}
