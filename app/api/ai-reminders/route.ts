import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/app/lib/supabase-server';
import { rateLimit, rateLimitResponse } from '@/app/lib/rateLimit';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Add ANTHROPIC_API_KEY to your .env file.' },
        { status: 500 }
      );
    }

    // Auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // 20 requests / minute (Haiku is cheap but SMS costs money)
    const perMin = rateLimit({ identifier: `reminder:${user.id}`, max: 20, windowMs: 60_000 });
    if (!perMin.success) return rateLimitResponse(perMin.retryAfterMs, 'Generating reminders too quickly. Please slow down.');

    // 60 requests / hour
    const perHour = rateLimit({ identifier: `reminder:${user.id}:hr`, max: 60, windowMs: 3_600_000 });
    if (!perHour.success) return rateLimitResponse(perHour.retryAfterMs, 'Hourly reminder limit reached. Your limit resets in 1 hour.');

    const body = await req.json();
    const { tenantName, landlordName, amountDue, currency, dueDay, propertyAddress, language, daysOverdue } = body;

    if (!tenantName || !amountDue) {
      return NextResponse.json({ error: 'tenantName and amountDue are required.' }, { status: 400 });
    }

    const lang = language === 'Luganda' ? 'Luganda' : 'English';
    const today = new Date().toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' });

    const systemPrompt = `You are a helpful assistant for Ugandan landlords. Write polite but firm WhatsApp/SMS rent reminder messages.
Keep messages concise (under 200 words), warm, and professional.
If writing in Luganda, use common Uganda Luganda.
Always include: tenant name, amount owed (with currency), due date or overdue status, and a polite call to action.
Do not include greetings like "Dear Claude" — write the message directly as if from the landlord.`;

    const userPrompt = `Write a rent reminder message in ${lang} for:
- Tenant: ${tenantName}
- Landlord: ${landlordName || 'your landlord'}
- Amount due: ${currency || 'UGX'} ${Number(amountDue).toLocaleString()}
- Rent due day: ${dueDay ? `${dueDay}th of every month` : 'start of month'}
- Property: ${propertyAddress || 'the property'}
- Today's date: ${today}
${daysOverdue && daysOverdue > 0 ? `- Payment is OVERDUE by ${daysOverdue} day(s) — be politely firm` : '- Payment is upcoming — be friendly and remind them'}

Write only the message text, ready to send via WhatsApp or SMS.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const message = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('AI Reminders Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate reminder message' },
      { status: 500 }
    );
  }
}
