import { createChangeLogStatement, dbBatchTx, dbQuery, type BatchStatement, type SqlParam } from '@/data/db';
import { nowUtcIso } from '@/lib/dates';
import { uuidv7 } from '@/lib/ids';
import type { Expense, ExpenseCategory, CashDrawerSummary } from '@/domain/expenses/types';

export const expensesRepo = {
  async getCategories(): Promise<ExpenseCategory[]> {
    const rows = await dbQuery<{
      id: string;
      name: string;
      description: string | null;
      is_system: number;
    }>(`SELECT * FROM expense_categories ORDER BY name ASC`);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: Boolean(r.is_system),
    }));
  },

  async getExpenses(filter?: {
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    searchQuery?: string;
  }): Promise<Expense[]> {
    let sql = `
      SELECT id, title, category_id, category_name, amount_bdt, payment_method,
             reference_number, notes, expense_date, created_by_user_id,
             created_by_username, branch_id, created_at
      FROM expenses
      WHERE deleted_at IS NULL
    `;
    const params: SqlParam[] = [];

    if (filter?.startDate) {
      sql += ` AND date(expense_date) >= date(?)`;
      params.push(filter.startDate);
    }
    if (filter?.endDate) {
      sql += ` AND date(expense_date) <= date(?)`;
      params.push(filter.endDate);
    }
    if (filter?.categoryId && filter.categoryId !== 'all') {
      sql += ` AND category_id = ?`;
      params.push(filter.categoryId);
    }
    if (filter?.searchQuery?.trim()) {
      const q = `%${filter.searchQuery.trim()}%`;
      sql += ` AND (title LIKE ? OR reference_number LIKE ? OR notes LIKE ?)`;
      params.push(q, q, q);
    }

    sql += ` ORDER BY expense_date DESC, created_at DESC`;

    const rows = await dbQuery<{
      id: string;
      title: string;
      category_id: string | null;
      category_name: string;
      amount_bdt: number;
      payment_method: string;
      reference_number: string | null;
      notes: string | null;
      expense_date: string;
      created_by_user_id: string | null;
      created_by_username: string | null;
      branch_id: string;
      created_at: string;
    }>(sql, params);

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      categoryId: r.category_id,
      categoryName: r.category_name,
      amountBdt: Number(r.amount_bdt) || 0,
      paymentMethod: r.payment_method,
      referenceNumber: r.reference_number,
      notes: r.notes,
      expenseDate: r.expense_date,
      createdByUserId: r.created_by_user_id,
      createdByUsername: r.created_by_username,
      branchId: r.branch_id,
      createdAt: r.created_at,
    }));
  },

  async createExpense(
    input: {
      title: string;
      categoryId?: string | null;
      categoryName: string;
      amountBdt: number;
      paymentMethod: string;
      referenceNumber?: string | null;
      notes?: string | null;
      expenseDate?: string;
      branchId?: string;
      userId?: string | null;
      username?: string | null;
    },
    deviceId: string
  ): Promise<Expense> {
    const id = uuidv7();
    const now = nowUtcIso();
    const expDate = input.expenseDate || now;
    const branchId = input.branchId || 'default-branch';

    let resolvedUserId: string | null = null;
    if (input.userId) {
      try {
        const u = await dbQuery<{ id: string }>(`SELECT id FROM users WHERE id = ? LIMIT 1`, [
          input.userId,
        ]);
        if (u.length > 0) resolvedUserId = u[0].id;
      } catch {}
    }

    const statements: BatchStatement[] = [
      {
        sql: `INSERT INTO expenses (
                id, title, category_id, category_name, amount_bdt, payment_method,
                reference_number, notes, expense_date, created_by_user_id,
                created_by_username, branch_id, created_at, updated_at, device_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id,
          input.title.trim(),
          input.categoryId || null,
          input.categoryName.trim(),
          input.amountBdt,
          input.paymentMethod,
          input.referenceNumber?.trim() || null,
          input.notes?.trim() || null,
          expDate,
          resolvedUserId,
          input.username || 'Cashier',
          branchId,
          now,
          now,
          deviceId,
        ],
      },
      {
        sql: `INSERT INTO audit_log (id, user_id, username, action, details, created_at, device_id)
              VALUES (?, ?, ?, 'expenses.create', ?, ?, ?)`,
        params: [
          uuidv7(),
          resolvedUserId,
          input.username || 'Cashier',
          JSON.stringify({ id, title: input.title, amount: input.amountBdt }),
          now,
          deviceId,
        ],
      },
      createChangeLogStatement('expenses', id, 'insert', now),
    ];

    await dbBatchTx(statements);

    return {
      id,
      title: input.title.trim(),
      categoryId: input.categoryId || null,
      categoryName: input.categoryName.trim(),
      amountBdt: input.amountBdt,
      paymentMethod: input.paymentMethod,
      referenceNumber: input.referenceNumber?.trim() || null,
      notes: input.notes?.trim() || null,
      expenseDate: expDate,
      createdByUserId: resolvedUserId,
      createdByUsername: input.username || 'Cashier',
      branchId,
      createdAt: now,
    };
  },

  async deleteExpense(id: string, _deviceId: string): Promise<void> {
    const now = nowUtcIso();
    await dbBatchTx([
      {
        sql: `UPDATE expenses SET deleted_at = ?, updated_at = ? WHERE id = ?`,
        params: [now, now, id],
      },
      createChangeLogStatement('expenses', id, 'delete', now),
    ]);
  },

  async getCashDrawerSummary(): Promise<CashDrawerSummary> {
    // 1. Look for active open drawer session
    const sessionRows = await dbQuery<{
      id: string;
      opening_cash_bdt: number;
      opened_at: string;
      opened_by_username: string;
      status: string;
    }>(
      `SELECT id, opening_cash_bdt, opened_at, opened_by_username, status
       FROM cash_drawer_sessions
       WHERE status = 'open'
       ORDER BY opened_at DESC
       LIMIT 1`
    );

    const activeSession = sessionRows[0] || null;
    const openingCashBdt = activeSession ? Number(activeSession.opening_cash_bdt) : 0;
    const dateLimit = activeSession ? activeSession.opened_at : '1970-01-01';

    // 2-5. Fetch cash movements concurrently
    const [salesCashRows, dueCashRows, expCashRows, poCashRows] = await Promise.all([
      dbQuery<{ total: number }>(
        `SELECT COALESCE(SUM(paid_amount_bdt), 0.0) as total
         FROM sales
         WHERE status = 'completed' AND payment_method = 'cash'
           AND created_at >= ?`,
        [dateLimit]
      ),
      dbQuery<{ total: number }>(
        `SELECT COALESCE(SUM(amount_bdt), 0.0) as total
         FROM customer_payments
         WHERE payment_method = 'cash'
           AND created_at >= ?`,
        [dateLimit]
      ),
      dbQuery<{ total: number }>(
        `SELECT COALESCE(SUM(amount_bdt), 0.0) as total
         FROM expenses
         WHERE payment_method = 'cash' AND deleted_at IS NULL
           AND created_at >= ?`,
        [dateLimit]
      ),
      dbQuery<{ total: number }>(
        `SELECT COALESCE(SUM(paid_amount_bdt), 0.0) as total
         FROM purchases
         WHERE payment_method = 'cash' AND status = 'received'
           AND created_at >= ?`,
        [dateLimit]
      ),
    ]);

    const cashSalesBdt = Number(salesCashRows[0]?.total) || 0;
    const customerDueCollectedCashBdt = Number(dueCashRows[0]?.total) || 0;
    const cashExpensesBdt = Number(expCashRows[0]?.total) || 0;
    const supplierPurchasesCashBdt = Number(poCashRows[0]?.total) || 0;

    // Expected cash in drawer = Opening + In - Out
    const expectedCashInDrawerBdt =
      openingCashBdt +
      cashSalesBdt +
      customerDueCollectedCashBdt -
      cashExpensesBdt -
      supplierPurchasesCashBdt;

    return {
      openingCashBdt,
      cashSalesBdt,
      customerDueCollectedCashBdt,
      cashExpensesBdt,
      supplierPurchasesCashBdt,
      expectedCashInDrawerBdt: Math.round(expectedCashInDrawerBdt * 100) / 100,
      isSessionOpen: Boolean(activeSession),
      sessionId: activeSession?.id || null,
      openedAt: activeSession?.opened_at || null,
      openedByUsername: activeSession?.opened_by_username || null,
    };
  },

  async openDrawerSession(
    openingCashBdt: number,
    userId: string,
    username: string,
    deviceId: string
  ): Promise<string> {
    const id = uuidv7();
    const now = nowUtcIso();

    let resolvedBranchId = 'default-branch';
    try {
      const b = await dbQuery<{ id: string }>(`SELECT id FROM branches LIMIT 1`);
      if (b.length > 0) resolvedBranchId = b[0].id;
    } catch {}

    const statements: BatchStatement[] = [
      {
        sql: `INSERT INTO cash_drawer_sessions (
                id, branch_id, opened_by_user_id, opened_by_username, opened_at,
                opening_cash_bdt, status, device_id
              ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
        params: [id, resolvedBranchId, userId, username, now, openingCashBdt, deviceId],
      },
      {
        sql: `INSERT INTO audit_log (id, user_id, username, action, details, created_at, device_id)
              VALUES (?, ?, ?, 'drawer.open', ?, ?, ?)`,
        params: [
          uuidv7(),
          userId,
          username,
          JSON.stringify({ sessionId: id, openingCash: openingCashBdt }),
          now,
          deviceId,
        ],
      },
    ];

    await dbBatchTx(statements);
    return id;
  },

  async closeDrawerSession(params: {
    sessionId: string;
    actualCashBdt: number;
    expectedCashBdt: number;
    notes?: string;
    userId: string;
    username: string;
    deviceId: string;
  }): Promise<void> {
    const now = nowUtcIso();
    const discrepancy = params.actualCashBdt - params.expectedCashBdt;

    const statements: BatchStatement[] = [
      {
        sql: `UPDATE cash_drawer_sessions
              SET closed_by_user_id = ?,
                  closed_by_username = ?,
                  closed_at = ?,
                  expected_cash_bdt = ?,
                  actual_cash_bdt = ?,
                  discrepancy_bdt = ?,
                  notes = ?,
                  status = 'closed'
              WHERE id = ?`,
        params: [
          params.userId,
          params.username,
          now,
          params.expectedCashBdt,
          params.actualCashBdt,
          discrepancy,
          params.notes?.trim() || null,
          params.sessionId,
        ],
      },
      {
        sql: `INSERT INTO audit_log (id, user_id, username, action, details, created_at, device_id)
              VALUES (?, ?, ?, 'drawer.close', ?, ?, ?)`,
        params: [
          uuidv7(),
          params.userId,
          params.username,
          JSON.stringify({
            sessionId: params.sessionId,
            expected: params.expectedCashBdt,
            actual: params.actualCashBdt,
            discrepancy,
          }),
          now,
          params.deviceId,
        ],
      },
    ];

    await dbBatchTx(statements);
  },
};
