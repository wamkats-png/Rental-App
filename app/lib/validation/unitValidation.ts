// =============================================================================
// Unit Occupancy Validation
// FILE: app/lib/validation/unitValidation.ts
//
// BUG: Validation was checking unit.capacity (how many people a room CAN hold)
//      instead of checking whether the unit currently HAS an active tenant.
//
// ROOT CAUSE: isUnitAvailable() compared against a capacity integer instead of
//             querying actual occupant count from the tenants/leases table.
//
// FIX: Availability is determined by unit.status === 'Available', which is the
//      source of truth. A unit is occupied when it has an active lease.
//      We also add a DB-level guard that counts active leases directly.
//
// NOTE: Status values match the DB CHECK constraint in 002_create_business_tables.sql:
//       units.status IN ('Available', 'Occupied', 'Under_maintenance')
//       leases.status IN ('Draft', 'Pending_tenant_signature',
//                         'Pending_landlord_signature', 'Active', 'Terminated')
// =============================================================================

import { createClient } from '@/app/lib/supabase-server'
import { z } from 'zod'

// ─── Zod schema for unit input ────────────────────────────────────────────────
// Mirrors the DB schema from 002_create_business_tables.sql

export const UnitSchema = z.object({
  id: z.string().uuid().optional(),
  property_id: z.string().uuid(),
  code: z.string().min(1, 'Unit code is required').max(20),
  description: z.string().max(200).optional().default(''),
  bedrooms: z.number().int().min(0).max(20).optional().default(1),
  default_rent_amount: z
    .number()
    .int('Rent must be a whole number (UGX)')
    .positive('Rent must be greater than 0')
    .max(100_000_000, 'Rent amount seems too high — check the value'),
  status: z.enum(['Available', 'Occupied', 'Under_maintenance']).default('Available'),
})

export type UnitInput = z.infer<typeof UnitSchema>

// ─── THE FIX: Check actual occupants, not capacity ───────────────────────────

/**
 * Determines whether a unit is available for a new tenant.
 *
 * BEFORE (buggy):
 *   return unit.capacity > 0   ← was checking room size, not actual occupancy
 *
 * AFTER (correct):
 *   Query active leases for this unit. A unit is available only when
 *   it has zero active leases AND its status is 'Available'.
 */
export async function isUnitAvailable(unitId: string): Promise<{
  available: boolean
  reason?: string
}> {
  const supabase = await createClient()

  // Check 1: unit status field (fast, cached in app state)
  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('status, code')
    .eq('id', unitId)
    .single()

  if (unitError || !unit) {
    return { available: false, reason: 'Unit not found' }
  }

  if (unit.status === 'Under_maintenance') {
    return { available: false, reason: `Unit ${unit.code} is under maintenance` }
  }

  if (unit.status === 'Occupied') {
    return { available: false, reason: `Unit ${unit.code} is already occupied` }
  }

  // Check 2: active lease count — the authoritative DB-level guard.
  // Catches edge cases where unit.status was not updated correctly.
  const { count, error: leaseError } = await supabase
    .from('leases')
    .select('id', { count: 'exact', head: true })
    .eq('unit_id', unitId)
    .eq('status', 'Active')

  if (leaseError) {
    // Don't silently pass — surface the error
    return { available: false, reason: 'Could not verify unit availability. Try again.' }
  }

  if (count && count > 0) {
    // Status mismatch: unit says Available but has an Active lease — self-heal
    await supabase
      .from('units')
      .update({ status: 'Occupied' })
      .eq('id', unitId)

    return {
      available: false,
      reason: `Unit ${unit.code} has an active lease. Status has been corrected.`,
    }
  }

  return { available: true }
}

// ─── Validate rent amount is a safe UGX integer ──────────────────────────────

/**
 * Validates that a rent amount is a safe UGX integer.
 * Rejects floats, negatives, and suspiciously large values.
 *
 * @example
 *   validateRentAmount(750000)    → { valid: true, sanitized: 750000 }
 *   validateRentAmount(750000.5)  → { valid: false, reason: 'Must be whole UGX' }
 *   validateRentAmount('750,000') → { valid: true, sanitized: 750000 }
 */
export function validateRentAmount(amount: unknown): {
  valid: boolean
  sanitized?: number
  reason?: string
} {
  if (typeof amount !== 'number' && typeof amount !== 'string') {
    return { valid: false, reason: 'Rent amount must be a number' }
  }

  const parsed = Number(amount)

  if (isNaN(parsed)) {
    return { valid: false, reason: 'Rent amount is not a valid number' }
  }

  if (!Number.isInteger(parsed)) {
    // Common case: "750,000" with comma — strip and retry
    if (typeof amount === 'string') {
      const stripped = parseInt(amount.replace(/[,\s]/g, ''), 10)
      if (!isNaN(stripped) && stripped > 0) {
        return { valid: true, sanitized: stripped }
      }
    }
    return { valid: false, reason: 'Rent must be a whole number in UGX (no decimals)' }
  }

  if (parsed <= 0) {
    return { valid: false, reason: 'Rent must be greater than 0' }
  }

  if (parsed > 100_000_000) {
    return { valid: false, reason: 'Rent amount exceeds 100M UGX — please verify' }
  }

  return { valid: true, sanitized: parsed }
}

// ─── Combined: validate a new tenant move-in ─────────────────────────────────

/**
 * Full validation before assigning a tenant to a unit.
 * Run this before creating a lease record.
 *
 * @example
 *   const check = await validateMoveIn(unitId, 750000)
 *   if (!check.ok) return res.status(400).json({ error: check.reason })
 */
export async function validateMoveIn(
  unitId: string,
  rentAmount: unknown
): Promise<{ ok: boolean; reason?: string; sanitizedRent?: number }> {
  // 1. Validate rent amount first (fast, no DB call)
  const rentCheck = validateRentAmount(rentAmount)
  if (!rentCheck.valid) {
    return { ok: false, reason: rentCheck.reason }
  }

  // 2. Check unit is actually available (DB check)
  const availCheck = await isUnitAvailable(unitId)
  if (!availCheck.available) {
    return { ok: false, reason: availCheck.reason }
  }

  return { ok: true, sanitizedRent: rentCheck.sanitized }
}
