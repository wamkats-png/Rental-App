import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TENANT_SCHEMA = `{
  full_name: string (required — tenant's full name),
  phone: string (required — Uganda phone, e.g. +256700000001 or 0700000001),
  email: string (optional),
  national_id: string (required — Uganda NIN, e.g. CM900000001001 or CF900000002002),
  address: string (optional — physical address),
  comm_preference: "WhatsApp" | "Email" | "SMS" (optional, default "WhatsApp")
}`;

const PROPERTY_SCHEMA = `{
  name: string (required — property name or identifier),
  address: string (required — physical address or plot number),
  district: string (required — Uganda district, e.g. Kampala, Wakiso, Entebbe),
  lc_area: string (optional — LC1/LC2 area name),
  property_type: "Residential" | "Commercial" | "Mixed" (optional, default "Residential"),
  property_rates_ref: string (optional — local authority rates reference number)
}`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured.' },
        { status: 500 }
      );
    }

    const { text, type } = await req.json();
    if (!text || !type) {
      return NextResponse.json({ error: 'text and type are required.' }, { status: 400 });
    }
    if (type !== 'tenants' && type !== 'properties') {
      return NextResponse.json({ error: 'type must be "tenants" or "properties".' }, { status: 400 });
    }

    const schema = type === 'tenants' ? TENANT_SCHEMA : PROPERTY_SCHEMA;
    const entityName = type === 'tenants' ? 'tenant' : 'property';

    // Cap input to stay well within token limits
    const truncatedText = text.slice(0, 12000);

    const prompt = `You are a data import assistant for RentFlow Uganda, a property management app for Ugandan landlords.

The user has uploaded a file to import ${entityName} records. The file may use any format or column naming convention — CSV, TSV, semicolon-delimited, or even a messy spreadsheet export.

Your job:
1. Detect the delimiter (comma, tab, semicolon, pipe, etc.)
2. Parse all data rows (skip header rows, skip blank rows)
3. Map each column to the target schema using your best judgment:
   - "Tenant Name", "Name", "Full Name" → full_name
   - "Mobile", "Tel", "Phone Number", "Contact" → phone
   - "NIN", "National ID", "ID Number" → national_id
   - "Location", "Home", "Residence" → address
   - "Property Name", "Building", "Estate" → name
   - "Area", "Zone", "Locality" → lc_area
   - etc.
4. Validate each row: mark errors[] for any missing required fields
5. Return ONLY a raw JSON array — no markdown, no code fences, no explanation

Target schema for each ${entityName}:
${schema}

Output format (JSON array, one object per row):
[
  {
    ${type === 'tenants'
      ? '"full_name": "...", "phone": "...", "email": "...", "national_id": "...", "address": "...", "comm_preference": "WhatsApp"'
      : '"name": "...", "address": "...", "district": "...", "lc_area": "...", "property_type": "Residential", "property_rates_ref": ""'
    },
    "errors": []
  }
]

If a required field is missing or empty, add a descriptive message to errors[].
Do NOT invent data — leave fields empty string "" if not present in the source.

Raw file content to parse:
\`\`\`
${truncatedText}
\`\`\`

Return ONLY the JSON array. Absolutely no markdown, no explanation, no code fences.`;

    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
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

    const rawText = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';

    // Strip markdown code fences if Claude added them despite instructions
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed: unknown[];
    try {
      parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error('Not an array');
    } catch {
      return NextResponse.json(
        { error: 'AI returned an unexpected format. Please try again or use standard CSV import.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, rows: parsed });
  } catch (error: any) {
    console.error('AI Import Error:', error);
    return NextResponse.json(
      { error: error.message || 'AI import failed. Please try again.' },
      { status: 500 }
    );
  }
}
