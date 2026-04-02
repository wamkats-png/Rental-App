// =============================================================================
// In-memory sliding window rate limiter
// FILE: app/lib/rateLimit.ts
//
// No external dependency. Works per Vercel serverless instance.
// To scale across multiple instances: swap `store` for Upstash Redis.
// =============================================================================

export interface RateLimitConfig {
  windowMs:   number  // time window in ms
  max:        number  // max requests in window
  identifier: string  // e.g. userId, `${userId}:hourly`, `ip:${ip}`
}

interface WindowEntry {
  count:   number
  resetAt: number
}

// In-memory store — resets on cold start (acceptable for serverless)
const store = new Map<string, WindowEntry>()

export function rateLimit(config: RateLimitConfig): {
  success:      boolean
  remaining:    number
  resetAt:      number
  retryAfterMs: number
} {
  const now = Date.now()
  const key = `rl:${config.identifier}`
  const entry = store.get(key)

  // First request or window expired — reset counter
  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs
    store.set(key, { count: 1, resetAt })
    return { success: true, remaining: config.max - 1, resetAt, retryAfterMs: 0 }
  }

  // Window full
  if (entry.count >= config.max) {
    return {
      success:      false,
      remaining:    0,
      resetAt:      entry.resetAt,
      retryAfterMs: entry.resetAt - now,
    }
  }

  // Increment
  entry.count++
  store.set(key, entry)
  return {
    success:      true,
    remaining:    config.max - entry.count,
    resetAt:      entry.resetAt,
    retryAfterMs: 0,
  }
}

/** Helper: returns a 429 NextResponse with standard headers */
export function rateLimitResponse(retryAfterMs: number, message?: string) {
  const { NextResponse } = require('next/server') as typeof import('next/server')
  return NextResponse.json(
    {
      error: message ?? 'Too many requests. Please wait before trying again.',
      retryAfterMs,
    },
    {
      status: 429,
      headers: {
        'Retry-After':          String(Math.ceil(retryAfterMs / 1000)),
        'X-RateLimit-Remaining': '0',
      },
    }
  )
}

// Purge stale entries every 5 min — prevents memory leak in long-running containers
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    store.forEach((entry, key) => {
      if (now > entry.resetAt) store.delete(key)
    })
  }, 5 * 60 * 1000)
}
