// ─── Enums ───────────────────────────────────────────────────────────────────

export type VenueTier = 'bronze' | 'silver' | 'gold';
export type VenueStatus = 'active' | 'inactive' | 'suspended' | 'delisted';
export type SessionStatus = 'open' | 'closed' | 'auto_closed';
export type BookingStatus = 'confirmed' | 'cancelled' | 'no_show' | 'completed';
export type TokenLedgerType = 'purchase' | 'deduction' | 'refund' | 'penalty' | 'grace_deduction' | 'compensation';
export type AuditEventType =
  | 'entry_scan'
  | 'exit_scan'
  | 'auto_close'
  | 'token_deduction'
  | 'no_show_penalty'
  | 'governance_action'
  | 'kiosk_scan';
export type ScanMethod = 'staff' | 'kiosk';
export type SettlementStatus = 'pending' | 'approved' | 'paid';
export type CommitmentDuration = '1_month' | '3_months' | '6_months';
export type CommitmentStatus = 'active' | 'expired' | 'broken';
export type GovernanceActionType = 'warning' | 're_audit' | 'delist' | 'suspend_user' | 'ban_user';
export type UserRole = 'user' | 'gym_owner' | 'admin';
export type BundleSize = 'small' | 'medium' | 'large';

// ─── Core entities ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;
  name: string;
  tier: VenueTier;
  status: VenueStatus;
  description: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  opening_time: string; // HH:MM
  closing_time: string; // HH:MM
  amenities: string[];
  activity_types: string[];
  image_urls: string[];
  avg_rating: number;
  total_ratings: number;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface VenueSlot {
  id: string;
  venue_id: string;
  slot_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  capacity: number;
  booked_count: number;
  is_blocked: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  venue_id: string;
  slot_id: string;
  status: BookingStatus;
  guest_user_id: string | null;
  entry_qr_hash: string | null;
  entry_qr_expires_at: string | null;
  entry_qr_used: boolean;
  cancelled_at: string | null;
  penalty_applied: boolean;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  booking_id: string;
  user_id: string;
  venue_id: string;
  status: SessionStatus;
  entry_scanned_at: string | null;
  exit_scanned_at: string | null;
  auto_closed_at: string | null;
  tokens_deducted: number | null;
  scan_method_entry: ScanMethod | null;
  scan_method_exit: ScanMethod | null;
  scanned_by_user_id: string | null; // staff user
  kiosk_device_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenBundle {
  id: string;
  name: string;
  size: BundleSize;
  token_count: number;
  price_inr: number; // in paise
  validity_days: number;
  is_active: boolean;
  created_at: string;
}

export interface TokenLedgerEntry {
  id: string;
  user_id: string;
  bundle_id: string | null;
  session_id: string | null;
  booking_id: string | null;
  type: TokenLedgerType;
  amount: number; // positive = credit, negative = debit
  balance_after: number;
  expires_at: string | null;
  grace_expires_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  event_type: AuditEventType;
  user_id: string | null;
  venue_id: string | null;
  session_id: string | null;
  booking_id: string | null;
  token_amount: number | null;
  qr_hash: string | null;
  scan_method: ScanMethod | null;
  scanned_by_user_id: string | null;
  kiosk_device_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Settlement {
  id: string;
  venue_id: string;
  cycle_start: string;
  cycle_end: string;
  tokens_consumed: number;
  payout_rate_inr: number; // paise per token
  total_payout_inr: number; // paise
  status: SettlementStatus;
  approved_by_user_id: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Rating {
  id: string;
  user_id: string;
  venue_id: string;
  session_id: string;
  score: number; // 1–5
  note: string | null;
  created_at: string;
}

export interface Commitment {
  id: string;
  user_id: string;
  venue_id: string;
  duration: CommitmentDuration;
  status: CommitmentStatus;
  started_at: string;
  ends_at: string;
  discount_rate: number; // e.g. 0.10 = 10%
  broken_at: string | null;
  break_reason: string | null;
  compensation_tokens: number | null;
  created_at: string;
}

export interface KioskDevice {
  id: string;
  venue_id: string;
  name: string;
  device_token: string;
  is_active: boolean;
  last_seen_at: string | null;
  registered_by_user_id: string;
  created_at: string;
}

export interface VenuePricing {
  id: string;
  venue_id: string;
  day_of_week: number; // 0=Sun, 6=Sat
  hour_start: number; // 0–23
  hour_end: number; // 0–23
  multiplier: number; // 0.6–2.0
  is_active: boolean;
  approved_by_gym: boolean;
  created_at: string;
}

export interface AdminAction {
  id: string;
  action_type: GovernanceActionType;
  admin_user_id: string;
  target_user_id: string | null;
  target_venue_id: string | null;
  reason: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Computed / API types ─────────────────────────────────────────────────────

export interface TokenBalance {
  user_id: string;
  available_tokens: number;
  grace_tokens: number;
  earliest_expiry: string | null;
}

export interface VenueWithDistance extends Venue {
  distance_km: number;
  current_token_cost: number;
  is_peak: boolean;
  active_commitment: Commitment | null;
}

export interface SlotWithAvailability extends VenueSlot {
  available_spots: number;
  token_cost: number;
  is_peak: boolean;
}
