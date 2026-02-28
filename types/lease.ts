export type RentFrequency = "monthly" | "quarterly" | "annually";

export interface Lease {
  id?: string;
  ownerId: string;
  propertyId: string;
  unitLabel: string; // e.g. "Unit 3B"
  tenantId: string;
  rentAmount: number;
  currency: string;
  dueDayOfMonth: number; // 1–28
  rentFrequency: RentFrequency;
  startDate: string; // ISO date string
  endDate?: string;
  status: "active" | "ended";
  createdAt: string;
}
