import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

let openai: OpenAI | null = null;
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

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
- contract_html: A full professional HTML contract document formatted for Uganda, including all terms

For the contract_html, generate a complete, professional tenancy agreement that includes:
1. Title: "TENANCY AGREEMENT"
2. Date and parties (Landlord and Tenant with full names)
3. Property description and address
4. Term of tenancy (start and end dates)
5. Rent amount, payment frequency, due date, and accepted payment methods (Cash, Mobile Money, Bank Transfer)
6. Security deposit terms
7. Utilities responsibility
8. Tenant obligations (maintain property, no subletting without consent, etc.)
9. Landlord obligations (structural repairs, quiet enjoyment, etc.)
10. Termination and notice period
11. Governing law: "Laws of the Republic of Uganda"
12. Signature blocks for both parties with date fields and witness lines

Use proper HTML formatting with <h1>, <h2>, <p>, <ol>, <li> tags. Style it professionally.

If information is missing from the user's input, use reasonable defaults for Uganda (e.g., standard 30-day notice, tenant pays utilities, etc.) but note what was assumed.

IMPORTANT: Always respond with valid JSON only. No markdown, no extra text.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, text, imageBase64 } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to your .env file.' },
        { status: 500 }
      );
    }

    let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (mode === 'image' && imageBase64) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all contract/lease information from this image of a physical rental contract. Return the structured JSON with all fields including a generated contract_html based on the extracted information.',
          },
          {
            type: 'image_url',
            image_url: { url: imageBase64, detail: 'high' },
          },
        ],
      });
    } else if (mode === 'text' && text) {
      messages.push({
        role: 'user',
        content: `Generate a complete rental contract from this description: "${text}"\n\nReturn structured JSON with all fields including contract_html.`,
      });
    } else {
      return NextResponse.json(
        { error: 'Please provide either text description or an image.' },
        { status: 400 }
      );
    }

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 4096,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    const parsed = JSON.parse(content);

    // Sanitize contract_html server-side: strip script tags and inline event handlers
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
