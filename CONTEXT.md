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
[
  {
    "table_name": "admin_actions",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "admin_actions",
    "column_name": "action_type",
    "data_type": "USER-DEFINED",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "admin_actions",
    "column_name": "admin_user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "admin_actions",
    "column_name": "target_user_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "admin_actions",
    "column_name": "target_venue_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "admin_actions",
    "column_name": "reason",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "admin_actions",
    "column_name": "metadata",
    "data_type": "jsonb",
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "table_name": "admin_actions",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_name": "audit_log",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "audit_log",
    "column_name": "event_type",
    "data_type": "USER-DEFINED",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "audit_log",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "audit_log",
    "column_name": "venue_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "audit_log",
    "column_name": "session_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "audit_log",
    "column_name": "booking_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "audit_log",
    "column_name": "token_amount",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "audit_log",
    "column_name": "qr_hash",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "audit_log",
    "column_name": "scan_method",
    "data_type": "USER-DEFINED",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "audit_log",
    "column_name": "scanned_by_user_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "audit_log",
    "column_name": "kiosk_device_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "audit_log",
    "column_name": "metadata",
    "data_type": "jsonb",
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "table_name": "audit_log",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_name": "bookings",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "bookings",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "bookings",
    "column_name": "venue_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "bookings",
    "column_name": "slot_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "bookings",
    "column_name": "status",
    "data_type": "USER-DEFINED",
    "is_nullable": "NO",
    "column_default": "'confirmed'::booking_status"
  },
  {
    "table_name": "bookings",
    "column_name": "guest_user_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "bookings",
    "column_name": "entry_qr_hash",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "bookings",
    "column_name": "entry_qr_expires_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "bookings",
    "column_name": "entry_qr_used",
    "data_type": "boolean",
    "is_nullable": "NO",
    "column_default": "false"
  },
  {
    "table_name": "bookings",
    "column_name": "cancelled_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "bookings",
    "column_name": "penalty_applied",
    "data_type": "boolean",
    "is_nullable": "NO",
    "column_default": "false"
  },
  {
    "table_name": "bookings",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_name": "bookings",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_name": "commitments",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "commitments",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "commitments",
    "column_name": "venue_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "commitments",
    "column_name": "duration",
    "data_type": "USER-DEFINED",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "commitments",
    "column_name": "status",
    "data_type": "USER-DEFINED",
    "is_nullable": "NO",
    "column_default": "'active'::commitment_status"
  },
  {
    "table_name": "commitments",
    "column_name": "started_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_name": "commitments",
    "column_name": "ends_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "commitments",
    "column_name": "discount_rate",
    "data_type": "numeric",
    "is_nullable": "NO",
    "column_default": "0.10"
  },
  {
    "table_name": "commitments",
    "column_name": "broken_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "commitments",
    "column_name": "break_reason",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "commitments",
    "column_name": "compensation_tokens",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "commitments",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_name": "geography_columns",
    "column_name": "f_table_catalog",
    "data_type": "name",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "geography_columns",
    "column_name": "f_table_schema",
    "data_type": "name",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "geography_columns",
    "column_name": "f_table_name",
    "data_type": "name",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "geography_columns",
    "column_name": "f_geography_column",
    "data_type": "name",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "geography_columns",
    "column_name": "coord_dimension",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "geography_columns",
    "column_name": "srid",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "geography_columns",
    "column_name": "type",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "geometry_columns",
    "column_name": "f_table_catalog",
    "data_type": "character varying",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "geometry_columns",
    "column_name": "f_table_schema",
    "data_type": "name",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "geometry_columns",
    "column_name": "f_table_name",
    "data_type": "name",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "geometry_columns",
    "column_name": "f_geometry_column",
    "data_type": "name",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "geometry_columns",
    "column_name": "coord_dimension",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "geometry_columns",
    "column_name": "srid",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "geometry_columns",
    "column_name": "type",
    "data_type": "character varying",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "kiosk_devices",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "kiosk_devices",
    "column_name": "venue_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "kiosk_devices",
    "column_name": "name",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "kiosk_devices",
    "column_name": "device_token",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "kiosk_devices",
    "column_name": "is_active",
    "data_type": "boolean",
    "is_nullable": "NO",
    "column_default": "true"
  },
  {
    "table_name": "kiosk_devices",
    "column_name": "last_seen_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "kiosk_devices",
    "column_name": "registered_by_user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "kiosk_devices",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_name": "ratings",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "ratings",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "ratings",
    "column_name": "venue_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "ratings",
    "column_name": "session_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "ratings",
    "column_name": "score",
    "data_type": "smallint",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "ratings",
    "column_name": "note",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "ratings",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_name": "sessions",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "sessions",
    "column_name": "booking_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "sessions",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "sessions",
    "column_name": "venue_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "sessions",
    "column_name": "status",
    "data_type": "USER-DEFINED",
    "is_nullable": "NO",
    "column_default": "'open'::session_status"
  },
  {
    "table_name": "sessions",
    "column_name": "entry_scanned_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "sessions",
    "column_name": "exit_scanned_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "sessions",
    "column_name": "auto_closed_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "sessions",
    "column_name": "tokens_deducted",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "sessions",
    "column_name": "peak_multiplier_used",
    "data_type": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "sessions",
    "column_name": "commitment_discount",
    "data_type": "numeric",
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "table_name": "sessions",
    "column_name": "scan_method_entry",
    "data_type": "USER-DEFINED",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "sessions",
    "column_name": "scan_method_exit",
    "data_type": "USER-DEFINED",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "sessions",
    "column_name": "scanned_by_user_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "sessions",
    "column_name": "kiosk_device_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "sessions",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_name": "sessions",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_name": "settlements",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "settlements",
    "column_name": "venue_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "settlements",
    "column_name": "cycle_start",
    "data_type": "date",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "settlements",
    "column_name": "cycle_end",
    "data_type": "date",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "settlements",
    "column_name": "tokens_consumed",
    "data_type": "integer",
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "table_name": "settlements",
    "column_name": "payout_rate_inr",
    "data_type": "integer",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "settlements",
    "column_name": "total_payout_inr",
    "data_type": "integer",
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "table_name": "settlements",
    "column_name": "status",
    "data_type": "USER-DEFINED",
    "is_nullable": "NO",
    "column_default": "'pending'::settlement_status"
  }
]

