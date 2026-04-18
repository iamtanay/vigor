# Vigor

A token-based fitness marketplace for India. Buy a token bundle, spend them at any gym on the platform — no locked-in memberships.

---

## What it is

Users purchase token bundles and use them to book slots at partner venues (gyms, yoga studios, CrossFit boxes, pools). Venues get paid per token consumed at the end of each settlement cycle. Vigor earns the margin.

Three portals, one Next.js app:
- **User PWA** — mobile-only web app at `/app`
- **Gym Dashboard** — venue owner portal at `/gym`
- **Admin Center** — internal ops at `/admin`

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 App Router · TypeScript · Tailwind CSS |
| Backend | Supabase (Postgres + Auth + Realtime + Edge Functions) |
| Monorepo | Turborepo |
| Payments | Razorpay (Phase 5) |
| Notifications | Firebase Cloud Messaging (Phase 5) |

---

## Getting started

### Prerequisites
- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A Supabase project (free tier works)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp apps/web/.env.local.example apps/web/.env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Set up the database
```bash
# Apply all migrations + seed
supabase db reset
```

### 4. Fix auth passwords (run once after seeding)
Open `supabase/fix_auth_passwords.sql` in the Supabase SQL editor and run it.

### 5. Start the dev server
```bash
npm run dev
# → http://localhost:3000
```

---

## Development login

Phone OTP requires a paid SMS provider. Skip it in dev:

```
http://localhost:3000/dev-login
```

| Account | Email | Role | Tokens |
|---|---|---|---|
| Ananya Sharma | user1@joinvigor.co | User | 148 |
| Karan Mehta | user2@joinvigor.co | User | 85 |
| Sneha Iyer | user3@joinvigor.co | User | 32 |
| Iron Republic | owner@ironrepublic.in | Gym owner · Gold | — |
| Centurion Fitness | owner@centurionfitness.in | Gym owner · Silver | — |
| Fit Zone | owner@fitzone.in | Gym owner · Bronze | — |
| Admin | admin@joinvigor.co | Admin | — |

All passwords: `Password123!`

---

## Project structure

```
/apps/web          Next.js app — all three portals
/packages/types    Shared TypeScript interfaces
/packages/lib      Supabase clients, token formula, QR utils
/supabase          Migrations, Edge Functions, seed data
```

---

## Token economics

- **Base rates:** Bronze 6t · Silver 10t · Gold 15t per session
- **Peak hours:** 6–9 AM and 5–9 PM at 1.5× multiplier
- **Deducted at exit** — never at booking
- **Cancellation < 2 hrs before slot:** 1 token penalty
- **No-show:** 1 token penalty
- **Bundle expiry:** 15-day grace period at 50% value, then full lapse

---

## Build phases

| Phase | Description | Status |
|---|---|---|
| P1 | Schema · Auth · Seed data | ✅ Complete |
| P2 | User PWA — browse, book, wallet, activity | ✅ Complete |
| P3 | QR system — entry/exit, session lifecycle | 🔲 Next |
| P4 | Gym owner portal — dashboard, settlements | 🔲 |
| P5 | Ratings · Razorpay · Production hardening | 🔲 |

---

## Key rules (enforced in code)

1. Tokens deducted **at exit only** — never at booking
2. Entry QR: single-use, expires 15 min after slot start
3. Exit QR: refreshes every 60 seconds
4. Sessions auto-close after 4 hours
5. `audit_log` rows are **never updated or deleted**
6. Settlements require manual Admin approval

---

*Built with [Supabase](https://supabase.com) and [Next.js](https://nextjs.org)*
