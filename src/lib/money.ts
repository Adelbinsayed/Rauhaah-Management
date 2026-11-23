/**
 * Money helpers for Rauhaah Management.
 *
 * - Totals, prices, payments, and balances are stored as integer **poisha** (1 BDT = 100 poisha).
 * - Per-unit costs (especially bulk liquids per ml) are stored as integer **milli-poisha**
 *   (1 BDT = 100,000 milli-poisha; 1 poisha = 1,000 milli-poisha) to avoid truncation drift.
 */

export const POISHA_PER_BDT = 100;
export const MILLI_POISHA_PER_POISHA = 1000;
export const MILLI_POISHA_PER_BDT = 100_000;

/** Convert BDT decimal (e.g. 125.50) to integer poisha (12550). */
export function bdtToPoisha(bdt: number): number {
  if (!Number.isFinite(bdt)) {
    throw new RangeError(`Invalid BDT amount: ${bdt}`);
  }
  return Math.round(bdt * POISHA_PER_BDT);
}

/** Convert integer poisha (12550) to BDT decimal (125.50). */
export function poishaToBdt(poisha: number): number {
  return poisha / POISHA_PER_BDT;
}

/** Convert BDT decimal (e.g. 0.125) to integer milli-poisha (12500). */
export function bdtToMilliPoisha(bdt: number): number {
  if (!Number.isFinite(bdt)) {
    throw new RangeError(`Invalid BDT unit cost: ${bdt}`);
  }
  return Math.round(bdt * MILLI_POISHA_PER_BDT);
}

/** Convert integer poisha to milli-poisha. */
export function poishaToMilliPoisha(poisha: number): number {
  return Math.round(poisha) * MILLI_POISHA_PER_POISHA;
}

/** Round integer milli-poisha to nearest whole poisha (half-up for positives). */
export function milliPoishaToPoisha(milliPoisha: number): number {
  return Math.round(milliPoisha / MILLI_POISHA_PER_POISHA);
}

/** Format integer poisha as BDT string, e.g. "৳1,250.00" or "৳1,250". */
export function formatBdt(poisha: number, options?: { showDecimals?: boolean }): string {
  const showDecimals = options?.showDecimals ?? true;
  const bdt = poishaToBdt(poisha);
  return formatBdtAmount(bdt, { showDecimals });
}

/** Format BDT decimal amount as localized currency string, e.g. "৳12,500.00" or "৳12,500". */
export function formatBdtAmount(amountBdt: number, options?: { showDecimals?: boolean }): string {
  const showDecimals = options?.showDecimals ?? true;
  const num = Number.isFinite(amountBdt) ? amountBdt : 0;
  const isNegative = num < 0;
  const formatted = new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(Math.abs(num));
  return isNegative ? `-৳${formatted}` : `৳${formatted}`;
}
