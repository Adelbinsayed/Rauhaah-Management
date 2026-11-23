/**
 * Date helpers: store UTC ISO-8601 strings, display in Asia/Dhaka time.
 */

const DHAKA_TIMEZONE = 'Asia/Dhaka';

export function nowUtcIso(): string {
  return new Date().toISOString();
}

export function formatDhakaDateTime(utcIso?: string | null): string {
  if (!utcIso) return '—';
  const date = new Date(utcIso);
  if (isNaN(date.getTime())) return '—';
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

export function formatDhakaDate(utcIso?: string | null): string {
  if (!utcIso) return '—';
  const date = new Date(utcIso);
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DHAKA_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export type CommonDatePreset = 'today' | 'yesterday' | '7days' | 'month' | 'last_month' | 'all' | 'custom';

export interface DateRangeBounds {
  startDateIso: string;
  endDateIso: string;
  startDateStr: string; // YYYY-MM-DD
  endDateStr: string;   // YYYY-MM-DD
  label: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toUtcDateString(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function getTodayDateString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DHAKA_TIMEZONE }).format(new Date());
}

/**
 * Convert a UTC ISO timestamp to its YYYY-MM-DD calendar date in Asia/Dhaka.
 */
export function utcIsoToDhakaDateString(utcIso: string): string {
  const d = new Date(utcIso);
  if (isNaN(d.getTime())) return getTodayDateString();
  return new Intl.DateTimeFormat('en-CA', { timeZone: DHAKA_TIMEZONE }).format(d);
}

/**
 * Convert Dhaka calendar YYYY-MM-DD bounds to UTC ISO-8601 range bounds.
 * Asia/Dhaka is permanently UTC+06:00 with no DST.
 */
export function dhakaDateBoundsToUtcIso(
  startYmd: string,
  endYmd: string
): { startDateIso: string; endDateIso: string } {
  const today = getTodayDateString();
  const sDate = new Date(`${startYmd}T00:00:00.000+06:00`);
  const eDate = new Date(`${endYmd}T23:59:59.999+06:00`);
  const validStart = !isNaN(sDate.getTime())
    ? sDate
    : new Date(`${today}T00:00:00.000+06:00`);
  const validEnd = !isNaN(eDate.getTime())
    ? eDate
    : new Date(`${today}T23:59:59.999+06:00`);
  return {
    startDateIso: validStart.toISOString(),
    endDateIso: validEnd.toISOString(),
  };
}

/**
 * Pure calculation of date bounds for any preset or custom interval in Asia/Dhaka.
 * Returns ISO timestamps for SQL range filtering and YYYY-MM-DD strings for date inputs.
 */
export function calculateDateRange(
  preset: CommonDatePreset,
  customStart?: string,
  customEnd?: string
): DateRangeBounds {
  const todayStr = getTodayDateString();
  const [year, month, day] = todayStr.split('-').map(Number);

  switch (preset) {
    case 'today': {
      const { startDateIso, endDateIso } = dhakaDateBoundsToUtcIso(todayStr, todayStr);
      return {
        startDateIso,
        endDateIso,
        startDateStr: todayStr,
        endDateStr: todayStr,
        label: 'Today',
      };
    }
    case 'yesterday': {
      const yStr = toUtcDateString(new Date(Date.UTC(year, month - 1, day - 1)));
      const { startDateIso, endDateIso } = dhakaDateBoundsToUtcIso(yStr, yStr);
      return {
        startDateIso,
        endDateIso,
        startDateStr: yStr,
        endDateStr: yStr,
        label: 'Yesterday',
      };
    }
    case '7days': {
      const pastStr = toUtcDateString(new Date(Date.UTC(year, month - 1, day - 6)));
      const { startDateIso, endDateIso } = dhakaDateBoundsToUtcIso(pastStr, todayStr);
      return {
        startDateIso,
        endDateIso,
        startDateStr: pastStr,
        endDateStr: todayStr,
        label: 'Last 7 Days',
      };
    }
    case 'month': {
      const startOfMonthStr = `${year}-${pad(month)}-01`;
      const { startDateIso, endDateIso } = dhakaDateBoundsToUtcIso(startOfMonthStr, todayStr);
      return {
        startDateIso,
        endDateIso,
        startDateStr: startOfMonthStr,
        endDateStr: todayStr,
        label: 'This Month',
      };
    }
    case 'last_month': {
      const startOfLastStr = toUtcDateString(new Date(Date.UTC(year, month - 2, 1)));
      const endOfLastStr = toUtcDateString(new Date(Date.UTC(year, month - 1, 0)));
      const { startDateIso, endDateIso } = dhakaDateBoundsToUtcIso(startOfLastStr, endOfLastStr);
      return {
        startDateIso,
        endDateIso,
        startDateStr: startOfLastStr,
        endDateStr: endOfLastStr,
        label: 'Last Month',
      };
    }
    case 'custom': {
      if (customStart && customEnd) {
        const { startDateIso, endDateIso } = dhakaDateBoundsToUtcIso(customStart, customEnd);
        return {
          startDateIso,
          endDateIso,
          startDateStr: customStart,
          endDateStr: customEnd,
          label: `${customStart} to ${customEnd}`,
        };
      }
      const { startDateIso, endDateIso } = dhakaDateBoundsToUtcIso(todayStr, todayStr);
      return {
        startDateIso,
        endDateIso,
        startDateStr: todayStr,
        endDateStr: todayStr,
        label: 'Custom',
      };
    }
    case 'all':
    default: {
      return {
        startDateIso: '2024-01-01T00:00:00.000Z',
        endDateIso: '2099-12-31T23:59:59.999Z',
        startDateStr: '',
        endDateStr: '',
        label: 'All Time',
      };
    }
  }
}
