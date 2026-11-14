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
  const rawTotal = Math.round(quantity * unitPriceBdt * 100) / 100;

  let discount = 0;
  if (discountPercent > 0) {
    discount = Math.round(rawTotal * (discountPercent / 100) * 100) / 100;
  } else if (discountAmountBdt > 0) {
    discount = Math.min(rawTotal, discountAmountBdt);
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
    const raw = Math.round(item.quantity * item.unitPriceBdt * 100) / 100;
    subtotal += raw;
    totalItemDiscount += item.discountAmountBdt || 0;
    sumLines += item.lineTotalBdt;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  sumLines = Math.round(sumLines * 100) / 100;

  let cartDiscount = 0;
  if (cartDiscountPercent > 0) {
    cartDiscount = Math.round(sumLines * (cartDiscountPercent / 100) * 100) / 100;
  } else if (cartDiscountAmountBdt > 0) {
    cartDiscount = Math.min(sumLines, cartDiscountAmountBdt);
  }

  const totalAmount = Math.max(0, Math.round((sumLines - cartDiscount) * 100) / 100);

  let change = 0;
  let due = 0;
  if (paidAmountBdt >= totalAmount) {
    change = Math.round((paidAmountBdt - totalAmount) * 100) / 100;
  } else {
    due = Math.round((totalAmount - paidAmountBdt) * 100) / 100;
  }

  return {
    subtotalBdt: subtotal,
    itemDiscountBdt: Math.round(totalItemDiscount * 100) / 100,
    cartDiscountPercent,
    cartDiscountBdt: cartDiscount,
    totalAmountBdt: totalAmount,
    paidAmountBdt,
    changeAmountBdt: change,
    dueAmountBdt: due,
  };
}

/**
 * Generates standard branch invoice number (e.g. INV-202611-0001)
 */
export function formatInvoiceNumber(prefix: string = 'INV', date: Date = new Date(), sequence: number = 1): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seqStr = String(sequence).padStart(4, '0');
  return `${prefix}-${year}${month}-${seqStr}`;
}
