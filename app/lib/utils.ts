export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export function formatUGX(amount: number): string {
  return 'UGX ' + amount.toLocaleString('en-UG');
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-UG', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

export function getStorageItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch { return fallback; }
}

export function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getCurrentTaxYear(): { start: string; end: string; label: string } {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: `${year}-07-01`,
    end: `${year + 1}-06-30`,
    label: `${year}/${year + 1}`
  };
}

export function isOverdue(dueDay: number, graceDays: number, lastPaymentDate: string | null): boolean {
  const now = new Date();
  const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
  const graceEnd = new Date(dueDate);
  graceEnd.setDate(graceEnd.getDate() + graceDays);
  if (now <= graceEnd) return false;
  if (!lastPaymentDate) return true;
  const lastPay = new Date(lastPaymentDate);
  return lastPay < dueDate;
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
