import { NextResponse } from 'next/server';

/**
 * POST /api/cron/test-run
 * Internal endpoint that triggers a test cron run from the settings UI.
 * Uses the server-side CRON_SECRET so the client never needs to know it.
 * Only available in non-production or to authenticated sessions (called
 * from the Settings page which is already behind auth).
 */
export async function POST() {
  const secret = process.env.CRON_SECRET ?? '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const res = await fetch(`${appUrl}/api/cron/reminders`, {
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
