# RentFlow Uganda — Execution Plan
**Ordered: Easiest → Hardest**
Last updated: 2026-03-22

---

## PHASE 1 — Quick Wins & Bug Fixes
> Zero new dependencies. Targeted edits to existing files. Each task is 1–3 files.

### 1.1 Fix overdue payment calculation
- **File:** `app/page.tsx`, `app/reminders/page.tsx`
- **Problem:** Current logic uses `due_day + grace_period_days` without checking actual calendar days vs. current date.
- **Fix:** Calculate overdue by comparing `new Date(year, month-1, due_day + grace_period)` against `today`.
- **Effort:** ~30 min

### 1.2 Fix receipt number uniqueness
- **File:** `app/payments/page.tsx`
- **Problem:** `Math.random()` used to generate receipt numbers — not collision-safe.
- **Fix:** Use `Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase()` or better, a DB sequence.
- **Effort:** ~15 min

### 1.3 Fix "Clear Data" in Settings
- **File:** `app/settings/page.tsx`
- **Problem:** Only clears localStorage, not Supabase records.
- **Fix:** Add Supabase delete calls for all landlord-owned records before clearing cache. Add a strong confirmation modal (type "DELETE" to confirm).
- **Effort:** ~45 min

### 1.4 Add confirmation dialogs for destructive actions
- **Files:** `app/leases/page.tsx`, `app/properties/page.tsx`, `app/tenants/page.tsx`, `app/maintenance/page.tsx`, `app/payments/page.tsx`
- **Problem:** Status changes and deletes fire immediately.
- **Fix:** Wrap all delete/status-change actions in a reusable `<ConfirmModal>` component.
- **Effort:** ~1 hour

### 1.5 Move hardcoded values to Settings
- **Files:** `app/settings/page.tsx`, `app/payments/page.tsx`, `app/tax-reports/page.tsx`
- **Problem:** Withholding tax rate (6%), URA tax thresholds, and grace period defaults are hardcoded.
- **Fix:** Add a "Tax & Finance Settings" section to the Settings page. Store values in Supabase `landlords` table. Load them in payments and tax-reports pages.
- **Effort:** ~2 hours

### 1.6 Deduplicate overdue calculation logic
- **Files:** `app/page.tsx`, `app/reminders/page.tsx`
- **Fix:** Extract into `app/lib/utils.ts` as `getOverduePayments(leases, payments)`.
- **Effort:** ~20 min

### 1.7 Fix email & phone validation in forms
- **Files:** `app/tenants/page.tsx`, `app/settings/page.tsx`
- **Fix:** Add regex validation on blur. Show inline error messages.
- **Effort:** ~45 min

---

## PHASE 2 — UX Polish
> Improves experience without structural changes. Mostly additive.

### 2.1 Add loading skeletons to all pages
- **Files:** All `app/*/page.tsx` files
- **What:** Replace blank screens during data fetch with animated skeleton placeholders.
- **How:** Create a reusable `<Skeleton>` component. Apply on every page while `loading === true`.
- **Effort:** ~2 hours

### 2.2 Add error states to all pages
- **Files:** All `app/*/page.tsx` files
- **What:** Show an error card with retry button when Supabase calls fail.
- **How:** Add `error` state alongside `loading`. Wrap fetch in try/catch everywhere.
- **Effort:** ~1.5 hours

### 2.3 Add toast notification system
- **Files:** `app/components/Toast.tsx` (exists), `app/components/LayoutContent.tsx`
- **What:** Currently success/error feedback is inconsistent. Unify with toast notifications.
- **How:** Extend the existing `Toast.tsx` component into a global queue via context.
- **Effort:** ~1.5 hours

### 2.4 Reorganize the lease form into steps
- **File:** `app/leases/page.tsx`
- **What:** 14-field single modal → 3-step wizard (Basic Info → Financial Terms → Dates & Conditions).
- **Effort:** ~2 hours

### 2.5 Add pagination to all list pages
- **Files:** All `app/*/page.tsx`, `app/lib/database.ts`
- **What:** All records load at once. Add page controls (20 per page).
- **How:** Add `range()` to Supabase queries. Add `<Pagination>` component.
- **Effort:** ~3 hours

### 2.6 Improve mobile sidebar
- **Files:** `app/components/Sidebar.tsx`, `app/components/LayoutContent.tsx`
- **What:** No hamburger menu on mobile. Add slide-in drawer with overlay.
- **Effort:** ~2 hours

### 2.7 Add notification center
- **Files:** New `app/components/NotificationBell.tsx`, `app/components/Sidebar.tsx`
- **What:** Persistent inbox for: expiring leases, overdue payments, maintenance due.
- **How:** Derive notifications from existing data on load. Store dismissals in localStorage.
- **Effort:** ~3 hours

---

## PHASE 3 — Missing Core Features
> New pages and flows. Each requires UI + database + logic.

