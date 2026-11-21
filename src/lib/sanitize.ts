/**
 * Sanitization and security helpers (OWASP Security-First Guidelines).
 */

/**
 * Escapes SQLite LIKE wildcard characters ('%', '_', '\') in user search input.
 * Prevents wildcard injection and excessive CPU usage in full-text scans.
 */
export function sanitizeSqlLikePattern(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Normalizes phone numbers (removes whitespace, dashes, country code prefix if local).
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+880')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('880')) {
    cleaned = '0' + cleaned.slice(3);
  }
  return cleaned;
}
