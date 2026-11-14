import { describe, it, expect } from 'vitest';
import {
  convertQuantity,
  mlToGrams,
  gramsToMl,
  formatQuantityWithUnit,
  STANDARD_TOLA_ML,
  STANDARD_TOLA_GRAMS,
} from './units';
import type { Unit } from './types';

describe('Unit and Density Conversions', () => {
  const unitMl: Unit = {
    id: 'unit-vol-ml',
    code: 'ml',
    name: 'Millilitre',
    unitType: 'volume',
    baseUnitCode: 'ml',
    conversionFactor: 1.0,
    isSystem: true,
  };

  const unitLitre: Unit = {
    id: 'unit-vol-l',
    code: 'l',
    name: 'Litre',
    unitType: 'volume',
    baseUnitCode: 'ml',
    conversionFactor: 1000.0,
    isSystem: true,
  };

  const unitTolaVol: Unit = {
    id: 'unit-vol-tola',
    code: 'tola',
    name: 'Tola (12 ml)',
    unitType: 'volume',
    baseUnitCode: 'ml',
    conversionFactor: STANDARD_TOLA_ML,
    isSystem: true,
  };

  const unitGrams: Unit = {
    id: 'unit-wt-g',
    code: 'g',
    name: 'Gram',
    unitType: 'weight',
    baseUnitCode: 'g',
    conversionFactor: 1.0,
    isSystem: true,
  };

  const unitKg: Unit = {
    id: 'unit-wt-kg',
    code: 'kg',
    name: 'Kilogram',
    unitType: 'weight',
    baseUnitCode: 'g',
    conversionFactor: 1000.0,
    isSystem: true,
  };

  it('converts within the same unit type correctly', () => {
    // 1 Litre = 1000 ml
    expect(convertQuantity(1, unitLitre, unitMl)).toBe(1000);
    // 500 ml = 0.5 Litre
    expect(convertQuantity(500, unitMl, unitLitre)).toBe(0.5);
    // 1 Tola = 12 ml
    expect(convertQuantity(1, unitTolaVol, unitMl)).toBe(12);
    // 24 ml = 2 Tola
    expect(convertQuantity(24, unitMl, unitTolaVol)).toBe(2);
    // 2.5 kg = 2500 g
    expect(convertQuantity(2.5, unitKg, unitGrams)).toBe(2500);
  });

  it('converts across weight and volume using density', () => {
    // Oud oil with density = 0.95 g/ml
    const density = 0.95;
    // 100 ml * 0.95 = 95 g
    expect(convertQuantity(100, unitMl, unitGrams, density)).toBeCloseTo(95);
    expect(mlToGrams(100, density)).toBeCloseTo(95);
    // 95 g / 0.95 = 100 ml
    expect(convertQuantity(95, unitGrams, unitMl, density)).toBeCloseTo(100);
    expect(gramsToMl(95, density)).toBeCloseTo(100);
    // 1 Litre (1000 ml) -> 0.95 kg
    expect(convertQuantity(1, unitLitre, unitKg, density)).toBeCloseTo(0.95);
    // Check standard tola constant
    expect(STANDARD_TOLA_GRAMS).toBe(11.664);
  });

  it('throws error when converting weight to volume without density', () => {
    expect(() => convertQuantity(100, unitMl, unitGrams)).toThrowError();
  });

  it('formats quantities with clean decimals', () => {
    expect(formatQuantityWithUnit(12, 'ml')).toBe('12 ml');
    expect(formatQuantityWithUnit(1.5, 'tola')).toBe('1.5 tola');
    expect(formatQuantityWithUnit(250.125, 'g')).toBe('250.125 g');
  });
});