### 3.1 Tenant Applications page
- **Files:** New `app/applications/page.tsx`
- **What:** The sidebar shows a badge for pending applications but the page doesn't exist.
- **Features:** Application form (prospect name, desired unit, move-in date, notes), status (New / Reviewing / Approved / Rejected), convert to tenant on approval.
- **DB:** Uses existing `Application` type in `app/types/index.ts`.
- **Effort:** ~4 hours

### 3.2 Maintenance status workflow
- **File:** `app/maintenance/page.tsx`
- **What:** Add status field: `Reported → In Progress → Resolved`.
- **Also:** Add priority (Low / Medium / High / Urgent), estimated vs actual cost, resolution date.
- **Effort:** ~3 hours

### 3.3 Partial payment tracking
- **File:** `app/payments/page.tsx`
- **What:** Allow recording payments less than full rent. Show outstanding balance per tenant.
- **How:** Add `expected_amount` and `balance_due` derived from lease rent. Show balance badge on tenant row.
- **Effort:** ~3 hours

### 3.4 Payment schedule vs actuals view
- **File:** `app/payments/page.tsx` or new `app/payments/schedule/page.tsx`
- **What:** Calendar/table showing expected payment dates vs what was received. Highlight gaps.
- **Effort:** ~4 hours

### 3.5 Lease renewal workflow
- **File:** `app/leases/page.tsx`
- **What:** "Renew Lease" button on active leases nearing expiry. Pre-fills a new lease form from the current one. Archives old lease.
- **Effort:** ~3 hours

### 3.6 Vendor management
- **Files:** New `app/vendors/page.tsx`, update `app/maintenance/page.tsx`
- **What:** Add/edit/delete vendors (name, phone, speciality, rating). Link maintenance records to a vendor.
- **Effort:** ~4 hours

### 3.7 Late payment penalties & interest
- **Files:** `app/payments/page.tsx`, `app/leases/page.tsx`
- **What:** Auto-calculate penalty based on days overdue × daily rate (configurable per lease). Show penalty due alongside rent due.
- **Effort:** ~3 hours

---

## PHASE 4 — Document & File Management
> Requires Supabase Storage setup and file handling.

### 4.1 Property photo uploads
- **File:** `app/properties/page.tsx`
- **What:** Upload 1+ photos per property. Show thumbnail in property card.
- **How:** Supabase Storage bucket `property-photos`. Store URL in `properties` table.
- **Effort:** ~3 hours

### 4.2 Maintenance photo attachments
- **File:** `app/maintenance/page.tsx`
- **What:** Attach before/after photos to maintenance records.
- **Effort:** ~2 hours (reuse storage pattern from 4.1)

### 4.3 Lease document attachments
- **File:** `app/leases/page.tsx`
- **What:** Upload signed lease PDF. View/download from lease detail.
- **Effort:** ~2 hours

### 4.4 Data export / full backup
- **File:** `app/settings/page.tsx`
- **What:** Export all landlord data as a single ZIP (CSV files per entity + uploaded files manifest).
- **Effort:** ~4 hours

---

## PHASE 5 — Form Validation Overhaul
> Requires adding Zod as a dependency.

### 5.1 Install and configure Zod
- `npm install zod`
- Create `app/lib/schemas.ts` with schemas for all entities.
- **Effort:** ~1 hour

### 5.2 Validate all forms with Zod
- **Files:** All `app/*/page.tsx` with forms
- Validate on submit and on blur. Show field-level error messages.
- **Effort:** ~4 hours

### 5.3 Validate API route inputs
- **Files:** `app/api/*/route.ts`
- Parse and validate request bodies with Zod before processing.
- **Effort:** ~1.5 hours

---

## PHASE 6 — AI Feature Improvements
> Enhances existing AI pages. Requires prompt engineering + API work.

### 6.1 Add follow-up question suggestions in AI Insights
- **File:** `app/ai-insights/page.tsx`
- After each AI response, show 3 suggested follow-up questions dynamically generated from the answer.
- **Effort:** ~2 hours

### 6.2 Persist AI Insights conversation history
- **File:** `app/ai-insights/page.tsx`
- Store conversation in `localStorage` with a "New Chat" button to reset.
- **Effort:** ~1.5 hours

### 6.3 Add contract template library
- **Files:** `app/ai-contract/page.tsx`, new `app/lib/contractTemplates.ts`
- Pre-built templates: Residential Monthly, Commercial, Short-term. User picks a template as starting point before AI generation.
- **Effort:** ~3 hours

### 6.4 Rate-limit AI API routes
- **Files:** `app/api/ai-*/route.ts`
- Add simple in-memory rate limiter (e.g., 10 requests/min per user) using a Map with timestamps.
- **Effort:** ~1.5 hours

### 6.5 Multi-language reminders (Runyoro, Lusoga, Ateso)
- **File:** `app/reminders/page.tsx`, `app/api/ai-reminders/route.ts`
- Add language selector with additional Ugandan languages beyond English/Luganda.
- **Effort:** ~1 hour

---

## PHASE 7 — Security & Auth Improvements
> Requires Supabase Auth config changes and middleware work.