[
  {
    "table_name": "spatial_ref_sys",
    "column_name": "srid"
  },
  {
    "table_name": "users",
    "column_name": "id"
  },
  {
    "table_name": "users",
    "column_name": "id"
  },
  {
    "table_name": "venues",
    "column_name": "id"
  },
  {
    "table_name": "sessions",
    "column_name": "id"
  },
  {
    "table_name": "sessions",
    "column_name": "id"
  },
  {
    "table_name": "audit_log",
    "column_name": "id"
  },
  {
    "table_name": "venue_slots",
    "column_name": "id"
  },
  {
    "table_name": "token_bundles",
    "column_name": "id"
  },
  {
    "table_name": "token_ledger",
    "column_name": "id"
  },
  {
    "table_name": "bookings",
    "column_name": "id"
  },
  {
    "table_name": "settlements",
    "column_name": "id"
  },
  {
    "table_name": "ratings",
    "column_name": "id"
  },
  {
    "table_name": "commitments",
    "column_name": "id"
  },
  {
    "table_name": "kiosk_devices",
    "column_name": "id"
  },
  {
    "table_name": "venue_pricing",
    "column_name": "id"
  },
  {
    "table_name": "admin_actions",
    "column_name": "id"
  }
]

[
  {
    "table_name": "sessions",
    "column_name": "booking_id",
    "foreign_table": "bookings",
    "foreign_column": "id"
  },
  {
    "table_name": "sessions",
    "column_name": "user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "sessions",
    "column_name": "user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "sessions",
    "column_name": "venue_id",
    "foreign_table": "venues",
    "foreign_column": "id"
  },
  {
    "table_name": "sessions",
    "column_name": "scanned_by_user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "token_ledger",
    "column_name": "session_id",
    "foreign_table": "sessions",
    "foreign_column": "id"
  },
  {
    "table_name": "token_ledger",
    "column_name": "booking_id",
    "foreign_table": "bookings",
    "foreign_column": "id"
  },
  {
    "table_name": "audit_log",
    "column_name": "user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "audit_log",
    "column_name": "venue_id",
    "foreign_table": "venues",
    "foreign_column": "id"
  },
  {
    "table_name": "audit_log",
    "column_name": "session_id",
    "foreign_table": "sessions",
    "foreign_column": "id"
  },
  {
    "table_name": "audit_log",
    "column_name": "booking_id",
    "foreign_table": "bookings",
    "foreign_column": "id"
  },
  {
    "table_name": "venues",
    "column_name": "owner_user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "venue_slots",
    "column_name": "venue_id",
    "foreign_table": "venues",
    "foreign_column": "id"
  },
  {
    "table_name": "token_ledger",
    "column_name": "user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "token_ledger",
    "column_name": "bundle_id",
    "foreign_table": "token_bundles",
    "foreign_column": "id"
  },
  {
    "table_name": "bookings",
    "column_name": "user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "bookings",
    "column_name": "venue_id",
    "foreign_table": "venues",
    "foreign_column": "id"
  },
  {
    "table_name": "bookings",
    "column_name": "slot_id",
    "foreign_table": "venue_slots",
    "foreign_column": "id"
  },
  {
    "table_name": "bookings",
    "column_name": "guest_user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "audit_log",
    "column_name": "scanned_by_user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "settlements",
    "column_name": "venue_id",
    "foreign_table": "venues",
    "foreign_column": "id"
  },
  {
    "table_name": "settlements",
    "column_name": "approved_by_user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "ratings",
    "column_name": "user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "ratings",
    "column_name": "venue_id",
    "foreign_table": "venues",
    "foreign_column": "id"
  },
  {
    "table_name": "ratings",
    "column_name": "session_id",
    "foreign_table": "sessions",
    "foreign_column": "id"
  },
  {
    "table_name": "commitments",
    "column_name": "user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "commitments",
    "column_name": "venue_id",
    "foreign_table": "venues",
    "foreign_column": "id"
  },
  {
    "table_name": "kiosk_devices",
    "column_name": "venue_id",
    "foreign_table": "venues",
    "foreign_column": "id"
  },
  {
    "table_name": "kiosk_devices",
    "column_name": "registered_by_user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "sessions",
    "column_name": "kiosk_device_id",
    "foreign_table": "kiosk_devices",
    "foreign_column": "id"
  },
  {
    "table_name": "venue_pricing",
    "column_name": "venue_id",
    "foreign_table": "venues",
    "foreign_column": "id"
  },
  {
    "table_name": "admin_actions",
    "column_name": "admin_user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "admin_actions",
    "column_name": "target_user_id",
    "foreign_table": "users",
    "foreign_column": "id"
  },
  {
    "table_name": "admin_actions",
    "column_name": "target_venue_id",
    "foreign_table": "venues",
    "foreign_column": "id"
  }
]

