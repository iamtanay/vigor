-- ─────────────────────────────────────────────────────────────────────────────
-- Vigor — Initial Schema Migration
-- 0001_initial_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE venue_tier AS ENUM ('bronze', 'silver', 'gold');
CREATE TYPE venue_status AS ENUM ('active', 'inactive', 'suspended', 'delisted');
CREATE TYPE session_status AS ENUM ('open', 'closed', 'auto_closed');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'no_show', 'completed');
CREATE TYPE token_ledger_type AS ENUM (
  'purchase', 'deduction', 'refund', 'penalty',
  'grace_deduction', 'compensation'
);
CREATE TYPE audit_event_type AS ENUM (
  'entry_scan', 'exit_scan', 'auto_close',
  'token_deduction', 'no_show_penalty',
  'governance_action', 'kiosk_scan'
);
CREATE TYPE scan_method AS ENUM ('staff', 'kiosk');
CREATE TYPE settlement_status AS ENUM ('pending', 'approved', 'paid');
CREATE TYPE commitment_duration AS ENUM ('1_month', '3_months', '6_months');
CREATE TYPE commitment_status AS ENUM ('active', 'expired', 'broken');
CREATE TYPE governance_action_type AS ENUM (
  'warning', 're_audit', 'delist',
  'suspend_user', 'ban_user'
);
CREATE TYPE user_role AS ENUM ('user', 'gym_owner', 'admin');
CREATE TYPE bundle_size AS ENUM ('small', 'medium', 'large');

-- ─── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Links to auth.users.id — must match
  auth_id       UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone         TEXT UNIQUE,
  email         TEXT UNIQUE,
  name          TEXT,
  role          user_role NOT NULL DEFAULT 'user',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Venues ───────────────────────────────────────────────────────────────────

CREATE TABLE venues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   UUID NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  tier            venue_tier NOT NULL DEFAULT 'bronze',
  status          venue_status NOT NULL DEFAULT 'inactive',
  description     TEXT,
  address         TEXT NOT NULL,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL,
  pincode         TEXT NOT NULL,
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  location        GEOGRAPHY(POINT, 4326), -- PostGIS point for geo queries
  phone           TEXT,
  opening_time    TIME NOT NULL DEFAULT '06:00',
  closing_time    TIME NOT NULL DEFAULT '22:00',
  amenities       TEXT[] NOT NULL DEFAULT '{}',
  activity_types  TEXT[] NOT NULL DEFAULT '{}',
  image_urls      TEXT[] NOT NULL DEFAULT '{}',
  avg_rating      NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_ratings   INTEGER NOT NULL DEFAULT 0,
  -- Token payout rate for settlements (paise per token)
  payout_rate_inr INTEGER NOT NULL DEFAULT 800,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-populate PostGIS point from lat/lng
CREATE OR REPLACE FUNCTION venues_set_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER venues_location_trigger
BEFORE INSERT OR UPDATE OF latitude, longitude ON venues
FOR EACH ROW EXECUTE FUNCTION venues_set_location();

-- ─── Venue Slots ──────────────────────────────────────────────────────────────

CREATE TABLE venue_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  slot_date     DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  capacity      INTEGER NOT NULL DEFAULT 20,
  booked_count  INTEGER NOT NULL DEFAULT 0,
  is_blocked    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (venue_id, slot_date, start_time),
  CONSTRAINT booked_not_exceed_capacity CHECK (booked_count <= capacity),
  CONSTRAINT end_after_start CHECK (end_time > start_time)
);

-- ─── Token Bundles (admin-configured) ────────────────────────────────────────

CREATE TABLE token_bundles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  size          bundle_size NOT NULL,
  token_count   INTEGER NOT NULL,
  price_inr     INTEGER NOT NULL, -- paise (100 = ₹1)
  validity_days INTEGER NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT token_count_positive CHECK (token_count > 0),
  CONSTRAINT price_positive CHECK (price_inr > 0),
  CONSTRAINT validity_positive CHECK (validity_days > 0)
);

-- ─── Token Ledger (append-only, never update/delete) ─────────────────────────

CREATE TABLE token_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  bundle_id       UUID REFERENCES token_bundles(id),
  session_id      UUID, -- FK added after sessions table
  booking_id      UUID, -- FK added after bookings table
  type            token_ledger_type NOT NULL,
  amount          INTEGER NOT NULL, -- positive = credit, negative = debit
  balance_after   INTEGER NOT NULL,
  expires_at      TIMESTAMPTZ, -- set for purchases
  grace_expires_at TIMESTAMPTZ, -- set when grace period starts
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT balance_non_negative CHECK (balance_after >= 0)
);

