/**
 * decisionAgent.js — Autonomous decision engine for RentFlow build execution
 * Resolves architectural, stack, and implementation questions without human input.
 */

const RENTFLOW_STACK = {
  database: {
    answer: "Supabase (PostgreSQL)",
    reason: "Already integrated. RLS enforced. Relational integrity for financial data.",
  },
  authentication: {
    answer: "Supabase Auth (existing integration)",
    reason: "Already in codebase. JWT handled automatically. No new auth library needed.",
  },
  payments: {
    answer: "MTN Mobile Money + Airtel Money (UGX integers only)",
    reason: "Uganda-specific payment rails. Amounts stored as integers — never floats.",
  },
  sms: {
    answer: "Africa's Talking",
    reason: "Best SMS coverage in Uganda. Reliable delivery. Already scoped in Phase 3.",
  },
  deployment: {
    answer: "Vercel",
    reason: "Optimized for Next.js. Zero-config deployments. Authorized email: wamkats@gmail.com.",
  },
  storage: {
    answer: "Supabase Storage",
    reason: "Already in stack. Integrated with auth and RLS. No extra service needed.",
  },
  email: {
    answer: "Resend (wamkats@gmail.com as sender identity)",
    reason: "Developer-friendly. Reliable. Minimal config. Pre-authorized email available.",
  },
  charting: {
    answer: "Recharts",
    reason: "Lightweight. React-native. No extra bundle cost. Good for dashboard use cases.",
  },
  pdf: {
    answer: "jsPDF or @react-pdf/renderer",
    reason: "Client-side generation. No server costs. Works for tax PDFs and reports.",
  },
  dates: {
    answer: "date-fns",
    reason: "Lightweight, tree-shakeable. Uganda fiscal year: July–June. No moment.js bloat.",
  },
  state: {
    answer: "Zustand for global state, React Context for component-scoped state",
    reason: "Simple. TypeScript-friendly. No boilerplate. Consistent with Next.js App Router.",
  },
  forms: {
    answer: "React Hook Form + Zod",
    reason: "Type-safe validation. Minimal re-renders. Zod schemas reusable as API validators.",
  },
  styling: {
    answer: "TailwindCSS (existing setup)",
    reason: "Already configured. Mobile-first. Consistent with existing components.",
  },
}

const DELETION_KEYWORDS = ["delete", "remove", "drop", "clear", "purge", "truncate", "wipe", "destroy", "rm", "unlink"]

const SAFETY_KEYWORDS = ["backup", "archive", "restore", "rollback", "undo"]

/**
 * Main decision resolver.
 * @param {string} question - The question or prompt from Claude Code
 * @param {object} context - Optional context (current phase, file, etc.)
 * @returns {{ answer: string, reason: string, blocked?: boolean }}
 */
const decide = async (question, context = {}) => {
  const q = question.toLowerCase()

  // ── Safety override: detect destructive intent ────────────────────────────
  const isDestructive = DELETION_KEYWORDS.some((kw) => q.includes(kw))

  if (isDestructive) {
    return {
      answer: "Do not delete. Archive or soft-delete instead.",
      reason: "Non-destructive policy enforced. Use archiveFile() or set is_deleted=true.",
      blocked: true,
      action: "Archive deprecated files. Flag DB records with is_deleted=true, deleted_at=now().",
    }
  }

  // ── Stack decisions ───────────────────────────────────────────────────────
  for (const [keyword, resolution] of Object.entries(RENTFLOW_STACK)) {
    if (q.includes(keyword)) {
      return resolution
    }
  }

  // ── Phase-specific decisions ──────────────────────────────────────────────
  if (q.includes("dark mode")) {
    return {
      answer: "Use next-themes with system preference detection. Store preference in localStorage.",
      reason: "next-themes is the standard for Next.js. Supports SSR without flash.",
    }
  }

  if (q.includes("tax") || q.includes("uganda") || q.includes("fiscal")) {
    return {
      answer: "Uganda fiscal year: July 1 – June 30. Tax rates: 12% individual, 30% company.",
      reason: "Uganda Revenue Authority tax calendar. Apply correct rate based on landlord entity type.",
    }
  }

  if (q.includes("currency") || q.includes("money") || q.includes("ugx")) {
    return {
      answer: "Store all amounts as integers (UGX has no decimal). Display with UGX prefix and comma separators.",
      reason: "Floating point is unsafe for financial data. UGX does not use sub-unit denominations.",
    }
  }

  if (q.includes("rls") || q.includes("row level") || q.includes("permission")) {
    return {
      answer: "Always enable RLS on every table. Write policies for owner, manager, and viewer roles.",
      reason: "Multi-tenant security. Every query must be scoped to the authenticated user's data.",
    }
  }

  if (q.includes("migration") || q.includes("schema")) {
    return {
      answer: "Create numbered migration file in /supabase/migrations/. Include rollback SQL.",
      reason: "Supabase migration convention. Reversible schema changes only.",
    }
  }

  if (q.includes("test") || q.includes("testing")) {
    return {
      answer: "Unit test utilities with Jest. Integration test API routes. Smoke test features manually before marking done.",
      reason: "Quality gate requirement. No phase is complete without passing tests.",
    }
  }

  if (q.includes("mobile") || q.includes("responsive")) {
    return {
      answer: "Mobile-first. Minimum width 360px. TailwindCSS responsive prefixes: sm: md: lg:",
      reason: "Ugandan users are primarily mobile. Design for phone first.",
    }
  }

  if (q.includes("error") || q.includes("loading") || q.includes("empty state")) {
    return {
      answer: "All async components need: loading skeleton, error boundary with retry, empty state with action CTA.",
      reason: "Quality standard. No blank screens. Every state must be handled explicitly.",
    }
  }

  if (q.includes("cron") || q.includes("schedule") || q.includes("reminder")) {
    return {
      answer: "Use Vercel Cron Jobs (vercel.json config). Supabase Edge Functions as alternative.",
      reason: "No extra service needed. Vercel Cron is free on Pro tier and integrates with deployment.",
    }
  }

  // ── Fallback: apply best practice default ────────────────────────────────
  return {
    answer: "Proceed with established codebase pattern and Next.js 14 App Router conventions.",
    reason: "No specific rule matched. Defaulting to existing patterns for consistency.",
  }
}

module.exports = { decide }
