// Supabase clients
export { createClient as createBrowserClient } from './supabase/browser';
export { createClient as createServerClient } from './supabase/server';
export { createAdminClient } from './supabase/admin';

// QR utilities
export {
  signPayload,
  verifySignature,
  buildEntryQRString,
  buildExitQRString,
  parseQRString,
} from './qr/hmac';
export type { EntryQRPayload, ExitQRPayload } from './qr/hmac';

// Token formula
export {
  calculateDeduction,
  TIER_BASE_RATES,
  PEAK_MAX_MULTIPLIER,
  OFFPEAK_MIN_MULTIPLIER,
} from './tokens/formula';
export type { DeductionInput } from './tokens/formula';
