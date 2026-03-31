import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

/**
 * GET /api/cron/reminders
 * Called by Vercel Cron (or any scheduler) to send automatic rent reminders.
 * Vercel cron config in vercel.json:
 * { "crons": [{ "path": "/api/cron/reminders", "schedule": "0 8 * * *" }] }
 *
 * Env vars required:
 *   CRON_SECRET           — shared secret to authenticate the cron caller
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service role key (bypasses RLS for cron)
 *   AFRICASTALKING_API_KEY
 *   AFRICASTALKING_USERNAME
 */
export async function GET(req: NextRequest) {
  // Authenticate cron caller
  const auth = req.headers.get('authorization');
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const sent: string[] = [];
  const skipped: string[] = [];

  try {
    // Fetch all active leases
    const { data: leases, error: lErr } = await supabase
      .from('leases')
      .select('*, tenants(*)')
      .eq('status', 'Active');

    if (lErr) throw lErr;
    if (!leases || leases.length === 0) {
      return NextResponse.json({ message: 'No active leases', sent: 0, skipped: 0 });
    }

    // Fetch landlord reminder settings (stored as JSON in landlord profile or use defaults)
    const reminderDaysBefore = parseInt(process.env.REMINDER_DAYS_BEFORE ?? '3', 10);

    for (const lease of leases) {
      const tenant = lease.tenants;
      if (!tenant?.phone) { skipped.push(lease.id); continue; }

      // Calculate next due date
      const dueDay = lease.due_day ?? 1;
      const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
      if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);

      // Send reminder when the due date is within the configured window (≤ N days away).
      // Using strict equality caused the cron to never fire; using <= ensures the
      // reminder is sent on any day within the window.
      if (daysUntilDue > reminderDaysBefore) { skipped.push(lease.id); continue; }

      // Check if already paid this month
      const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const { data: payments } = await supabase
        .from('payments')
        .select('id')
        .eq('lease_id', lease.id)
        .gte('date', periodStart)
        .limit(1);

      if (payments && payments.length > 0) { skipped.push(lease.id); continue; }

      // Send SMS
      const message = `Dear ${tenant.full_name}, your rent of UGX ${lease.rent_amount.toLocaleString()} is due in ${daysUntilDue} day(s) on ${dueDate.toLocaleDateString('en-UG')}. Please make payment on time. Thank you.`;

      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/send-sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: tenant.phone, message }),
        });
        sent.push(lease.id);
      } catch {
        skipped.push(lease.id);
      }
    }

    return NextResponse.json({ message: 'Reminders processed', sent: sent.length, skipped: skipped.length, date: todayStr });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
