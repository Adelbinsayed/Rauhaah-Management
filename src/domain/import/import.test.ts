import { describe, expect, it } from 'vitest';
import { normalizeHeader, parseNumberField, computeStringHash, parseCsvContent } from './csvParser';
import { validateCsvImport } from './importValidator';
import { escapeCsvCell } from '../../lib/csvExport';
import type { Sellable } from '../catalog/types';

describe('CSV Parser domain logic', () => {
  it('normalizes headers with BOM, spaces, and punctuation', () => {
    expect(normalizeHeader('\uFEFFProduct Name')).toBe('product_name');
    expect(normalizeHeader('  Retail-Price (BDT)  ')).toBe('retail_price_bdt');
    expect(normalizeHeader('SKU #')).toBe('sku');
    expect(normalizeHeader('Unit / Measure')).toBe('unit_measure');
  });

  it('strips currency symbols, commas, and handles numbers cleanly', () => {
    expect(parseNumberField('৳1,250.50')).toBe(1250.5);
    expect(parseNumberField('  500 BDT ')).toBe(500);
    expect(parseNumberField('$99.99')).toBe(99.99);
    expect(parseNumberField('25%')).toBe(25);
    expect(parseNumberField('')).toBeNull();
    expect(parseNumberField('abc')).toBeNull();
    expect(parseNumberField('12abc')).toBeNull();
    expect(parseNumberField('12.34xyz')).toBeNull();
    expect(parseNumberField('-50.25')).toBe(-50.25);
  });

  it('computes stable deterministic hash for content', () => {
    const text1 = 'sku,name\nPRD-1,Oud';
    const text2 = 'sku,name\nPRD-1,Oud';
    const text3 = 'sku,name\nPRD-2,Rose';
    expect(computeStringHash(text1)).toBe(computeStringHash(text2));
    expect(computeStringHash(text1)).not.toBe(computeStringHash(text3));
  });

  it('parses raw CSV text into normalized row objects', () => {
    const csv = `\uFEFFProduct SKU, Product Name, Selling Price
RAU-001, Black Oud, "৳1,500.00"
RAU-002, White Musk, 250
`;
    const res = parseCsvContent(csv);
    expect(res.headers).toEqual(['product_sku', 'product_name', 'selling_price']);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0].product_sku).toBe('RAU-001');
    expect(res.rows[0].product_name).toBe('Black Oud');
    expect(res.rows[0].selling_price).toBe('৳1,500.00');
  });

  it('auto-detects semicolon-delimited CSV files', () => {
    const csv = `sku;name;selling_price
RAU-001;"Black; Oud";1500
RAU-002;White Musk;250
`;
    const res = parseCsvContent(csv);
    expect(res.headers).toEqual(['sku', 'name', 'selling_price']);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0].sku).toBe('RAU-001');
    expect(res.rows[0].name).toBe('Black; Oud');
    expect(res.rows[0].selling_price).toBe('1500');
  });
});

