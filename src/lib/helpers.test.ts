import { describe, expect, it } from 'vitest';
import { uuidv7 } from './ids';
import {
  bdtToMilliPoisha,
  bdtToPoisha,
  formatBdt,
  milliPoishaToPoisha,
  poishaToBdt,
  poishaToMilliPoisha,
} from './money';
import { formatQuantity, fromThousandths, PRODUCT_CLASS_UNITS, toThousandths } from './quantity';

describe('uuidv7', () => {
  it('generates valid RFC 9562 v7 UUIDs', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uuidv7()));
    expect(ids.size).toBe(100);
  });
});

describe('money helpers', () => {
  it('converts between BDT and poisha without floating-point drift', () => {
    expect(bdtToPoisha(125.5)).toBe(12550);
    expect(bdtToPoisha(0.1 + 0.2)).toBe(30);
    expect(poishaToBdt(12550)).toBe(125.5);
  });

  it('converts between BDT, poisha, and milli-poisha accurately', () => {
    // 125 BDT / 1000 ml = 0.125 BDT/ml = 12,500 milli-poisha
    expect(bdtToMilliPoisha(0.125)).toBe(12500);
    expect(poishaToMilliPoisha(150)).toBe(150000);
    // 12,500 milli-poisha * 10 ml = 125,000 milli-poisha -> 125 poisha (1.25 BDT)
    expect(milliPoishaToPoisha(12500 * 10)).toBe(125);
  });

  it('formats BDT cleanly', () => {
    expect(formatBdt(125000)).toBe('৳1,250.00');
    expect(formatBdt(125000, { showDecimals: false })).toBe('৳1,250');
  });
});

describe('quantity helpers', () => {
  it('converts decimal quantities to thousandths and back', () => {
    expect(toThousandths(2.5)).toBe(2500);
    expect(toThousandths(11.664)).toBe(11664);
    expect(fromThousandths(2500)).toBe(2.5);
  });

  it('formats quantities with trimmed trailing zeros', () => {
    expect(formatQuantity(2500, 'ml')).toBe('2.5 ml');
    expect(formatQuantity(10000, 'pcs')).toBe('10 pcs');
    expect(formatQuantity(11664, 'g')).toBe('11.664 g');
  });

  it('maps product classes to valid units', () => {
    expect(PRODUCT_CLASS_UNITS.accessory).toEqual(['pcs']);
    expect(PRODUCT_CLASS_UNITS.liquid_fragrance).toContain('tola');
    expect(PRODUCT_CLASS_UNITS.liquid_fragrance).not.toContain('pcs');
  });
});
