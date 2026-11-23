import { describe, expect, it } from 'vitest';
import { calculateLineTotal, calculateCartTotals, formatInvoiceNumber } from './posCalculations';
import type { CartItem } from './types';

describe('POS Domain Calculations', () => {
  it('calculates oil line total with custom ml and per-ml price', () => {
    // e.g. 3 ml of Black Oud at ৳170/ml
    const line = calculateLineTotal({
      quantity: 3,
      unitPriceBdt: 170,
    });
    expect(line.rawTotalBdt).toBe(510);
    expect(line.discountBdt).toBe(0);
    expect(line.lineTotalBdt).toBe(510);
  });

  it('calculates line total with percent discount', () => {
    // 6 ml of Royal Musk at ৳150/ml = ৳900 with 10% discount
    const line = calculateLineTotal({
      quantity: 6,
      unitPriceBdt: 150,
      discountPercent: 10,
    });
    expect(line.rawTotalBdt).toBe(900);
    expect(line.discountBdt).toBe(90);
    expect(line.lineTotalBdt).toBe(810);
  });

  it('calculates full cart totals with item discounts and cart-level discount', () => {
    const items: CartItem[] = [
      {
        id: 'line-1',
        sellableId: 'prd-1',
        productName: 'Black Oud',
        sku: 'RAU-001',
        sellableType: 'loose_decant',
        unitCode: 'ml',
        bottleSizeMl: 3,
        quantity: 3,
        unitPriceBdt: 170,
        idealRetailPriceBdt: 170,
        costPriceBdt: 100,
        discountPercent: 0,
        discountAmountBdt: 0,
        lineTotalBdt: 510,
        stockInHand: 50,
      },
      {
        id: 'line-2',
        sellableId: 'prd-2',
        productName: 'Turkish Janamaz',
        sku: 'RAU-002',
        sellableType: 'sealed_product',
        unitCode: 'pcs',
        quantity: 1,
        unitPriceBdt: 950,
        idealRetailPriceBdt: 950,
        costPriceBdt: 600,
        discountPercent: 0,
        discountAmountBdt: 50,
        lineTotalBdt: 900,
        stockInHand: 20,
      },
    ];

    // Subtotal: 510 + 950 = 1460
    // Line discount: 50
    // Sum of lines: 1410
    // Additional Cart discount ৳110 -> Total ৳1300
    // Customer pays ৳1500 Cash -> Change ৳200
    const totals = calculateCartTotals(items, 0, 110, 1500);

    expect(totals.subtotalBdt).toBe(1460);
    expect(totals.itemDiscountBdt).toBe(50);
    expect(totals.cartDiscountBdt).toBe(110);
    expect(totals.totalAmountBdt).toBe(1300);
    expect(totals.changeAmountBdt).toBe(200);
    expect(totals.dueAmountBdt).toBe(0);
  });

  it('calculates due balance when customer pays partial amount', () => {
    const items: CartItem[] = [
      {
        id: 'line-1',
        sellableId: 'prd-1',
        productName: 'Miswak',
        sku: 'MSK-01',
        sellableType: 'accessory',
        unitCode: 'pcs',
        quantity: 5,
        unitPriceBdt: 60,
        idealRetailPriceBdt: 60,
        costPriceBdt: 30,
        discountPercent: 0,
        discountAmountBdt: 0,
        lineTotalBdt: 300,
        stockInHand: 100,
      },
    ];

    // Total ৳300, customer pays ৳200, due ৳100
    const totals = calculateCartTotals(items, 0, 0, 200);
    expect(totals.totalAmountBdt).toBe(300);
    expect(totals.changeAmountBdt).toBe(0);
    expect(totals.dueAmountBdt).toBe(100);
  });

  it('formats sequential invoice number correctly', () => {
    const date = new Date(2026, 10, 14); // Nov 2026
    expect(formatInvoiceNumber('INV', date, 42)).toBe('INV-202611-0042');
  });

  it('strips trailing hyphens from invoice prefix', () => {
    const date = new Date(2026, 10, 14); // Nov 2026
    expect(formatInvoiceNumber('INV-', date, 1)).toBe('INV-202611-0001');
  });

  it('clamps line and cart discount percentages to [0, 100]', () => {
    const overLine = calculateLineTotal({
      quantity: 2,
      unitPriceBdt: 500,
      discountPercent: 150,
    });
    expect(overLine.discountBdt).toBe(1000);
    expect(overLine.lineTotalBdt).toBe(0);

    const underLine = calculateLineTotal({
      quantity: 2,
      unitPriceBdt: 500,
      discountPercent: -25,
    });
    expect(underLine.discountBdt).toBe(0);
    expect(underLine.lineTotalBdt).toBe(1000);

    const items: CartItem[] = [
      {
        id: 'line-1',
        sellableId: 'prd-1',
        productName: 'Black Oud',
        sku: 'RAU-001',
        sellableType: 'sealed_product',
        unitCode: 'pcs',
        quantity: 1,
        unitPriceBdt: 1000,
        idealRetailPriceBdt: 1000,
        costPriceBdt: 600,
        discountPercent: 0,
        discountAmountBdt: 0,
        lineTotalBdt: 1000,
        stockInHand: 10,
      },
    ];

    const overCart = calculateCartTotals(items, 120, 0, 0);
    expect(overCart.cartDiscountPercent).toBe(100);
    expect(overCart.cartDiscountBdt).toBe(1000);
    expect(overCart.totalAmountBdt).toBe(0);

    const underCart = calculateCartTotals(items, -15, 0, 1000);
    expect(underCart.cartDiscountPercent).toBe(0);
    expect(underCart.cartDiscountBdt).toBe(0);
    expect(underCart.totalAmountBdt).toBe(1000);
  });
});
