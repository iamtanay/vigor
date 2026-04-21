# Vigor — Project Context

> **Paste this file at the top of every new LLM session.**
> After each phase, update the "Current Status" and "Established Conventions" sections.

---

## What Vigor Is

Vigor is a token-based fitness marketplace for India. Users buy token bundles and spend them across any venue on the platform — gyms, yoga studios, pools, CrossFit boxes — instead of being locked into one subscription. Venues are paid per token consumed during settlement cycles. The platform earns the margin between token purchase price and gym payout rate.

**Three interfaces:**
1. **User App** — mobile-first Next.js PWA (375–430px viewport; desktop shows "open on mobile" page)
2. **Gym Dashboard** — web portal for venue owners
3. **Admin Center** — internal web tool for platform operations

---

## Tech Stack

### Monorepo (Turborepo)
```
/apps
  /web          → Next.js App Router (User PWA + Gym Dashboard + Admin Center)

/packages
  /ui           → Shared component library (stub — Phase 2+)
  /lib          → Supabase clients, token formula, QR utilities
  /types        → Shared TypeScript types across all apps
```

### Frontend
- Next.js 15 App Router — all portals
- No React Native at MVP — user app is Next.js mobile-web PWA
- Tailwind CSS + design tokens; shadcn/ui added progressively

### Backend
- Supabase — PostgreSQL, Auth, Realtime, Storage, Edge Functions, Cron
- **Phase 3 note:** QR generation/validation runs in Next.js API routes (server-side, secure, free)
  instead of Supabase Edge Functions to stay within the free tier.
- Auto-close sessions: Next.js API route `/api/sessions/auto-close` triggered by Vercel cron (free on hobby plan) every 15 min. No pg_cron needed.

