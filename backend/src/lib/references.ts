import { randomBytes, randomUUID } from 'crypto';

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Human-friendly booking reference, e.g. "TBS-AB3X9K2P". */
export function generateBookingReference(): string {
  let s = '';
  const bytes = randomBytes(8);
  for (const b of bytes) s += REF_ALPHABET[b % REF_ALPHABET.length];
  return `TBS-${s}`;
}

export function generateToken(): string {
  return randomUUID().replace(/-/g, '') + randomBytes(8).toString('hex');
}

export function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}