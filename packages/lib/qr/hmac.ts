// QR signing utilities — runs in Edge Functions and server only

export async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = await signPayload(payload, secret);
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export interface EntryQRPayload {
  type: 'entry';
  booking_id: string;
  user_id: string;
  venue_id: string;
  slot_start_iso: string;
  nonce: string; // crypto.randomUUID()
}

export interface ExitQRPayload {
  type: 'exit';
  session_id: string;
  user_id: string;
  venue_id: string;
  issued_at_iso: string;
  // No nonce — refreshes every 60s, old one invalid immediately
}

export function buildEntryQRString(payload: EntryQRPayload, signature: string): string {
  return `vigor:entry:${btoa(JSON.stringify(payload))}.${signature}`;
}

export function buildExitQRString(payload: ExitQRPayload, signature: string): string {
  return `vigor:exit:${btoa(JSON.stringify(payload))}.${signature}`;
}

export function parseQRString(raw: string): {
  type: 'entry' | 'exit';
  payload: EntryQRPayload | ExitQRPayload;
  signature: string;
} | null {
  try {
    const [, type, rest] = raw.split(':');
    if (!rest) return null;
    const dotIdx = rest.lastIndexOf('.');
    const payloadB64 = rest.substring(0, dotIdx);
    const signature = rest.substring(dotIdx + 1);
    const payload = JSON.parse(atob(payloadB64));
    return { type: type as 'entry' | 'exit', payload, signature };
  } catch {
    return null;
  }
}