describe('Import Validator domain rules', () => {
  const mockProducts: Sellable[] = [
    {
      id: 'prod-1',
      sku: 'PRD-101',
      barcode: '890123456789',
      name: 'Royal Musk',
      brandId: null,
      categoryId: null,
      sellableType: 'loose_decant',
      retailPriceBdt: 150,
      wholesalePriceBdt: 130,
      minPriceBdt: 115,
      isTaxable: false,
      taxRatePercent: 0,
      trackInventory: true,
      isActive: true,
      calculatedCostBdt: 100,
      primaryStockQuantity: 40,
      primaryUnitCode: 'ml',
      components: [],
      createdAt: '2026-11-14T00:00:00Z',
      updatedAt: '2026-11-14T00:00:00Z',
    },
  ];

  it('in price-list mode: updates existing product and flags unknown SKU as error', () => {
    const rows: Record<string, string>[] = [
      { sku: 'PRD-101', selling_price: '180', cost_price: '115' },
      { sku: 'UNKNOWN-999', selling_price: '500' },
    ];

    const result = validateCsvImport({
      importType: 'prices',
      fileName: 'prices.csv',
      rawContent: 'sample',
      rows,
      existingProducts: mockProducts,
      categories: [],
      brands: [],
    });

    expect(result.summary.totalRows).toBe(2);
    expect(result.summary.updateRows).toBe(1);
    expect(result.summary.errorRows).toBe(1);

    const row1 = result.rows[0];
    expect(row1.status).toBe('update');
    expect(row1.changes).toHaveLength(2);
    expect(row1.changes.find((c) => c.field === 'retail_price_bdt')?.newValue).toBe(180);

    const row2 = result.rows[1];
    expect(row2.status).toBe('error');
    expect(row2.errors[0]).toContain('does not exist in catalog');
  });

  it('in products mode: marks new products as "new" and existing as "update"', () => {
    const rows: Record<string, string>[] = [
      {
        sku: 'PRD-101',
        name: 'Royal Musk Updated',
        selling_price: '150',
      },
      {
        sku: 'PRD-NEW',
        name: 'Amber Oud Supreme',
        type: 'oil',
        selling_price: '350',
        opening_stock: '100',
      },
    ];

    const result = validateCsvImport({
      importType: 'products',
      fileName: 'products.csv',
      rawContent: 'sample',
      rows,
      existingProducts: mockProducts,
      categories: [],
      brands: [],
    });

    expect(result.summary.totalRows).toBe(2);
    expect(result.summary.newRows).toBe(1);
    expect(result.summary.updateRows).toBe(1);

    const newProd = result.rows[1];
    expect(newProd.status).toBe('new');
    expect(newProd.payload.sellableType).toBe('loose_decant');
    expect(newProd.payload.initialQuantity).toBe(100);
  });

  it('flags duplicate SKUs within the same file with exact row references', () => {
    const rows: Record<string, string>[] = [
      { sku: 'DUP-1', name: 'First occurrence', selling_price: '100' },
      { sku: 'DUP-1', name: 'Second occurrence', selling_price: '120' },
    ];

    const result = validateCsvImport({
      importType: 'products',
      fileName: 'dups.csv',
      rawContent: 'sample',
      rows,
      existingProducts: [],
      categories: [],
      brands: [],
    });

    expect(result.summary.errorRows).toBe(1);
    expect(result.rows[1].errors[0]).toContain('Duplicate SKU "DUP-1" found in file');
  });

  it('in stock mode: validates quantity and detects differences', () => {
    const rows: Record<string, string>[] = [
      { sku: 'PRD-101', quantity: '75', notes: 'Warehouse audit' },
    ];

    const result = validateCsvImport({
      importType: 'stock',
      fileName: 'stock.csv',
      rawContent: 'sample',
      rows,
      existingProducts: mockProducts,
      categories: [],
      brands: [],
    });

    expect(result.summary.updateRows).toBe(1);
    const row = result.rows[0];
    expect(row.status).toBe('update');
    expect(row.changes[0].oldValue).toBe(40);
    expect(row.changes[0].newValue).toBe(75);
  });

  it('flags duplicate barcodes within the same file', () => {
    const rows: Record<string, string>[] = [
      { sku: 'PRD-1', barcode: '890111222', name: 'Item A', selling_price: '100' },
      { sku: 'PRD-2', barcode: '890111222', name: 'Item B', selling_price: '120' },
    ];

    const result = validateCsvImport({
      importType: 'products',
      fileName: 'dup_barcodes.csv',
      rawContent: 'sample',
      rows,
      existingProducts: [],
      categories: [],
      brands: [],
    });

    expect(result.summary.errorRows).toBe(1);
    expect(result.rows[1].errors[0]).toContain('Duplicate Barcode "890111222" found in file');
  });
});

describe('CSV Export formula injection protection', () => {
  it('prefixes dangerous formula starters with a single quote while preserving negative numbers', () => {
    expect(escapeCsvCell('=SUM(A1)')).toBe(`"'=SUM(A1)"`);
    expect(escapeCsvCell('+cmd|calc')).toBe(`"'+cmd|calc"`);
    expect(escapeCsvCell('@SUM(1,2)')).toBe(`"'@SUM(1,2)"`);
    expect(escapeCsvCell('\t123')).toBe(`"'\t123"`);
    expect(escapeCsvCell('-cmd')).toBe(`"'-cmd"`);
    expect(escapeCsvCell('-123.45')).toBe('"-123.45"');
    expect(escapeCsvCell(-123.45)).toBe('"-123.45"');
    expect(escapeCsvCell('Normal "Text"')).toBe('"Normal ""Text"""');
  });
});
