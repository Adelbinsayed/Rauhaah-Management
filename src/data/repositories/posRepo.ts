import { createChangeLogStatement, dbBatchTx, dbQuery, type BatchStatement } from '@/data/db';
import { nowUtcIso } from '@/lib/dates';
import { uuidv7 } from '@/lib/ids';
import type { CartItem, CartTotals, Customer, Sale, SalePayment } from '@/domain/pos/types';
import { formatInvoiceNumber } from '@/domain/pos/posCalculations';

export const posRepo = {
  /**
   * Fast customer search by phone or name with live lifetime loyalty stats
   */
  async searchCustomers(query: string): Promise<Customer[]> {
    const clean = query.trim();
    if (!clean) return [];

    const sql = `
      SELECT c.id, c.phone, c.name, c.notes, c.due_balance_bdt, c.created_at,
             COUNT(s.id) as visit_count,
             COALESCE(SUM(s.total_amount_bdt), 0.0) as total_spend_bdt,
             MAX(s.created_at) as last_visit_at
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id AND s.status = 'completed'
      WHERE c.deleted_at IS NULL AND (c.phone LIKE ? OR c.name LIKE ?)
      GROUP BY c.id
      ORDER BY total_spend_bdt DESC, c.name ASC
      LIMIT 10
    `;
    const term = `%${clean}%`;
    const rows = await dbQuery<Record<string, unknown>>(sql, [term, term]);

    return rows.map((r) => ({
      id: String(r.id),
      phone: String(r.phone),
      name: String(r.name),
      notes: r.notes ? String(r.notes) : null,
      dueBalanceBdt: Number(r.due_balance_bdt || 0),
      visitCount: Number(r.visit_count || 0),
      totalSpendBdt: Number(r.total_spend_bdt || 0),
      lastVisitAt: r.last_visit_at ? String(r.last_visit_at) : null,
      createdAt: String(r.created_at),
    }));
  },

  /**
   * Retrieves single customer by exact phone number
   */
  async getCustomerByPhone(phone: string): Promise<Customer | null> {
    const clean = phone.trim().replace(/[\s-]/g, '');
    if (!clean) return null;

    const sql = `
      SELECT c.id, c.phone, c.name, c.notes, c.due_balance_bdt, c.created_at,
             COUNT(s.id) as visit_count,
             COALESCE(SUM(s.total_amount_bdt), 0.0) as total_spend_bdt,
             MAX(s.created_at) as last_visit_at
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id AND s.status = 'completed'
      WHERE c.deleted_at IS NULL AND c.phone = ?
      GROUP BY c.id
      LIMIT 1
    `;
    const rows = await dbQuery<Record<string, unknown>>(sql, [clean]);
    if (rows.length === 0) return null;
    const r = rows[0];

    return {
      id: String(r.id),
      phone: String(r.phone),
      name: String(r.name),
      notes: r.notes ? String(r.notes) : null,
      dueBalanceBdt: Number(r.due_balance_bdt || 0),
      visitCount: Number(r.visit_count || 0),
      totalSpendBdt: Number(r.total_spend_bdt || 0),
      lastVisitAt: r.last_visit_at ? String(r.last_visit_at) : null,
      createdAt: String(r.created_at),
    };
  },

  /**
   * Quick-add customer directly from the POS register
   */
  async quickCreateCustomer(
    phone: string,
    name: string,
    deviceId: string,
    notes?: string
  ): Promise<Customer> {
    const id = uuidv7();
    const now = nowUtcIso();
    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    const cleanName = name.trim();

    await dbBatchTx([
      {
        sql: `INSERT INTO customers (id, phone, name, notes, due_balance_bdt, created_at, updated_at, device_id)
              VALUES (?, ?, ?, ?, 0.0, ?, ?, ?)`,
        params: [id, cleanPhone, cleanName, notes || null, now, now, deviceId],
      },
      createChangeLogStatement('customers', id, 'insert', now),
    ]);

    return {
      id,
      phone: cleanPhone,
      name: cleanName,
      notes: notes || null,
      dueBalanceBdt: 0,
      visitCount: 0,
      totalSpendBdt: 0,
      lastVisitAt: null,
      createdAt: now,
    };
  },

  /**
   * Generates the next sequential invoice number for the branch
   */
  async getNextInvoiceNumber(prefix: string = 'INV'): Promise<string> {
    const cleanPrefix = (prefix || 'INV').trim().replace(/-+$/, '') || 'INV';
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const base = `${cleanPrefix}-${yearMonth}-`;

    const rows = await dbQuery<{ max_seq: number }>(
      `SELECT COALESCE(MAX(CAST(SUBSTR(invoice_number, ?) AS INTEGER)), 0) as max_seq
       FROM sales
       WHERE invoice_number LIKE ?`,
      [base.length + 1, `${base}%`]
    );

    const seq = Number(rows[0]?.max_seq || 0) + 1;
    return formatInvoiceNumber(cleanPrefix, now, seq);
  },

  /**
   * Executes a complete sale transaction atomically:
   * 1. Inserts into `sales`
   * 2. Inserts all `sale_items` with DB-authoritative COGS
   * 3. Inserts payment records into `sale_payments`
   * 4. Deducts stock from `stock_items` and records `stock_movements`
   * 5. Updates customer due balance (if any remaining due)
   * 6. Writes `audit_log` and `change_log`
   */
  async completeSale(params: {
    invoiceNumber: string;
    customer: Customer | null;
    cashierId: string;
    items: CartItem[];
    totals: CartTotals;
    payments: SalePayment[];
    branchId: string;
    deviceId: string;
  }): Promise<{ saleId: string; invoiceNumber: string }> {
    const { invoiceNumber, customer, cashierId, items, totals, payments, branchId, deviceId } =
      params;
    const saleId = uuidv7();
    const now = nowUtcIso();

    // Resolve active branch UUID from branches table
    let resolvedBranchId = branchId;
    try {
      const branchRows = await dbQuery<{ id: string }>(
        `SELECT id FROM branches WHERE deleted_at IS NULL ORDER BY is_default DESC, created_at ASC LIMIT 1`
      );
      if (branchRows.length > 0 && branchRows[0].id) {
        resolvedBranchId = branchRows[0].id;
      }
    } catch (err) {
      console.warn('Branch lookup for sale:', err);
    }

    // Resolve cashier username for audit_log
    let resolvedCashierName = 'Cashier';
    try {
      const userRows = await dbQuery<{ name: string | null }>(
        `SELECT COALESCE(display_name, username) as name FROM users WHERE id = ? LIMIT 1`,
        [cashierId]
      );
      if (userRows.length > 0 && userRows[0].name) {
        resolvedCashierName = userRows[0].name;
      }
    } catch {
      // keep default
    }

    const statements: BatchStatement[] = [];

    // Primary payment method label
    const primaryPaymentMethod =
      payments.length === 1 ? payments[0].method : payments.length > 1 ? 'split' : 'cash';

    // 1. Insert into sales
    statements.push({
      sql: `INSERT INTO sales (
              id, invoice_number, customer_id, customer_name, customer_phone,
              cashier_id, subtotal_bdt, discount_amount_bdt, discount_percent,
              discount_reason, discounted_by, total_amount_bdt, paid_amount_bdt,
              change_amount_bdt, due_amount_bdt, payment_method, status,
              branch_id, created_at, updated_at, device_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)`,
      params: [
        saleId,
        invoiceNumber,
        customer ? customer.id : null,
        customer ? customer.name : 'Walk-in Customer',
        customer ? customer.phone : null,
        cashierId,
        totals.subtotalBdt,
        totals.cartDiscountBdt + totals.itemDiscountBdt,
        totals.cartDiscountPercent,
        totals.cartDiscountReason || null,
        totals.cartDiscountBdt > 0 ? cashierId : null,
        totals.totalAmountBdt,
        totals.paidAmountBdt,
        totals.changeAmountBdt,
        totals.dueAmountBdt,
        primaryPaymentMethod,
        resolvedBranchId,
        now,
        now,
        deviceId,
      ],
    });

    // Track sequential stock changes within this sale if multiple lines share a stock item
    const runningStockMap = new Map<string, number>();

    // 2. Insert sale_items (with DB-authoritative COGS), deduct stock, and record stock_movements
    for (const item of items) {
      const compRows = await dbQuery<{
        stock_item_id: string;
        comp_qty: number;
        current_quantity: number;
        cost_price_bdt: number;
      }>(
        `SELECT sc.stock_item_id, sc.quantity as comp_qty, si.current_quantity, si.cost_price_bdt
         FROM sellable_components sc
         JOIN stock_items si ON sc.stock_item_id = si.id
         WHERE sc.sellable_id = ?`,
        [item.sellableId]
      );

      const dbUnitCost = compRows.reduce(
        (sum, c) => sum + Number(c.comp_qty || 0) * Number(c.cost_price_bdt || 0),
        0
      );
      const authoritativeCostBdt =
        compRows.length > 0 ? Math.round(dbUnitCost * 100000) / 100000 : item.costPriceBdt;

      const saleItemId = uuidv7();
      statements.push({
        sql: `INSERT INTO sale_items (
                id, sale_id, sellable_id, product_name, sku, sellable_type,
                unit_code, quantity, bottle_size_ml, unit_price_bdt,
                ideal_retail_price_bdt, cost_price_bdt, discount_amount_bdt,
                discount_percent, discount_reason, line_total_bdt, created_at, device_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          saleItemId,
          saleId,
          item.sellableId,
          item.productName,
          item.sku,
          item.sellableType,
          item.unitCode,
          item.quantity,
          item.bottleSizeMl || null,
          item.unitPriceBdt,
          item.idealRetailPriceBdt,
          authoritativeCostBdt,
          item.discountAmountBdt,
          item.discountPercent,
          item.discountReason || null,
          item.lineTotalBdt,
          now,
          deviceId,
        ],
      });

      // Deduct stock from stock_items via components and record stock_movements
      for (const comp of compRows) {
        const deductQty = Number(comp.comp_qty || 1) * item.quantity;
        const qtyBefore =
          runningStockMap.get(comp.stock_item_id) ?? Number(comp.current_quantity || 0);
        const qtyAfter = qtyBefore - deductQty;
        runningStockMap.set(comp.stock_item_id, qtyAfter);

        statements.push({
          sql: `UPDATE stock_items
                SET current_quantity = current_quantity - ?,
                    updated_at = ?
                WHERE id = ?`,
          params: [deductQty, now, comp.stock_item_id],
        });

        statements.push({
          sql: `INSERT INTO stock_movements (
                  id, stock_item_id, movement_type, reference_id, quantity_delta,
                  quantity_before, quantity_after, cost_price_bdt, reason, created_at, device_id
                ) VALUES (?, ?, 'sale', ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            uuidv7(),
            comp.stock_item_id,
            saleId,
            -deductQty,
            qtyBefore,
            qtyAfter,
            Number(comp.cost_price_bdt || 0),
            `POS Sale ${invoiceNumber} (${item.productName})`,
            now,
            deviceId,
          ],
        });

        statements.push(createChangeLogStatement('stock_items', comp.stock_item_id, 'update', now));
      }
    }

    // 3. Insert sale_payments
    for (const p of payments) {
      statements.push({
        sql: `INSERT INTO sale_payments (id, sale_id, payment_method, amount_bdt, transaction_ref, created_at, device_id)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [uuidv7(), saleId, p.method, p.amountBdt, p.reference || null, now, deviceId],
      });
    }

    // 4. Update customer due if unpaid balance exists
    if (customer && totals.dueAmountBdt > 0) {
      statements.push({
        sql: `UPDATE customers
              SET due_balance_bdt = due_balance_bdt + ?, updated_at = ?
              WHERE id = ?`,
        params: [totals.dueAmountBdt, now, customer.id],
      });
      statements.push(createChangeLogStatement('customers', customer.id, 'update', now));
    }

    // 5. Audit & Change Log
    statements.push({
      sql: `INSERT INTO audit_log (id, user_id, username, action, details, branch_id, created_at, device_id)
            VALUES (?, ?, ?, 'sale.complete', ?, ?, ?, ?)`,
      params: [
        uuidv7(),
        cashierId,
        resolvedCashierName,
        JSON.stringify({
          saleId,
          invoiceNumber,
          totalAmountBdt: totals.totalAmountBdt,
          paidAmountBdt: totals.paidAmountBdt,
          dueAmountBdt: totals.dueAmountBdt,
          paymentMethod: primaryPaymentMethod,
          itemCount: items.length,
        }),
        resolvedBranchId,
        now,
        deviceId,
      ],
    });
    statements.push(createChangeLogStatement('sales', saleId, 'insert', now));

    await dbBatchTx(statements);

    return {
      saleId,
      invoiceNumber,
    };
  },

  /**
   * Retrieves sales history with optional date range filtering
   */
  async getSales(options?: {
    startDate?: string;
    endDate?: string;
    cashierId?: string;
    limit?: number;
  }): Promise<Sale[]> {
    let sql = `
      SELECT s.*, u.display_name as cashier_name
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (options?.startDate) {
      sql += ` AND s.created_at >= ?`;
      params.push(`${options.startDate}T00:00:00.000Z`);
    }

    if (options?.endDate) {
      sql += ` AND s.created_at <= ?`;
      params.push(`${options.endDate}T23:59:59.999Z`);
    }

    if (options?.cashierId) {
      sql += ` AND s.cashier_id = ?`;
      params.push(options.cashierId);
    }

    sql += ` ORDER BY s.created_at DESC LIMIT ?`;
    params.push(options?.limit ?? 300);

    const rows = await dbQuery<Record<string, unknown>>(sql, params);

    return rows.map((r) => ({
      id: String(r.id),
      invoiceNumber: String(r.invoice_number),
      customerId: r.customer_id ? String(r.customer_id) : null,
      customerName: r.customer_name ? String(r.customer_name) : null,
      customerPhone: r.customer_phone ? String(r.customer_phone) : null,
      cashierId: String(r.cashier_id),
      cashierName: r.cashier_name ? String(r.cashier_name) : undefined,
      subtotalBdt: Number(r.subtotal_bdt),
      discountAmountBdt: Number(r.discount_amount_bdt),
      discountPercent: Number(r.discount_percent),
      discountReason: r.discount_reason ? String(r.discount_reason) : null,
      totalAmountBdt: Number(r.total_amount_bdt),
      paidAmountBdt: Number(r.paid_amount_bdt),
      changeAmountBdt: Number(r.change_amount_bdt),
      dueAmountBdt: Number(r.due_amount_bdt),
      paymentMethod: r.payment_method as Sale['paymentMethod'],
      status: r.status as Sale['status'],
      createdAt: String(r.created_at),
    }));
  },

  /**
   * Retrieves recent sales history
   */
  async getRecentSales(limit: number = 50): Promise<Sale[]> {
    return this.getSales({ limit });
  },

  /**
   * Retrieves full details for a single sale including its items and payment breakdowns
   */
  async getSaleDetails(saleId: string): Promise<Sale | null> {
    const saleRows = await dbQuery<Record<string, unknown>>(
      `SELECT s.*, u.display_name as cashier_name
       FROM sales s
       LEFT JOIN users u ON s.cashier_id = u.id
       WHERE s.id = ?`,
      [saleId]
    );

    if (saleRows.length === 0) return null;
    const r = saleRows[0];

    // Fetch sale items and payment lines concurrently
    const [itemRows, paymentRows] = await Promise.all([
      dbQuery<Record<string, unknown>>(
        `SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC`,
        [saleId]
      ),
      dbQuery<Record<string, unknown>>(
        `SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY created_at ASC`,
        [saleId]
      ),
    ]);

    const items: CartItem[] = itemRows.map((it) => ({
      id: String(it.id),
      sellableId: String(it.sellable_id),
      productName: String(it.product_name),
      sku: String(it.sku),
      sellableType: it.sellable_type as CartItem['sellableType'],
      unitCode: String(it.unit_code),
      bottleSizeMl: it.bottle_size_ml ? Number(it.bottle_size_ml) : undefined,
      quantity: Number(it.quantity),
      unitPriceBdt: Number(it.unit_price_bdt),
      idealRetailPriceBdt: Number(it.ideal_retail_price_bdt),
      costPriceBdt: Number(it.cost_price_bdt),
      discountAmountBdt: Number(it.discount_amount_bdt),
      discountPercent: Number(it.discount_percent),
      discountReason: it.discount_reason ? String(it.discount_reason) : undefined,
      lineTotalBdt: Number(it.line_total_bdt),
      stockInHand: 0,
    }));

    const payments: SalePayment[] = paymentRows.map((p) => ({
      method: p.payment_method as SalePayment['method'],
      amountBdt: Number(p.amount_bdt),
      reference: p.transaction_ref ? String(p.transaction_ref) : undefined,
    }));

    return {
      id: String(r.id),
      invoiceNumber: String(r.invoice_number),
      customerId: r.customer_id ? String(r.customer_id) : null,
      customerName: r.customer_name ? String(r.customer_name) : null,
      customerPhone: r.customer_phone ? String(r.customer_phone) : null,
      cashierId: String(r.cashier_id),
      cashierName: r.cashier_name ? String(r.cashier_name) : undefined,
      subtotalBdt: Number(r.subtotal_bdt),
      discountAmountBdt: Number(r.discount_amount_bdt),
      discountPercent: Number(r.discount_percent),
      discountReason: r.discount_reason ? String(r.discount_reason) : null,
      totalAmountBdt: Number(r.total_amount_bdt),
      paidAmountBdt: Number(r.paid_amount_bdt),
      changeAmountBdt: Number(r.change_amount_bdt),
      dueAmountBdt: Number(r.due_amount_bdt),
      paymentMethod: r.payment_method as Sale['paymentMethod'],
      status: r.status as Sale['status'],
      items,
      payments,
      createdAt: String(r.created_at),
    };
  },
};