### 7.1 Add password change flow
- **File:** `app/settings/page.tsx`
- Use `supabase.auth.updateUser({ password })` with current password confirmation.
- **Effort:** ~2 hours

### 7.2 Add email change with verification
- **File:** `app/settings/page.tsx`
- Use `supabase.auth.updateUser({ email })`. Show "check your inbox" message.
- **Effort:** ~1.5 hours

### 7.3 Add Row Level Security audit
- **Files:** `supabase/migrations/` — new migration file
- Review all RLS policies. Ensure no landlord can access another's data.
- Add missing policies for `applications`, `contracts`, `communication_logs`.
- **Effort:** ~2 hours

### 7.4 Add audit logging
- **Files:** New `supabase/migrations/` table `audit_logs`, new `app/lib/audit.ts`
- Log all create/update/delete operations with user ID, timestamp, entity, old/new values.
- **Effort:** ~4 hours

### 7.5 Add two-factor authentication
- **File:** `app/settings/page.tsx`, `app/login/page.tsx`
- Use Supabase Auth TOTP flow. Show QR code in settings. Prompt on login.
- **Effort:** ~4 hours

---

## PHASE 8 — Performance & Scale
> Needed once data volume grows.

### 8.1 Add database query projections
- **File:** `app/lib/database.ts`
- Add `select()` column lists to all queries. Stop fetching unused columns.
- **Effort:** ~1.5 hours

### 8.2 Add server-side filtering
- **Files:** `app/lib/database.ts`, all `app/*/page.tsx`
- Move filter logic (by property, by month, by status) into Supabase queries instead of client-side array filtering.
- **Effort:** ~3 hours

### 8.3 Add React Query for caching & background refresh
- `npm install @tanstack/react-query`
- Wrap all data fetches in `useQuery`. Add stale-while-revalidate behavior.
- **Files:** All `app/*/page.tsx`, new `app/providers.tsx`
- **Effort:** ~5 hours

### 8.4 Add real-time updates via Supabase subscriptions
- **Files:** `app/page.tsx` (dashboard), `app/payments/page.tsx`
- Use `supabase.channel()` to subscribe to payment and maintenance table changes. Update UI without refresh.
- **Effort:** ~3 hours

---

## PHASE 9 — URA Tax Integration
> Most complex. Requires external API or scraping URA's portal.

### 9.1 Quarterly advance tax calculator
- **File:** `app/tax-reports/page.tsx`
- Add tab showing Q1–Q4 advance tax amounts due under the Uganda Income Tax Act schedule.
- **Effort:** ~3 hours

### 9.2 Multi-year tax comparison
- **File:** `app/tax-reports/page.tsx`
- Add year selector. Show side-by-side comparison of income and tax across years.
- **Effort:** ~2 hours

### 9.3 Allowable deductions tracker
- **Files:** `app/tax-reports/page.tsx`, new `app/deductions/page.tsx`
- Track deductible expenses: agent fees, repairs, insurance, mortgage interest. Auto-include maintenance costs.
- **Effort:** ~4 hours

### 9.4 URA e-filing export
- **File:** `app/tax-reports/page.tsx`
- Generate a URA-compatible return format (XML or CSV matching URA's template) for manual upload to the URA e-services portal.
- **Effort:** ~5 hours

---

## PHASE 10 — Testing
> Last because you need stable features before writing tests.

### 10.1 Unit tests for utility functions
- `npm install -D vitest @testing-library/react`
- Test: overdue calculation, receipt number generation, tax calculation logic.
- **Files:** New `app/lib/__tests__/`
- **Effort:** ~3 hours

### 10.2 Component tests
- Test: form validation, modal open/close, pagination.
- **Effort:** ~4 hours

### 10.3 End-to-end tests with Playwright
- `npm install -D @playwright/test`
- Test critical paths: login → add property → add tenant → record payment → view receipt.
- **Effort:** ~6 hours

---

## Summary Table

| Phase | Focus | Tasks | Est. Total |
|-------|-------|-------|------------|
| 1 | Bug Fixes | 7 | ~6 hours |
| 2 | UX Polish | 7 | ~15 hours |
| 3 | Core Features | 7 | ~24 hours |
| 4 | File Management | 4 | ~11 hours |
| 5 | Form Validation | 3 | ~6.5 hours |
| 6 | AI Improvements | 5 | ~9 hours |
| 7 | Security & Auth | 5 | ~13.5 hours |
| 8 | Performance | 4 | ~12.5 hours |
| 9 | URA Tax | 4 | ~14 hours |
| 10 | Testing | 3 | ~13 hours |
| **Total** | | **49 tasks** | **~124 hours** |

---

## Recommended Starting Order (first 2 weeks)
1. Phase 1 (all bug fixes) — foundation must be solid first
2. Phase 2.1–2.3 (skeletons, errors, toasts) — immediate UX lift
3. Phase 3.1 (tenant applications) — complete the sidebar promise
4. Phase 3.2 (maintenance workflow) — high daily-use value
5. Phase 5.1–5.2 (Zod validation) — prevents bad data going forward
