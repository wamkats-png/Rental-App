import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/app/lib/supabase-server';
import { rateLimit, rateLimitResponse } from '@/app/lib/rateLimit';

const SYSTEM_PROMPT = `You are a Ugandan property rental contract specialist. You help landlords create and extract information from rental/tenancy agreements under Ugandan law.

When given a description or image of a contract, extract or generate the following structured data:
- tenant_name: Full name of the tenant
- landlord_name: Full name of the landlord (if available)
- property_address: Property location/address
- unit_description: Unit or room description (if available)
- rent_amount: Monthly rent in UGX (number only, no formatting)
- payment_frequency: "Monthly", "Quarterly", or "Yearly"
- currency: Default "UGX"
- start_date: Lease start date in YYYY-MM-DD format
- end_date: Lease end date in YYYY-MM-DD format
- deposit_amount: Security deposit in UGX (number only, 0 if not specified)
- due_day: Day of month rent is due (number 1-28, default 1)
- grace_period_days: Grace period in days (default 5)
- utilities_responsibility: "Landlord", "Tenant", or "Shared"
- notice_period_days: Notice period in days (default 30)
- contract_type: "Residential", "Commercial", or "Other"
- special_terms: Any special conditions or clauses (string)
- contract_html: A compact HTML tenancy agreement (NO inline styles, NO style tags, plain semantic HTML only)

For contract_html, generate a concise but complete tenancy agreement using ONLY these tags: <h1>, <h2>, <p>, <ol>, <li>, <strong>, <br>. No CSS, no style attributes, no class attributes.

Include these sections (keep each section brief — 2-5 sentences or bullet points):
1. Title "TENANCY AGREEMENT" and date
2. Parties: Landlord and Tenant names
3. Property address and unit
4. Lease term (start/end dates)
5. Rent: amount, frequency, due date, payment methods (Cash, Mobile Money, Bank Transfer)
6. Security deposit amount and return conditions
7. Utilities responsibility
8. Tenant obligations (4-5 key points as a list)
9. Landlord obligations (3-4 key points as a list)
10. Termination and notice period
11. Governing law: Laws of the Republic of Uganda
12. Signature blocks with date lines for both parties and a witness

If information is missing, use reasonable Uganda defaults (30-day notice, tenant pays utilities) and note assumptions in special_terms.

IMPORTANT: Always respond with valid JSON only. No markdown, no extra text, no code fences. Keep contract_html under 2000 words.`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Add ANTHROPIC_API_KEY to your .env.local file.' },
        { status: 500 }
      );
    }

    // Auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // 5 requests / minute (contract generation is expensive — 8k tokens)
    const perMin = rateLimit({ identifier: `contract:${user.id}`, max: 5, windowMs: 60_000 });
    if (!perMin.success) return rateLimitResponse(perMin.retryAfterMs, 'Generating contracts too quickly. Please wait before trying again.');

    // 20 requests / hour
    const perHour = rateLimit({ identifier: `contract:${user.id}:hr`, max: 20, windowMs: 3_600_000 });
    if (!perHour.success) return rateLimitResponse(perHour.retryAfterMs, 'Hourly contract limit reached. Your limit resets in 1 hour.');

    const body = await req.json();
    const { mode, text, imageBase64 } = body;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let userContent: Anthropic.MessageParam['content'];

    if (mode === 'image' && imageBase64) {
      // Strip the data URL prefix to get raw base64 and media type
      const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return NextResponse.json({ error: 'Invalid image format.' }, { status: 400 });
      }
      const mediaType = matches[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      const base64Data = matches[2];

      userContent = [
        {
          type: 'text',
          text: 'Extract all contract/lease information from this image of a physical rental contract. Return the structured JSON with all fields including a generated contract_html based on the extracted information.',
        },
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64Data },
        },
      ];
    } else if (mode === 'text' && text) {
      userContent = `Generate a complete rental contract from this description: "${text}"\n\nReturn structured JSON with all fields including contract_html.`;
    } else {
      return NextResponse.json(
        { error: 'Please provide either a text description or an image.' },
        { status: 400 }
      );
    }

    // Retry up to 3 times on overload (529) with exponential backoff
    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        });
        break;
      } catch (e: any) {
        const isOverloaded = e?.status === 529 || e?.message?.includes('overloaded');
        if (isOverloaded && attempt < 2) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    if (!response) throw new Error('API unavailable after retries');

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    // Strip any accidental markdown code fences before parsing
    let cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // If response was truncated (hit token limit), rescue the JSON
    if (response.stop_reason === 'max_tokens') {
      const htmlFieldIdx = cleaned.indexOf('"contract_html"');
      if (htmlFieldIdx !== -1) {
        // Truncated inside contract_html — strip the incomplete value and use a placeholder
        let base = cleaned.slice(0, htmlFieldIdx).trimEnd();
        if (base.endsWith(',')) base = base.slice(0, -1);
        cleaned = base + ',"contract_html":"<p><em>Contract preview was truncated. Please try again.</em></p>"}';
      } else {
        // Truncated before contract_html — close the JSON object cleanly
        cleaned = cleaned.trimEnd();
        if (cleaned.endsWith(',')) cleaned = cleaned.slice(0, -1);
        cleaned += ',"contract_html":"<p><em>Contract preview unavailable. Please try again.</em></p>"}';
      }
    }
    const parsed = JSON.parse(cleaned);

    // Sanitize contract_html: strip script tags and inline event handlers
    if (typeof parsed.contract_html === 'string') {
      parsed.contract_html = parsed.contract_html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<iframe[\s\S]*?>/gi, '')
        .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/javascript\s*:/gi, '');
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('AI Contract Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process contract' },
      { status: 500 }
    );
  }
}
