import { createChangeLogStatement, dbQuery, dbBatchTx, type BatchStatement } from '../db';
import { dhakaDateBoundsToUtcIso, nowUtcIso } from '@/lib/dates';
import { uuidv7 } from '@/lib/ids';
import type {
  Supplier,
  Purchase,
  StockItemLookup,
} from '../../domain/purchases/types';

export const purchasesRepo = {
  // ==========================================
  // Suppliers Management
  // ==========================================
  async getSuppliers(): Promise<Supplier[]> {
    const rows = await dbQuery<{
      id: string;
      name: string;
      contact_person: string | null;
      phone: string | null;
      email: string | null;
      address: string | null;
      notes: string | null;
      is_active: number;
      created_at: string;
      updated_at: string;
      total_orders: number;
      total_purchased_bdt: number;
      total_paid_bdt: number;
      total_due_bdt: number;
    }>(
      `SELECT s.id, s.name, s.contact_person, s.phone, s.email, s.address, s.notes, s.is_active, s.created_at, s.updated_at,
              COUNT(p.id) AS total_orders,
              COALESCE(SUM(p.total_amount_bdt), 0.0) AS total_purchased_bdt,
              COALESCE(SUM(p.paid_amount_bdt), 0.0) AS total_paid_bdt,
              COALESCE(SUM(p.total_amount_bdt - p.paid_amount_bdt), 0.0) AS total_due_bdt
       FROM suppliers s
       LEFT JOIN purchases p ON s.id = p.supplier_id AND p.deleted_at IS NULL AND p.status != 'cancelled'
       WHERE s.deleted_at IS NULL
       GROUP BY s.id
       ORDER BY s.name ASC`
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      contactPerson: r.contact_person,
      phone: r.phone,
      email: r.email,
      address: r.address,
      notes: r.notes,
      isActive: r.is_active === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      totalOrders: Number(r.total_orders || 0),
      totalPurchasedBdt: Number(r.total_purchased_bdt || 0),
      totalPaidBdt: Number(r.total_paid_bdt || 0),
      totalDueBdt: Math.max(0, Number(r.total_due_bdt || 0)),
    }));
  },

  async createSupplier(
    supplier: {
      name: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
      address?: string;
      notes?: string;
    },
    deviceId: string
  ): Promise<Supplier> {
    const id = uuidv7();
    const now = nowUtcIso();

    await dbBatchTx([
      {
        sql: `INSERT INTO suppliers (
          id, name, contact_person, phone, email, address, notes, is_active, created_at, updated_at, device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        params: [
          id,
          supplier.name.trim(),
          supplier.contactPerson?.trim() || null,
          supplier.phone?.trim() || null,
          supplier.email?.trim() || null,
          supplier.address?.trim() || null,
          supplier.notes?.trim() || null,
          now,
          now,
          deviceId,
        ],
      },
      createChangeLogStatement('suppliers', id, 'insert', now),
    ]);

    return {
      id,
      name: supplier.name.trim(),
      contactPerson: supplier.contactPerson?.trim() || null,
      phone: supplier.phone?.trim() || null,
      email: supplier.email?.trim() || null,
      address: supplier.address?.trim() || null,
      notes: supplier.notes?.trim() || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      totalOrders: 0,
      totalPurchasedBdt: 0,
      totalPaidBdt: 0,
      totalDueBdt: 0,
    };
  },

  async updateSupplier(
    supplier: {
      id: string;
      name: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
      address?: string;
      notes?: string;
      isActive: boolean;
    },
    deviceId: string
  ): Promise<void> {
    const now = nowUtcIso();
    await dbBatchTx([
      {
        sql: `UPDATE suppliers
              SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, notes = ?, is_active = ?, updated_at = ?, device_id = ?
              WHERE id = ?`,
        params: [
          supplier.name.trim(),
          supplier.contactPerson?.trim() || null,
          supplier.phone?.trim() || null,
          supplier.email?.trim() || null,
          supplier.address?.trim() || null,
          supplier.notes?.trim() || null,
          supplier.isActive ? 1 : 0,
          now,
          deviceId,
          supplier.id,
        ],
      },
      createChangeLogStatement('suppliers', supplier.id, 'update', now),
    ]);
  },

  async deleteSupplier(id: string, deviceId: string): Promise<void> {
    const now = nowUtcIso();
    await dbBatchTx([
      {
        sql: `UPDATE suppliers SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?`,
        params: [now, now, deviceId, id],
      },
      createChangeLogStatement('suppliers', id, 'delete', now),
    ]);
  },

  // ==========================================
  // Stock Items Lookup for Receiving
  // ==========================================
  async getStockItems(): Promise<StockItemLookup[]> {
    const rows = await dbQuery<{
      id: string;
      sku: string;
      name: string;
      item_type: string;
      unit_code: string;
      current_quantity: number;
      cost_price_bdt: number;
      density_g_per_ml: number | null;
      reorder_quantity: number | null;
    }>(
      `SELECT s.id, s.sku, s.name, s.item_type, u.code AS unit_code,
              s.current_quantity, s.cost_price_bdt, s.density_g_per_ml, s.reorder_quantity
       FROM stock_items s
       JOIN units u ON s.unit_id = u.id
       WHERE s.deleted_at IS NULL AND s.is_active = 1
       ORDER BY s.name ASC`
    );

    return rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      itemType: r.item_type,
      unitCode: r.unit_code,
      currentQuantity: r.current_quantity,
      costPriceBdt: r.cost_price_bdt,
      densityGPerMl: r.density_g_per_ml,
      reorderQuantity: r.reorder_quantity,
    }));
  },

  // ==========================================
  // Purchase PO Number Generator
  // ==========================================
  async getNextPurchaseNumber(prefix = 'PO'): Promise<string> {
    const cleanPrefix = (prefix || 'PO').trim().replace(/-+$/, '') || 'PO';
    const today = new Date();
    const ym = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const base = `${cleanPrefix}-${ym}-`;

    const row = await dbQuery<{ max_seq: number }>(
      `SELECT COALESCE(MAX(CAST(SUBSTR(purchase_number, ?) AS INTEGER)), 0) as max_seq
       FROM purchases
       WHERE purchase_number LIKE ?`,
      [base.length + 1, `${base}%`]
    );
    const nextSeq = Number(row[0]?.max_seq || 0) + 1;
    return `${base}${String(nextSeq).padStart(4, '0')}`;
  },

  // ==========================================
  // Purchases List & Queries
  // ==========================================
  async getPurchases(params?: {
    startDate?: string;
    endDate?: string;
    supplierId?: string;
    searchQuery?: string;
  }): Promise<Purchase[]> {
    let sql = `
      SELECT p.id, p.purchase_number, p.supplier_id, p.supplier_name, p.branch_id,
             p.status, p.total_amount_bdt, p.paid_amount_bdt, p.payment_method,
             p.reference_number, p.notes, p.received_by_user_id, p.received_by_username,
             p.received_at, p.created_at, p.updated_at
      FROM purchases p
      WHERE p.deleted_at IS NULL
    `;
    const sqlParams: (string | number)[] = [];

    if (params?.startDate) {
      sql += ` AND p.received_at >= ?`;
      sqlParams.push(dhakaDateBoundsToUtcIso(params.startDate, params.startDate).startDateIso);
    }
    if (params?.endDate) {
      sql += ` AND p.received_at <= ?`;
      sqlParams.push(dhakaDateBoundsToUtcIso(params.endDate, params.endDate).endDateIso);
    }
    if (params?.supplierId && params.supplierId !== 'all') {
      sql += ` AND p.supplier_id = ?`;
      sqlParams.push(params.supplierId);
    }
    if (params?.searchQuery) {
      sql += ` AND (p.purchase_number LIKE ? OR p.supplier_name LIKE ? OR p.reference_number LIKE ?)`;
      const q = `%${params.searchQuery.trim()}%`;
      sqlParams.push(q, q, q);
    }

    sql += ` ORDER BY p.received_at DESC, p.created_at DESC`;

    const rows = await dbQuery<{
      id: string;
      purchase_number: string;
      supplier_id: string | null;
      supplier_name: string;
      branch_id: string;
      status: string;
      total_amount_bdt: number;
      paid_amount_bdt: number;
      payment_method: string;
      reference_number: string | null;
      notes: string | null;
      received_by_user_id: string | null;
      received_by_username: string | null;
      received_at: string;
      created_at: string;
      updated_at: string;
    }>(sql, sqlParams);

    return rows.map((r) => ({
      id: r.id,
      purchaseNumber: r.purchase_number,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      branchId: r.branch_id,
      status: r.status as Purchase['status'],
      totalAmountBdt: r.total_amount_bdt,
      paidAmountBdt: r.paid_amount_bdt,
      paymentMethod: r.payment_method,
      referenceNumber: r.reference_number,
      notes: r.notes,
      receivedByUserId: r.received_by_user_id,
      receivedByUsername: r.received_by_username,
      receivedAt: r.received_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  async getPurchaseDetails(purchaseId: string): Promise<Purchase | null> {
    const purchaseRows = await dbQuery<{
      id: string;
      purchase_number: string;
      supplier_id: string | null;
      supplier_name: string;
      branch_id: string;
      status: string;
      total_amount_bdt: number;
      paid_amount_bdt: number;
      payment_method: string;
      reference_number: string | null;
      notes: string | null;
      received_by_user_id: string | null;
      received_by_username: string | null;
      received_at: string;
      created_at: string;
      updated_at: string;
    }>(`SELECT * FROM purchases WHERE id = ? AND deleted_at IS NULL`, [purchaseId]);

    if (purchaseRows.length === 0) return null;
    const p = purchaseRows[0];

    const itemRows = await dbQuery<{
      id: string;
      purchase_id: string;
      stock_item_id: string;
      product_name: string;
      purchased_unit: string;
      purchased_quantity: number;
      unit_rate_bdt: number;
      total_cost_bdt: number;
      converted_quantity_base: number;
      base_unit_code: string;
      base_cost_per_unit_bdt: number;
      notes: string | null;
      created_at: string;
    }>(`SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY rowid ASC`, [purchaseId]);

    return {
      id: p.id,
      purchaseNumber: p.purchase_number,
      supplierId: p.supplier_id,
      supplierName: p.supplier_name,
      branchId: p.branch_id,
      status: p.status as Purchase['status'],
      totalAmountBdt: p.total_amount_bdt,
      paidAmountBdt: p.paid_amount_bdt,
      paymentMethod: p.payment_method,
      referenceNumber: p.reference_number,
      notes: p.notes,
      receivedByUserId: p.received_by_user_id,
      receivedByUsername: p.received_by_username,
      receivedAt: p.received_at,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      items: itemRows.map((i) => ({
        id: i.id,
        purchaseId: i.purchase_id,
        stockItemId: i.stock_item_id,
        productName: i.product_name,
        purchasedUnit: i.purchased_unit,
        purchasedQuantity: i.purchased_quantity,
        unitRateBdt: i.unit_rate_bdt,
        totalCostBdt: i.total_cost_bdt,
        convertedQuantityBase: i.converted_quantity_base,
        baseUnitCode: i.base_unit_code,
        baseCostPerUnitBdt: i.base_cost_per_unit_bdt,
        notes: i.notes,
        createdAt: i.created_at,
      })),
    };
  },

  // ==========================================
  // Receive Stock & Complete Purchase (Single Atomic Batch)
  // ==========================================
  async receivePurchaseOrder(params: {
    purchaseNumber: string;
    supplierId?: string | null;
    supplierName: string;
    branchId: string;
    totalAmountBdt: number;
    paidAmountBdt: number;
    paymentMethod: string;
    referenceNumber?: string | null;
    notes?: string | null;
    receivedByUserId: string;
    receivedByUsername: string;
    receivedAt: string;
    deviceId: string;
    items: Array<{
      stockItemId: string;
      productName: string;
      purchasedUnit: string;
      purchasedQuantity: number;
      unitRateBdt: number;
      totalCostBdt: number;
      convertedQuantityBase: number;
      baseUnitCode: string;
      baseCostPerUnitBdt: number;
      notes?: string | null;
      currentStockBefore: number;
      currentCostBefore: number;
    }>;
  }): Promise<string> {
    const purchaseId = uuidv7();
    const now = nowUtcIso();

    // Dynamically resolve valid branch ID from database
    let resolvedBranchId = params.branchId;
    try {
      const branchRows = await dbQuery<{ id: string }>(
        `SELECT id FROM branches WHERE deleted_at IS NULL ORDER BY is_default DESC, created_at ASC LIMIT 1`
      );
      if (branchRows.length > 0 && branchRows[0].id) {
        resolvedBranchId = branchRows[0].id;
      }
    } catch (err) {
      console.warn('Branch lookup for purchase:', err);
    }

    // Validate supplier_id exists
    let resolvedSupplierId: string | null = null;
    if (params.supplierId) {
      try {
        const supRows = await dbQuery<{ id: string }>(
          `SELECT id FROM suppliers WHERE id = ? AND deleted_at IS NULL`,
          [params.supplierId]
        );
        if (supRows.length > 0) {
          resolvedSupplierId = supRows[0].id;
        }
      } catch (err) {
        console.warn('Supplier lookup for purchase:', err);
      }
    }

    // Validate received_by_user_id exists
    let resolvedUserId: string | null = null;
    if (params.receivedByUserId) {
      try {
        const userRows = await dbQuery<{ id: string }>(
          `SELECT id FROM users WHERE id = ? AND deleted_at IS NULL`,
          [params.receivedByUserId]
        );
        if (userRows.length > 0) {
          resolvedUserId = userRows[0].id;
        }
      } catch (err) {
        console.warn('User lookup for purchase:', err);
      }
    }

    const statements: BatchStatement[] = [];

    // 1. Insert into purchases table
    statements.push({
      sql: `INSERT INTO purchases (
        id, purchase_number, supplier_id, supplier_name, branch_id, status,
        total_amount_bdt, paid_amount_bdt, payment_method, reference_number, notes,
        received_by_user_id, received_by_username, received_at, created_at, updated_at, device_id
      ) VALUES (?, ?, ?, ?, ?, 'received', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        purchaseId,
        params.purchaseNumber,
        resolvedSupplierId,
        params.supplierName.trim(),
        resolvedBranchId,
        params.totalAmountBdt,
        params.paidAmountBdt,
        params.paymentMethod,
        params.referenceNumber?.trim() || null,
        params.notes?.trim() || null,
        resolvedUserId,
        params.receivedByUsername,
        params.receivedAt,
        now,
        now,
        params.deviceId,
      ],
    });

    // 2. Insert items, update stock & cost, and record stock movement
    for (const item of params.items) {
      const itemId = uuidv7();
      const movementId = uuidv7();

      // Purchase item record
      statements.push({
        sql: `INSERT INTO purchase_items (
          id, purchase_id, stock_item_id, product_name, purchased_unit,
          purchased_quantity, unit_rate_bdt, total_cost_bdt,
          converted_quantity_base, base_unit_code, base_cost_per_unit_bdt,
          notes, created_at, device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          itemId,
          purchaseId,
          item.stockItemId,
          item.productName,
          item.purchasedUnit,
          item.purchasedQuantity,
          item.unitRateBdt,
          item.totalCostBdt,
          item.convertedQuantityBase,
          item.baseUnitCode,
          item.baseCostPerUnitBdt,
          item.notes || null,
          now,
          params.deviceId,
        ],
      });

      // Calculate weighted average cost price
      const qtyBefore = item.currentStockBefore;
      const qtyDelta = item.convertedQuantityBase;
      const qtyAfter = qtyBefore + qtyDelta;

      let newWeightedCost = item.baseCostPerUnitBdt;
      if (qtyBefore > 0 && qtyAfter > 0) {
        newWeightedCost =
          (qtyBefore * item.currentCostBefore + qtyDelta * item.baseCostPerUnitBdt) / qtyAfter;
      }

      // Update stock_items table: increase quantity and update cost price (5 decimal places = milli-poisha precision)
      statements.push({
        sql: `UPDATE stock_items
              SET current_quantity = current_quantity + ?,
                  cost_price_bdt = ?,
                  updated_at = ?
              WHERE id = ?`,
        params: [qtyDelta, Math.round(newWeightedCost * 100000) / 100000, now, item.stockItemId],
      });

      statements.push(createChangeLogStatement('stock_items', item.stockItemId, 'update', now));

      // Insert stock movement record
      statements.push({
        sql: `INSERT INTO stock_movements (
          id, stock_item_id, movement_type, reference_id, quantity_delta,
          quantity_before, quantity_after, cost_price_bdt, reason, created_at, device_id
        ) VALUES (?, ?, 'purchase_received', ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          movementId,
          item.stockItemId,
          purchaseId,
          qtyDelta,
          qtyBefore,
          qtyAfter,
          item.baseCostPerUnitBdt,
          `Purchase PO: ${params.purchaseNumber} from ${params.supplierName}`,
          now,
          params.deviceId,
        ],
      });
    }

    // 3. Record Audit Log & Change Log
    statements.push({
      sql: `INSERT INTO audit_log (
        id, user_id, username, action, details, created_at, device_id
      ) VALUES (?, ?, ?, 'purchase.receive', ?, ?, ?)`,
      params: [
        uuidv7(),
        resolvedUserId,
        params.receivedByUsername,
        JSON.stringify({
          purchaseId,
          purchaseNumber: params.purchaseNumber,
          supplier: params.supplierName,
          itemsCount: params.items.length,
          totalAmountBdt: params.totalAmountBdt,
        }),
        now,
        params.deviceId,
      ],
    });
    statements.push(createChangeLogStatement('purchases', purchaseId, 'insert', now));

    // Execute everything atomically
    await dbBatchTx(statements);

    return purchaseId;
  },

  async getCategories(): Promise<Array<{ id: string; name: string }>> {
    try {
      const rows = await dbQuery<{ id: string; name: string }>(
        `SELECT id, name FROM categories WHERE is_active = 1 AND deleted_at IS NULL ORDER BY sort_order ASC, name ASC`
      );
      return rows;
    } catch {
      return [];
    }
  },

  async createStockItemQuick(params: {
    name: string;
    sku?: string;
    itemType: string;
    unitCode?: string;
    densityGPerMl?: number | null;
    costPriceBdt?: number;
    retailPriceBdt?: number;
    categoryId?: string | null;
    userId?: string | null;
    username?: string | null;
    deviceId: string;
  }): Promise<StockItemLookup> {
    const stockItemId = uuidv7();
    const now = nowUtcIso();
    const cleanName = params.name.trim();

    const prefix =
      params.itemType === 'raw_oil'
        ? 'OIL'
        : params.itemType === 'empty_bottle'
        ? 'BTL'
        : params.itemType === 'accessory'
        ? 'ACC'
        : 'PRD';
    const sku =
      params.sku?.trim() || `STK-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

    const unitCode = params.unitCode || (params.itemType === 'raw_oil' ? 'ml' : 'pcs');
    let unitId =
      unitCode === 'ml' ? 'unit-vol-ml' : unitCode === 'g' ? 'unit-wt-g' : 'unit-cnt-pcs';

    try {
      const uRows = await dbQuery<{ id: string }>(
        `SELECT id FROM units WHERE code = ? LIMIT 1`,
        [unitCode]
      );
      if (uRows.length > 0) {
        unitId = uRows[0].id;
      }
    } catch (e) {
      console.warn('Unit query fallback:', e);
    }

    let resolvedUserId: string | null = null;
    if (params.userId) {
      try {
        const uRows = await dbQuery<{ id: string }>(
          `SELECT id FROM users WHERE id = ? LIMIT 1`,
          [params.userId]
        );
        if (uRows.length > 0) resolvedUserId = uRows[0].id;
      } catch (e) {
        console.warn('User query fallback:', e);
      }
    }

    const statements: BatchStatement[] = [];

    // 1. Insert into stock_items
    statements.push({
      sql: `INSERT INTO stock_items (
        id, sku, name, brand_id, category_id, item_type, unit_id,
        density_g_per_ml, current_quantity, min_alert_quantity,
        cost_price_bdt, notes, is_active, created_at, updated_at, device_id
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 0.0, 5.0, ?, NULL, 1, ?, ?, ?)`,
      params: [
        stockItemId,
        sku,
        cleanName,
        params.categoryId || null,
        params.itemType,
        unitId,
        params.densityGPerMl ?? (params.itemType === 'raw_oil' ? 1.0 : null),
        params.costPriceBdt || 0,
        now,
        now,
        params.deviceId,
      ],
    });

    // 2. If retail price is provided, also create sellable product
    if (params.retailPriceBdt && params.retailPriceBdt > 0) {
      const sellableId = uuidv7();
      const sellableSku = `SELL-${sku}`;
      const sellableType =
        params.itemType === 'raw_oil'
          ? 'loose_decant'
          : params.itemType === 'accessory'
          ? 'accessory'
          : 'sealed_product';

      statements.push({
        sql: `INSERT INTO sellables (
          id, sku, barcode, name, brand_id, category_id, sellable_type,
          retail_price_bdt, wholesale_price_bdt, min_price_bdt,
          is_taxable, tax_rate_percent, track_inventory, is_active,
          created_at, updated_at, device_id
        ) VALUES (?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, 0, 0, 1, 1, ?, ?, ?)`,
        params: [
          sellableId,
          sellableSku,
          cleanName,
          params.categoryId || null,
          sellableType,
          params.retailPriceBdt,
          params.costPriceBdt || params.retailPriceBdt,
          params.costPriceBdt || params.retailPriceBdt,
          now,
          now,
          params.deviceId,
        ],
      });

      statements.push({
        sql: `INSERT INTO sellable_components (
          id, sellable_id, stock_item_id, quantity, unit_id, is_primary, created_at, device_id
        ) VALUES (?, ?, ?, 1.0, ?, 1, ?, ?)`,
        params: [uuidv7(), sellableId, stockItemId, unitId, now, params.deviceId],
      });
    }

    // 3. Audit log
    statements.push({
      sql: `INSERT INTO audit_log (
        id, user_id, username, action, details, created_at, device_id
      ) VALUES (?, ?, ?, 'catalog.create_stock_item_quick', ?, ?, ?)`,
      params: [
        uuidv7(),
        resolvedUserId,
        params.username || 'Admin',
        JSON.stringify({ id: stockItemId, sku, name: cleanName, itemType: params.itemType }),
        now,
        params.deviceId,
      ],
    });

    await dbBatchTx(statements);

    return {
      id: stockItemId,
      sku,
      name: cleanName,
      itemType: params.itemType,
      unitCode,
      densityGPerMl: params.densityGPerMl ?? (params.itemType === 'raw_oil' ? 1.0 : null),
      currentQuantity: 0,
      costPriceBdt: params.costPriceBdt || 0,
    };
  },
};
