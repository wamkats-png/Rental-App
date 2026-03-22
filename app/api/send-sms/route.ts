import { NextRequest, NextResponse } from 'next/server';

const AT_USERNAME = process.env.AFRICASTALKING_USERNAME ?? 'sandbox';
const AT_API_KEY = process.env.AFRICASTALKING_API_KEY ?? '';
const AT_ENV = process.env.AFRICASTALKING_ENV ?? 'sandbox'; // 'sandbox' | 'production'
const AT_BASE = AT_ENV === 'production'
  ? 'https://api.africastalking.com'
  : 'https://api.sandbox.africastalking.com';

export async function POST(req: NextRequest) {
  try {
    const { to, message } = await req.json() as { to: string; message: string };

    if (!to || !message) {
      return NextResponse.json({ error: 'to and message are required' }, { status: 400 });
    }

    if (!AT_API_KEY) {
      // Graceful degradation when no AT credentials are configured
      console.warn('[send-sms] No AFRICASTALKING_API_KEY — simulating send');
      return NextResponse.json({ status: 'simulated', message: 'SMS would be sent (no API key configured)' });
    }

    const params = new URLSearchParams({
      username: AT_USERNAME,
      to,
      message,
    });

    const res = await fetch(`${AT_BASE}/version1/messaging`, {
      method: 'POST',
      headers: {
        apiKey: AT_API_KEY,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data }, { status: 502 });
    }

    return NextResponse.json({ status: 'sent', data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
