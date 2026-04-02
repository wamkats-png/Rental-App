import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/app/lib/supabase-server'
import { validateMoveIn } from '@/app/lib/validation/unitValidation'

// ─── Request body schema ──────────────────────────────────────────────────────

const CreateLeaseSchema = z.object({
  property_id:              z.string().uuid('Invalid property'),
  unit_id:                  z.string().uuid('Invalid unit'),
  tenant_id:                z.string().uuid('Invalid tenant'),
  contract_type:            z.enum(['Residential', 'Commercial', 'Other']),
  rent_amount:              z.number().positive('Rent must be greater than 0'),
  payment_frequency:        z.enum(['Monthly', 'Quarterly', 'Yearly']),
  currency:                 z.string().default('UGX'),
  start_date:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be YYYY-MM-DD'),
  end_date:                 z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be YYYY-MM-DD'),
  due_day:                  z.number().int().min(1).max(31).default(1),
  grace_period_days:        z.number().int().min(0).max(60).default(5),
  deposit_amount:           z.number().min(0).default(0),
  utilities_responsibility: z.enum(['Landlord', 'Tenant', 'Shared']).default('Tenant'),
  notice_period_days:       z.number().int().min(0).default(30),
  status:                   z.enum(['Draft', 'Pending_tenant_signature', 'Pending_landlord_signature', 'Active', 'Terminated']).default('Draft'),
  late_fee_type:            z.enum(['percentage', 'flat']).optional(),
  late_fee_rate:            z.number().min(0).optional(),
  escalation_rate:          z.number().min(0).optional(),
  escalation_frequency:     z.enum(['Yearly', '2 Years']).optional(),
  next_review_date:         z.string().optional(),
  // Optional: if set, the old lease is terminated after the new one is created
  renewing_from_id:         z.string().uuid().optional(),
})

type CreateLeaseInput = z.infer<typeof CreateLeaseSchema>

// ─── POST /api/leases ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // 1. Authenticate
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // 2. Parse + validate body shape
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateLeaseSchema.safeParse(body)
  if (!parsed.success) {
    const messages = parsed.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
    return NextResponse.json({ error: 'Validation failed', details: messages }, { status: 400 })
  }

  const data: CreateLeaseInput = parsed.data

  // 3. Date logic: end_date must be after start_date
  if (new Date(data.end_date) <= new Date(data.start_date)) {
    return NextResponse.json({ error: 'end_date must be after start_date' }, { status: 400 })
  }

  // 4. Ownership check: property must belong to this landlord
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', data.property_id)
    .eq('landlord_id', user.id)
    .single()

  if (propError || !property) {
    return NextResponse.json({ error: 'Property not found or access denied' }, { status: 403 })
  }

  // 5. Unit + rent validation (the fixed isUnitAvailable logic)
  //    Skip availability check when editing (status != Active) or renewing
  //    — only enforce on fresh Active lease creations.
  if (data.status === 'Active') {
    const moveInCheck = await validateMoveIn(data.unit_id, data.rent_amount)
    if (!moveInCheck.ok) {
      return NextResponse.json({ error: moveInCheck.reason }, { status: 409 })
    }
    // Use the sanitized (comma-stripped, integer-coerced) rent value
    if (moveInCheck.sanitizedRent !== undefined) {
      data.rent_amount = moveInCheck.sanitizedRent
    }
  }

  // 6. Insert the lease
  const { data: lease, error: leaseError } = await supabase
    .from('leases')
    .insert({
      landlord_id:              user.id,
      property_id:              data.property_id,
      unit_id:                  data.unit_id,
      tenant_id:                data.tenant_id,
      contract_type:            data.contract_type,
      rent_amount:              data.rent_amount,
      payment_frequency:        data.payment_frequency,
      currency:                 data.currency,
      start_date:               data.start_date,
      end_date:                 data.end_date,
      due_day:                  data.due_day,
      grace_period_days:        data.grace_period_days,
      deposit_amount:           data.deposit_amount,
      utilities_responsibility: data.utilities_responsibility,
      notice_period_days:       data.notice_period_days,
      status:                   data.status,
      late_fee_type:            data.late_fee_type,
      late_fee_rate:            data.late_fee_rate,
      escalation_rate:          data.escalation_rate,
      escalation_frequency:     data.escalation_frequency,
      next_review_date:         data.next_review_date ?? null,
    })
    .select()
    .single()

  if (leaseError || !lease) {
    console.error('Lease insert error:', leaseError)
    return NextResponse.json({ error: 'Failed to create lease. Please try again.' }, { status: 500 })
  }

  // 7. If lease is Active, mark the unit as Occupied
  if (data.status === 'Active') {
    await supabase
      .from('units')
      .update({ status: 'Occupied' })
      .eq('id', data.unit_id)
  }

  // 8. If this is a renewal, terminate the old lease
  if (data.renewing_from_id) {
    const { error: terminateError } = await supabase
      .from('leases')
      .update({ status: 'Terminated' })
      .eq('id', data.renewing_from_id)
      .eq('landlord_id', user.id)   // ownership guard

    if (terminateError) {
      // Non-fatal: lease was created; log but don't roll back
      console.error('Failed to terminate old lease during renewal:', terminateError)
    }
  }

  return NextResponse.json({ success: true, lease }, { status: 201 })
}

// ─── GET /api/leases ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const unitId = searchParams.get('unit_id')

  let query = supabase
    .from('leases')
    .select('*')
    .eq('landlord_id', user.id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (unitId) query = query.eq('unit_id', unitId)

  const { data: leases, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ leases })
}
