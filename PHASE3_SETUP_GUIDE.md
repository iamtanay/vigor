# Phase 3 — Supabase Setup Guide & Implementation Notes

Complete step-by-step for everything that must be done in Supabase UI and locally.

---

## 1. Run the Migration in Supabase UI

**Where:** Supabase Dashboard → SQL Editor → New query

**What to run:** Copy the entire contents of:
```
supabase/migrations/202604210001_phase3_sessions_rls.sql
```

Then click **Run**.

This migration adds:
- RLS policies for the `sessions` table (insert/update/select by user + service_role)
- Widened `bookings` policies (allow marking `completed`, allow updating QR fields)
- `audit_log` user insert policy for scan events
- `venue_pricing` read policy
- `compute_session_deduction()` helper function (used for reference — actual deduction logic is in the API route)

> ⚠️ If you get "policy already exists" errors, just skip those lines — they're safe to ignore.

---

## 2. Add New Environment Variables

Open `apps/web/.env.local` and add:

```bash
# Already set from Phase 1:
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# NEW in Phase 3:
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # From: Supabase Dashboard → Settings → API → service_role key
SUPABASE_JWT_SECRET=your-secret     # From: Supabase Dashboard → Settings → API → JWT Secret
NEXT_PUBLIC_APP_URL=http://localhost:3000   # Change to your Vercel URL in production
CRON_SECRET=make-up-a-random-string  # Optional — protects the cron GET endpoint
```

