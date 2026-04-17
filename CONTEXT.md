# Vigor — Project Context

> **Paste this file at the top of every new LLM session.**
> After each phase, update the "Current Status" and "Established Conventions" sections.

---

## What Vigor Is

Vigor is a token-based fitness marketplace for India. Users buy token bundles and spend them across any venue on the platform — gyms, yoga studios, pools, CrossFit boxes — instead of being locked into one subscription. Venues are paid per token consumed during settlement cycles. The platform earns the margin between token purchase price and gym payout rate.

**Three interfaces:**
1. **User App** — mobile-first (React Native, iOS + Android)
2. **Gym Dashboard** — web portal for venue owners
3. **Admin Center** — internal web tool for platform operations

---

## Tech Stack

### Monorepo (Turborepo)
```
/apps
  /web          → Next.js App Router (Admin Center + Gym Dashboard + Landing Page)
  /mobile       → React Native (User App — iOS + Android)

/packages
  /ui           → Shared component library (shadcn/ui + Tailwind)
  /lib          → Supabase client, API logic, QR utilities
  /types        → Shared TypeScript types across all apps
```

### Frontend
- **Web:** Next.js App Router, Tailwind CSS, shadcn/ui
- **Mobile:** React Native (single codebase, iOS + Android)
- ~70% logic reuse via `/packages`

### Backend
- **Supabase** — primary backend
  - PostgreSQL: all transactional data
  - Supabase Auth: phone OTP (users), email + OTP 2FA (gym owners, admin)
  - Supabase Realtime: live slot availability, occupancy, session state
  - Supabase Storage: venue images, QR seed assets
  - Supabase Edge Functions: token deduction, QR validation, settlement calculations, audit log writes
- **Node.js / NestJS** — future microservice for complex settlement batching (not MVP)
- **Python** — ML dynamic pricing microservice (Phase 4+); consumes session/booking data, outputs multiplier suggestions

### Infrastructure
- Next.js → Vercel (or AWS Amplify / GCP Cloud Run)
- React Native → App Store + Google Play
- ML service → AWS or GCP
- Separate dev / staging / production environments

### Other Services
- **SMS OTP:** MSG91 (or equivalent Indian gateway) via Supabase Auth
- **Push notifications:** Firebase Cloud Messaging (FCM)
- **Payments:** Razorpay (India-first) — stubbed at MVP, wired in Phase 5
- **QR crypto:** HMAC-SHA256, server-generated, server-validated

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

# Auth / SMS
SUPABASE_SMS_PROVIDER=msg91
MSG91_API_KEY=

# Payments
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Push Notifications
FCM_SERVER_KEY=
NEXT_PUBLIC_FCM_VAPID_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

---

## Database — Core Tables (schema source of truth)

> **Replace this section with your actual `pg_dump --schema-only` output after Phase 1.**

Planned tables (to be replaced with live SQL):

| Table | Purpose |
|---|---|
| `users` | Registered users, phone, profile |
| `venues` | Gyms/studios, tier, location, status |
| `venue_slots` | Bookable time slots per venue |
| `bookings` | Slot reservations (no token deduction here) |
| `sessions` | Active/closed check-in sessions |
| `token_bundles` | Admin-configured bundle products |
| `token_ledger` | Per-user token purchases and deductions (append-only) |
| `audit_log` | Every scan, deduction, auto-close, governance action (append-only, never updated or deleted) |
| `settlements` | Per-venue settlement cycles and payouts |
| `ratings` | Post-session user ratings per venue |
| `commitments` | User gym-level commitment records |
| `kiosk_devices` | Registered kiosk tablets per venue |
| `venue_pricing` | Dynamic pricing multipliers per venue per hour |
| `guests` | Guest-access records linked to host bookings |
| `admin_actions` | Governance log (warnings, re-audits, delistings, bans) |

---

## Business Rules — Non-Negotiable in Code

These are hard constraints that must be enforced at the database and edge function level, not just the UI:

1. **Tokens are never deducted at booking — only at exit scan or auto-close.**
2. Entry QR is **single-use** and expires **15 minutes** after slot start time.
3. Exit QR **refreshes every 60 seconds** — the previous QR is invalid immediately on refresh.
4. Auto-close triggers at **4 hours post-entry** if no exit scan recorded (configurable per venue type by Admin).
5. No-show or cancellation within 2 hours of slot deducts exactly **1 token**.
6. Peak multiplier **cannot exceed 2× base rate** for the tier.
7. Off-peak multiplier **cannot go below 0.6× base rate** for the tier.
8. Commitment discount **stacks** with bundle discount — both applied at exit deduction.
9. Guest token deduction comes **entirely from the host's balance**.
10. All scan events write to `audit_log` — **no row is ever updated or deleted**.
11. Settlement payouts require **Admin approval** before execution — never automatic.
12. Token expiry triggers a **15-day grace period** at 50% face value, then full lapse.

---

## Token System Summary

- Users buy bundles (Admin-configured): small / medium / large, tiered by volume and validity (30 / 60 / 90 days).
- Tokens are non-transferable and non-refundable except for platform fault.
- Deduction at exit = `venue_tier_base_rate × peak_or_offpeak_multiplier × (1 − commitment_discount_if_any)`.
- Bundle discount is baked into the per-token purchase price, not the deduction formula.
- Grace period push notifications: 7 days before expiry, on expiry day, at grace period end.

---

## Entry / Exit Flow (reference for all QR work)

```
User books slot (no token deducted)
  ↓
User arrives → presents Entry QR
  ↓ (single-use, expires 15 min after slot start)
Staff / kiosk scans → session opened → audit_log write
  ↓
User works out
  ↓
User leaves → presents Exit QR
  ↓ (time-bound, refreshes every 60s)
Staff / kiosk scans → session closed → token deduction calculated + executed → audit_log write → session summary shown to user
  ↓
[If no exit within 4 hrs] → auto-close cron → standard rate deduction → audit_log write
```

