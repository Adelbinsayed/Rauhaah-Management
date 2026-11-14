import type { Unit } from './types';

export const STANDARD_TOLA_ML = 12.0;
export const STANDARD_TOLA_GRAMS = 11.664;

/**
 * Converts a quantity from one unit to another within the same unit type,
 * or across weight/volume if density (g/ml) is provided.
 */
export function convertQuantity(
  amount: number,
  fromUnit: Unit,
  toUnit: Unit,
  densityGPerMl?: number | null
): number {
  if (fromUnit.id === toUnit.id || fromUnit.code === toUnit.code) {
    return amount;
  }

  // Same unit type: simple conversion through base unit
  if (fromUnit.unitType === toUnit.unitType) {
    const amountInBase = amount * fromUnit.conversionFactor;
    return amountInBase / toUnit.conversionFactor;
  }

  // Cross-type: Volume <-> Weight requires density
  if (
    (fromUnit.unitType === 'volume' && toUnit.unitType === 'weight') ||
    (fromUnit.unitType === 'weight' && toUnit.unitType === 'volume')
  ) {
    if (!densityGPerMl || densityGPerMl <= 0) {
      throw new Error(
        `Cannot convert between ${fromUnit.name} and ${toUnit.name} without a valid density value.`
      );
    }

    // Convert fromUnit to its base (ml or g)
    const baseFrom = amount * fromUnit.conversionFactor;

    let baseTo: number;
    if (fromUnit.unitType === 'volume' && toUnit.unitType === 'weight') {
      // ml to grams: grams = ml * density
      baseTo = baseFrom * densityGPerMl;
    } else {
      // grams to ml: ml = grams / density
      baseTo = baseFrom / densityGPerMl;
    }

    // Convert base of target to target unit
    return baseTo / toUnit.conversionFactor;
  }

  throw new Error(`Cannot convert between ${fromUnit.unitType} and ${toUnit.unitType}.`);
}

/**
 * Helper to calculate weight in grams from ml given density
 */
export function mlToGrams(ml: number, densityGPerMl: number): number {
  if (densityGPerMl <= 0) return ml;
  return ml * densityGPerMl;
}

/**
 * Helper to calculate volume in ml from grams given density
 */
export function gramsToMl(grams: number, densityGPerMl: number): number {
  if (densityGPerMl <= 0) return grams;
  return grams / densityGPerMl;
}

/**
 * Formats quantity with unit symbol cleanly (e.g., 12 ml, 1 tola, 50 pcs)
 */
export function formatQuantityWithUnit(quantity: number, unitCode: string): string {
  const rounded = Math.round(quantity * 1000) / 1000;
  return `${rounded} ${unitCode}`;
}

/**
 * Common decant bottle sizes in Bangladesh attar market
 */
export interface DecantOption {
  label: string;
  ml: number;
  tolaFraction: string;
}

export const POPULAR_DECANT_OPTIONS: DecantOption[] = [
  { label: '3 ml (1/4 Tola)', ml: 3, tolaFraction: '1/4' },
  { label: '6 ml (1/2 Tola)', ml: 6, tolaFraction: '1/2' },
  { label: '12 ml (1 Tola)', ml: 12, tolaFraction: '1' },
  { label: '24 ml (2 Tola)', ml: 24, tolaFraction: '2' },
];
