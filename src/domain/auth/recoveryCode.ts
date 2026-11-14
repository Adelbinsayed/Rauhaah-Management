const SAFE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates an owner recovery code in the format:
 * RAUH-XXXX-XXXX-XXXX
 * Uses unambiguous characters (excluding 0, 1, I, O).
 */
export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);

  const chars = Array.from(bytes, (b) => SAFE_CHARS[b % SAFE_CHARS.length]);
  const chunk1 = chars.slice(0, 4).join('');
  const chunk2 = chars.slice(4, 8).join('');
  const chunk3 = chars.slice(8, 12).join('');

  return `RAUH-${chunk1}-${chunk2}-${chunk3}`;
}

/**
 * Normalizes a user-entered recovery code for lookup / comparison:
 * Trims whitespace, converts to uppercase, replaces spaces with dashes,
 * and ensures standard RAUH-XXXX-XXXX-XXXX format.
 */
export function normalizeRecoveryCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleaned.startsWith('RAUH') && cleaned.length === 12) {
    // If user omitted RAUH prefix:
    return `RAUH-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`;
  }
  if (cleaned.startsWith('RAUH') && cleaned.length === 16) {
    const body = cleaned.slice(4);
    return `RAUH-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
  }
  return raw.trim().toUpperCase();
}

/**
 * Validate recovery code format
 */
export function isValidRecoveryCodeFormat(code: string): boolean {
  const norm = normalizeRecoveryCode(code);
  return /^RAUH-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(norm);
}
