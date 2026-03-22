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

export function resolveTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Calculate a tenant payment reliability score (0–100).
 * Based on: payment frequency, recency, and on-time ratio relative to lease due day.
 */
export function calculateTenantScore(
  tenantId: string,
  payments: Array<{ tenant_id: string; date: string; amount: number; lease_id: string }>,
  leases: Array<{ id: string; tenant_id: string; due_day: number; rent_amount: number; status: string; start_date: string }>
): { score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F'; label: string } {
  const tenantLeases = leases.filter(l => l.tenant_id === tenantId && l.status !== 'Draft');
  const tenantPayments = payments.filter(p => p.tenant_id === tenantId);

  if (tenantLeases.length === 0 || tenantPayments.length === 0) {
    return { score: 0, grade: 'F', label: 'No data' };
  }

  // Months since earliest lease started
  const earliest = new Date(Math.min(...tenantLeases.map(l => new Date(l.start_date).getTime())));
  const now = new Date();
  const monthsActive = Math.max(1, Math.round((now.getTime() - earliest.getTime()) / (30 * 86400000)));

  // Payment frequency score (payments per expected month, capped at 1)
  const freqScore = Math.min(1, tenantPayments.length / monthsActive);

  // On-time ratio: payment within grace period (10 days of due day)
  const onTimeCount = tenantPayments.filter(p => {
    const lease = tenantLeases.find(l => l.id === p.lease_id);
    if (!lease) return false;
    const payDate = new Date(p.date);
    const dueDate = new Date(payDate.getFullYear(), payDate.getMonth(), lease.due_day);
    const diffDays = (payDate.getTime() - dueDate.getTime()) / 86400000;
    return diffDays <= 10; // paid within 10 days of due date
  }).length;
  const onTimeRatio = tenantPayments.length > 0 ? onTimeCount / tenantPayments.length : 0;

  // Recency: last payment within 45 days adds full recency credit
  const lastPayment = tenantPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const daysSinceLastPayment = lastPayment
    ? (now.getTime() - new Date(lastPayment.date).getTime()) / 86400000
    : 999;
  const recencyScore = Math.max(0, 1 - daysSinceLastPayment / 90);

  // Weighted score: frequency 30%, on-time 50%, recency 20%
  const raw = freqScore * 30 + onTimeRatio * 50 + recencyScore * 20;
  const score = Math.min(100, Math.round(raw));

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  const label = grade === 'A' ? 'Excellent' : grade === 'B' ? 'Good' : grade === 'C' ? 'Average' : grade === 'D' ? 'Poor' : 'Very Poor';

  return { score, grade, label };
}
