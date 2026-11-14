import { dbBatchTx, dbQuery, type BatchStatement, type SqlParam } from '@/data/db';
import { nowUtcIso } from '@/lib/dates';
import { uuidv7 } from '@/lib/ids';
import type {
  Brand,
  Category,
  CreateAttarIntakeInput,
  CreateProductInput,
  CreateStockItemInput,
  BulkPriceUpdateItem,
  PriceHistoryEntry,
  Sellable,
  SellableComponent,
  StockItem,
  Unit,
} from '@/domain/catalog/types';

export const catalogRepo = {
  // --- Units, Categories, Brands ---
  async getUnits(): Promise<Unit[]> {
    const rows = await dbQuery<Record<string, unknown>>(
      `SELECT id, code, name, unit_type, base_unit_code, conversion_factor, is_system
       FROM units ORDER BY unit_type, conversion_factor`
    );
    return rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      unitType: r.unit_type as Unit['unitType'],
      baseUnitCode: String(r.base_unit_code),
      conversionFactor: Number(r.conversion_factor),
      isSystem: Boolean(r.is_system),
    }));
  },

  async getCategories(): Promise<Category[]> {
    const rows = await dbQuery<Record<string, unknown>>(
      `SELECT id, name, slug, parent_id, sort_order, is_active, created_at, updated_at
       FROM categories WHERE is_active = 1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, name ASC`
    );
    return rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name),
      slug: String(r.slug),
      parentId: r.parent_id ? String(r.parent_id) : null,
      sortOrder: Number(r.sort_order),
      isActive: Boolean(r.is_active),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));
  },

  async getBrands(): Promise<Brand[]> {
    const rows = await dbQuery<Record<string, unknown>>(
      `SELECT id, name, description, country_of_origin, is_active, created_at, updated_at
       FROM brands WHERE is_active = 1 AND deleted_at IS NULL
       ORDER BY name ASC`
    );
    return rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name),
      description: r.description ? String(r.description) : null,
      countryOfOrigin: r.country_of_origin ? String(r.country_of_origin) : null,
      isActive: Boolean(r.is_active),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));
  },

  // --- Stock Items (Raw Materials & Bulk Inventory) ---
  async getStockItems(
    options?: {
      brandId?: string;
      categoryId?: string;
      itemType?: string;
      search?: string;
    },
    canViewCost = false
  ): Promise<StockItem[]> {
    let sql = `
      SELECT s.id, s.sku, s.name, s.brand_id, b.name as brand_name,
             s.category_id, c.name as category_name, s.item_type,
             s.unit_id, u.code as unit_code, u.name as unit_name,
             s.density_g_per_ml, s.current_quantity, s.min_alert_quantity,
             s.cost_price_bdt, s.reorder_quantity, s.notes, s.is_active,
             s.created_at, s.updated_at
      FROM stock_items s
      LEFT JOIN brands b ON s.brand_id = b.id
      LEFT JOIN categories c ON s.category_id = c.id
      LEFT JOIN units u ON s.unit_id = u.id
      WHERE s.deleted_at IS NULL
    `;
    const params: SqlParam[] = [];

    if (options?.brandId) {
      sql += ' AND s.brand_id = ?';
      params.push(options.brandId);
    }
    if (options?.categoryId) {
      sql += ' AND s.category_id = ?';
      params.push(options.categoryId);
    }
    if (options?.itemType) {
      sql += ' AND s.item_type = ?';
      params.push(options.itemType);
    }
    if (options?.search?.trim()) {
      sql += ' AND (s.name LIKE ? OR s.sku LIKE ?)';
      const term = `%${options.search.trim()}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY s.name ASC';

    const rows = await dbQuery<Record<string, unknown>>(sql, params);
    return rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      sku: String(r.sku),
      name: String(r.name),
      brandId: r.brand_id ? String(r.brand_id) : null,
      brandName: r.brand_name ? String(r.brand_name) : null,
      categoryId: r.category_id ? String(r.category_id) : null,
      categoryName: r.category_name ? String(r.category_name) : null,
      itemType: r.item_type as StockItem['itemType'],
      unitId: String(r.unit_id),
      unitCode: r.unit_code ? String(r.unit_code) : undefined,
      unitName: r.unit_name ? String(r.unit_name) : undefined,
      densityGPerMl: r.density_g_per_ml != null ? Number(r.density_g_per_ml) : null,
      currentQuantity: Number(r.current_quantity),
      minAlertQuantity: Number(r.min_alert_quantity),
      costPriceBdt: canViewCost ? Number(r.cost_price_bdt) : 0,
      reorderQuantity: r.reorder_quantity != null ? Number(r.reorder_quantity) : null,
      notes: r.notes ? String(r.notes) : null,
      isActive: Boolean(r.is_active),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));
  },

  async createStockItem(
    input: CreateStockItemInput,
    userId: string,
    deviceId: string
  ): Promise<StockItem> {
    const id = uuidv7();
    const sku = input.sku?.trim() || `STK-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = nowUtcIso();

    const statements: BatchStatement[] = [
      {
        sql: `INSERT INTO stock_items (
                id, sku, name, brand_id, category_id, item_type, unit_id,
                density_g_per_ml, current_quantity, min_alert_quantity,
                cost_price_bdt, notes, is_active, created_at, updated_at, device_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        params: [
          id,
          sku,
          input.name.trim(),
          input.brandId || null,
          input.categoryId || null,
          input.itemType,
          input.unitId,
          input.densityGPerMl ?? null,
          input.currentQuantity || 0,
          input.minAlertQuantity || 0,
          input.costPriceBdt || 0,
          input.notes?.trim() || null,
          now,
          now,
          deviceId,
        ],
      },
      {
        sql: `INSERT INTO audit_log (id, user_id, action, details, created_at, device_id)
              VALUES (?, ?, 'catalog.create_stock_item', ?, ?, ?)`,
        params: [
          uuidv7(),
          userId,
          JSON.stringify({ id, sku, name: input.name }),
          now,
          deviceId,
        ],
      },
      {
        sql: `INSERT INTO change_log (id, table_name, row_id, operation, changed_at, synced)
              VALUES (?, 'stock_items', ?, 'insert', ?, 0)`,
        params: [uuidv7(), id, now],
      },
    ];

    await dbBatchTx(statements);

    const rows = await dbQuery<Record<string, unknown>>(
      `SELECT s.*, b.name as brand_name, c.name as category_name, u.code as unit_code, u.name as unit_name
       FROM stock_items s
       LEFT JOIN brands b ON s.brand_id = b.id
       LEFT JOIN categories c ON s.category_id = c.id
       LEFT JOIN units u ON s.unit_id = u.id
       WHERE s.id = ?`,
      [id]
    );
    const item = rows[0];

    return {
      id,
      sku,
      name: input.name.trim(),
      brandId: input.brandId || null,
      brandName: item?.brand_name ? String(item.brand_name) : null,
      categoryId: input.categoryId || null,
      categoryName: item?.category_name ? String(item.category_name) : null,
      itemType: input.itemType,
      unitId: input.unitId,
      unitCode: item?.unit_code ? String(item.unit_code) : undefined,
      unitName: item?.unit_name ? String(item.unit_name) : undefined,
      densityGPerMl: input.densityGPerMl ?? null,
      currentQuantity: input.currentQuantity || 0,
      minAlertQuantity: input.minAlertQuantity || 0,
      costPriceBdt: input.costPriceBdt || 0,
      reorderQuantity: null,
      notes: input.notes?.trim() || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  },

  // --- Sellables (Retail & Wholesale Products) ---
  async getSellables(
    options?: {
      brandId?: string;
      categoryId?: string;
      sellableType?: string;
      search?: string;
    },
    canViewCost = false
  ): Promise<Sellable[]> {
    let sql = `
      SELECT s.id, s.sku, s.barcode, s.name, s.brand_id, b.name as brand_name,
             s.category_id, c.name as category_name, s.sellable_type,
             s.retail_price_bdt, s.wholesale_price_bdt, s.min_price_bdt,
             s.is_taxable, s.tax_rate_percent, s.track_inventory,
             s.is_active, s.created_at, s.updated_at
      FROM sellables s
      LEFT JOIN brands b ON s.brand_id = b.id
      LEFT JOIN categories c ON s.category_id = c.id
      WHERE s.deleted_at IS NULL
    `;
    const params: SqlParam[] = [];

    if (options?.brandId) {
      sql += ' AND s.brand_id = ?';
      params.push(options.brandId);
    }
    if (options?.categoryId) {
      sql += ' AND s.category_id = ?';
      params.push(options.categoryId);
    }
    if (options?.sellableType) {
      sql += ' AND s.sellable_type = ?';
      params.push(options.sellableType);
    }
    if (options?.search?.trim()) {
      sql += ' AND (s.name LIKE ? OR s.sku LIKE ? OR s.barcode LIKE ?)';
      const term = `%${options.search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY s.name ASC';

    const rows = await dbQuery<Record<string, unknown>>(sql, params);

    // Fetch components for all sellables
    const components = await dbQuery<Record<string, unknown>>(`
      SELECT sc.id, sc.sellable_id, sc.stock_item_id, sc.quantity, sc.unit_id, sc.is_primary,
             si.name as stock_item_name, si.sku as stock_item_sku, si.cost_price_bdt as stock_item_cost,
             u.code as unit_code
      FROM sellable_components sc
      JOIN stock_items si ON sc.stock_item_id = si.id
      JOIN units u ON sc.unit_id = u.id
    `);

    const compMap = new Map<string, SellableComponent[]>();
    for (const c of components) {
      const sId = String(c.sellable_id);
      const list = compMap.get(sId) || [];
      list.push({
        id: String(c.id),
        sellableId: sId,
        stockItemId: String(c.stock_item_id),
        stockItemName: String(c.stock_item_name),
        stockItemSku: String(c.stock_item_sku),
        stockItemCostBdt: canViewCost ? Number(c.stock_item_cost) : undefined,
        quantity: Number(c.quantity),
        unitId: String(c.unit_id),
        unitCode: String(c.unit_code),
        isPrimary: Boolean(c.is_primary),
      });
      compMap.set(sId, list);
    }

    return rows.map((r: Record<string, unknown>) => {
      const sId = String(r.id);
      const comps = compMap.get(sId) || [];

      let calculatedCostBdt: number | undefined;
      if (canViewCost && comps.length > 0) {
        calculatedCostBdt = comps.reduce((acc, c) => {
          return acc + (c.stockItemCostBdt || 0) * c.quantity;
        }, 0);
      }

      return {
        id: sId,
        sku: String(r.sku),
        barcode: r.barcode ? String(r.barcode) : null,
        name: String(r.name),
        brandId: r.brand_id ? String(r.brand_id) : null,
        brandName: r.brand_name ? String(r.brand_name) : null,
        categoryId: r.category_id ? String(r.category_id) : null,
        categoryName: r.category_name ? String(r.category_name) : null,
        sellableType: r.sellable_type as Sellable['sellableType'],
        retailPriceBdt: Number(r.retail_price_bdt),
        wholesalePriceBdt: Number(r.wholesale_price_bdt),
        minPriceBdt: Number(r.min_price_bdt),
        isTaxable: Boolean(r.is_taxable),
        taxRatePercent: Number(r.tax_rate_percent || 0),
        trackInventory: Boolean(r.track_inventory),
        isActive: Boolean(r.is_active),
        components: comps,
        calculatedCostBdt,
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      };
    });
  },

  async createProduct(
    input: CreateProductInput,
    userId: string,
    deviceId: string
  ): Promise<Sellable> {
    const sellableId = uuidv7();
    const now = nowUtcIso();
    const sku = input.sku?.trim() || `PRD-${Math.floor(100000 + Math.random() * 900000)}`;

    const txStatements: BatchStatement[] = [];

    // 1. Insert Sellable
    txStatements.push({
      sql: `INSERT INTO sellables (
              id, sku, barcode, name, brand_id, category_id, sellable_type,
              retail_price_bdt, wholesale_price_bdt, min_price_bdt,
              is_taxable, tax_rate_percent, track_inventory, is_active,
              created_at, updated_at, device_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, 1, ?, ?, ?)`,
      params: [
        sellableId,
        sku,
        input.barcode?.trim() || null,
        input.name.trim(),
        input.brandId || null,
        input.categoryId || null,
        input.sellableType,
        input.retailPriceBdt,
        input.wholesalePriceBdt,
        input.minPriceBdt || input.wholesalePriceBdt,
        now,
        now,
        deviceId,
      ],
    });

    // 2. Components handling
    if (
      (input.sellableType === 'sealed_product' || input.sellableType === 'accessory') &&
      !input.components?.length
    ) {
      // Auto-create matching stock item
      const stockItemId = uuidv7();
      const stockSku = `STK-${sku}`;
      const defaultUnitId = input.unitId || 'unit-cnt-pcs';

      txStatements.push({
        sql: `INSERT INTO stock_items (
                id, sku, name, brand_id, category_id, item_type, unit_id,
                current_quantity, min_alert_quantity, cost_price_bdt,
                is_active, created_at, updated_at, device_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        params: [
          stockItemId,
          stockSku,
          input.name.trim(),
          input.brandId || null,
          input.categoryId || null,
          input.sellableType,
          defaultUnitId,
          input.initialQuantity || 0,
          input.minAlertQuantity || 5,
          input.costPriceBdt || 0,
          now,
          now,
          deviceId,
        ],
      });

      // Link component 1:1
      txStatements.push({
        sql: `INSERT INTO sellable_components (id, sellable_id, stock_item_id, quantity, unit_id, is_primary, created_at, device_id)
              VALUES (?, ?, ?, 1.0, ?, 1, ?, ?)`,
        params: [uuidv7(), sellableId, stockItemId, defaultUnitId, now, deviceId],
      });
    } else if (input.components && input.components.length > 0) {
      for (const comp of input.components) {
        txStatements.push({
          sql: `INSERT INTO sellable_components (id, sellable_id, stock_item_id, quantity, unit_id, is_primary, created_at, device_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            uuidv7(),
            sellableId,
            comp.stockItemId,
            comp.quantity,
            comp.unitId,
            comp.isPrimary ? 1 : 0,
            now,
            deviceId,
          ],
        });
      }
    }

    // 3. Initial price history record
    txStatements.push({
      sql: `INSERT INTO price_history (id, sellable_id, price_type, old_price, new_price, change_reason, changed_by_user_id, created_at, device_id)
            VALUES (?, ?, 'retail', 0, ?, 'Initial product setup', ?, ?, ?)`,
      params: [uuidv7(), sellableId, input.retailPriceBdt, userId, now, deviceId],
    });
    txStatements.push({
      sql: `INSERT INTO price_history (id, sellable_id, price_type, old_price, new_price, change_reason, changed_by_user_id, created_at, device_id)
            VALUES (?, ?, 'wholesale', 0, ?, 'Initial product setup', ?, ?, ?)`,
      params: [uuidv7(), sellableId, input.wholesalePriceBdt, userId, now, deviceId],
    });

    // 4. Audit & Change Log
    txStatements.push({
      sql: `INSERT INTO audit_log (id, user_id, action, details, created_at, device_id)
            VALUES (?, ?, 'catalog.create_product', ?, ?, ?)`,
      params: [
        uuidv7(),
        userId,
        JSON.stringify({ id: sellableId, sku, name: input.name, type: input.sellableType }),
        now,
        deviceId,
      ],
    });
    txStatements.push({
      sql: `INSERT INTO change_log (id, table_name, row_id, operation, changed_at, synced)
            VALUES (?, 'sellables', ?, 'insert', ?, 0)`,
      params: [uuidv7(), sellableId, now],
    });

    await dbBatchTx(txStatements);

    return {
      id: sellableId,
      sku,
      barcode: input.barcode?.trim() || null,
      name: input.name.trim(),
      brandId: input.brandId || null,
      categoryId: input.categoryId || null,
      sellableType: input.sellableType,
      retailPriceBdt: input.retailPriceBdt,
      wholesalePriceBdt: input.wholesalePriceBdt,
      minPriceBdt: input.minPriceBdt || input.wholesalePriceBdt,
      isTaxable: false,
      taxRatePercent: 0,
      trackInventory: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  },

  async createAttarIntake(
    input: CreateAttarIntakeInput,
    userId: string,
    deviceId: string
  ): Promise<void> {
    const now = nowUtcIso();
    const stockItemId = uuidv7();
    const baseSku = input.sku?.trim() || `ATT-${Math.floor(100000 + Math.random() * 900000)}`;
    const overheadPct = input.overheadPercent ?? 15;

    const baseCostPerMl =
      input.boughtVolumeMl > 0 ? input.totalPurchaseCostBdt / input.boughtVolumeMl : 0;
    const effectiveCostPerMl = baseCostPerMl * (1 + overheadPct / 100);

    const txStatements: BatchStatement[] = [];

    // 1. Master Bulk Oil Stock Item
    txStatements.push({
      sql: `INSERT INTO stock_items (
              id, sku, name, brand_id, category_id, item_type, unit_id,
              density_g_per_ml, current_quantity, min_alert_quantity,
              cost_price_bdt, notes, is_active, created_at, updated_at, device_id
            ) VALUES (?, ?, ?, ?, ?, 'raw_oil', 'unit-vol-ml', 0.98, ?, 20, ?, ?, 1, ?, ?, ?)`,
      params: [
        stockItemId,
        `STK-${baseSku}`,
        `${input.name.trim()} (Master Oil)`,
        input.brandId || null,
        input.categoryId || 'cat-attar',
        input.boughtVolumeMl,
        effectiveCostPerMl,
        `Bought ${input.boughtVolumeMl}ml for ৳${input.totalPurchaseCostBdt}. True cost +${overheadPct}% = ৳${effectiveCostPerMl.toFixed(2)}/ml`,
        now,
        now,
        deviceId,
      ],
    });

    // 2. Enabled decant sizes
    for (const size of input.sizes) {
      if (!size.enabled) continue;

      const sellableId = uuidv7();
      const sellableSku = `${baseSku}-${size.sizeMl}ML`;
      const sellableName = `${input.name.trim()} ${size.label}`;

      txStatements.push({
        sql: `INSERT INTO sellables (
                id, sku, barcode, name, brand_id, category_id, sellable_type,
                retail_price_bdt, wholesale_price_bdt, min_price_bdt,
                is_taxable, tax_rate_percent, track_inventory, is_active,
                created_at, updated_at, device_id
              ) VALUES (?, ?, ?, ?, ?, ?, 'loose_decant', ?, ?, ?, 0, 0, 1, 1, ?, ?, ?)`,
        params: [
          sellableId,
          sellableSku,
          null,
          sellableName,
          input.brandId || null,
          input.categoryId || 'cat-attar',
          size.idealSellPriceBdt,
          size.wholesalePriceBdt,
          size.costPriceBdt,
          now,
          now,
          deviceId,
        ],
      });

      // Link component to master stock oil
      txStatements.push({
        sql: `INSERT INTO sellable_components (
                id, sellable_id, stock_item_id, quantity, unit_id, is_primary, created_at, device_id
              ) VALUES (?, ?, ?, ?, 'unit-vol-ml', 1, ?, ?)`,
        params: [uuidv7(), sellableId, stockItemId, size.sizeMl, now, deviceId],
      });

      // Price history
      txStatements.push({
        sql: `INSERT INTO price_history (
                id, sellable_id, price_type, old_price, new_price, change_reason, changed_by_user_id, created_at, device_id
              ) VALUES (?, ?, 'retail', 0, ?, 'Attar intake ideal benchmark price (+25%)', ?, ?, ?)`,
        params: [uuidv7(), sellableId, size.idealSellPriceBdt, userId, now, deviceId],
      });
      txStatements.push({
        sql: `INSERT INTO price_history (
                id, sellable_id, price_type, old_price, new_price, change_reason, changed_by_user_id, created_at, device_id
              ) VALUES (?, ?, 'wholesale', 0, ?, 'Attar intake wholesale benchmark price', ?, ?, ?)`,
        params: [uuidv7(), sellableId, size.wholesalePriceBdt, userId, now, deviceId],
      });

      txStatements.push({
        sql: `INSERT INTO change_log (id, table_name, row_id, operation, changed_at, synced)
              VALUES (?, 'sellables', ?, 'insert', ?, 0)`,
        params: [uuidv7(), sellableId, now],
      });
    }

    // Audit log
    txStatements.push({
      sql: `INSERT INTO audit_log (id, user_id, action, details, created_at, device_id)
            VALUES (?, ?, 'catalog.create_attar_intake', ?, ?, ?)`,
      params: [
        uuidv7(),
        userId,
        JSON.stringify({
          name: input.name,
          volume: input.boughtVolumeMl,
          cost: input.totalPurchaseCostBdt,
        }),
        now,
        deviceId,
      ],
    });

    await dbBatchTx(txStatements);
  },

  // --- Bulk Price Editing & Price History ---
  async bulkUpdatePrices(
    items: BulkPriceUpdateItem[],
    userId: string,
    deviceId: string
  ): Promise<void> {
    if (!items.length) return;

    const now = nowUtcIso();
    const txStatements: BatchStatement[] = [];

    for (const item of items) {
      const rows = await dbQuery<{ retail_price_bdt: number; wholesale_price_bdt: number }>(
        `SELECT retail_price_bdt, wholesale_price_bdt FROM sellables WHERE id = ?`,
        [item.sellableId]
      );
      const current = rows[0];
      if (!current) continue;

      const updates: string[] = ['updated_at = ?'];
      const params: SqlParam[] = [now];

      if (item.retailPriceBdt != null && item.retailPriceBdt !== current.retail_price_bdt) {
        updates.push('retail_price_bdt = ?');
        params.push(item.retailPriceBdt);

        txStatements.push({
          sql: `INSERT INTO price_history (id, sellable_id, price_type, old_price, new_price, change_reason, changed_by_user_id, created_at, device_id)
                VALUES (?, ?, 'retail', ?, ?, ?, ?, ?, ?)`,
          params: [
            uuidv7(),
            item.sellableId,
            current.retail_price_bdt,
            item.retailPriceBdt,
            item.changeReason || 'Bulk price revision',
            userId,
            now,
            deviceId,
          ],
        });
      }

      if (item.wholesalePriceBdt != null && item.wholesalePriceBdt !== current.wholesale_price_bdt) {
        updates.push('wholesale_price_bdt = ?');
        params.push(item.wholesalePriceBdt);

        txStatements.push({
          sql: `INSERT INTO price_history (id, sellable_id, price_type, old_price, new_price, change_reason, changed_by_user_id, created_at, device_id)
                VALUES (?, ?, 'wholesale', ?, ?, ?, ?, ?, ?)`,
          params: [
            uuidv7(),
            item.sellableId,
            current.wholesale_price_bdt,
            item.wholesalePriceBdt,
            item.changeReason || 'Bulk price revision',
            userId,
            now,
            deviceId,
          ],
        });
      }

      if (item.minPriceBdt != null) {
        updates.push('min_price_bdt = ?');
        params.push(item.minPriceBdt);
      }

      params.push(item.sellableId);

      txStatements.push({
        sql: `UPDATE sellables SET ${updates.join(', ')} WHERE id = ?`,
        params,
      });

      txStatements.push({
        sql: `INSERT INTO change_log (id, table_name, row_id, operation, changed_at, synced)
              VALUES (?, 'sellables', ?, 'update', ?, 0)`,
        params: [uuidv7(), item.sellableId, now],
      });
    }

    if (txStatements.length > 0) {
      await dbBatchTx(txStatements);
    }
  },

  async getPriceHistory(sellableId?: string): Promise<PriceHistoryEntry[]> {
    let sql = `
      SELECT ph.id, ph.sellable_id, s.name as sellable_name, ph.price_type,
             ph.old_price, ph.new_price, ph.change_reason,
             ph.changed_by_user_id, u.username as changed_by_username,
             ph.created_at
      FROM price_history ph
      JOIN sellables s ON ph.sellable_id = s.id
      LEFT JOIN users u ON ph.changed_by_user_id = u.id
    `;
    const params: SqlParam[] = [];

    if (sellableId) {
      sql += ' WHERE ph.sellable_id = ?';
      params.push(sellableId);
    }

    sql += ' ORDER BY ph.created_at DESC LIMIT 200';

    const rows = await dbQuery<Record<string, unknown>>(sql, params);
    return rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      sellableId: String(r.sellable_id),
      sellableName: String(r.sellable_name),
      priceType: r.price_type as PriceHistoryEntry['priceType'],
      oldPrice: Number(r.old_price),
      newPrice: Number(r.new_price),
      changeReason: r.change_reason ? String(r.change_reason) : null,
      changedByUserId: r.changed_by_user_id ? String(r.changed_by_user_id) : null,
      changedByUsername: r.changed_by_username ? String(r.changed_by_username) : null,
      createdAt: String(r.created_at),
    }));
  },
};
