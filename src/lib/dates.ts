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

export function getTodayDateString(): string {
  return toDateString(new Date());
}

/**
 * Pure calculation of date bounds for any preset or custom interval.
 * Returns ISO timestamps for SQL range filtering and YYYY-MM-DD strings for date inputs.
 */
export function calculateDateRange(
  preset: CommonDatePreset,
  customStart?: string,
  customEnd?: string
): DateRangeBounds {
  const now = new Date();

  const startOfDay = (d: Date): Date => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };

  const endOfDay = (d: Date): Date => {
    const copy = new Date(d);
    copy.setHours(23, 59, 59, 999);
    return copy;
  };

  switch (preset) {
    case 'today': {
      const today = toDateString(now);
      return {
        startDateIso: startOfDay(now).toISOString(),
        endDateIso: endOfDay(now).toISOString(),
        startDateStr: today,
        endDateStr: today,
        label: 'Today',
      };
    }
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = toDateString(y);
      return {
        startDateIso: startOfDay(y).toISOString(),
        endDateIso: endOfDay(y).toISOString(),
        startDateStr: yStr,
        endDateStr: yStr,
        label: 'Yesterday',
      };
    }
    case '7days': {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      return {
        startDateIso: startOfDay(past).toISOString(),
        endDateIso: endOfDay(now).toISOString(),
        startDateStr: toDateString(past),
        endDateStr: toDateString(now),
        label: 'Last 7 Days',
      };
    }
    case 'month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDateIso: startOfDay(startOfMonth).toISOString(),
        endDateIso: endOfDay(now).toISOString(),
        startDateStr: toDateString(startOfMonth),
        endDateStr: toDateString(now),
        label: 'This Month',
      };
    }
    case 'last_month': {
      const startOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLast = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDateIso: startOfDay(startOfLast).toISOString(),
        endDateIso: endOfDay(endOfLast).toISOString(),
        startDateStr: toDateString(startOfLast),
        endDateStr: toDateString(endOfLast),
        label: 'Last Month',
      };
    }
    case 'custom': {
      if (customStart && customEnd) {
        const s = new Date(`${customStart}T00:00:00`);
        const e = new Date(`${customEnd}T23:59:59.999`);
        return {
          startDateIso: s.toISOString(),
          endDateIso: e.toISOString(),
          startDateStr: customStart,
          endDateStr: customEnd,
          label: `${customStart} to ${customEnd}`,
        };
      }
      const today = toDateString(now);
      return {
        startDateIso: startOfDay(now).toISOString(),
        endDateIso: endOfDay(now).toISOString(),
        startDateStr: today,
        endDateStr: today,
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
