import type { Brand, Category, Sellable } from '../catalog/types';
import { parseNumberField, computeStringHash } from './csvParser';
import type {
  CsvPreviewRow,
  FieldChange,
  ImportType,
  ValidationResult,
  ValidationSummary,
} from './types';

export interface ValidationContext {
  importType: ImportType;
  fileName: string;
  rawContent: string;
  rows: Record<string, string>[];
  existingProducts: Sellable[];
  categories: Category[];
  brands: Brand[];
}

export function validateCsvImport(ctx: ValidationContext): ValidationResult {
  const { importType, fileName, rawContent, rows, existingProducts, categories, brands } = ctx;

  const fileHash = computeStringHash(rawContent);

  // Maps for fast matching
  const productBySku = new Map<string, Sellable>();
  const productByBarcode = new Map<string, Sellable>();
  for (const p of existingProducts) {
    if (p.sku) productBySku.set(p.sku.trim().toLowerCase(), p);
    if (p.barcode) productByBarcode.set(p.barcode.trim().toLowerCase(), p);
  }

  const categoryMap = new Map<string, Category>();
  for (const c of categories) {
    categoryMap.set(c.name.trim().toLowerCase(), c);
  }

  const brandMap = new Map<string, Brand>();
  for (const b of brands) {
    brandMap.set(b.name.trim().toLowerCase(), b);
  }

  const seenSkusInFile = new Map<string, number>();
  const previewRows: CsvPreviewRow[] = [];

  const summary: ValidationSummary = {
    totalRows: rows.length,
    newRows: 0,
    updateRows: 0,
    unchangedRows: 0,
    errorRows: 0,
  };

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // Row 1 is header
    const errors: string[] = [];
    const warnings: string[] = [];
    const changes: FieldChange[] = [];

    // Extract common fields
    const skuRaw = (row.sku || row.product_sku || row.item_code || '').trim();
    const barcodeRaw = (row.barcode || row.upc || row.ean || '').trim();
    const nameRaw = (row.name || row.product_name || row.title || '').trim();

    if (!skuRaw && !barcodeRaw) {
      errors.push('Row must contain at least an SKU or Barcode.');
    }

    const skuKey = skuRaw.toLowerCase();
    if (skuRaw) {
      if (seenSkusInFile.has(skuKey)) {
        errors.push(
          `Duplicate SKU "${skuRaw}" found in file (first appeared on row ${seenSkusInFile.get(skuKey)}).`
        );
      } else {
        seenSkusInFile.set(skuKey, rowNumber);
      }
    }

    // Match with database
    const existing =
      (skuRaw ? productBySku.get(skuKey) : undefined) ||
      (barcodeRaw ? productByBarcode.get(barcodeRaw.toLowerCase()) : undefined);

    let status: CsvPreviewRow['status'] = 'unchanged';
    const payload: Record<string, unknown> = {
      sku: skuRaw || (existing ? existing.sku : ''),
      barcode: barcodeRaw || (existing?.barcode ?? null),
      name: nameRaw || (existing ? existing.name : ''),
    };

    if (importType === 'prices') {
      // --- Price List Import Mode ---
      if (!existing) {
        errors.push(`SKU "${skuRaw || barcodeRaw}" does not exist in catalog. Price imports only update existing products.`);
      } else {
        payload.sellableId = existing.id;
        const sellingPrice = parseNumberField(row.selling_price || row.retail_price || row.price);
        const wholesalePrice = parseNumberField(row.wholesale_price || row.wholesale);
        const costPrice = parseNumberField(row.cost_price || row.unit_cost || row.cost);

        if (sellingPrice !== null) {
          if (sellingPrice < 0) {
            errors.push('Selling price cannot be negative.');
          } else {
            payload.retailPriceBdt = sellingPrice;
            if (sellingPrice !== existing.retailPriceBdt) {
              changes.push({
                field: 'retail_price_bdt',
                label: 'Retail Price (৳)',
                oldValue: existing.retailPriceBdt,
                newValue: sellingPrice,
              });
            }
          }
        }

        if (wholesalePrice !== null) {
          if (wholesalePrice < 0) {
            errors.push('Wholesale price cannot be negative.');
          } else {
            payload.wholesalePriceBdt = wholesalePrice;
            if (wholesalePrice !== existing.wholesalePriceBdt) {
              changes.push({
                field: 'wholesale_price_bdt',
                label: 'Wholesale Price (৳)',
                oldValue: existing.wholesalePriceBdt,
                newValue: wholesalePrice,
              });
            }
          }
        }

        if (costPrice !== null) {
          if (costPrice < 0) {
            errors.push('Cost price cannot be negative.');
          } else {
            payload.costPriceBdt = costPrice;
            const oldCost = existing.calculatedCostBdt ?? 0;
            if (costPrice !== oldCost) {
              changes.push({
                field: 'cost_price_bdt',
                label: 'Cost Price (৳)',
                oldValue: oldCost,
                newValue: costPrice,
              });
            }
          }
        }

        if (changes.length > 0) {
          status = 'update';
        }
      }
    } else if (importType === 'products') {
      // --- Full Product Import Mode ---
      const categoryName = (row.category || row.category_name || '').trim();
      const brandName = (row.brand || row.brand_name || '').trim();
      const typeRaw = (row.type || row.product_type || row.kind || '').trim().toLowerCase();
      const isOil = typeRaw.includes('oil') || typeRaw.includes('attar') || typeRaw.includes('decant');
      const sellableType = isOil ? 'loose_decant' : 'sealed_product';

      const unitRaw = (row.unit || row.uom || '').trim().toLowerCase();
      const unitId = isOil || unitRaw === 'ml' ? 'unit-vol-ml' : 'unit-cnt-pcs';

      const sellingPrice = parseNumberField(row.selling_price || row.retail_price || row.price);
      const wholesalePrice = parseNumberField(row.wholesale_price || row.wholesale);
      const costPrice = parseNumberField(row.cost_price || row.unit_cost || row.cost);
      const openingStock = parseNumberField(row.opening_stock || row.stock || row.quantity);

      payload.sellableType = sellableType;
      payload.unitId = unitId;
      payload.categoryName = categoryName || null;
      payload.brandName = brandName || null;

      if (!existing) {
        // New Product
        if (!nameRaw) {
          errors.push('Product name is required for new products.');
        }
        if (sellingPrice === null || sellingPrice < 0) {
          errors.push('A valid selling price (>= 0) is required for new products.');
        }

        payload.retailPriceBdt = sellingPrice ?? 0;
        payload.wholesalePriceBdt = wholesalePrice ?? (sellingPrice ?? 0);
        payload.costPriceBdt = costPrice ?? 0;
        payload.initialQuantity = openingStock ?? 0;

        changes.push({
          field: 'name',
          label: 'Product Name',
          oldValue: null,
          newValue: nameRaw,
        });
        changes.push({
          field: 'retail_price_bdt',
          label: 'Retail Price (৳)',
          oldValue: null,
          newValue: sellingPrice ?? 0,
        });
        if (openingStock) {
          changes.push({
            field: 'initial_quantity',
            label: 'Opening Stock',
            oldValue: null,
            newValue: openingStock,
          });
        }

        status = 'new';
      } else {
        // Updating Existing Product
        payload.sellableId = existing.id;

        if (nameRaw && nameRaw !== existing.name) {
          changes.push({
            field: 'name',
            label: 'Name',
            oldValue: existing.name,
            newValue: nameRaw,
          });
        }

        if (sellingPrice !== null && sellingPrice !== existing.retailPriceBdt) {
          if (sellingPrice < 0) {
            errors.push('Selling price cannot be negative.');
          } else {
            changes.push({
              field: 'retail_price_bdt',
              label: 'Retail Price (৳)',
              oldValue: existing.retailPriceBdt,
              newValue: sellingPrice,
            });
            payload.retailPriceBdt = sellingPrice;
          }
        }

        if (wholesalePrice !== null && wholesalePrice !== existing.wholesalePriceBdt) {
          if (wholesalePrice < 0) {
            errors.push('Wholesale price cannot be negative.');
          } else {
            changes.push({
              field: 'wholesale_price_bdt',
              label: 'Wholesale Price (৳)',
              oldValue: existing.wholesalePriceBdt,
              newValue: wholesalePrice,
            });
            payload.wholesalePriceBdt = wholesalePrice;
          }
        }

        if (costPrice !== null && costPrice !== existing.calculatedCostBdt) {
          if (costPrice < 0) {
            errors.push('Cost price cannot be negative.');
          } else {
            changes.push({
              field: 'cost_price_bdt',
              label: 'Cost Price (৳)',
              oldValue: existing.calculatedCostBdt ?? 0,
              newValue: costPrice,
            });
            payload.costPriceBdt = costPrice;
          }
        }

        if (changes.length > 0) {
          status = 'update';
        }
      }
    } else if (importType === 'stock') {
      // --- Stock Ledger / Count Mode ---
      if (!existing) {
        errors.push(`SKU "${skuRaw || barcodeRaw}" does not exist in catalog.`);
      } else {
        payload.sellableId = existing.id;
        const stockQty = parseNumberField(row.quantity || row.stock || row.current_stock);
        const costPrice = parseNumberField(row.cost_price || row.unit_cost || row.cost);
        const notes = (row.notes || row.reason || '').trim();

        if (stockQty === null || stockQty < 0) {
          errors.push('A valid non-negative inventory quantity is required.');
        } else {
          payload.quantity = stockQty;
          const oldQty = existing.primaryStockQuantity ?? 0;
          if (stockQty !== oldQty) {
            changes.push({
              field: 'primary_stock_quantity',
              label: `Stock Quantity (${existing.primaryUnitCode || 'pcs'})`,
              oldValue: oldQty,
              newValue: stockQty,
            });
          }
        }

        if (costPrice !== null) {
          if (costPrice < 0) {
            errors.push('Cost price cannot be negative.');
          } else {
            payload.costPriceBdt = costPrice;
            const oldCost = existing.calculatedCostBdt ?? 0;
            if (costPrice !== oldCost) {
              changes.push({
                field: 'cost_price_bdt',
                label: 'Cost Price (৳)',
                oldValue: oldCost,
                newValue: costPrice,
              });
            }
          }
        }

        payload.notes = notes;
        if (changes.length > 0) {
          status = 'update';
        }
      }
    }

    if (errors.length > 0) {
      status = 'error';
      summary.errorRows++;
    } else if (status === 'new') {
      summary.newRows++;
    } else if (status === 'update') {
      summary.updateRows++;
    } else {
      summary.unchangedRows++;
    }

    previewRows.push({
      rowNumber,
      sku: skuRaw || (existing ? existing.sku : ''),
      barcode: barcodeRaw || existing?.barcode,
      name: nameRaw || existing?.name,
      status,
      errors,
      warnings,
      changes,
      payload,
    });
  });

  return {
    importType,
    fileName,
    fileHash,
    summary,
    rows: previewRows,
    hasErrors: summary.errorRows > 0,
  };
}
