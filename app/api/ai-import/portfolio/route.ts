import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PORTFOLIO_PROMPT = (filename: string, text: string) => `You are a property portfolio data extraction expert for RentFlow Uganda, a rental management platform for Ugandan landlords.

The user uploaded: "${filename}"

Your task: Extract ALL rental data across every section/sheet/table in this file and return it as structured JSON.

Return this exact shape (no markdown, no code fences, raw JSON only):
{
  "summary": "2-3 sentence human-friendly description of what you found (property names, unit counts, tenant count, payment history scope, total arrears if visible)",
  "properties": [
    {
      "name": "string — property/building name (required)",
      "address": "string — plot number or street address",
      "district": "string — Uganda district e.g. Kampala, Wakiso",
      "lc_area": "string — LC1/LC2 area or zone",
      "property_type": "Residential | Commercial | Mixed"
    }
  ],
  "units": [
    {
      "property_name": "string — must match a property name above (required)",
      "code": "string — unit identifier e.g. A1, Room 3, Unit 101 (required)",
      "description": "string — unit description",
      "bedrooms": 1,
      "default_rent_amount": 0,
      "status": "Available | Occupied | Under_maintenance"
    }
  ],
  "tenants": [
    {
      "full_name": "string — tenant full name (required)",
      "phone": "string — phone number with country code if available",
      "national_id": "string — NIN or national ID",
      "address": "string — tenant home address",
      "unit_code": "string — unit code this tenant occupies",
      "property_name": "string — property name this tenant is in",
      "comm_preference": "WhatsApp | SMS | Email"
    }
  ],
  "payments": [
    {
      "tenant_name": "string — must match a tenant full_name above",
      "unit_code": "string — unit code",
      "property_name": "string — property name",
      "amount": 0,
      "date": "YYYY-MM-DD",
      "method": "Cash | Mobile_Money | Bank",
      "period_start": "YYYY-MM-01",
      "period_end": "YYYY-MM-28"
    }
  ]
}

Rules:
- Leave fields as empty string "" or 0 if data is not present — do NOT invent data
- property_name in units/tenants/payments must exactly match a name in the properties array
- Extract EVERY payment row you can find (each month for each tenant is a separate payment object)
- For unit status: if a tenant is assigned to the unit, set status to "Occupied"; otherwise "Available"
- For payments: infer the month from column headers or row context; use first day of month for period_start and last day for period_end
- district defaults to "Kampala" if Uganda district is not specified
- comm_preference defaults to "WhatsApp" if not specified
- If you see arrears/balance due, extract those as payment records with a note in the method field or skip — do not fabricate dates

File content:
\`\`\`
${text.slice(0, 18000)}
\`\`\`

Return ONLY the JSON object. No markdown. No explanation. No code fences.`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured.' }, { status: 500 });
    }

    const { text, filename } = await req.json();
    if (!text) {
      return NextResponse.json({ error: 'text is required.' }, { status: 400 });
    }

    const prompt = PORTFOLIO_PROMPT(filename || 'uploaded file', text);

    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          messages: [{ role: 'user', content: prompt }],
        });
        break;
      } catch (e: any) {
        const isOverloaded = e?.status === 529 || e?.message?.includes('overloaded');
        if (isOverloaded && attempt < 2) {
          await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    if (!response) throw new Error('API unavailable after retries');

    const rawText = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';

    // Strip markdown code fences
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Not an object');
    } catch {
      return NextResponse.json(
        { error: 'AI returned an unexpected format. Please try again.' },
        { status: 500 }
      );
    }

    // Normalize and validate arrays
    const result = {
      summary: (parsed.summary as string) || 'Portfolio data extracted.',
      properties: Array.isArray(parsed.properties) ? parsed.properties : [],
      units: Array.isArray(parsed.units) ? parsed.units : [],
      tenants: Array.isArray(parsed.tenants) ? parsed.tenants : [],
      payments: Array.isArray(parsed.payments) ? parsed.payments : [],
    };

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Portfolio Import Error:', error);
    return NextResponse.json(
      { error: error.message || 'Portfolio import failed. Please try again.' },
      { status: 500 }
    );
  }
}