-- Prevent any UPDATE or DELETE on this table
CREATE RULE no_update_token_ledger AS ON UPDATE TO token_ledger DO INSTEAD NOTHING;
CREATE RULE no_delete_token_ledger AS ON DELETE TO token_ledger DO INSTEAD NOTHING;

-- ─── Bookings ─────────────────────────────────────────────────────────────────

CREATE TABLE bookings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id),
  venue_id              UUID NOT NULL REFERENCES venues(id),
  slot_id               UUID NOT NULL REFERENCES venue_slots(id),
  status                booking_status NOT NULL DEFAULT 'confirmed',
  guest_user_id         UUID REFERENCES users(id),
  entry_qr_hash         TEXT UNIQUE,
  entry_qr_expires_at   TIMESTAMPTZ,
  entry_qr_used         BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at          TIMESTAMPTZ,
  penalty_applied       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT guest_not_self CHECK (guest_user_id IS NULL OR guest_user_id != user_id)
);

-- ─── Sessions ────────────────────────────────────────────────────────────────

CREATE TABLE sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            UUID NOT NULL REFERENCES bookings(id),
  user_id               UUID NOT NULL REFERENCES users(id),
  venue_id              UUID NOT NULL REFERENCES venues(id),
  status                session_status NOT NULL DEFAULT 'open',
  entry_scanned_at      TIMESTAMPTZ,
  exit_scanned_at       TIMESTAMPTZ,
  auto_closed_at        TIMESTAMPTZ,
  tokens_deducted       INTEGER,
  peak_multiplier_used  NUMERIC(3,2),
  commitment_discount   NUMERIC(3,2) NOT NULL DEFAULT 0,
  scan_method_entry     scan_method,
  scan_method_exit      scan_method,
  scanned_by_user_id    UUID REFERENCES users(id),
  kiosk_device_id       UUID, -- FK added after kiosk_devices
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tokens_positive CHECK (tokens_deducted IS NULL OR tokens_deducted > 0)
);

-- Add deferred FK from token_ledger to sessions + bookings
ALTER TABLE token_ledger
  ADD CONSTRAINT token_ledger_session_fk
    FOREIGN KEY (session_id) REFERENCES sessions(id),
  ADD CONSTRAINT token_ledger_booking_fk
    FOREIGN KEY (booking_id) REFERENCES bookings(id);

-- ─── Audit Log (append-only, immutable) ──────────────────────────────────────

CREATE TABLE audit_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type            audit_event_type NOT NULL,
  user_id               UUID REFERENCES users(id),
  venue_id              UUID REFERENCES venues(id),
  session_id            UUID REFERENCES sessions(id),
  booking_id            UUID REFERENCES bookings(id),
  token_amount          INTEGER,
  qr_hash               TEXT,
  scan_method           scan_method,
  scanned_by_user_id    UUID REFERENCES users(id),
  kiosk_device_id       UUID,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce immutability at DB level
CREATE RULE no_update_audit_log AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_audit_log AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- ─── Settlements ──────────────────────────────────────────────────────────────

CREATE TABLE settlements (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id                UUID NOT NULL REFERENCES venues(id),
  cycle_start             DATE NOT NULL,
  cycle_end               DATE NOT NULL,
  tokens_consumed         INTEGER NOT NULL DEFAULT 0,
  payout_rate_inr         INTEGER NOT NULL, -- paise per token at time of settlement
  total_payout_inr        INTEGER NOT NULL DEFAULT 0, -- paise
  status                  settlement_status NOT NULL DEFAULT 'pending',
  approved_by_user_id     UUID REFERENCES users(id),
  approved_at             TIMESTAMPTZ,
  paid_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cycle_end_after_start CHECK (cycle_end > cycle_start),
  CONSTRAINT tokens_non_negative CHECK (tokens_consumed >= 0)
);

-- ─── Ratings ─────────────────────────────────────────────────────────────────

CREATE TABLE ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  venue_id    UUID NOT NULL REFERENCES venues(id),
  session_id  UUID NOT NULL REFERENCES sessions(id),
  score       SMALLINT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, session_id),
  CONSTRAINT score_range CHECK (score BETWEEN 1 AND 5)
);

-- Auto-update venue avg_rating on insert
CREATE OR REPLACE FUNCTION update_venue_avg_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE venues
  SET
    avg_rating = (
      SELECT ROUND(AVG(score)::NUMERIC, 2)
      FROM ratings WHERE venue_id = NEW.venue_id
    ),
    total_ratings = (
      SELECT COUNT(*) FROM ratings WHERE venue_id = NEW.venue_id
    )
  WHERE id = NEW.venue_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ratings_update_venue
