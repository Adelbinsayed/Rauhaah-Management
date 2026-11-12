/**
 * Quantity helpers for Rauhaah Management.
 * Quantities are stored as integer thousandths (e.g. 2.5 ml = 2500, 1 pc = 1000).
 */

export const QUANTITY_SCALE = 1000;

export type UnitCode = 'pcs' | 'ml' | 'litre' | 'g' | 'tola';

export type ProductClass =
  | 'liquid_fragrance'
  | 'solid_fragrance'
  | 'sealed_bottle'
  | 'raw_material'
  | 'packaging'
  | 'accessory'
  | 'skincare';

export const PRODUCT_CLASS_UNITS: Record<ProductClass, UnitCode[]> = {
  liquid_fragrance: ['ml', 'litre', 'g', 'tola'],
  solid_fragrance: ['g', 'tola', 'pcs'],
  sealed_bottle: ['pcs'],
  raw_material: ['ml', 'litre', 'g', 'tola'],
  packaging: ['pcs'],
  accessory: ['pcs'],
  skincare: ['ml', 'g', 'pcs'],
};

/** Convert decimal quantity (e.g. 2.5) to integer thousandths (2500). */
export function toThousandths(qty: number): number {
  if (!Number.isFinite(qty)) {
    throw new RangeError(`Invalid quantity: ${qty}`);
  }
  return Math.round(qty * QUANTITY_SCALE);
}

/** Convert integer thousandths (2500) to decimal quantity (2.5). */
export function fromThousandths(thousandths: number): number {
  return thousandths / QUANTITY_SCALE;
}

/** Format integer thousandths with unit, trimming trailing zeros (e.g. "2.5 ml", "10 pcs"). */
export function formatQuantity(thousandths: number, unit: UnitCode): string {
  const value = fromThousandths(thousandths);
  const formatted = Number.isInteger(value)
    ? value.toString()
    : value.toFixed(3).replace(/\.?0+$/, '');
  return `${formatted} ${unit}`;
}
