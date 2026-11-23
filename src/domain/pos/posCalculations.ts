import type { CartItem, CartTotals } from './types';

/**
 * Calculates a single cart line total after line-level discount
 */
export function calculateLineTotal(params: {
  quantity: number;
  unitPriceBdt: number;
  discountPercent?: number;
  discountAmountBdt?: number;
}): {
  rawTotalBdt: number;
  discountBdt: number;
  lineTotalBdt: number;
} {
  const { quantity, unitPriceBdt, discountPercent = 0, discountAmountBdt = 0 } = params;
  const safeQty = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  const safePrice = Number.isFinite(unitPriceBdt) ? Math.max(0, unitPriceBdt) : 0;
  const rawTotal = Math.round(safeQty * safePrice * 100) / 100;

  const clampedDiscountPct = Number.isFinite(discountPercent)
    ? Math.min(100, Math.max(0, discountPercent))
    : 0;
  const clampedDiscountAmt = Number.isFinite(discountAmountBdt)
    ? Math.min(rawTotal, Math.max(0, discountAmountBdt))
    : 0;

  let discount = 0;
  if (clampedDiscountPct > 0) {
    discount = Math.round(rawTotal * (clampedDiscountPct / 100) * 100) / 100;
  } else if (clampedDiscountAmt > 0) {
    discount = clampedDiscountAmt;
  }

  const finalTotal = Math.max(0, Math.round((rawTotal - discount) * 100) / 100);

  return {
    rawTotalBdt: rawTotal,
    discountBdt: discount,
    lineTotalBdt: finalTotal,
  };
}

/**
 * Calculates full cart totals including subtotal, line discounts, cart discount, change, and due
 */
export function calculateCartTotals(
  items: CartItem[],
  cartDiscountPercent: number = 0,
  cartDiscountAmountBdt: number = 0,
  paidAmountBdt: number = 0
): CartTotals {
  let subtotal = 0;
  let totalItemDiscount = 0;
  let sumLines = 0;

  for (const item of items) {
    const safeQty = Number.isFinite(item.quantity) ? Math.max(0, item.quantity) : 0;
    const safePrice = Number.isFinite(item.unitPriceBdt) ? Math.max(0, item.unitPriceBdt) : 0;
    const raw = Math.round(safeQty * safePrice * 100) / 100;
    subtotal += raw;
    totalItemDiscount += Number.isFinite(item.discountAmountBdt) ? Math.max(0, item.discountAmountBdt || 0) : 0;
    sumLines += Number.isFinite(item.lineTotalBdt) ? Math.max(0, item.lineTotalBdt) : 0;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  sumLines = Math.round(sumLines * 100) / 100;

  const clampedCartDiscountPct = Number.isFinite(cartDiscountPercent)
    ? Math.min(100, Math.max(0, cartDiscountPercent))
    : 0;
  const safeCartDiscountAmtInput = Number.isFinite(cartDiscountAmountBdt)
    ? Math.max(0, cartDiscountAmountBdt)
    : 0;
  const safePaidAmount = Number.isFinite(paidAmountBdt) ? Math.max(0, paidAmountBdt) : 0;

  let cartDiscount = 0;
  if (clampedCartDiscountPct > 0) {
    cartDiscount = Math.round(sumLines * (clampedCartDiscountPct / 100) * 100) / 100;
  } else if (safeCartDiscountAmtInput > 0) {
    cartDiscount = Math.min(sumLines, safeCartDiscountAmtInput);
  }

  const totalAmount = Math.max(0, Math.round((sumLines - cartDiscount) * 100) / 100);

  let change = 0;
  let due = 0;
  if (safePaidAmount >= totalAmount) {
    change = Math.round((safePaidAmount - totalAmount) * 100) / 100;
  } else {
    due = Math.round((totalAmount - safePaidAmount) * 100) / 100;
  }

  return {
    subtotalBdt: subtotal,
    itemDiscountBdt: Math.round(totalItemDiscount * 100) / 100,
    cartDiscountPercent: clampedCartDiscountPct,
    cartDiscountBdt: cartDiscount,
    totalAmountBdt: totalAmount,
    paidAmountBdt: safePaidAmount,
    changeAmountBdt: change,
    dueAmountBdt: due,
  };
}

/**
 * Generates standard branch invoice number (e.g. INV-202611-0001)
 */
export function formatInvoiceNumber(prefix: string = 'INV', date: Date = new Date(), sequence: number = 1): string {
  const cleanPrefix = (prefix || 'INV').trim().replace(/-+$/, '') || 'INV';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seqStr = String(sequence).padStart(4, '0');
  return `${cleanPrefix}-${year}${month}-${seqStr}`;
}
