import { createChangeLogStatement, dbBatchTx, dbQuery, type BatchStatement } from '@/data/db';
import { nowUtcIso } from '@/lib/dates';
import { uuidv7 } from '@/lib/ids';
import type { ImportLogEntry, ValidationResult } from '@/domain/import/types';

export const importRepo = {
  /**
   * Checks if a file hash was already imported to warn the user.
   */
  async checkDuplicateFileHash(fileHash: string): Promise<ImportLogEntry | null> {
    const rows = await dbQuery<Record<string, unknown>>(
      `SELECT l.*, u.username as user_name
       FROM import_logs l
       LEFT JOIN users u ON l.user_id = u.id
       WHERE l.file_hash = ?
       ORDER BY l.created_at DESC LIMIT 1`,
      [fileHash]
    );

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: String(r.id),
      fileName: String(r.file_name),
      fileHash: r.file_hash ? String(r.file_hash) : null,
      importType: r.import_type as ImportLogEntry['importType'],
      totalRows: Number(r.total_rows),
      successRows: Number(r.success_rows),
      errorRows: Number(r.error_rows),
      errorDetails: r.error_details ? String(r.error_details) : null,
      createdAt: String(r.created_at),
      userName: r.user_name ? String(r.user_name) : null,
    };
  },

  /**
   * Retrieves past import audit history.
   */
  async getImportLogs(): Promise<ImportLogEntry[]> {
    const rows = await dbQuery<Record<string, unknown>>(
      `SELECT l.*, u.username as user_name
       FROM import_logs l
       LEFT JOIN users u ON l.user_id = u.id
       ORDER BY l.created_at DESC LIMIT 100`
    );

    return rows.map((r) => ({
      id: String(r.id),
      fileName: String(r.file_name),
      fileHash: r.file_hash ? String(r.file_hash) : null,
      importType: r.import_type as ImportLogEntry['importType'],
      totalRows: Number(r.total_rows),
      successRows: Number(r.success_rows),
      errorRows: Number(r.error_rows),
      errorDetails: r.error_details ? String(r.error_details) : null,
      createdAt: String(r.created_at),
      userName: r.user_name ? String(r.user_name) : null,
    }));
  },

  /**
   * Executes the entire import in a single atomic SQLite batch transaction.
   */
  async executeImport(
    result: ValidationResult,
    userId: string,
    deviceId: string
  ): Promise<{ successCount: number; errorCount: number }> {
    const now = nowUtcIso();
    const statements: BatchStatement[] = [];
    let successCount = 0;

    // Cache existing categories and brands for on-the-fly resolution
    const existingCats = await dbQuery<{ id: string; name: string }>(
      `SELECT id, name FROM categories WHERE deleted_at IS NULL`
    );
    const catMap = new Map<string, string>();
    for (const c of existingCats) {
      catMap.set(c.name.trim().toLowerCase(), c.id);
    }

    const existingBrands = await dbQuery<{ id: string; name: string }>(
      `SELECT id, name FROM brands WHERE deleted_at IS NULL`
    );
    const brandMap = new Map<string, string>();
    for (const b of existingBrands) {
      brandMap.set(b.name.trim().toLowerCase(), b.id);
    }

    for (const row of result.rows) {
      if (row.status === 'error' || row.status === 'unchanged') {
        continue;
      }

      if (result.importType === 'prices') {
        const sellableId = String(row.payload.sellableId);
        const retailPrice = row.payload.retailPriceBdt as number | undefined;
        const wholesalePrice = row.payload.wholesalePriceBdt as number | undefined;
        const costPrice = row.payload.costPriceBdt as number | undefined;

        // 1. Update sellable prices
        if (retailPrice !== undefined || wholesalePrice !== undefined) {
          statements.push({
            sql: `UPDATE sellables
                  SET retail_price_bdt = COALESCE(?, retail_price_bdt),
                      wholesale_price_bdt = COALESCE(?, wholesale_price_bdt),
                      updated_at = ?
                  WHERE id = ?`,
            params: [retailPrice ?? null, wholesalePrice ?? null, now, sellableId],
          });

          // Price history log
          const retailChange = row.changes.find((c) => c.field === 'retail_price_bdt');
          if (retailPrice !== undefined && retailChange) {
            statements.push({
              sql: `INSERT INTO price_history (id, sellable_id, price_type, old_price, new_price, change_reason, changed_by_user_id, created_at, device_id)
                    VALUES (?, ?, 'retail', ?, ?, 'CSV Price Import', ?, ?, ?)`,
              params: [
                uuidv7(),
                sellableId,
                retailChange.oldValue ?? retailPrice,
                retailPrice,
                userId,
                now,
                deviceId,
              ],
            });
          }

          const wholesaleChange = row.changes.find((c) => c.field === 'wholesale_price_bdt');
          if (wholesalePrice !== undefined && wholesaleChange) {
            statements.push({
              sql: `INSERT INTO price_history (id, sellable_id, price_type, old_price, new_price, change_reason, changed_by_user_id, created_at, device_id)
                    VALUES (?, ?, 'wholesale', ?, ?, 'CSV Price Import', ?, ?, ?)`,
              params: [
                uuidv7(),
                sellableId,
                wholesaleChange.oldValue ?? wholesalePrice,
                wholesalePrice,
                userId,
                now,
                deviceId,
              ],
            });
          }
        }

        // 2. Update primary stock item cost if provided (divide by sc.quantity for pre-sized decants)
        if (costPrice !== undefined) {
          statements.push({
            sql: `UPDATE stock_items
                  SET cost_price_bdt = COALESCE(
                    (SELECT ? / NULLIF(sc.quantity, 0)
                     FROM sellable_components sc
                     WHERE sc.sellable_id = ? AND sc.stock_item_id = stock_items.id AND sc.is_primary = 1
                     LIMIT 1),
                    cost_price_bdt
                  ),
                  updated_at = ?
                  WHERE id IN (
                    SELECT stock_item_id FROM sellable_components WHERE sellable_id = ? AND is_primary = 1
                  )`,
            params: [costPrice, sellableId, now, sellableId],
          });
        }

        statements.push(createChangeLogStatement('sellables', sellableId, 'update', now));

        successCount++;
      } else if (result.importType === 'products') {
        // Resolve Category
        let categoryId: string | null = null;
        const catName = row.payload.categoryName as string | null;
        if (catName) {
          const key = catName.trim().toLowerCase();
          if (catMap.has(key)) {
            categoryId = catMap.get(key)!;
          } else {
            categoryId = uuidv7();
            catMap.set(key, categoryId);
            const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || uuidv7().slice(0, 8);
            statements.push({
              sql: `INSERT INTO categories (id, name, slug, sort_order, is_active, created_at, updated_at, device_id)
                    VALUES (?, ?, ?, 0, 1, ?, ?, ?)`,
              params: [categoryId, catName.trim(), slug, now, now, deviceId],
            });
          }
        }

        // Resolve Brand
        let brandId: string | null = null;
        const bName = row.payload.brandName as string | null;
        if (bName) {
          const key = bName.trim().toLowerCase();
          if (brandMap.has(key)) {
            brandId = brandMap.get(key)!;
          } else {
            brandId = uuidv7();
            brandMap.set(key, brandId);
            statements.push({
              sql: `INSERT INTO brands (id, name, is_active, created_at, updated_at, device_id)
                    VALUES (?, ?, 1, ?, ?, ?)`,
              params: [brandId, bName.trim(), now, now, deviceId],
            });
          }
        }

        if (row.status === 'new') {
          const sellableId = uuidv7();
          const sku =
            (row.payload.sku ? String(row.payload.sku).trim() : '') ||
            `PRD-${Math.floor(100000 + Math.random() * 900000)}`;
          const barcode = row.payload.barcode ? String(row.payload.barcode).trim() : null;
          const name = String(row.payload.name).trim();
          const sellableType = String(row.payload.sellableType);
          const retailPrice = Number(row.payload.retailPriceBdt || 0);
          const wholesalePrice = Number(row.payload.wholesalePriceBdt || retailPrice);
          const costPrice = Number(row.payload.costPriceBdt || 0);
          const initialQty = Number(row.payload.initialQuantity || 0);
          const unitId = String(row.payload.unitId);
          const itemType = sellableType === 'loose_decant' ? 'raw_oil' : 'sealed_product';

          // Insert Sellable
          statements.push({
            sql: `INSERT INTO sellables (
                    id, sku, barcode, name, brand_id, category_id, sellable_type,
                    retail_price_bdt, wholesale_price_bdt, min_price_bdt,
                    is_taxable, tax_rate_percent, track_inventory, is_active,
                    created_at, updated_at, device_id
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, 1, ?, ?, ?)`,
            params: [
              sellableId,
              sku,
              barcode,
              name,
              brandId,
              categoryId,
              sellableType,
              retailPrice,
              wholesalePrice,
              wholesalePrice,
              now,
              now,
              deviceId,
            ],
          });

          // Auto-create matching stock item
          const stockItemId = uuidv7();
          statements.push({
            sql: `INSERT INTO stock_items (
                    id, sku, name, brand_id, category_id, item_type, unit_id,
                    current_quantity, min_alert_quantity, cost_price_bdt,
                    is_active, created_at, updated_at, device_id
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
            params: [
              stockItemId,
              `STK-${sku}`,
              name,
              brandId,
              categoryId,
              itemType,
              unitId,
              initialQty,
              itemType === 'raw_oil' ? 20 : 5,
              costPrice,
              now,
              now,
              deviceId,
            ],
          });

          // Link 1:1 component
          statements.push({
            sql: `INSERT INTO sellable_components (id, sellable_id, stock_item_id, quantity, unit_id, is_primary, created_at, device_id)
                  VALUES (?, ?, ?, 1.0, ?, 1, ?, ?)`,
            params: [uuidv7(), sellableId, stockItemId, unitId, now, deviceId],
          });

          // Price history initial entry
          if (retailPrice > 0) {
            statements.push({
              sql: `INSERT INTO price_history (id, sellable_id, price_type, old_price, new_price, change_reason, changed_by_user_id, created_at, device_id)
                    VALUES (?, ?, 'retail', 0, ?, 'CSV Initial Product Import', ?, ?, ?)`,
              params: [uuidv7(), sellableId, retailPrice, userId, now, deviceId],
            });
          }

          statements.push(createChangeLogStatement('sellables', sellableId, 'insert', now));

          successCount++;
        } else if (row.status === 'update') {
          const sellableId = String(row.payload.sellableId);
          const retailPrice = row.payload.retailPriceBdt as number | undefined;
          const wholesalePrice = row.payload.wholesalePriceBdt as number | undefined;
          const costPrice = row.payload.costPriceBdt as number | undefined;
          const name = row.payload.name ? String(row.payload.name).trim() : undefined;

          statements.push({
            sql: `UPDATE sellables
                  SET name = COALESCE(?, name),
                      category_id = COALESCE(?, category_id),
                      brand_id = COALESCE(?, brand_id),
                      retail_price_bdt = COALESCE(?, retail_price_bdt),
                      wholesale_price_bdt = COALESCE(?, wholesale_price_bdt),
                      updated_at = ?
                  WHERE id = ?`,
            params: [
              name ?? null,
              categoryId,
              brandId,
              retailPrice ?? null,
              wholesalePrice ?? null,
              now,
              sellableId,
            ],
          });

          if (costPrice !== undefined) {
            statements.push({
              sql: `UPDATE stock_items
                    SET cost_price_bdt = COALESCE(
                      (SELECT ? / NULLIF(sc.quantity, 0)
                       FROM sellable_components sc
                       WHERE sc.sellable_id = ? AND sc.stock_item_id = stock_items.id AND sc.is_primary = 1
                       LIMIT 1),
                      cost_price_bdt
                    ),
                    updated_at = ?
                    WHERE id IN (
                      SELECT stock_item_id FROM sellable_components WHERE sellable_id = ? AND is_primary = 1
                    )`,
              params: [costPrice, sellableId, now, sellableId],
            });
          }

          statements.push(createChangeLogStatement('sellables', sellableId, 'update', now));

          successCount++;
        }
      } else if (result.importType === 'stock') {
        const sellableId = String(row.payload.sellableId);
        const qty = Number(row.payload.quantity);
        const cost = row.payload.costPriceBdt as number | undefined;

        statements.push({
          sql: `UPDATE stock_items
                SET current_quantity = ?,
                    cost_price_bdt = CASE
                      WHEN ? IS NOT NULL THEN COALESCE(
                        (SELECT ? / NULLIF(sc.quantity, 0)
                         FROM sellable_components sc
                         WHERE sc.sellable_id = ? AND sc.stock_item_id = stock_items.id AND sc.is_primary = 1
                         LIMIT 1),
                        cost_price_bdt
                      )
                      ELSE cost_price_bdt
                    END,
                    updated_at = ?
                WHERE id IN (
                  SELECT stock_item_id FROM sellable_components WHERE sellable_id = ? AND is_primary = 1
                )`,
          params: [qty, cost ?? null, cost ?? null, sellableId, now, sellableId],
        });

        statements.push(createChangeLogStatement('sellables', sellableId, 'update', now));

        successCount++;
      }
    }

    // Insert Import Log
    const logId = uuidv7();
    const errorDetails = result.rows
      .filter((r) => r.status === 'error')
      .map((r) => ({ row: r.rowNumber, sku: r.sku, errors: r.errors }));

    statements.push({
      sql: `INSERT INTO import_logs (
              id, file_name, file_hash, import_type, total_rows,
              success_rows, error_rows, error_details, created_at,
              device_id, user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        logId,
        result.fileName,
        result.fileHash,
        result.importType,
        result.summary.totalRows,
        successCount,
        result.summary.errorRows,
        errorDetails.length > 0 ? JSON.stringify(errorDetails) : null,
        now,
        deviceId,
        userId,
      ],
    });

    await dbBatchTx(statements);

    return {
      successCount,
      errorCount: result.summary.errorRows,
    };
  },
};
