import { createChangeLogStatement, dbBatchTx, dbQuery, type BatchStatement, type SqlParam } from '@/data/db';
import { nowUtcIso } from '@/lib/dates';
import { uuidv7 } from '@/lib/ids';
import { normalizePhoneNumber, sanitizeSqlLikePattern } from '@/lib/sanitize';
import type { Customer, CustomerPayment, CustomerSaleSummary } from '@/domain/customers/types';

export const customersRepo = {
  async getCustomers(filter?: {
    search?: string;
    onlyWithDues?: boolean;
  }): Promise<Customer[]> {
    let sql = `
      SELECT c.id, c.phone, c.name, c.email, c.address, c.notes, c.due_balance_bdt,
             c.created_at, c.updated_at,
             COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as total_orders,
             COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total_amount_bdt ELSE 0 END), 0.0) as total_spent_bdt,
             MAX(CASE WHEN s.status = 'completed' THEN s.created_at END) as last_order_date
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id
      WHERE c.deleted_at IS NULL
    `;
    const params: SqlParam[] = [];

    if (filter?.search?.trim()) {
      const q = `%${sanitizeSqlLikePattern(filter.search)}%`;
      sql += ` AND (c.name LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\')`;
      params.push(q, q, q);
    }

    sql += ` GROUP BY c.id`;

    if (filter?.onlyWithDues) {
      sql += ` HAVING c.due_balance_bdt > 0.01`;
    }

    sql += ` ORDER BY c.due_balance_bdt DESC, total_spent_bdt DESC, c.name ASC`;

    const rows = await dbQuery<{
      id: string;
      phone: string;
      name: string;
      email: string | null;
      address: string | null;
      notes: string | null;
      due_balance_bdt: number;
      created_at: string;
      updated_at: string;
      total_orders: number;
      total_spent_bdt: number;
      last_order_date: string | null;
    }>(sql, params);

    return rows.map((r) => ({
      id: r.id,
      phone: r.phone,
      name: r.name,
      email: r.email,
      address: r.address,
      notes: r.notes,
      dueBalanceBdt: Number(r.due_balance_bdt) || 0,
      totalOrders: Number(r.total_orders) || 0,
      totalSpentBdt: Number(r.total_spent_bdt) || 0,
      lastOrderDate: r.last_order_date,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  async getCustomerDetails(customerId: string): Promise<{
    customer: Customer;
    sales: CustomerSaleSummary[];
    payments: CustomerPayment[];
  } | null> {
    // Concurrently fetch profile, sales history, and ledger payments
    const [custRows, salesRows, paymentRows] = await Promise.all([
      dbQuery<{
        id: string;
        phone: string;
        name: string;
        email: string | null;
        address: string | null;
        notes: string | null;
        due_balance_bdt: number;
        created_at: string;
        updated_at: string;
        total_orders: number;
        total_spent_bdt: number;
        last_order_date: string | null;
      }>(
        `SELECT c.id, c.phone, c.name, c.email, c.address, c.notes, c.due_balance_bdt,
                c.created_at, c.updated_at,
                COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as total_orders,
                COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total_amount_bdt ELSE 0 END), 0.0) as total_spent_bdt,
                MAX(CASE WHEN s.status = 'completed' THEN s.created_at END) as last_order_date
         FROM customers c
         LEFT JOIN sales s ON c.id = s.customer_id
         WHERE c.id = ? AND c.deleted_at IS NULL
         GROUP BY c.id`,
        [customerId]
      ),
      dbQuery<{
        id: string;
        invoice_number: string;
        created_at: string;
        total_amount_bdt: number;
        paid_amount_bdt: number;
        due_amount_bdt: number;
        payment_method: string;
        status: string;
      }>(
        `SELECT id, invoice_number, created_at, total_amount_bdt, paid_amount_bdt,
                due_amount_bdt, payment_method, status
         FROM sales
         WHERE customer_id = ?
         ORDER BY created_at DESC`,
        [customerId]
      ),
      dbQuery<{
        id: string;
        customer_id: string;
        amount_bdt: number;
        payment_method: string;
        reference_number: string | null;
        notes: string | null;
        received_by_user_id: string | null;
        received_by_username: string | null;
        created_at: string;
      }>(
        `SELECT * FROM customer_payments
         WHERE customer_id = ?
         ORDER BY created_at DESC`,
        [customerId]
      ),
    ]);

    if (custRows.length === 0) return null;
    const c = custRows[0];

    const customer: Customer = {
      id: c.id,
      phone: c.phone,
      name: c.name,
      email: c.email,
      address: c.address,
      notes: c.notes,
      dueBalanceBdt: Number(c.due_balance_bdt) || 0,
      totalOrders: Number(c.total_orders) || 0,
      totalSpentBdt: Number(c.total_spent_bdt) || 0,
      lastOrderDate: c.last_order_date,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };

    const sales: CustomerSaleSummary[] = salesRows.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoice_number,
      createdAt: s.created_at,
      totalAmountBdt: Number(s.total_amount_bdt) || 0,
      paidAmountBdt: Number(s.paid_amount_bdt) || 0,
      dueAmountBdt: Number(s.due_amount_bdt) || 0,
      paymentMethod: s.payment_method,
      status: s.status,
    }));

    const payments: CustomerPayment[] = paymentRows.map((p) => ({
      id: p.id,
      customerId: p.customer_id,
      amountBdt: Number(p.amount_bdt) || 0,
      paymentMethod: p.payment_method,
      referenceNumber: p.reference_number,
      notes: p.notes,
      receivedByUserId: p.received_by_user_id,
      receivedByUsername: p.received_by_username,
      createdAt: p.created_at,
    }));

    return { customer, sales, payments };
  },

  async createCustomer(
    input: {
      name: string;
      phone: string;
      email?: string;
      address?: string;
      notes?: string;
    },
    deviceId: string
  ): Promise<Customer> {
    const id = uuidv7();
    const now = nowUtcIso();
    const cleanPhone = normalizePhoneNumber(input.phone);
    const cleanName = input.name.trim();

    const statements: BatchStatement[] = [
      {
        sql: `INSERT INTO customers (
                id, phone, name, email, address, notes, due_balance_bdt, created_at, updated_at, device_id
              ) VALUES (?, ?, ?, ?, ?, ?, 0.0, ?, ?, ?)`,
        params: [
          id,
          cleanPhone,
          cleanName,
          input.email?.trim() || null,
          input.address?.trim() || null,
          input.notes?.trim() || null,
          now,
          now,
          deviceId,
        ],
      },
      createChangeLogStatement('customers', id, 'insert', now),
    ];

    await dbBatchTx(statements);

    return {
      id,
      phone: cleanPhone,
      name: cleanName,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      dueBalanceBdt: 0,
      totalOrders: 0,
      totalSpentBdt: 0,
      lastOrderDate: null,
      createdAt: now,
      updatedAt: now,
    };
  },

  async updateCustomer(
    input: {
      id: string;
      name: string;
      phone: string;
      email?: string;
      address?: string;
      notes?: string;
    },
    _deviceId: string
  ): Promise<void> {
    const now = nowUtcIso();
    const statements: BatchStatement[] = [
      {
        sql: `UPDATE customers
              SET name = ?, phone = ?, email = ?, address = ?, notes = ?, updated_at = ?
              WHERE id = ?`,
        params: [
          input.name.trim(),
          normalizePhoneNumber(input.phone),
          input.email?.trim() || null,
          input.address?.trim() || null,
          input.notes?.trim() || null,
          now,
          input.id,
        ],
      },
      createChangeLogStatement('customers', input.id, 'update', now),
    ];

    await dbBatchTx(statements);
  },

  async deleteCustomer(id: string, _deviceId: string): Promise<void> {
    const now = nowUtcIso();
    await dbBatchTx([
      {
        sql: `UPDATE customers SET deleted_at = ?, updated_at = ? WHERE id = ?`,
        params: [now, now, id],
      },
      createChangeLogStatement('customers', id, 'delete', now),
    ]);
  },

  async recordDuePayment(params: {
    customerId: string;
    amountBdt: number;
    paymentMethod: string;
    referenceNumber?: string;
    notes?: string;
    receivedByUserId?: string | null;
    receivedByUsername?: string | null;
    deviceId: string;
  }): Promise<number> {
    const paymentId = uuidv7();
    const now = nowUtcIso();

    // Verify user ID exists
    let resolvedUserId: string | null = null;
    if (params.receivedByUserId) {
      try {
        const u = await dbQuery<{ id: string }>(`SELECT id FROM users WHERE id = ? LIMIT 1`, [
          params.receivedByUserId,
        ]);
        if (u.length > 0) resolvedUserId = u[0].id;
      } catch {}
    }

    const statements: BatchStatement[] = [
      // 1. Insert customer payment
      {
        sql: `INSERT INTO customer_payments (
                id, customer_id, amount_bdt, payment_method, reference_number,
                notes, received_by_user_id, received_by_username, created_at, device_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          paymentId,
          params.customerId,
          params.amountBdt,
          params.paymentMethod,
          params.referenceNumber?.trim() || null,
          params.notes?.trim() || null,
          resolvedUserId,
          params.receivedByUsername || 'Cashier',
          now,
          params.deviceId,
        ],
      },
      // 2. Reduce customer due balance
      {
        sql: `UPDATE customers
              SET due_balance_bdt = MAX(0.0, due_balance_bdt - ?),
                  updated_at = ?
              WHERE id = ?`,
        params: [params.amountBdt, now, params.customerId],
      },
      // 3. Audit log
      {
        sql: `INSERT INTO audit_log (id, user_id, username, action, details, created_at, device_id)
              VALUES (?, ?, ?, 'customer.due_payment', ?, ?, ?)`,
        params: [
          uuidv7(),
          resolvedUserId,
          params.receivedByUsername || 'Cashier',
          JSON.stringify({
            customerId: params.customerId,
            amount: params.amountBdt,
            method: params.paymentMethod,
          }),
          now,
          params.deviceId,
        ],
      },
      createChangeLogStatement('customers', params.customerId, 'update', now),
    ];

    await dbBatchTx(statements);

    const rows = await dbQuery<{ due_balance_bdt: number }>(
      `SELECT due_balance_bdt FROM customers WHERE id = ?`,
      [params.customerId]
    );

    return rows[0]?.due_balance_bdt ? Number(rows[0].due_balance_bdt) : 0;
  },
};