---

## Venue Tier System

| Tier | Base rate | Audit criteria |
|---|---|---|
| Bronze | Lowest | Basic equipment, limited amenities |
| Silver | Mid | Moderate equipment, some amenities |
| Gold | Highest | Full equipment, AC, lockers, classes, certified trainers |

Tier is set by Admin via checklist audit. Reviewed every 6 months or triggered if venue rating drops below threshold.

---

## Rating & Governance

- Rating prompt appears after every session exit, before next booking (dismissable once).
- Thresholds (exact values set by Admin): warning → mandatory re-audit → auto-delist.
- Gyms can flag users for misconduct → Admin review → suspend or ban.
- All governance actions logged in `audit_log`.

---

## Brand & Design

**Color palette:**
```
Deep Space:    #1A1A2E  (primary background)
Card Dark:     #23233A  (card/surface background)
Vigor Violet:  #6C63FF  (primary CTA, brand accent)
Pulse Green:   #39D98A  (token amounts, success states)
Burn Coral:    #FF6B6B  (peak pricing, alerts)
Tempo Amber:   #FFD166  (warnings, off-peak end)
Frost:         #F5F4FF  (light text on dark)
Light Surface: #EEEEFF  (light mode surface)
```

**Tier badge colors:**
```
Bronze:    #CD7F32
Silver:    #8A9BB5
Gold:      #B8860B
```

**Status pill colors:**
```
Off-peak:  Vigor Violet (#6C63FF)
Peak:      Burn Coral (#FF6B6B)
Committed: Pulse Green (#27B06A)
```

**Typography:** Inter or system-ui. Scale: 28px/500 (hero) → 18px/500 (section) → 15px/400 (body) → 12px/500 uppercase (labels). Letter spacing: −0.03em on headings, +0.06–0.08em on caps labels.

**Motion:**
- Cards: `translateY(12px) → 0`, 200ms, `ease-out`
- Page transitions: horizontal slide, 250ms, `cubic-bezier(0.4, 0, 0.2, 1)`
- QR scan success: screen blooms green, haptic pulse, auto-closes
- Token deduction: counter ticks down with brief amber flash
- Bottom sheets: spring physics, slight overshoot

**Logo:** Geometric upward V chevron with single horizontal crossbar. Wordmark: "Vigor" with V in Vigor Violet.

---

## Phase Plan Overview

| Phase | Title | Est. Duration | Status |
|---|---|---|---|
| P1 | Foundation — schema, auth, seed data | ~1 week | 🔲 Not started |
| P2 | User mobile web — browse, book, wallet | ~1.5 weeks | 🔲 Not started |
| P3 | QR system — entry, exit, session lifecycle | ~1.5 weeks | 🔲 Not started |
| P4 | Gym owner portal — dashboard, sessions, settlements | ~1 week | 🔲 Not started |
| P5 | Ratings, payments, production hardening | ~1 week | 🔲 Not started |

**Scope decisions locked for this build:**
- Phase 1 starts now — 2–3 gyms, 2–3 users seeded
- **No React Native at MVP** — user app is Next.js PWA (mobile viewport only; desktop shows "open on mobile" page)
- No dynamic pricing until Phase 4 (flat tier base rates throughout P1–P3)
- No payment gateway until Phase 5 (bundle purchase is a stub)

---

## Current Status

> **Update this section after every phase.**

- [ ] Phase 1 complete
- [ ] Schema exported and pasted below
- [ ] Seed data live
- [ ] Auth working (user phone OTP, gym email OTP)
- [ ] Established conventions documented below

**Live schema SQL:** *(paste `pg_dump --schema-only` output here after Phase 1)*

---

## Established Conventions

> **Update this section as conventions emerge during the build.**

- [ ] Server actions vs API routes decision: *(e.g., "we use server actions for all mutations")*
- [ ] Supabase client location: `/packages/lib/supabase/`
- [ ] Shared types location: `/packages/types/`
- [ ] Component primitives: shadcn/ui only — do not create custom primitives that duplicate shadcn
- [ ] Loading spinner: `/packages/ui/spinner.tsx` — do not create new ones
- [ ] All Supabase Edge Functions in: `supabase/functions/`
- [ ] Mobile viewport lock: `max-w-[430px] mx-auto` on root layout; desktop redirect handled by Next.js middleware at `/middleware.ts`

---

## Folder Structure

> **Update this as the repo is scaffolded.**

```
/
├── apps/
│   ├── web/                    # Next.js — Admin Center + Gym Dashboard + Landing
│   │   ├── app/
│   │   │   ├── (admin)/        # Admin Center routes
│   │   │   ├── (gym)/          # Gym Dashboard routes
│   │   │   ├── (user)/         # User PWA routes (mobile-only)
│   │   │   └── middleware.ts   # Mobile detection + auth guards
│   │   └── ...
│   └── mobile/                 # React Native — future
├── packages/
│   ├── ui/                     # Shared shadcn/ui components
│   ├── lib/
│   │   ├── supabase/           # Supabase clients (browser + server + admin)
│   │   ├── qr/                 # QR generation + validation utilities
│   │   └── tokens/             # Token deduction formula helpers
│   └── types/                  # Shared TypeScript interfaces
├── supabase/
│   ├── migrations/             # All schema migrations (version-controlled)
│   ├── functions/              # Edge Functions
│   └── seed.sql                # Seed data script
└── CONTEXT.md                  # ← this file
```

---

*Last updated: Phase 0 (pre-build). Update after each phase.*
