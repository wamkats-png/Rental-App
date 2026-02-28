export interface PropertyExpense {
  id?: string;
  ownerId: string;
  propertyId: string;
  category: string; // e.g. "Maintenance", "Utilities", "Insurance"
  description: string;
  amount: number;
  currency: string;
  date: string; // ISO date string
  createdAt: string;
}
