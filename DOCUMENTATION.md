# RentFlow Uganda — Technical Documentation

**Version:** 1.0
**Stack:** Next.js 14.1 · TypeScript · Supabase · TailwindCSS · Vercel
**Live URL:** https://rentflow-uganda.vercel.app
**Supabase Project:** vnclmjqifdughdfysvgf.supabase.co

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Authentication Flow](#authentication-flow)
4. [Data Model](#data-model)
5. [Pages & Features](#pages--features)
6. [API Routes](#api-routes)
7. [Context & State Management](#context--state-management)
8. [Role System](#role-system)
9. [Subscription Gating](#subscription-gating)
10. [SMS & Reminders](#sms--reminders)
11. [Known Issues & Fixes Applied](#known-issues--fixes-applied)
12. [Deployment](#deployment)
13. [Environment Variables](#environment-variables)

---

## Architecture Overview

```
Browser
  └─ Next.js 14 App Router (Vercel)
       ├─ AuthProvider     — Supabase Auth session management
       ├─ AppProvider      — All CRUD state (properties, tenants, leases, etc.)
       ├─ RoleProvider     — Team member role resolution
       ├─ ThemeProvider    — Dark/light mode (localStorage)
       └─ LayoutContent    — Sidebar + main content layout
```

All data lives in **Supabase PostgreSQL**. The client reads/writes directly via the Supabase JS SDK with Row Level Security (RLS) enforcing that each landlord can only access their own rows (`landlord_id = auth.uid()`).

There is **no separate backend** beyond Next.js API routes for SMS, AI, and cron tasks.

---

## Project Structure

```
app/
├─ page.tsx                  # Dashboard (/)
├─ layout.tsx                # Root layout — wraps all providers
├─ globals.css
├─ welcome/page.tsx          # Onboarding wizard (new users)
├─ login/page.tsx            # Email/password + Google OAuth login
├─ forgot-password/page.tsx  # Password reset request
├─ auth/
│   ├─ callback/route.ts     # OAuth callback handler
│   └─ reset-password/page.tsx
├─ properties/page.tsx       # Property + unit CRUD
├─ tenants/page.tsx          # Tenant list, scores, comms log
├─ leases/page.tsx           # Lease CRUD, duplicate, late fees
├─ payments/page.tsx         # Payment recording, receipts, PDF
├─ maintenance/page.tsx      # Maintenance tracking
├─ expenses/page.tsx         # Expense tracking by category
├─ analytics/page.tsx        # Occupancy + revenue + forecast charts
├─ reminders/page.tsx        # AI-powered SMS reminders
├─ import/page.tsx           # CSV import wizard
├─ reconcile/page.tsx        # Bank statement reconciliation
├─ tax-reports/page.tsx      # Uganda tax year PDF reports
├─ ai-contract/page.tsx      # AI lease contract generator
├─ ai-insights/page.tsx      # AI property insights
├─ upgrade/page.tsx          # Plan comparison + usage meters
├─ join/page.tsx             # Team invite acceptance
├─ settings/
│   ├─ page.tsx              # Profile, theme, clear data
│   ├─ team/page.tsx         # Team invites + role management
│   ├─ audit/page.tsx        # Audit log viewer
│   ├─ branding/page.tsx     # Logo, color, tagline
│   ├─ templates/page.tsx    # Communication templates
│   └─ reminders/page.tsx    # Reminder schedule config
├─ components/
│   ├─ AuthProvider.tsx      # Auth context + session guard
│   ├─ AppProvider.tsx       → see context/AppContext.tsx
│   ├─ LayoutContent.tsx     # Sidebar + mobile topbar
│   ├─ Sidebar.tsx           # Navigation + upgrade prompt
│   ├─ GlobalSearch.tsx      # Cmd+K search across all data
│   ├─ RevenueChart.tsx      # Recharts bar chart
│   ├─ ThemeProvider.tsx     # Dark mode toggle
│   └─ Toast.tsx             # Dismissable toast notification
├─ context/
│   ├─ AppContext.tsx        # All data state + CRUD functions
│   └─ RoleContext.tsx       # Current user's team role
├─ lib/
│   ├─ supabase.ts           # Supabase client singleton
│   ├─ supabase-server.ts    # Server-side Supabase client
│   ├─ database.ts           # All Supabase CRUD helpers
│   ├─ utils.ts              # formatUGX, daysUntil, calculateTenantScore
│   ├─ csvImport.ts          # CSV parsing utilities
│   ├─ csvExport.ts          # CSV export utility
│   ├─ pdfReceipt.ts         # PDF receipt generation (html2canvas/jsPDF)
│   └─ useSubscription.ts    # Plan limits hook
├─ types/index.ts            # All TypeScript interfaces
└─ api/
    ├─ send-sms/route.ts     # Africa's Talking SMS sender
    ├─ ai-contract/route.ts  # Claude AI contract generation
    ├─ ai-insights/route.ts  # Claude AI property insights
    ├─ ai-reminders/route.ts # Claude AI reminder drafting
    └─ cron/reminders/route.ts # Vercel cron rent reminders
```

---

## Authentication Flow

1. **New user** → `/login` → email/password sign up → email confirmation → redirect to app
2. **Existing user** → `/login` → sign in → dashboard
3. **Google OAuth** → `/login` → "Continue with Google" → Google consent → `/auth/callback` → session cookie set → dashboard
4. **Session guard** — `AuthProvider` checks `getSession()` on mount; if no session on non-auth pages → redirect to `/login`
5. **New user onboarding** — Dashboard checks `properties.length === 0 && !landlord.name` → redirect to `/welcome`

### Supabase Auth Providers Required
- Email/Password: enabled by default
- Google OAuth: requires Client ID + Secret set in Supabase Dashboard → Authentication → Providers → Google

---

## Data Model

### `landlords`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | = auth.uid() |
| name | text | |
| phone | text | |
| email | text | |
| landlord_type | text | 'Individual' \| 'Company' |
| ura_tin | text | Uganda Revenue Authority TIN |
| subscription_plan | text | 'Free' \| 'AI_Assist' |
| logo_url | text | Branding |
| primary_color | text | Branding hex color |
| company_tagline | text | Branding |
| created_at | timestamptz | |

### `properties`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| landlord_id | uuid | = auth.uid() (RLS) |
| name | text | |
| address | text | |
| district | text | |
| lc_area | text | |
| property_type | text | 'Residential' \| 'Commercial' \| 'Mixed' |
| property_rates_ref | text | |
| created_at | timestamptz | |

### `units`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| property_id | uuid | FK → properties |
| code | text | e.g. 'A1', 'B2' |
| description | text | |
| bedrooms | int | |
| default_rent_amount | int | UGX |
| status | text | 'Available' \| 'Occupied' \| 'Under_maintenance' |
| created_at | timestamptz | |

### `tenants`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| landlord_id | uuid | RLS |
| full_name | text | |
| phone | text | Uganda format +256... |
| email | text | |
| national_id | text | |
| occupation | text | |
| emergency_contact | text | |
| created_at | timestamptz | |

### `leases`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| landlord_id | uuid | RLS |
| property_id | uuid | |
| unit_id | uuid | |
| tenant_id | uuid | |
| status | text | 'Active' \| 'Terminated' \| 'Expired' |
| start_date | date | |
| end_date | date | nullable |
| rent_amount | int | UGX |
| deposit_amount | int | UGX |
| payment_frequency | text | 'Monthly' \| 'Quarterly' \| 'Yearly' |
| due_day | int | Day of month payment due (1–28) |
| grace_period_days | int | Days before late fee applies |
| late_fee_type | text | 'flat' \| 'percentage' |
| late_fee_rate | numeric | Amount or % |
| escalation_rate | numeric | Annual % rent increase |
| next_review_date | date | Auto-computed from start_date |
| created_at | timestamptz | |

### `payments`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| landlord_id | uuid | RLS |
| tenant_id | uuid | |
| property_id | uuid | |
| unit_id | uuid | |
| lease_id | uuid | |
| date | date | |
| amount | int | UGX |
| payment_method | text | 'Mobile_Money' \| 'Bank_Transfer' \| 'Cash' \| 'Cheque' |
| period_start | date | |
| period_end | date | |
| withholding_tax_amount | int | 6% WHT |
| receipt_number | text | Auto-generated RCP-YYYYMMDD-XXXX |
| created_at | timestamptz | |

### `expenses`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| landlord_id | uuid | RLS |
| property_id | uuid | nullable (portfolio-level expense) |
| category | text | 'Repairs' \| 'Utilities' \| 'Insurance' \| 'Taxes' \| 'Management' \| 'Other' |
| description | text | |
| amount | int | UGX |
| date | date | |
| vendor | text | |
| reference | text | |
| created_at | timestamptz | |

### `maintenance`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| landlord_id | uuid | RLS |
| property_id | uuid | |
| unit_id | uuid | nullable |
| title | text | |
| description | text | |
| status | text | 'Open' \| 'In_Progress' \| 'Resolved' |
| priority | text | 'Low' \| 'Medium' \| 'High' \| 'Urgent' |
| cost | int | UGX |
| date | date | |
| resolved_date | date | nullable |
| created_at | timestamptz | |

### `team_members`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| owner_id | uuid | The landlord who owns the account |
| user_id | uuid | nullable until invite accepted |
| email | text | Invited email |
| name | text | |
| role | text | 'Manager' \| 'Viewer' |
| status | text | 'Pending' \| 'Active' \| 'Revoked' |
| invite_token | text | 48-char hex token |
| created_at | timestamptz | |

### `audit_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| landlord_id | uuid | |
| user_id | uuid | Who performed the action |
| user_email | text | |
| action | text | 'create' \| 'update' \| 'delete' |
| entity_type | text | 'property' \| 'tenant' \| 'lease' \| 'payment' |
| entity_id | uuid | |
| summary | text | Human-readable description |
| created_at | timestamptz | |

---

## Pages & Features

### Dashboard (`/`)
- KPI cards: Monthly Revenue, Occupancy %, Overdue count, Monthly Expenses
- Revenue bar chart (last 6 months, Recharts)
- Recent activity feed (payments, maintenance, new tenants)
- Lease expiry alerts (30-day window, color-coded, dismissable)
- Rent review alerts (30-day window, dismissable)
- Per-property filter dropdown (when >1 property)
- **New user redirect:** If `properties.length === 0 && !landlord.name` → `/welcome`

### Welcome Onboarding (`/welcome`)
3-step wizard for new users:
1. **Profile** — name, phone, account type, URA TIN
2. **First Property** — name, address, district, type (skippable)
3. **Done** — "Go to Dashboard" button

### Properties (`/properties`)
- Add/edit/delete properties
- Expandable unit list per property
- Add/edit/delete units (code, bedrooms, rent, status)
- Guard: cannot delete property with active leases

### Tenants (`/tenants`)
- Full CRUD with communication log sidebar
- Tenant score badge (A–F, based on payment history)
- CSV export
- Select-all + bulk export

### Leases (`/leases`)
- Full CRUD with duplicate lease functionality
- Late fee configuration (flat or % of rent)
- Rent escalation scheduler (% per year, next review date)
- Status management: Active → Terminated
- Linked unit status auto-update

### Payments (`/payments`)
- Record payments against active leases
- Auto-calculates WHT (6%) and suggested late fee
- PDF receipt generation (html2canvas + jsPDF)
- Filter by month and tenant
- CSV export
- SMS receipt sent on payment recorded (Africa's Talking)

### Maintenance (`/maintenance`)
- Track issues by property/unit
- Priority levels: Low / Medium / High / Urgent
- Status cycling: Open → In Progress → Resolved
- Cost tracking
- Summary cards: open count, in-progress, total cost, avg resolution time

### Expenses (`/expenses`)
- Categorised expense tracking
- Property-level or portfolio-level
- Category summary pie chart
- CSV export

### Analytics (`/analytics`)
- Occupancy rate chart by property
- Revenue trend (12 months)
- Revenue forecast (based on active leases + escalation)
- Top property by revenue

### AI Features
- **AI Reminders** (`/reminders`) — Claude drafts SMS messages for selected tenants; bulk send via Africa's Talking
- **AI Contract** (`/ai-contract`) — Claude generates a lease contract from lease details
- **AI Insights** (`/ai-insights`) — Claude analyses portfolio and gives recommendations

### Import (`/import`)
- CSV import wizard for tenants and properties
- Column mapping step
- Validation with per-row error reporting

### Reconcile (`/reconcile`)
- Upload bank statement CSV
- Auto-match to recorded payments by amount + receipt number
- Flag unmatched and discrepant rows

### Tax Reports (`/tax-reports`)
- Uganda tax year (July–June)
- Rental income summary per property
- WHT (6%) and applicable rates (12% / 30%)
- PDF download with landlord branding

### Settings
| Sub-page | Function |
|----------|----------|
| `/settings` | Profile edit, theme toggle, clear cache |
| `/settings/team` | Invite team members, assign roles, revoke access |
| `/settings/audit` | View all data mutations with user + timestamp |
| `/settings/branding` | Logo URL, brand color, company tagline |
| `/settings/templates` | Reusable SMS/email templates |
| `/settings/reminders` | Configure reminder schedule (days before due) |

### Upgrade (`/upgrade`)
- Plan comparison table: Free vs AI Assist
- Live usage meters (properties, tenants, leases)
- Contact prompt for upgrade

---

## API Routes

### `POST /api/send-sms`
Sends SMS via Africa's Talking.
```json
{ "to": "+256700123456", "message": "Your rent..." }
```
Returns `{ success: true }` or `{ error: "..." }`.

### `POST /api/ai-contract`
Generates lease contract using Claude claude-sonnet-4-6.
```json
{ "lease": { ...leaseObject }, "tenant": { ...tenantObject }, "property": { ...propertyObject } }
```

### `POST /api/ai-insights`
Returns portfolio analysis from Claude.
```json
{ "properties": [...], "tenants": [...], "payments": [...], "leases": [...] }
```

### `POST /api/ai-reminders`
Drafts reminder messages using Claude.
```json
{ "tenants": [...], "leases": [...], "type": "reminder" | "overdue" }
```

### `GET /api/cron/reminders`
Vercel cron job (runs daily at 08:00 EAT via `vercel.json`).
- Protected by `CRON_SECRET` header
- Finds leases with rent due within `REMINDER_DAYS_BEFORE` days (default: 3)
- Sends SMS to all matching tenants who haven't paid
- Skips already-paid tenants

---

## Context & State Management

### AppContext (`app/context/AppContext.tsx`)
Single source of truth for all application data. Loads all data in parallel on user login. Provides CRUD functions for every entity.

```typescript
const {
  landlord, properties, units, tenants, leases, payments,
  maintenance, contracts, applications, communicationLogs,
  expenses, commTemplates,
  loading, error,
  // CRUD functions...
} = useApp();
```

All mutations:
1. Update Supabase DB
2. Update local React state optimistically
3. Fire audit log (for properties, tenants, leases, payments)

### RoleContext (`app/context/RoleContext.tsx`)
Checks `team_members` table on login to determine if user is a team member or owner.

```typescript
const { role, isOwner, canEdit, canDelete, ownerId } = useRole();
```

- `isOwner` — user is the account owner (not a team member)
- `canEdit` — Owner or Manager
- `canDelete` — Owner only

---

## Role System

| Role | Can View | Can Edit | Can Delete |
|------|----------|----------|------------|
| Owner | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ❌ |
| Viewer | ✅ | ❌ | ❌ |

Invite flow:
1. Owner goes to Settings → Team → Invite
2. A `team_members` row is created with `status: 'Pending'` and a unique `invite_token`
3. Owner copies and shares the invite link: `https://rentflow-uganda.vercel.app/join?token=<token>`
4. Invitee opens link → signs in → clicks Accept → row updated with `user_id` and `status: 'Active'`
5. On next login, RoleContext detects team membership and sets role accordingly

---

## Subscription Gating

**Free plan limits:**
- 3 properties
- 10 tenants
- 10 leases
- No AI features

**AI Assist plan:**
- Unlimited everything
- All AI features unlocked

The `useSubscription` hook (`app/lib/useSubscription.ts`) exposes:
```typescript
const {
  plan,          // 'Free' | 'AI_Assist'
  isFree,
  canAddProperty, canAddTenant, canAddLease, canUseAI,
  propertiesUsed, propertiesMax,
  tenantsUsed, tenantsMax,
  leasesUsed, leasesMax,
} = useSubscription();
```

The sidebar shows an upgrade banner for Free plan users.

---

## SMS & Reminders

**Provider:** Africa's Talking (sandbox mode by default)

**Triggers:**
1. Payment recorded → SMS receipt to tenant
2. Daily cron (08:00) → reminder SMS to tenants with upcoming rent (configurable days before)

**Configuration:**
```
AFRICASTALKING_USERNAME=your_username
AFRICASTALKING_API_KEY=your_api_key
AFRICASTALKING_ENV=sandbox   # or 'production'
REMINDER_DAYS_BEFORE=3
CRON_SECRET=your_cron_secret
```

To switch to production SMS: change `AFRICASTALKING_ENV=production` in Vercel env vars and re-deploy.

---

## Known Issues & Fixes Applied

### Fixed in Audit (2026-03-22)

| # | Issue | File | Fix |
|---|-------|------|-----|
| 1 | **CRITICAL** `filteredPayments` used before declaration — ReferenceError crashes dashboard for any user with active leases | `app/page.tsx` | Moved `filteredPayments` declaration above `overduePayments` |
| 2 | `updateLandlordDB` used `UPDATE` (not `UPSERT`) — new users never got a landlord row in DB; profile name wouldn't persist across sessions | `app/lib/database.ts` | Changed to `upsert({ id: userId, ...updates }, { onConflict: 'id' })` |
| 3 | Welcome page "Go to Dashboard" used `router.push('/')` — could cause navigation loop if user hit browser Back | `app/welcome/page.tsx` | Changed to `router.replace('/')` |
| 4 | Dashboard redirect used `router.push('/welcome')` — stacked history entries | `app/page.tsx` | Changed to `router.replace('/welcome')` |
| 5 | Welcome page had no error feedback on profile/property save failure | `app/welcome/page.tsx` | Added try/catch + `saveError` state display |
| 6 | Team page `copyInviteLink` set "Copied!" before clipboard write completed | `app/settings/team/page.tsx` | Moved `setCopiedToken` into `.then()` callback |
| 7 | Team page `handleRoleChange`, `handleRevoke`, `handleRemove` had no error handling — silent failures | `app/settings/team/page.tsx` | Added error checking and `setError()` on failure |

### Fixed in Audit (2026-03-22) — Second Pass

| # | Issue | File | Fix |
|---|-------|------|-----|
| 8 | **CRITICAL** "Go to Dashboard" button after welcome wizard did not navigate to dashboard — dashboard redirected back to `/welcome` because `updateLandlord` only called `setLandlord` after an `await`, so if the DB write threw, local state was never set, leaving `landlord.name` empty. Dashboard condition `properties.length === 0 && !landlord.name` then fired a redirect loop. | `app/context/AppContext.tsx` | Moved `setLandlord` **before** the async DB call (optimistic update pattern) so local state is always updated regardless of DB result. |
| 9 | Dashboard `!landlord.name` check could mis-redirect users who have a name but zero properties (e.g. after skipping property step) | `app/page.tsx` | Changed redirect condition to `!landlord.id && !landlord.name` — only fires when the landlord record has truly never been initialised |
| 10 | **CRITICAL** Unit delete button in Properties page fired `deleteUnit(id)` directly with no confirmation dialog and no active-lease guard | `app/properties/page.tsx` | Added `deleteUnitConfirm` state, `handleDeleteUnit` with active-lease check, and inline Confirm/Cancel UI matching property delete pattern |
| 11 | **CRITICAL** Cron reminder cron job used `!==` comparison for days-until-due, meaning reminders were never sent unless the due date fell on *exactly* the configured day | `app/api/cron/reminders/route.ts` | Changed `daysUntilDue !== reminderDaysBefore` to `daysUntilDue > reminderDaysBefore` so reminders fire within the window |
| 12 | Settings test button sent `NEXT_PUBLIC_CRON_SECRET` from the client — this env var doesn't exist client-side, so the test always sent `Bearer test` and was rejected by production | `app/settings/reminders/page.tsx` | Created `/api/cron/test-run` server endpoint that injects the server-side `CRON_SECRET`; updated test button to POST to that endpoint |

### Known Remaining Issues (Non-Critical)

| # | Issue | File | Priority |
|---|-------|------|----------|
| 1 | Login error messages show raw Supabase error text | `app/login/page.tsx` | Low |
| 2 | Branding page modifies DOM directly via `onError` | `app/settings/branding/page.tsx` | Low |
| 3 | Audit log empty state doesn't explain what audit log is | `app/settings/audit/page.tsx` | Low |
| 4 | Maintenance status change has no confirmation dialog | `app/maintenance/page.tsx` | Low |
| 5 | Reconcile CSV amount match allows 0.99 UGX difference | `app/reconcile/page.tsx` | Medium |
| 6 | Most CRUD pages don't display AppContext `error` state to user | Various | Medium |
| 7 | Reminder settings (daysBefore, overdue toggle, etc.) stored in localStorage only — lost on browser clear / different device | `app/settings/reminders/page.tsx` | Medium |

---

## Deployment

**Platform:** Vercel
**Project:** `wamkats-pngs-projects/rentflow-uganda`
**Live URL:** https://rentflow-uganda.vercel.app

### Deploy Commands
```bash
# Push to GitHub (auto-deploys via Vercel GitHub integration)
git add -A && git commit -m "message" && git push origin main

# Or deploy directly with CLI
npx vercel --prod --yes
```

### Cron Job
`vercel.json` configures a daily cron:
```json
{
  "crons": [{ "path": "/api/cron/reminders", "schedule": "0 8 * * *" }]
}
```
Runs at 08:00 UTC daily. East Africa Time (EAT) is UTC+3, so this fires at 11:00 EAT. Adjust if needed.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `ANTHROPIC_API_KEY` | ✅ | For AI features (Claude) |
| `NEXT_PUBLIC_APP_URL` | ✅ | App URL (for OAuth redirects) |
| `AFRICASTALKING_USERNAME` | ⚠️ | Africa's Talking username |
| `AFRICASTALKING_API_KEY` | ⚠️ | Africa's Talking API key |
| `AFRICASTALKING_ENV` | ⚠️ | `sandbox` or `production` |
| `CRON_SECRET` | ✅ | Secret header for cron job protection |
| `REMINDER_DAYS_BEFORE` | optional | Days before rent due to send reminder (default: 3) |

All variables set on Vercel. Copy `.env.local.example` (if present) for local development.

---

## Supabase RLS Policies Required

Run these in Supabase SQL Editor if tables were created without RLS:

```sql
-- Properties
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord owns their properties"
  ON properties FOR ALL USING (landlord_id = auth.uid());

-- Units (via property ownership)
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access units via property"
  ON units FOR ALL USING (
    property_id IN (SELECT id FROM properties WHERE landlord_id = auth.uid())
  );

-- Tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord owns their tenants"
  ON tenants FOR ALL USING (landlord_id = auth.uid());

-- Leases
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord owns their leases"
  ON leases FOR ALL USING (landlord_id = auth.uid());

-- Payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord owns their payments"
  ON payments FOR ALL USING (landlord_id = auth.uid());

-- Maintenance
ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord owns maintenance records"
  ON maintenance FOR ALL USING (landlord_id = auth.uid());

-- Expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord owns expenses"
  ON expenses FOR ALL USING (landlord_id = auth.uid());

-- Landlords (upsert own record only)
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord owns their profile"
  ON landlords FOR ALL USING (id = auth.uid());

-- Team members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages their team"
  ON team_members FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "Member can read own invite"
  ON team_members FOR SELECT USING (user_id = auth.uid() OR invite_token IS NOT NULL);

-- Audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord views own audit logs"
  ON audit_logs FOR ALL USING (landlord_id = auth.uid());
```
