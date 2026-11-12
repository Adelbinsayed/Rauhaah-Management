/**
 * Date helpers: store UTC ISO-8601 strings, display in Asia/Dhaka time.
 */

const DHAKA_TIMEZONE = 'Asia/Dhaka';

export function nowUtcIso(): string {
  return new Date().toISOString();
}

export function formatDhakaDateTime(utcIso: string): string {
  const date = new Date(utcIso);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DHAKA_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatDhakaDate(utcIso: string): string {
  const date = new Date(utcIso);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DHAKA_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}
