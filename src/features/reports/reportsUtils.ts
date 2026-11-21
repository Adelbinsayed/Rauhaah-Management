import { calculateDateRange } from '@/lib/dates';
import type { DateRangeFilter, DateRangePreset } from '@/domain/reports/types';

/**
 * Format a number as Bangladeshi Taka currency (e.g. ৳12,500.00).
 */
export function formatBdt(amount: number): string {
  return `৳${Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format a number as integer or with 1 decimal.
 */
export function formatQty(qty: number, unit?: string): string {
  const formatted = Number(qty || 0).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Calculate standard date range bounds by delegating to central date engine.
 */
export function getDateRangeForPreset(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
): DateRangeFilter {
  const mappedPreset =
    preset === 'last_7_days' ? '7days' : preset === 'this_month' ? 'month' : preset;
  const bounds = calculateDateRange(mappedPreset, customStart, customEnd);
  return {
    preset,
    startDateIso: bounds.startDateIso,
    endDateIso: bounds.endDateIso,
    label: bounds.label,
  };
}

export { downloadCsv } from '@/lib/csvExport';
