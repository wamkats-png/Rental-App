import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/app/lib/supabase-server'
import { rateLimit, rateLimitResponse } from '@/app/lib/rateLimit'

// ─── Request body schema — mirrors payments table in 002_create_business_tables.sql ──

const RecordPaymentSchema = z.object({
  tenant_id:              z.string().uuid('Invalid tenant'),
  lease_id:               z.string().uuid('Invalid lease'),
  property_id:            z.string().uuid('Invalid property'),
  unit_id:                z.string().uuid('Invalid unit'),
  amount:                 z.number().int('Amount must be whole UGX').positive().max(100_000_000),
  date:                   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  payment_method:         z.enum(['Cash', 'Mobile_Money', 'Bank']),
  period_start:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'period_start must be YYYY-MM-DD').optional(),
  period_end:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'period_end must be YYYY-MM-DD').optional(),
  withholding_tax_amount: z.number().min(0).default(0),
  receipt_number:         z.string().max(100).default(''),
})

// ─── POST /api/payments ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // 1. Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // 2. Rate limit: 30 payments / hour (enough for bulk entry; blocks abuse)
  const perHour = rateLimit({ identifier: `payments:${user.id}:hr`, max: 30, windowMs: 3_600_000 })
  if (!perHour.success) {
    return rateLimitResponse(perHour.retryAfterMs, 'Too many payment entries. Please wait before recording more.')
  }

  // 3. Parse + validate
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = RecordPaymentSchema.safeParse(body)
  if (!parsed.success) {
    const details = parsed.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
    return NextResponse.json({ error: 'Validation failed', details }, { status: 400 })
  }

  const data = parsed.data

  // 4. Ownership check: lease must belong to this landlord and be Active
  const { data: lease, error: leaseError } = await supabase
    .from('leases')
    .select('id, landlord_id, status')
    .eq('id', data.lease_id)
    .single()

  if (leaseError || !lease) {
    return NextResponse.json({ error: 'Lease not found' }, { status: 404 })
  }
  if (lease.landlord_id !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  if (lease.status !== 'Active') {
    return NextResponse.json({ error: 'Cannot record payment for an inactive lease' }, { status: 400 })
  }

  // 5. Insert payment (RLS also enforces landlord_id at DB level)
  const { data: payment, error: insertError } = await supabase
    .from('payments')
    .insert({
      landlord_id:            user.id,
      tenant_id:              data.tenant_id,
      lease_id:               data.lease_id,
      property_id:            data.property_id,
      unit_id:                data.unit_id,
      amount:                 data.amount,
      date:                   data.date,
      payment_method:         data.payment_method,
      period_start:           data.period_start ?? null,
      period_end:             data.period_end   ?? null,
      withholding_tax_amount: data.withholding_tax_amount,
      receipt_number:         data.receipt_number,
    })
    .select()
    .single()

  if (insertError || !payment) {
    console.error('Payment insert error:', insertError)
    return NextResponse.json({ error: 'Failed to record payment. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, payment }, { status: 201 })
}

// ─── GET /api/payments ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const leaseId   = searchParams.get('lease_id')
  const tenantId  = searchParams.get('tenant_id')
  const from      = searchParams.get('from')   // YYYY-MM-DD
  const to        = searchParams.get('to')     // YYYY-MM-DD

  let query = supabase
    .from('payments')
    .select('*')
    .eq('landlord_id', user.id)
    .order('date', { ascending: false })

  if (leaseId)  query = query.eq('lease_id', leaseId)
  if (tenantId) query = query.eq('tenant_id', tenantId)
  if (from)     query = query.gte('date', from)
  if (to)       query = query.lte('date', to)

  const { data: payments, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ payments })
}
