import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client for Next.js API routes that need to bypass RLS.
 * Used by: validate-scan, auto-close (both write audit_log + token_ledger as platform operations)
 *
 * NEVER expose this client to the browser.
 * Only import this in app/api/** routes, never in Client Components.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      '[createAdminClient] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Add these to your .env.local file.'
    );
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