[
  {
    "schemaname": "public",
    "tablename": "users",
    "policyname": "users_select_own",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((auth_id = auth.uid()) OR (get_user_role() = 'admin'::user_role))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "users",
    "policyname": "users_update_own",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "(auth_id = auth.uid())",
    "with_check": "((auth_id = auth.uid()) AND (role = 'user'::user_role))"
  },
  {
    "schemaname": "public",
    "tablename": "users",
    "policyname": "users_admin_all",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(get_user_role() = 'admin'::user_role)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "venues",
    "policyname": "venues_public_read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((status = 'active'::venue_status) OR (get_user_role() = ANY (ARRAY['admin'::user_role, 'gym_owner'::user_role])))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "venues",
    "policyname": "venues_owner_update",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "((owner_user_id = get_user_id()) AND (get_user_role() = 'gym_owner'::user_role))",
    "with_check": "((owner_user_id = get_user_id()) AND (tier = ( SELECT venues_1.tier\n   FROM venues venues_1\n  WHERE (venues_1.id = venues_1.id))))"
  },
  {
    "schemaname": "public",
    "tablename": "venues",
    "policyname": "venues_admin_all",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(get_user_role() = 'admin'::user_role)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "venue_slots",
    "policyname": "slots_public_read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "venue_slots",
    "policyname": "slots_owner_write",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM venues v\n  WHERE ((v.id = venue_slots.venue_id) AND (v.owner_user_id = get_user_id()))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "venue_slots",
    "policyname": "slots_admin_all",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(get_user_role() = 'admin'::user_role)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "token_bundles",
    "policyname": "bundles_public_read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((is_active = true) OR (get_user_role() = 'admin'::user_role))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "token_bundles",
    "policyname": "bundles_admin_write",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(get_user_role() = 'admin'::user_role)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "token_ledger",
    "policyname": "ledger_user_read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((user_id = get_user_id()) OR (get_user_role() = 'admin'::user_role))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "token_ledger",
    "policyname": "ledger_service_insert",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(auth.role() = 'service_role'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "bookings",
    "policyname": "bookings_user_own",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((user_id = get_user_id()) OR (guest_user_id = get_user_id()))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "bookings",
    "policyname": "bookings_user_insert",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(user_id = get_user_id())"
  },
  {
    "schemaname": "public",
    "tablename": "bookings",
    "policyname": "bookings_user_cancel",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "((user_id = get_user_id()) AND (status = 'confirmed'::booking_status))",
    "with_check": "(status = 'cancelled'::booking_status)"
  },
  {
    "schemaname": "public",
    "tablename": "bookings",
    "policyname": "bookings_gym_read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((get_user_role() = 'gym_owner'::user_role) AND (EXISTS ( SELECT 1\n   FROM venues v\n  WHERE ((v.id = bookings.venue_id) AND (v.owner_user_id = get_user_id())))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "bookings",
    "policyname": "bookings_admin_all",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(get_user_role() = 'admin'::user_role)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "bookings",
    "policyname": "bookings_service_update",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "(auth.role() = 'service_role'::text)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "sessions",
    "policyname": "sessions_user_own",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(user_id = get_user_id())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "sessions",
    "policyname": "sessions_gym_read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((get_user_role() = 'gym_owner'::user_role) AND (EXISTS ( SELECT 1\n   FROM venues v\n  WHERE ((v.id = sessions.venue_id) AND (v.owner_user_id = get_user_id())))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "sessions",
    "policyname": "sessions_admin_all",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(get_user_role() = 'admin'::user_role)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "sessions",
    "policyname": "sessions_service_all",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(auth.role() = 'service_role'::text)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "audit_log",
    "policyname": "audit_user_own",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(user_id = get_user_id())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "audit_log",
    "policyname": "audit_gym_own",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((get_user_role() = 'gym_owner'::user_role) AND (EXISTS ( SELECT 1\n   FROM venues v\n  WHERE ((v.id = audit_log.venue_id) AND (v.owner_user_id = get_user_id())))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "audit_log",
    "policyname": "audit_admin_all",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(get_user_role() = 'admin'::user_role)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "audit_log",
    "policyname": "audit_service_insert",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(auth.role() = 'service_role'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "settlements",
    "policyname": "settlements_gym_read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((get_user_role() = 'gym_owner'::user_role) AND (EXISTS ( SELECT 1\n   FROM venues v\n  WHERE ((v.id = settlements.venue_id) AND (v.owner_user_id = get_user_id())))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "settlements",
    "policyname": "settlements_admin_all",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(get_user_role() = 'admin'::user_role)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "ratings",
    "policyname": "ratings_public_read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "ratings",
    "policyname": "ratings_user_insert",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(user_id = get_user_id())"
  },
  {
    "schemaname": "public",
    "tablename": "ratings",
    "policyname": "ratings_admin_all",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(get_user_role() = 'admin'::user_role)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "commitments",
    "policyname": "commitments_user_own",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(user_id = get_user_id())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "commitments",
    "policyname": "commitments_user_insert",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(user_id = get_user_id())"
  },
  {
    "schemaname": "public",
    "tablename": "commitments",
    "policyname": "commitments_admin_all",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(get_user_role() = 'admin'::user_role)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "kiosk_devices",
    "policyname": "kiosk_gym_read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((get_user_role() = 'gym_owner'::user_role) AND (EXISTS ( SELECT 1\n   FROM venues v\n  WHERE ((v.id = kiosk_devices.venue_id) AND (v.owner_user_id = get_user_id())))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "kiosk_devices",
    "policyname": "kiosk_admin_all",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(get_user_role() = 'admin'::user_role)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "kiosk_devices",
    "policyname": "kiosk_service_all",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(auth.role() = 'service_role'::text)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "venue_pricing",
    "policyname": "pricing_public_read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(is_active = true)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "venue_pricing",
    "policyname": "pricing_gym_write",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "((get_user_role() = 'gym_owner'::user_role) AND (EXISTS ( SELECT 1\n   FROM venues v\n  WHERE ((v.id = venue_pricing.venue_id) AND (v.owner_user_id = get_user_id())))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "venue_pricing",
    "policyname": "pricing_admin_all",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(get_user_role() = 'admin'::user_role)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "admin_actions",
    "policyname": "admin_actions_admin_all",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(get_user_role() = 'admin'::user_role)",
    "with_check": null
  }
]

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
| P1 | Foundation — schema, auth, seed data | ~1 week | ✅ Complete |
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

> Last updated: Phase 1 complete. Update after each phase.

### ✅ Phase 1 — Foundation (complete)

| Item | Status | Notes |
|---|---|---|
| Supabase schema — all tables, enums, FK constraints | ✅ | `supabase/migrations/202604170001_initial_schema.sql` |
| RLS policies — per-role, all tables | ✅ | `supabase/migrations/202604170002_rls_policies.sql` |
| Append-only `audit_log` (no update/delete) | ✅ | Enforced via RLS: only `service_role` can insert |
| Seed data — 3 venues, 3 users, token bundles, 7-day slots | ✅ | `supabase/seed.sql` |
| Next.js app scaffold — App Router, Tailwind, TypeScript | ✅ | `apps/web/` |
| User login page — `/login` | ✅ | Phone OTP flow (UI complete) |
| Gym owner login page — `/gym/login` | ✅ | Email OTP flow (UI complete) |
| Desktop → mobile redirect — `/mobile-only` | ✅ | Middleware handles UA detection |
| Root `/` redirect to `/login` | ✅ | `apps/web/src/app/page.tsx` |
| Auth middleware — protected routes + redirect guards | ✅ | `apps/web/src/middleware.ts` |
| Supabase Auth callback — `/auth/callback` | ✅ | `apps/web/src/app/auth/callback/route.ts` |
| `packages/lib` — Supabase clients, QR utils, token formula | ✅ | Browser, server, admin clients; HMAC signing; deduction formula |
| `packages/types` — shared TypeScript interfaces | ✅ | All DB entities typed |
| Dev login — `/dev-login` | ✅ | One-click login for all seed accounts; visible in dev only |
| Phone OTP in production | ⏳ | Requires paid SMS provider (Twilio/MSG91) — deferred to pre-launch |
| Email OTP in production | ⏳ | Works via Supabase built-in (3/hr limit on free plan) |

### ⚠️ Production auth note
Supabase free plan does not include SMS. Phone OTP requires a paid SMS provider (Twilio or MSG91). For all development and testing, use `/dev-login` which authenticates via email+password using the seed accounts. Wire up real SMS before go-live.

---

## Established Conventions

> Locked after Phase 1. Do not change without updating this section.

- **Mutations:** Server Actions for simple DB writes; API Routes (`/api/...`) for anything involving Edge Function calls or complex server logic (QR generation, token deduction).
- **Supabase clients:**
  - Browser (client components): `apps/web/src/lib/supabase/browser.ts` → `createClient()`
  - Server (server components, route handlers, middleware): `apps/web/src/lib/supabase/server.ts` → `createClient()`
  - Admin / service role (Edge Functions only, never client): `packages/lib/supabase/admin.ts` → `createAdminClient()`
- **Shared types:** `packages/types/index.ts` — all DB entity interfaces live here. Import as `import type { Venue, Booking } from '@vigor/types'`.
- **Shared logic:** `packages/lib/` — token formula, QR signing, Supabase clients. Import as `import { calculateDeduction } from '@vigor/lib/tokens/formula'`.
- **Component primitives:** Use Tailwind utility classes directly for Phase 1–2 screens. shadcn/ui components to be added to `packages/ui/` progressively — do not create one-off custom primitives.
- **Mobile viewport:** All user-facing pages (`/app/...`) must use `className="mobile-viewport"` on the root div (defined in `globals.css` as `max-width: 430px; margin: 0 auto`). Desktop users hitting `/app/...` are rewritten to `/mobile-only` by middleware.
- **Edge Functions:** All server-side crypto, token deduction, and audit log writes go in `supabase/functions/`. Never perform these in client components or unprotected API routes.
- **Dev login:** `/dev-login` is gated by `process.env.NODE_ENV === 'development'` in the UI. The route itself is always accessible — do not rely on this for security. Remove or hard-gate before production.
- **Styling:** Vigor design tokens are defined in `tailwind.config.ts` (`deep-space`, `card-dark`, `vigor-violet`, `pulse-green`, `burn-coral`, `tempo-amber`) and as CSS variables in `globals.css`. Always use tokens, never raw hex in className.

---

## Folder Structure

> Reflects actual repo state after Phase 1.

```
/
├── apps/
│   └── web/                              # Next.js 15 — all portals
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx              # Root → redirects to /login
│       │   │   ├── layout.tsx            # Root layout (Inter font, dark bg)
│       │   │   ├── globals.css           # Tailwind directives + design tokens + animations
│       │   │   ├── login/                # User phone OTP login
│       │   │   ├── gym/login/            # Gym owner email OTP login
│       │   │   ├── mobile-only/          # Desktop fallback page
│       │   │   ├── dev-login/            # ⚠️ Dev only — one-click seed account login
│       │   │   ├── auth/callback/        # Supabase Auth code exchange
│       │   │   ├── app/                  # 🔲 User PWA (Phase 2)
│       │   │   ├── gym/                  # 🔲 Gym dashboard (Phase 4)
│       │   │   └── admin/               # 🔲 Admin center (Phase 5)
│       │   ├── lib/
│       │   │   └── supabase/
│       │   │       ├── browser.ts        # Browser Supabase client
│       │   │       └── server.ts         # Server Supabase client
│       │   └── middleware.ts             # Auth guards + mobile detection
│       ├── public/
│       │   └── manifest.json             # PWA manifest
│       ├── tailwind.config.ts            # Vigor design tokens
│       ├── postcss.config.cjs            # PostCSS (CJS — required by "type":"module")
│       ├── next.config.ts
│       ├── package.json                  # next@15.3.1, lucide-react@^0.469.0
│       └── .env.local.example            # Copy to .env.local and fill in
│
├── packages/
│   ├── ui/                               # Shared component primitives (stub — Phase 2+)
│   ├── lib/
│   │   ├── index.ts                      # Barrel export
│   │   ├── supabase/
│   │   │   ├── browser.ts
│   │   │   ├── server.ts
│   │   │   └── admin.ts                  # Service role client (Edge Functions only)
│   │   ├── qr/
│   │   │   └── hmac.ts                   # HMAC-SHA256 sign/verify, QR string builders
│   │   └── tokens/
│   │       └── formula.ts                # calculateDeduction(), tier base rates, multiplier clamps
│   └── types/
│       └── index.ts                      # All shared TypeScript interfaces
│
├── supabase/
│   ├── migrations/
│   │   ├── 202604170001_initial_schema.sql
│   │   └── 202604170002_rls_policies.sql
│   ├── seed.sql                          # 3 venues, 3 users, token bundles, 7-day slots
│   ├── fix_auth_passwords.sql            # Run if dev-login gives "Invalid credentials"
│   └── config.toml
│
└── CONTEXT.md                            # ← this file — paste at top of every session
```

---

*Last updated: Phase 1 complete — April 2026.*
