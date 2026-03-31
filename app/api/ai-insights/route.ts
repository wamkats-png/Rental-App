import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Add ANTHROPIC_API_KEY to your .env file.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { messages, financialData } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required.' }, { status: 400 });
    }

    // Serialize financial data into a readable context string (capped to stay within token limits)
    const { payments = [], leases = [], properties = [], maintenance = [], landlordName = 'the landlord' } = financialData ?? {};

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // Summarize payments
    const totalRevenue = payments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
    const thisMonthPayments = payments.filter((p: any) => {
      const d = new Date(p.date);
      return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
    });
    const thisMonthRevenue = thisMonthPayments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);

    // Summarize by property
    const revenueByProperty: Record<string, number> = {};
    for (const p of payments) {
      const prop = properties.find((pr: any) => pr.id === p.property_id);
      const name = prop?.name ?? 'Unknown';
      revenueByProperty[name] = (revenueByProperty[name] ?? 0) + (p.amount ?? 0);
    }

    // Maintenance totals
    const totalMaintenance = maintenance.reduce((s: number, m: any) => s + (m.cost ?? 0), 0);
    const maintenanceByCategory: Record<string, number> = {};
    for (const m of maintenance) {
      maintenanceByCategory[m.category] = (maintenanceByCategory[m.category] ?? 0) + (m.cost ?? 0);
    }

    // Active leases and overdue detection
    const activeLeases = leases.filter((l: any) => l.status === 'Active');
    const overdueInfo: string[] = [];
    for (const lease of activeLeases) {
      const dueDay = lease.due_day ?? 1;
      const dueThisMonth = new Date(currentYear, today.getMonth(), dueDay);
      if (today > dueThisMonth) {
        const paidThisMonth = payments.some((p: any) => {
          if (p.lease_id !== lease.id) return false;
          const pd = new Date(p.date);
          return pd.getFullYear() === currentYear && pd.getMonth() + 1 === currentMonth;
        });
        if (!paidThisMonth) {
          const daysOverdue = Math.floor((today.getTime() - dueThisMonth.getTime()) / (1000 * 60 * 60 * 24));
          overdueInfo.push(`  - Lease ${lease.id.substring(0, 8)}: UGX ${(lease.rent_amount ?? 0).toLocaleString()} (${daysOverdue} days overdue)`);
        }
      }
    }

    // Uganda fiscal year (Jul–Jun)
    const fiscalYearStart = currentMonth >= 7 ? currentYear : currentYear - 1;
    const fiscalStart = new Date(fiscalYearStart, 6, 1);
    const fiscalPayments = payments.filter((p: any) => new Date(p.date) >= fiscalStart);
    const fiscalRevenue = fiscalPayments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
    const estimatedTax = Math.max(0, (fiscalRevenue - 2820000) * 0.12);

    const contextSummary = `
LANDLORD FINANCIAL SNAPSHOT — ${today.toDateString()}
Landlord: ${landlordName}

REVENUE:
- Total all-time: UGX ${totalRevenue.toLocaleString()}
- This month (${today.toLocaleString('default', { month: 'long' })} ${currentYear}): UGX ${thisMonthRevenue.toLocaleString()}
- Current fiscal year (Jul ${fiscalYearStart} – Jun ${fiscalYearStart + 1}): UGX ${fiscalRevenue.toLocaleString()}

REVENUE BY PROPERTY:
${Object.entries(revenueByProperty).map(([k, v]) => `  - ${k}: UGX ${v.toLocaleString()}`).join('\n') || '  (no data)'}

LEASES:
- Total active leases: ${activeLeases.length}
- Total leases: ${leases.length}

OVERDUE PAYMENTS (${overdueInfo.length}):
${overdueInfo.length > 0 ? overdueInfo.join('\n') : '  None — all tenants are up to date'}

MAINTENANCE COSTS:
- Total: UGX ${totalMaintenance.toLocaleString()}
- By category: ${Object.entries(maintenanceByCategory).map(([k, v]) => `${k}: UGX ${v.toLocaleString()}`).join(', ') || 'none'}

TAX ESTIMATE (Uganda Individual Rate):
- Taxable income (fiscal year): UGX ${fiscalRevenue.toLocaleString()}
- Estimated tax @ 12% above UGX 2,820,000: UGX ${estimatedTax.toLocaleString()}

TOTAL PAYMENTS RECORDED: ${payments.length}
`;

    const systemPrompt = `You are a smart financial advisor assistant for ${landlordName}, a landlord in Uganda using RentFlow Uganda — a property management app.

Answer questions clearly and concisely about their rental portfolio using the data below.
Always use UGX for amounts. Be specific with numbers from the data. If you don't have the data to answer precisely, say so honestly.
Keep responses under 200 words unless a detailed breakdown is requested.

${contextSummary}`;

    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          system: systemPrompt,
          messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
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

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({ success: true, reply });
  } catch (error: any) {
    console.error('AI Insights Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get AI insights' },
      { status: 500 }
    );
  }
}
