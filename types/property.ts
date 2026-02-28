export interface Property {
  id?: string;
  ownerId: string;
  name: string;
  address: string;
  currency: string; // e.g. "UGX" | "USD"
  createdAt: string; // ISO date string
}
