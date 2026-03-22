# RentFlow Uganda

Property management platform for Ugandan landlords — built with Next.js 14, Supabase, and TailwindCSS.

**Live:** https://rentflow-uganda.vercel.app

---

## Features

- **Dashboard** — KPI cards, revenue chart, occupancy, overdue alerts, expiring lease alerts
- **Properties & Units** — Full CRUD with expandable unit management
- **Tenants** — Profiles, payment history scoring (A–F), communication logs
- **Leases** — Create, duplicate, manage with late fees and annual escalation
- **Payments** — Record payments, auto-generate receipts, PDF downloads, SMS confirmation
- **Maintenance** — Track issues by priority and status
- **Expenses** — Category-level expense tracking per property or portfolio
- **Analytics** — Occupancy charts, revenue trends, 12-month forecast
- **AI Features** — Lease contract generator, portfolio insights, SMS reminder drafting (Claude)
- **SMS** — Africa's Talking integration for payment receipts and rent reminders
- **Cron Reminders** — Daily automated rent reminder SMS (Vercel cron)
- **Team** — Invite managers/viewers with role-based access control
- **Audit Log** — Every data mutation logged with user and timestamp
- **Tax Reports** — Uganda tax year PDF (Jul–Jun) with WHT and rates
- **CSV Import/Export** — Bulk import tenants and properties; export any list
- **Bank Reconciliation** — Upload bank statement CSV and match to payments
- **Dark Mode** — System-aware with localStorage toggle
- **Subscription Gating** — Free (3 props / 10 tenants) vs AI Assist (unlimited)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14.1 (App Router) |
| Language | TypeScript (strict) |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Styling | TailwindCSS |
| Charts | Recharts |
| AI | Anthropic Claude claude-sonnet-4-6 |
| SMS | Africa's Talking |
| PDF | html2canvas + jsPDF |
| Deploy | Vercel |

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/wamkats-png/Rental-App.git
cd rentflow-uganda
npm install
```

### 2. Set Up Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
AFRICASTALKING_USERNAME=sandbox
AFRICASTALKING_API_KEY=your-key
AFRICASTALKING_ENV=sandbox
CRON_SECRET=your-secret
REMINDER_DAYS_BEFORE=3
```

### 3. Set Up Supabase

1. Create a Supabase project
2. Run all table creation SQL (see `DOCUMENTATION.md` for schema)
3. Enable RLS on all tables and add policies (see `DOCUMENTATION.md`)
4. Enable Email/Password auth provider
5. (Optional) Enable Google OAuth

### 4. Run Dev Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Deployment

Deployed to Vercel. Any push to `main` auto-deploys via GitHub integration.

Manual deploy:
```bash
npx vercel --prod --yes
```

---

## Documentation

Full technical documentation in [`DOCUMENTATION.md`](./DOCUMENTATION.md):
- Architecture overview
- Complete data model
- All pages and features
- API routes
- Role system
- Subscription gating
- SMS & cron reminders
- Environment variables
- RLS policy SQL

---

## Repository

GitHub: https://github.com/wamkats-png/Rental-App