AFTER INSERT ON ratings
FOR EACH ROW EXECUTE FUNCTION update_venue_avg_rating();

-- ─── Commitments ─────────────────────────────────────────────────────────────

CREATE TABLE commitments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id),
  venue_id              UUID NOT NULL REFERENCES venues(id),
  duration              commitment_duration NOT NULL,
  status                commitment_status NOT NULL DEFAULT 'active',
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at               TIMESTAMPTZ NOT NULL,
  discount_rate         NUMERIC(3,2) NOT NULL DEFAULT 0.10,
  broken_at             TIMESTAMPTZ,
  break_reason          TEXT,
  compensation_tokens   INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Only one active commitment per user per venue
  UNIQUE (user_id, venue_id, status),
  CONSTRAINT discount_range CHECK (discount_rate BETWEEN 0 AND 0.50),
  CONSTRAINT ends_after_start CHECK (ends_at > started_at)
);

-- ─── Kiosk Devices ───────────────────────────────────────────────────────────

CREATE TABLE kiosk_devices (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id                UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  device_token            TEXT NOT NULL UNIQUE, -- hashed secret for device auth
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at            TIMESTAMPTZ,
  registered_by_user_id   UUID NOT NULL REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add deferred kiosk FK to sessions
ALTER TABLE sessions
  ADD CONSTRAINT sessions_kiosk_fk
    FOREIGN KEY (kiosk_device_id) REFERENCES kiosk_devices(id);

-- ─── Venue Pricing (dynamic multipliers) ─────────────────────────────────────

CREATE TABLE venue_pricing (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  day_of_week     SMALLINT NOT NULL, -- 0=Sun ... 6=Sat
  hour_start      SMALLINT NOT NULL, -- 0–23
  hour_end        SMALLINT NOT NULL, -- 1–24 (exclusive)
  multiplier      NUMERIC(3,2) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by_gym BOOLEAN NOT NULL DEFAULT FALSE,
  ml_suggested    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT day_range CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT hour_start_range CHECK (hour_start BETWEEN 0 AND 23),
  CONSTRAINT hour_end_range CHECK (hour_end BETWEEN 1 AND 24),
  CONSTRAINT hour_order CHECK (hour_end > hour_start),
  -- BUSINESS RULE: peak max 2×, offpeak min 0.6×
  CONSTRAINT multiplier_range CHECK (multiplier BETWEEN 0.6 AND 2.0)
);

-- ─── Admin Actions ────────────────────────────────────────────────────────────

CREATE TABLE admin_actions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type         governance_action_type NOT NULL,
  admin_user_id       UUID NOT NULL REFERENCES users(id),
  target_user_id      UUID REFERENCES users(id),
  target_venue_id     UUID REFERENCES venues(id),
  reason              TEXT NOT NULL,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Helper: token balance view ──────────────────────────────────────────────

CREATE OR REPLACE VIEW user_token_balances AS
SELECT
  user_id,
  -- Active tokens (not expired or in grace)
  SUM(CASE
    WHEN type IN ('purchase', 'compensation') AND expires_at > NOW() THEN amount
    WHEN type IN ('deduction', 'penalty', 'grace_deduction') THEN amount
    ELSE 0
  END) AS available_tokens,
  -- Grace tokens (expired but within 15-day grace)
  SUM(CASE
    WHEN type = 'purchase' AND expires_at <= NOW()
         AND grace_expires_at IS NOT NULL AND grace_expires_at > NOW()
    THEN amount / 2  -- 50% value in grace
    ELSE 0
  END) AS grace_tokens,
  MIN(CASE WHEN expires_at > NOW() THEN expires_at END) AS earliest_expiry
FROM token_ledger
GROUP BY user_id;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_venues_location ON venues USING GIST(location);
CREATE INDEX idx_venues_city ON venues(city);
CREATE INDEX idx_venues_tier ON venues(tier);
CREATE INDEX idx_venues_status ON venues(status);
CREATE INDEX idx_venue_slots_venue_date ON venue_slots(venue_id, slot_date);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_slot_id ON bookings(slot_id);
CREATE INDEX idx_bookings_entry_qr_hash ON bookings(entry_qr_hash) WHERE entry_qr_hash IS NOT NULL;
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_venue_id ON sessions(venue_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_token_ledger_user_id ON token_ledger(user_id);
CREATE INDEX idx_token_ledger_expires ON token_ledger(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_venue_id ON audit_log(venue_id);
CREATE INDEX idx_audit_log_session_id ON audit_log(session_id);
CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX idx_settlements_venue_id ON settlements(venue_id);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_commitments_user_venue ON commitments(user_id, venue_id);

-- ─── Updated_at auto-trigger ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER venues_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();