### Other Services
- SMS OTP: MSG91/Twilio via Supabase Auth — deferred; use /dev-login in dev
- Payments: Razorpay — stubbed Phase 2, wired Phase 5
- Push: Firebase Cloud Messaging (Phase 5)

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      ← NEW in Phase 3 (used by admin client in API routes)
SUPABASE_JWT_SECRET=            ← Used as HMAC signing secret for QR codes
MSG91_API_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
FCM_SERVER_KEY=
NEXT_PUBLIC_FCM_VAPID_KEY=
NEXT_PUBLIC_APP_URL=            ← e.g. http://localhost:3000 (used by auto-close trigger)
CRON_SECRET=                    ← Optional: protects /api/sessions/auto-close GET endpoint
```

---

## Database

See `supabase/migrations/` for full DDL.

Key tables: `users`, `venues`, `venue_slots`, `bookings`, `sessions`, `token_ledger`, `token_bundles`, `commitments`, `ratings`, `settlements`, `audit_log`, `kiosk_devices`, `venue_pricing`, `admin_actions`.

Enums: `user_role` (user/gym_owner/admin), `venue_tier` (bronze/silver/gold), `booking_status` (confirmed/cancelled/no_show/completed), `session_status` (open/closed/auto_closed), `token_ledger_type` (purchase/deduction/refund/penalty/grace_deduction/compensation).

---

## Business Rules — Non-Negotiable in Code

1. **Tokens never deducted at booking — only at exit scan or auto-close.**
2. Entry QR is single-use, expires 15 min after slot start.
3. Exit QR refreshes every 60 seconds.
4. Auto-close triggers at 4 hours post-entry.
5. No-show or cancellation within 2 hours of slot deducts exactly 1 token.
6. Peak multiplier cannot exceed 2× base rate.
7. Off-peak multiplier cannot go below 0.6× base rate.
8. Commitment discount stacks with bundle discount.
9. Guest deduction comes entirely from host's balance.
10. All scan events write to audit_log — no row ever updated or deleted.
11. Settlement payouts require Admin approval — never automatic.
12. Token expiry → 15-day grace period at 50% value, then full lapse.

---

## Token System

- Deduction = `tier_base_rate × peak_multiplier × (1 − commitment_discount)`
- Tier base rates: Bronze 6, Silver 10, Gold 16
- Peak hours: 6–9am and 5–9pm IST. Multiplier: 1.5× peak, 1.0× off-peak
- Bundle discount is baked into purchase price, not deduction formula
- Grace period notifications: 7 days before, on expiry day, at grace end

---

## Entry / Exit Flow

```
Book slot → no tokens deducted
↓
Arrive → tap booking → "Get Entry QR" button → show QR to staff
Staff opens /gym/scan → scans QR → session opens → audit_log write
↓
Work out
↓
Leave → tap "Session" tab in nav → show Exit QR (60s auto-refresh)
Staff scans → session closes → tokens deducted → audit_log write
↓
[No exit in 4hrs] → Vercel cron → /api/sessions/auto-close → standard rate deducted
```

---

## QR System (Phase 3)

### Architecture
All QR logic lives in Next.js API routes (not Supabase Edge Functions) for free-tier compatibility.

| Route | Purpose |
|---|---|
| `POST /api/sessions/generate-entry-qr` | Signs entry QR with HMAC-SHA256, stores hash on booking |
| `POST /api/sessions/generate-exit-qr` | Signs exit QR (60s TTL), no stored hash |
| `POST /api/sessions/validate-scan` | Validates QR, opens/closes session, deducts tokens (uses service_role client) |
| `POST /api/sessions/auto-close` | Closes sessions open > 4 hrs, deducts base rate |
| `GET /api/sessions/auto-close` | Same as POST — used by Vercel cron (protected by CRON_SECRET) |
| `GET /api/sessions/active` | Returns user's current open session |
| `GET /api/sessions/upcoming-bookings` | Returns confirmed bookings within entry window |

### QR Format
```
Entry: vigor:entry:<base64(JSON payload)>.<HMAC-SHA256 signature>
Exit:  vigor:exit:<base64(JSON payload)>.<HMAC-SHA256 signature>
```

Entry payload: `{ type, booking_id, user_id, venue_id, slot_start_iso, nonce }`
Exit payload: `{ type, session_id, user_id, venue_id, issued_at_iso }`

### Security
- Entry QR: single-use (entry_qr_used flag), 15-min expiry from slot start, nonce prevents replay
- Exit QR: 90s validation window (60s TTL + 30s grace), signature prevents forgery
- HMAC secret: `SUPABASE_JWT_SECRET` env var (never in browser)
- validate-scan uses service_role client — gym owner doesn't need to be authed as the member

### Auto-Close (Free Tier)
- **No pg_cron** (not available on Supabase free plan)
- Vercel cron runs `GET /api/sessions/auto-close` every 15 min (free on Vercel hobby)
- Also triggered lazily via `GET /api/sessions/active` on app open (fire-and-forget)
- Config: `vercel.json` at repo root

---

## Brand & Design

Colors (CSS vars + Tailwind tokens):
- `--color-deep-space` / `bg-deep-space`: #1A1A2E
- `--color-card-dark` / `bg-card-dark`: #23233A
- `bg-vigor-violet` / `text-vigor-violet`: #6C63FF
- `text-pulse-green`: #39D98A
- `text-burn-coral`: #FF6B6B
- `text-tempo-amber`: #FFD166

Tier badges: Bronze #CD7F32, Silver #8A9BB5, Gold #B8860B

Typography: Inter/system-ui. 28px/500 hero → 22px/500 title → 15px/400 body → 12px/500 uppercase labels. Headings: letter-spacing −0.03em.

Animation classes (globals.css): `.card-enter` (translateY 200ms), `.page-slide-in` (horizontal 250ms).

---

## Phase Plan

| Phase | Title | Status |
|---|---|---|
| P1 | Foundation — schema, auth, seed data | ✅ Complete |
| P2 | User mobile web — browse, book, wallet | ✅ Complete |
| P3 | QR system — entry, exit, session lifecycle | ✅ Complete |
| P4 | Gym owner portal — dashboard, sessions, settlements | 🔲 Next |
| P5 | Ratings, payments, production hardening | 🔲 |

---

## Current Status

### ✅ Phase 1 — Foundation (complete)

- Supabase schema: all tables, enums, FK, RLS — `202604170001_initial_schema.sql` + `202604170002_rls_policies.sql`
- Seed: 3 venues (Iron Republic/Gold, Centurion/Silver, Fit Zone/Bronze), 3 users (Ananya/148t, Karan/85t, Sneha/32t), token bundles, 7-day slots
- Next.js scaffold: App Router, Tailwind, TypeScript, design tokens
- Auth: `/login` (phone OTP), `/gym/login` (email OTP), `/dev-login` (dev bypass)
- Middleware: auth guards + mobile-only redirect for `/app/**`
- `packages/lib`: Supabase clients, HMAC QR utils, `calculateDeduction()`, `TIER_BASE_RATES`
- `packages/types`: all DB entity interfaces

### ✅ Phase 2 — User mobile web (complete)

All user-facing screens: Home, Explore, Venue Detail, Booking Confirm, Wallet, Activity.
API routes: bookings CRUD, wallet balance + purchase stub, user profile.

### ✅ Phase 3 — QR system (complete)

**New files added:**

| File | Purpose |
|---|---|
| `src/app/api/sessions/generate-entry-qr/route.ts` | HMAC-signed entry QR generation |
| `src/app/api/sessions/generate-exit-qr/route.ts` | 60s TTL exit QR generation |
| `src/app/api/sessions/validate-scan/route.ts` | QR validation + session open/close + token deduction |
| `src/app/api/sessions/auto-close/route.ts` | Auto-close sessions > 4 hrs (Vercel cron target) |
| `src/app/api/sessions/active/route.ts` | Get current open session |
| `src/app/api/sessions/upcoming-bookings/route.ts` | Get bookings in entry window |
| `src/app/app/session/page.tsx` | Active Session screen (server) |
| `src/app/app/session/ActiveSessionScreen.tsx` | Entry QR + Exit QR display + countdown |
| `src/app/gym/page.tsx` | Gym owner dashboard (basic — Phase 4 expands) |
| `src/app/gym/scan/page.tsx` | QR scan portal (server) |
| `src/app/gym/scan/GymScanPortal.tsx` | Camera scanner (jsQR) + manual input + result display |
| `src/lib/supabase/admin.ts` | Service-role Supabase client for API routes |
| `vercel.json` | Vercel cron: auto-close every 15 min |
| `supabase/migrations/202604210001_phase3_sessions_rls.sql` | RLS for sessions + helpers |

**Updated files:**
- `src/app/app/layout.tsx` — Added "Session" tab to bottom nav (4 tabs: Explore/ActiVity/Session/Wallet)
- `src/app/app/booking/[id]/BookingConfirmScreen.tsx` — Added "Get Entry QR" button
- `src/app/app/activity/ActivityScreen.tsx` — Active session banner, auto-close badge in history
- `src/app/app/activity/page.tsx` — Passes activeSession prop
- `src/app/app/home/HomeScreen.tsx` — Active session banner, peak/off-peak live indicator
- `src/app/app/home/page.tsx` — Passes activeSession prop

**Supabase changes:**
- New migration: `202604210001_phase3_sessions_rls.sql`
  - RLS policies for sessions table (insert/update/select)
  - Widened bookings policies (completed status, QR field updates)
  - audit_log user scan insert policy
  - `compute_session_deduction()` DB helper function

**Free-tier decisions:**
- QR crypto in Next.js API routes (not Edge Functions) — saves Edge Function cold starts
- Auto-close via Vercel cron (free on hobby) + lazy trigger on app open
- QR image rendering via `qrserver.com` free API (no npm package needed)
- jsQR loaded from cdnjs (free CDN) for camera scanning

### ⚠️ Known stubs / deferred items
- Payment gateway (Razorpay): Phase 5
- Phone OTP: requires paid SMS provider. Use `/dev-login`
- Supabase Realtime slot availability: Phase 4 (currently static fetch)
- Full gym owner dashboard (session history, settlement view): Phase 4
- Post-session rating prompt: Phase 5
- Push notifications: Phase 5

---

## Established Conventions

- **Dev auth:** Always use `/dev-login`. Accounts: `user1@joinvigor.co`, `user2@joinvigor.co`, `user3@joinvigor.co`, `owner@ironrepublic.in`, `owner@centurionfitness.in`, `owner@fitzone.in`, `admin@joinvigor.co` — all `Password123!`.
- **Mutations:** API Routes for all writes from client components. Server components read directly.
- **Supabase clients:**
  - Browser — `src/lib/supabase/browser.ts`
  - Server (user-scoped) — `src/lib/supabase/server.ts`
  - Admin (service_role) — `src/lib/supabase/admin.ts` ← NEW in Phase 3; use only in `/api/**` routes
- **Shared types:** `import type { Venue, Booking } from '@vigor/types'`
- **Shared logic:** `import { TIER_BASE_RATES, calculateDeduction } from '@vigor/lib/tokens/formula'`
- **Mobile viewport:** All `/app/**` pages use `.mobile-viewport` class on root div. API routes excluded from mobile redirect.
- **Animation:** `.card-enter` on list item roots, `.page-slide-in` on page roots.
- **CSS variables:** `--color-deep-space`, `--color-card-dark` used inline where Tailwind can't reach.
- **RLS rule:** API routes run as authenticated user (anon key + JWT), not service_role. Exception: validate-scan and auto-close use admin client (service_role) because they write audit_log and token_ledger on behalf of the platform.
- **No raw hex in code.** Use Tailwind tokens in className or CSS variables inline.
- **Logo:** Always use `VigorLogo` (full) or `VigorMark` (icon only) from `@/components/VigorLogo`. Never inline SVG logo code in pages.
- **QR signing secret:** Always read from `process.env.SUPABASE_JWT_SECRET`. Never hardcoded. Falls back to anon key in dev.
- **Peak hours:** IST 6–9am and 5–9pm. Server is UTC — always convert: `(utcHour + 5 + minuteCarry) % 24`.

---

## Folder Structure

> Reflects state after Phase 3.

```
/
├── vercel.json                              ← NEW: Vercel cron for auto-close
├── apps/web/src/
│   ├── app/
│   │   ├── page.tsx                         # → /login
│   │   ├── layout.tsx / globals.css
│   │   ├── login/                           # Phone OTP
│   │   ├── gym/login/                       # Email OTP
│   │   ├── mobile-only/                     # Desktop fallback
│   │   ├── dev-login/                       # ⚠️ Dev only
│   │   ├── auth/callback/
│   │   │
│   │   ├── app/                             # ✅ User PWA
│   │   │   ├── layout.tsx                   # Bottom nav — 4 tabs now (+ Session)
│   │   │   ├── page.tsx                     # → /app/home
│   │   │   ├── home/{page,HomeScreen}.tsx   # ✅ Updated: active session banner
│   │   │   ├── explore/{page,ExploreScreen}.tsx
│   │   │   ├── venue/[id]/{page,VenueDetailScreen}.tsx
│   │   │   ├── booking/[id]/{page,BookingConfirmScreen}.tsx  # ✅ Updated: Get Entry QR btn
│   │   │   ├── wallet/{page,WalletScreen}.tsx
│   │   │   ├── activity/{page,ActivityScreen}.tsx  # ✅ Updated: active session banner
│   │   │   └── session/{page,ActiveSessionScreen}.tsx  # ← NEW: QR display
│   │   │
│   │   ├── api/
│   │   │   ├── bookings/route.ts
│   │   │   ├── bookings/[id]/cancel/route.ts
│   │   │   ├── bookings/[id]/no-show/route.ts
│   │   │   ├── wallet/route.ts
│   │   │   ├── wallet/purchase/route.ts
│   │   │   ├── user/profile/route.ts
│   │   │   └── sessions/                    ← NEW in Phase 3
│   │   │       ├── generate-entry-qr/route.ts
│   │   │       ├── generate-exit-qr/route.ts
│   │   │       ├── validate-scan/route.ts   # Uses admin (service_role) client
│   │   │       ├── auto-close/route.ts      # POST + GET (Vercel cron)
│   │   │       ├── active/route.ts
│   │   │       └── upcoming-bookings/route.ts
│   │   │
│   │   ├── gym/                             # ✅ Phase 3 (basic) — Phase 4 expands
│   │   │   ├── page.tsx                     # Gym owner dashboard home
│   │   │   ├── login/
│   │   │   └── scan/{page,GymScanPortal}.tsx  ← NEW: camera QR scanner
│   │   │
│   │   └── admin/                           # 🔲 Phase 5
│   │
│   ├── components/
│   │   ├── TierBadge.tsx
│   │   ├── TokenChip.tsx
│   │   └── VigorLogo.tsx
│   ├── lib/supabase/{browser,server,admin}.ts  ← admin.ts NEW in Phase 3
│   └── middleware.ts
│
├── packages/
│   ├── lib/{supabase,qr/hmac.ts,tokens/formula.ts}
│   └── types/index.ts
│
└── supabase/
    ├── migrations/
    │   ├── 202604170001_initial_schema.sql
    │   ├── 202604170002_rls_policies.sql
    │   ├── 202604180001_phase2_rls_fixes.sql
    │   └── 202604210001_phase3_sessions_rls.sql  ← NEW
    ├── seed.sql
    ├── fix_auth_passwords.sql
    └── config.toml
```

---

## Phase 4 Preview — Gym Owner Portal

Phase 4 builds the full gym owner dashboard around the Phase 3 scan portal:

- `app/gym/dashboard/` — Full session log (today/week/month), realtime occupancy via Supabase Realtime
- `app/gym/sessions/` — Paginated session history with search and filters
- `app/gym/settlements/` — Token consumption counter, estimated payout, settlement history
- `app/gym/venue/` — Venue profile editor: hours, description, amenity tags
- `app/gym/ratings/` — Average score, recent reviews
- Supabase Realtime subscription for live occupancy updates on the dashboard
- API routes: `/api/gym/sessions`, `/api/gym/settlement`, `/api/gym/venue`

---

*Last updated: Phase 3 complete — April 2026.*