**Where to find them in Supabase:**
1. Go to your Supabase project dashboard
2. Click **Settings** (gear icon, bottom left)
3. Click **API**
4. Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`
5. Copy **JWT Secret** → `SUPABASE_JWT_SECRET`

> ⚠️ NEVER commit these to git. They're already in `.gitignore` via `.env.local`.

---

## 3. Verify the `sessions` Table Exists

The sessions table was created in Phase 1. Confirm it has the right columns:

**Supabase Dashboard → Table Editor → sessions**

Should have:
- `id` UUID
- `booking_id` UUID (FK → bookings)
- `user_id` UUID (FK → users)
- `venue_id` UUID (FK → venues)
- `status` session_status enum (`open` / `closed` / `auto_closed`)
- `entry_scanned_at` TIMESTAMPTZ nullable
- `exit_scanned_at` TIMESTAMPTZ nullable
- `auto_closed_at` TIMESTAMPTZ nullable
- `tokens_deducted` INTEGER nullable

If any column is missing, run this in SQL Editor:
```sql
-- Add missing columns if needed
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auto_closed_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tokens_deducted INTEGER;
```

---

## 4. Verify `audit_log` Table Has Required Columns

**Supabase Dashboard → Table Editor → audit_log**

Should have (among others):
- `session_id` UUID nullable
- `booking_id` UUID nullable
- `qr_hash` TEXT nullable
- `scan_method` scan_method enum nullable
- `token_delta` INTEGER nullable
- `metadata` JSONB nullable

If missing:
```sql
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS qr_hash TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS scan_method scan_method;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS token_delta INTEGER;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
```

---

## 5. Check `token_ledger` Has `session_id` Column

```sql
ALTER TABLE token_ledger ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id);
ALTER TABLE token_ledger ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id);
```

---

## 6. Verify `bookings` Has QR Columns

Should already exist from Phase 1, but verify:
```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS entry_qr_hash TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS entry_qr_expires_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS entry_qr_used BOOLEAN NOT NULL DEFAULT FALSE;
```

---

## 7. Copy New Files into Your Codebase

Copy these files from the Phase 3 deliverable into your project:

### New API routes (copy to `apps/web/src/app/api/sessions/`):
- `generate-entry-qr/route.ts`
- `generate-exit-qr/route.ts`
- `validate-scan/route.ts`
- `auto-close/route.ts`
- `active/route.ts`
- `upcoming-bookings/route.ts`

### New admin Supabase client:
- `apps/web/src/lib/supabase/admin.ts`

### New user screens:
- `apps/web/src/app/app/session/page.tsx`
- `apps/web/src/app/app/session/ActiveSessionScreen.tsx`

### New gym portal:
- `apps/web/src/app/gym/page.tsx` (replace existing)
- `apps/web/src/app/gym/scan/page.tsx`
- `apps/web/src/app/gym/scan/GymScanPortal.tsx`

### Replace these existing files:
- `apps/web/src/app/app/layout.tsx` (adds Session tab)
- `apps/web/src/app/app/booking/[id]/BookingConfirmScreen.tsx` (adds Get Entry QR button)
- `apps/web/src/app/app/activity/ActivityScreen.tsx` (active session banner)
- `apps/web/src/app/app/activity/page.tsx` (passes activeSession)
- `apps/web/src/app/app/home/HomeScreen.tsx` (active session banner)
- `apps/web/src/app/app/home/page.tsx` (passes activeSession)
- `CONTEXT.md` (updated)

### Root level:
- `vercel.json` (Vercel cron config)

---

## 8. Setup Vercel Cron (Free — Replaces pg_cron)

The `vercel.json` at root configures a cron job that calls `/api/sessions/auto-close` every 15 minutes.

**This is free on Vercel Hobby plan** (1 cron job, max 1/day on Hobby — upgrade to Pro for more frequent).

> ⚠️ On Vercel Hobby, cron jobs run once per day maximum. For the auto-close to work more frequently in production on the free plan, the lazy trigger approach (called when user opens the active session screen) covers most cases.

For local dev: auto-close is triggered whenever you call `GET /api/sessions/auto-close` or open the active session screen.

**To test cron locally:**
```bash
curl -X POST http://localhost:3000/api/sessions/auto-close
```

---

## 9. Test the Complete Flow (Dev)

### Step 1: Create a booking
1. Log in as `user1@joinvigor.co` via `/dev-login`
2. Browse to `/app/explore`
3. Pick a venue → select a slot → confirm booking

### Step 2: Get Entry QR (as user)
1. Go to `/app/activity` → click your upcoming booking
2. On the Booking Confirm screen, tap **"Get Entry QR"**
3. You'll see a QR code with a countdown timer
4. **Copy the QR string** from browser devtools (Network tab → generate-entry-qr → response → `qrString`) for testing

### Step 3: Scan Entry QR (as gym owner)
1. Log out, log in as `owner@ironrepublic.in` via `/dev-login`
2. Go to `/gym/scan`
3. Click **"Use manual QR input"**
4. Paste the entry QR string
5. Click **"Validate QR"**
6. You should see ✅ "Entry Recorded" with the user's name

### Step 4: Show Exit QR (as user)
1. Log back in as `user1@joinvigor.co`
2. Go to `/app/session` (or tap "Session" in bottom nav)
3. You should see the active session with a live Exit QR and 60s countdown

### Step 5: Scan Exit QR (as gym owner)
1. Copy the exit QR string from devtools (Network → generate-exit-qr → `qrString`)
2. Back in gym owner account, go to `/gym/scan`
3. Paste exit QR string → Validate
4. You should see 🏁 "Exit Recorded" with tokens deducted

### Step 6: Verify in Supabase
- **Table Editor → sessions**: Row should show `status = 'closed'`, `tokens_deducted` filled
- **Table Editor → audit_log**: Two rows — `entry_scan` and `exit_scan`
- **Table Editor → token_ledger**: New `deduction` row

---

## 10. Supabase Free Plan Limits — What's Used

| Feature | Free Tier Limit | Phase 3 Usage |
|---|---|---|
| Database | 500MB | Well within |
| Auth | 50,000 users | Well within |
| Edge Functions | 500K invocations/month | **NOT USED** — using Next.js API routes instead |
| Realtime | 200 concurrent connections | Not used yet (Phase 4) |
| Storage | 1GB | Not used yet |
| pg_cron | **NOT available on free** | Using Vercel cron instead ✅ |

---

## 11. No Paid Services Used in Phase 3

| What | Free solution used |
|---|---|
| QR code generation | `qrserver.com` free API (no key) |
| QR code scanning | jsQR from cdnjs.com (free CDN) |
| Auto-close cron | Vercel cron (free on hobby) |
| HMAC crypto | Web Crypto API (built into Node/browser) |
| Token deduction | Server-side calculation in API route |

---

## 12. Known Limitations (acceptable for build phase)

1. **QR image depends on qrserver.com** — requires internet. For offline testing, the canvas shows a placeholder. In production, consider generating QR as SVG server-side using the `qrcode` npm package.

2. **Camera scanning requires HTTPS** — `navigator.mediaDevices.getUserMedia` only works on HTTPS or localhost. Works fine on Vercel (HTTPS) and localhost. Won't work on HTTP.

3. **Peak hour calc uses server UTC** — converted to IST (+5:30) in the validate-scan route. Tested for correctness. If server TZ changes, re-check the conversion.

4. **Auto-close is eventually consistent** — not real-time. Sessions are closed within 15 minutes of the 4-hour threshold (cron interval). This is acceptable for MVP.

5. **Exit QR polling** — The user's browser calls `/api/sessions/generate-exit-qr` every 60s. This is 1 Supabase read per minute per active user — well within free tier limits.
