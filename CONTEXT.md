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
- Supabase Edge Functions: QR generation/validation, token deduction (Phase 3)
- Supabase Cron: auto-close sessions > 4 hrs (Phase 3)

### Other Services
- SMS OTP: MSG91/Twilio via Supabase Auth — deferred; use /dev-login in dev
- Payments: Razorpay — stubbed Phase 2, wired Phase 5
- Push: Firebase Cloud Messaging (Phase 5)

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
MSG91_API_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
FCM_SERVER_KEY=
NEXT_PUBLIC_FCM_VAPID_KEY=
NEXT_PUBLIC_APP_URL=
```

---

## Database

See `supabase/migrations/202604170001_initial_schema.sql` for full DDL.

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
- Tier base rates: Bronze 6, Silver 10, Gold 15
- Peak hours: 6–9am and 5–9pm. Multiplier: 1.5× peak, 1.0× off-peak
- Bundle discount is baked into purchase price, not deduction formula
- Grace period notifications: 7 days before, on expiry day, at grace end

---

## Entry / Exit Flow

```
Book slot → no tokens deducted
↓
Arrive → show Entry QR → staff scans → session open → audit_log write
↓
Work out
↓
Leave → show Exit QR (60s refresh) → staff scans → session closed → tokens deducted → audit_log write
↓
[No exit in 4hrs] → auto-close cron → standard rate deducted
```

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
| P3 | QR system — entry, exit, session lifecycle | 🔲 Next |
| P4 | Gym owner portal — dashboard, sessions, settlements | 🔲 |
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

**Shell & navigation**
- `app/app/layout.tsx` — bottom nav (Explore / ActiVity / Wallet), fixed, blurred
- `app/app/page.tsx` — redirects to `/app/home`
- Middleware updated: API routes (`/api/**`) excluded from mobile-only redirect

**Screens built**
| Route | File | What it does |
|---|---|---|
| `/app/home` | `home/page.tsx` + `HomeScreen.tsx` | Greeting, token balance chip, expiry warning, nearby venues (4 cards), category filter, upcoming booking preview, how-it-works, CTA |
| `/app/explore` | `explore/page.tsx` + `ExploreScreen.tsx` | Search bar, activity filter chips, tier filter, sort (rating/cheapest/premium), full venue list with peak cost preview |
| `/app/venue/[id]` | `venue/[id]/page.tsx` + `VenueDetailScreen.tsx` | Hero, stats (rating/hours/base cost), commitment badge + discount, description, amenity chips, 3-day slot picker (peak/off-peak cost per slot), recent ratings, fixed-bottom booking CTA with balance check |
| `/app/booking/[id]` | `booking/[id]/page.tsx` + `BookingConfirmScreen.tsx` | Booking status, venue/slot details, check-in instructions, free cancel vs 1-token late-cancel button |
| `/app/wallet` | `wallet/page.tsx` + `WalletScreen.tsx` | Balance card with expiry progress bar, grace token display, bundle selector (best-value badge), purchase CTA (stub), transaction history with credits/debits filter |
| `/app/activity` | `activity/page.tsx` + `ActivityScreen.tsx` | Two tabs: Upcoming (confirmed future bookings) + History (sessions with duration/tokens) |

**API routes**
| Route | Method | Purpose |
|---|---|---|
| `/api/bookings` | POST | Create booking: validates slot, 48hr window, no-dup, increments booked_count |
| `/api/bookings/[id]/cancel` | POST | Cancel: free >2hrs, 1-token penalty <2hrs, decrements booked_count |
| `/api/bookings/[id]/no-show` | POST | Admin only: mark no_show + 1-token penalty + audit_log |
| `/api/wallet` | GET | Live token balance (available + grace + earliestExpiry) |
| `/api/wallet/purchase` | POST | Stub purchase: validates bundle, inserts ledger entry, sets expiry |
| `/api/user/profile` | GET + PATCH | Read profile or update name/email |

**Shared components**
- `src/components/TierBadge.tsx` — Bronze/Silver/Gold styled badge
- `src/components/TokenChip.tsx` — balance pill linking to `/app/wallet`
- `src/components/VigorLogo.tsx` — `VigorLogo` (full wordmark, height prop) + `VigorMark` (V icon only)

**Migration**
- `supabase/migrations/202604180001_phase2_rls_fixes.sql` — adds `ledger_user_insert`, `slots_booking_update`, widens `bookings_user_cancel`, adds `audit_admin_insert`

**Dev login**
- `/dev-login` still the only way to authenticate in dev
- All 7 accounts redirect correctly: users → `/app/home`, gym owners → `/gym`, admin → `/admin`

### ⚠️ Known stubs / deferred items
- Payment gateway (Razorpay): Phase 5. Purchase stub records ledger entry without payment verification.
- Phone OTP: requires paid SMS provider. Use `/dev-login`.
- Slot availability via Supabase Realtime: Phase 3 (currently static fetch).
- Active Session screen (QR display): Phase 3.

---

## Established Conventions

- **Dev auth:** Always use `/dev-login`. Accounts: `user1@joinvigor.co`, `user2@joinvigor.co`, `user3@joinvigor.co`, `owner@ironrepublic.in`, `owner@centurionfitness.in`, `owner@fitzone.in`, `admin@joinvigor.co` — all `Password123!`.
- **Mutations:** API Routes for all writes from client components. Server components read directly.
- **Supabase clients:** Browser — `src/lib/supabase/browser.ts`. Server — `src/lib/supabase/server.ts`. Admin (service role) — `packages/lib/supabase/admin.ts`, Edge Functions only.
- **Shared types:** `import type { Venue, Booking } from '@vigor/types'`
- **Shared logic:** `import { TIER_BASE_RATES, calculateDeduction } from '@vigor/lib/tokens/formula'`
- **Mobile viewport:** All `/app/**` pages use `.mobile-viewport` class on root div. API routes excluded from mobile redirect.
- **Animation:** `.card-enter` on list item roots, `.page-slide-in` on page roots.
- **CSS variables:** `--color-deep-space`, `--color-card-dark` used inline where Tailwind can't reach.
- **RLS rule:** API routes run as authenticated user (anon key + JWT), not service_role. Tables needing API writes must have user-facing INSERT/UPDATE policies. See Phase 2 migration.
- **No raw hex in code.** Use Tailwind tokens in className or CSS variables inline.
- **Logo:** Always use `VigorLogo` (full) or `VigorMark` (icon only) from `@/components/VigorLogo`. Never inline SVG logo code in pages.
- **Edge Functions:** QR crypto, token deduction, audit log writes from scan events only. Never in API routes.

---

## Folder Structure

> Reflects state after Phase 2.

```
/
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
│   │   │   ├── layout.tsx                   # Bottom nav shell
│   │   │   ├── page.tsx                     # → /app/home
│   │   │   ├── home/{page,HomeScreen}.tsx
│   │   │   ├── explore/{page,ExploreScreen}.tsx
│   │   │   ├── venue/[id]/{page,VenueDetailScreen}.tsx
│   │   │   ├── booking/[id]/{page,BookingConfirmScreen}.tsx
│   │   │   ├── wallet/{page,WalletScreen}.tsx
│   │   │   └── activity/{page,ActivityScreen}.tsx
│   │   │
│   │   ├── api/
│   │   │   ├── bookings/route.ts            # POST create booking
│   │   │   ├── bookings/[id]/cancel/route.ts
│   │   │   ├── bookings/[id]/no-show/route.ts
│   │   │   ├── wallet/route.ts              # GET balance
│   │   │   ├── wallet/purchase/route.ts     # POST stub purchase
│   │   │   └── user/profile/route.ts        # GET + PATCH
│   │   │
│   │   ├── gym/                             # 🔲 Phase 4
│   │   └── admin/                           # 🔲 Phase 5
│   │
│   ├── components/
│   │   ├── TierBadge.tsx
│   │   └── TokenChip.tsx
│   ├── lib/supabase/{browser,server}.ts
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
    │   └── 202604180001_phase2_rls_fixes.sql  ← NEW
    ├── seed.sql
    ├── fix_auth_passwords.sql
    └── config.toml
```

---

## Phase 3 Preview — QR System

Phase 3 builds directly on Phase 2's booking infrastructure:

- `supabase/functions/generate-entry-qr` — HMAC-SHA256, single-use, 15-min expiry
- `supabase/functions/generate-exit-qr` — refreshes every 60s, previous hash invalidated
- `supabase/functions/validate-scan` — validates QR → opens/closes session → token deduction at exit → audit_log
- `supabase/functions/auto-close-sessions` — pg_cron job, runs every 15 min, closes sessions > 4 hrs
- `app/app/activity/` — Active Session screen added (live QR display + 60s countdown)
- `app/gym/` — QR scanner portal (mobile camera, jsQR/ZXing) — Phase 4 will build full dashboard around it

---

*Last updated: Phase 2 complete — April 2026.*
