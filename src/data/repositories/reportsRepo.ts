import { dbQuery } from '../db';
import type {
  CashFlowSummary,
  CashierPerformance,
  CategorySalesBreakdown,
  DailyTrendPoint,
  ExpenseCategoryBreakdown,
  InventoryValuationSummary,
  PaymentMethodBreakdown,
  PnLSummary,
  TopSellingProduct,
} from '@/domain/reports/types';

export const reportsRepo = {
  /**
   * Get high-level Profit & Loss (P&L) summary for the selected date range.
   */
  async getPnLSummary(startDateIso: string, endDateIso: string): Promise<PnLSummary> {
    const [salesRow, cogsRow, expensesRow, collRow] = await Promise.all([
      dbQuery<{
        orders_count: number;
        gross_sales: number;
        discount_total: number;
        net_revenue: number;
        dues_incurred: number;
      }>(
        `SELECT 
          COUNT(id) as orders_count,
          COALESCE(SUM(subtotal_bdt), 0) as gross_sales,
          COALESCE(SUM(discount_amount_bdt), 0) as discount_total,
          COALESCE(SUM(total_amount_bdt), 0) as net_revenue,
          COALESCE(SUM(due_amount_bdt), 0) as dues_incurred
        FROM sales
        WHERE status = 'completed'
          AND created_at >= ? AND created_at <= ?`,
        [startDateIso, endDateIso]
      ),
      dbQuery<{
        items_sold: number;
        cogs: number;
      }>(
        `SELECT 
          COALESCE(SUM(si.quantity), 0) as items_sold,
          COALESCE(SUM(si.cost_price_bdt * si.quantity), 0) as cogs
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.status = 'completed'
          AND s.created_at >= ? AND s.created_at <= ?`,
        [startDateIso, endDateIso]
      ),
      dbQuery<{ total_expenses: number }>(
        `SELECT COALESCE(SUM(amount_bdt), 0) as total_expenses
        FROM expenses
        WHERE deleted_at IS NULL
          AND (
            (expense_date >= ? AND expense_date <= ?)
            OR (created_at >= ? AND created_at <= ?)
          )`,
        [startDateIso, endDateIso, startDateIso, endDateIso]
      ),
      dbQuery<{ total_coll: number }>(
        `SELECT COALESCE(SUM(amount_bdt), 0) as total_coll
        FROM customer_payments
        WHERE created_at >= ? AND created_at <= ?`,
        [startDateIso, endDateIso]
      ).catch(() => []),
    ]);

    const ordersCount = Number(salesRow[0]?.orders_count || 0);
    const grossSalesBdt = Number(salesRow[0]?.gross_sales || 0);
    const discountTotalBdt = Number(salesRow[0]?.discount_total || 0);
    const netRevenueBdt = Number(salesRow[0]?.net_revenue || 0);
    const customerDuesIncurredBdt = Number(salesRow[0]?.dues_incurred || 0);

    const itemsSoldCount = Number(cogsRow[0]?.items_sold || 0);
    const cogsBdt = Math.round(Number(cogsRow[0]?.cogs || 0) * 100) / 100;
    const grossProfitBdt = Math.round((netRevenueBdt - cogsBdt) * 100) / 100;
    const grossMarginPercent =
      netRevenueBdt > 0 ? Math.round((grossProfitBdt / netRevenueBdt) * 1000) / 10 : 0;

    const operatingExpensesBdt = Math.round(Number(expensesRow[0]?.total_expenses || 0) * 100) / 100;
    const netProfitBdt = Math.round((grossProfitBdt - operatingExpensesBdt) * 100) / 100;
    const netMarginPercent =
      netRevenueBdt > 0 ? Math.round((netProfitBdt / netRevenueBdt) * 1000) / 10 : 0;
    const averageOrderValueBdt =
      ordersCount > 0 ? Math.round((netRevenueBdt / ordersCount) * 100) / 100 : 0;
    const customerDuesCollectedBdt = Math.round(Number(collRow[0]?.total_coll || 0) * 100) / 100;

    return {
      grossSalesBdt,
      discountTotalBdt,
      netRevenueBdt,
      cogsBdt,
      grossProfitBdt,
      grossMarginPercent,
      operatingExpensesBdt,
      netProfitBdt,
      netMarginPercent,
      ordersCount,
      itemsSoldCount,
      averageOrderValueBdt,
      customerDuesIncurredBdt,
      customerDuesCollectedBdt,
    };
  },

  /**
   * Daily breakdown of revenue, COGS, expenses, and net profit for trend charts.
   */
  async getDailyTrends(startDateIso: string, endDateIso: string): Promise<DailyTrendPoint[]> {
    // Fetch sales and expenses by day concurrently
    const [salesDays, expenseDays] = await Promise.all([
      dbQuery<{
        sale_date: string;
        orders_count: number;
        revenue: number;
        cogs: number;
      }>(
        `SELECT 
          strftime('%Y-%m-%d', s.created_at) as sale_date,
          COUNT(s.id) as orders_count,
          COALESCE(SUM(s.total_amount_bdt), 0) as revenue,
          COALESCE(SUM(si_agg.day_cogs), 0) as cogs
        FROM sales s
        LEFT JOIN (
          SELECT sale_id, SUM(cost_price_bdt * quantity) as day_cogs
          FROM sale_items
          GROUP BY sale_id
        ) si_agg ON si_agg.sale_id = s.id
        WHERE s.status = 'completed'
          AND s.created_at >= ? AND s.created_at <= ?
        GROUP BY strftime('%Y-%m-%d', s.created_at)
        ORDER BY sale_date ASC`,
        [startDateIso, endDateIso]
      ),
      dbQuery<{
        exp_date: string;
        expenses: number;
      }>(
        `SELECT 
          strftime('%Y-%m-%d', COALESCE(expense_date, created_at)) as exp_date,
          COALESCE(SUM(amount_bdt), 0) as expenses
        FROM expenses
        WHERE deleted_at IS NULL
          AND (
            (expense_date >= ? AND expense_date <= ?)
            OR (created_at >= ? AND created_at <= ?)
          )
        GROUP BY strftime('%Y-%m-%d', COALESCE(expense_date, created_at))`,
        [startDateIso, endDateIso, startDateIso, endDateIso]
      ),
    ]);

    const expenseMap = new Map<string, number>();
    for (const ed of expenseDays) {
      expenseMap.set(ed.exp_date, Number(ed.expenses || 0));
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return salesDays.map((sd) => {
      const revenue = Number(sd.revenue || 0);
      const cogs = Math.round(Number(sd.cogs || 0) * 100) / 100;
      const expenses = expenseMap.get(sd.sale_date) || 0;
      const grossProfit = Math.round((revenue - cogs) * 100) / 100;
      const netProfit = Math.round((grossProfit - expenses) * 100) / 100;

      const d = new Date(sd.sale_date);
      const dayLabel = isNaN(d.getTime()) ? '' : dayNames[d.getDay()];

      return {
        date: sd.sale_date,
        dayLabel,
        revenueBdt: revenue,
        cogsBdt: cogs,
        grossProfitBdt: grossProfit,
        expensesBdt: expenses,
        netProfitBdt: netProfit,
        ordersCount: Number(sd.orders_count || 0),
      };
    });
  },

  /**
   * Top selling products by revenue and units.
   */
  async getTopSellingProducts(
    startDateIso: string,
    endDateIso: string,
    limit = 15
  ): Promise<TopSellingProduct[]> {
    const rows = await dbQuery<{
      product_id: string;
      product_name: string;
      sku: string;
      sellable_type: string;
      unit_code: string;
      qty_sold: number;
      revenue: number;
      cogs: number;
    }>(
      `SELECT 
        si.sellable_id as product_id,
        si.product_name,
        si.sku,
        si.sellable_type,
        si.unit_code,
        COALESCE(SUM(si.quantity), 0) as qty_sold,
        COALESCE(SUM(si.line_total_bdt), 0) as revenue,
        COALESCE(SUM(si.cost_price_bdt * si.quantity), 0) as cogs
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed'
        AND s.created_at >= ? AND s.created_at <= ?
      GROUP BY si.sellable_id, si.product_name, si.sku
      ORDER BY revenue DESC
      LIMIT ?`,
      [startDateIso, endDateIso, limit]
    );

    return rows.map((r) => {
      const revenue = Number(r.revenue || 0);
      const cogs = Math.round(Number(r.cogs || 0) * 100) / 100;
      const grossProfit = Math.round((revenue - cogs) * 100) / 100;
      const marginPercent = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;

      return {
        productId: r.product_id,
        productName: r.product_name,
        sku: r.sku,
        sellableType: r.sellable_type,
        quantitySold: Number(r.qty_sold || 0),
        unitCode: r.unit_code || 'pcs',
        revenueBdt: revenue,
        cogsBdt: cogs,
        grossProfitBdt: grossProfit,
        marginPercent,
      };
    });
  },

  /**
   * Sales grouped by product categories.
   */
  async getCategorySales(
    startDateIso: string,
    endDateIso: string
  ): Promise<CategorySalesBreakdown[]> {
    const rows = await dbQuery<{
      category_id: string | null;
      category_name: string | null;
      sellable_type: string;
      items_sold: number;
      revenue: number;
      cogs: number;
    }>(
      `SELECT 
        c.id as category_id,
        COALESCE(c.name, CASE si.sellable_type 
          WHEN 'loose_decant' THEN 'Attar & Decants'
          WHEN 'sealed_product' THEN 'Sealed Perfumes'
          WHEN 'accessory' THEN 'Tasbih & Accessories'
          WHEN 'custom_blend' THEN 'Custom Blends'
          ELSE 'General Fragrance'
        END) as category_name,
        si.sellable_type,
        COALESCE(SUM(si.quantity), 0) as items_sold,
        COALESCE(SUM(si.line_total_bdt), 0) as revenue,
        COALESCE(SUM(si.cost_price_bdt * si.quantity), 0) as cogs
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN sellables sp ON si.sellable_id = sp.id
      LEFT JOIN categories c ON sp.category_id = c.id
      WHERE s.status = 'completed'
        AND s.created_at >= ? AND s.created_at <= ?
      GROUP BY category_name, si.sellable_type
      ORDER BY revenue DESC`,
      [startDateIso, endDateIso]
    );

    const totalRev = rows.reduce((acc, r) => acc + Number(r.revenue || 0), 0);

    return rows.map((r) => {
      const revenue = Number(r.revenue || 0);
      const cogs = Math.round(Number(r.cogs || 0) * 100) / 100;
      const grossProfit = Math.round((revenue - cogs) * 100) / 100;
      const marginPercent = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;
      const revenuePercentage = totalRev > 0 ? Math.round((revenue / totalRev) * 1000) / 10 : 0;

      return {
        categoryId: r.category_id,
        categoryName: r.category_name || 'General',
        sellableType: r.sellable_type,
        itemsSold: Number(r.items_sold || 0),
        revenueBdt: revenue,
        cogsBdt: cogs,
        grossProfitBdt: grossProfit,
        marginPercent,
        revenuePercentage,
      };
    });
  },

  /**
   * Payment methods breakdown (Cash, bKash, Nagad, Card, Split, Due).
   */
  async getPaymentMethodBreakdown(
    startDateIso: string,
    endDateIso: string
  ): Promise<PaymentMethodBreakdown[]> {
    // 1. Try sale_payments first (handles split payments correctly)
    const splitRows = await dbQuery<{
      payment_method: string;
      amount: number;
      tx_count: number;
    }>(
      `SELECT 
        sp.payment_method,
        COALESCE(SUM(sp.amount_bdt), 0) as amount,
        COUNT(sp.id) as tx_count
      FROM sale_payments sp
      JOIN sales s ON sp.sale_id = s.id
      WHERE s.status = 'completed'
        AND s.created_at >= ? AND s.created_at <= ?
      GROUP BY sp.payment_method`,
      [startDateIso, endDateIso]
    );

    let rows = splitRows;

    // Fallback to sales table if sale_payments table is empty
    if (splitRows.length === 0) {
      rows = await dbQuery<{
        payment_method: string;
        amount: number;
        tx_count: number;
      }>(
        `SELECT 
          payment_method,
          COALESCE(SUM(paid_amount_bdt), 0) as amount,
          COUNT(id) as tx_count
        FROM sales
        WHERE status = 'completed'
          AND created_at >= ? AND created_at <= ?
        GROUP BY payment_method`,
        [startDateIso, endDateIso]
      );
    }

    const totalPaid = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);

    const nameMap: Record<string, string> = {
      cash: 'Cash in Hand',
      bkash: 'bKash Mobile Wallet',
      nagad: 'Nagad Mobile Wallet',
      card: 'Card (Visa / Mastercard)',
      split: 'Split Payment',
      due: 'Unpaid Due / Credit',
    };

    return rows.map((r) => {
      const amount = Number(r.amount || 0);
      const percentage = totalPaid > 0 ? Math.round((amount / totalPaid) * 1000) / 10 : 0;
      return {
        paymentMethod: r.payment_method,
        displayName: nameMap[r.payment_method.toLowerCase()] || r.payment_method.toUpperCase(),
        amountBdt: amount,
        count: Number(r.tx_count || 0),
        percentage,
      };
    });
  },

  /**
   * Cashier / Staff sales performance.
   */
  async getCashierPerformance(
    startDateIso: string,
    endDateIso: string
  ): Promise<CashierPerformance[]> {
    const rows = await dbQuery<{
      cashier_id: string;
      cashier_name: string;
      orders_count: number;
      total_sales: number;
      discounts_given: number;
    }>(
      `SELECT 
        s.cashier_id,
        COALESCE(u.display_name, u.username, 'Staff') as cashier_name,
        COUNT(s.id) as orders_count,
        COALESCE(SUM(s.total_amount_bdt), 0) as total_sales,
        COALESCE(SUM(s.discount_amount_bdt), 0) as discounts_given
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE s.status = 'completed'
        AND s.created_at >= ? AND s.created_at <= ?
      GROUP BY s.cashier_id
      ORDER BY total_sales DESC`,
      [startDateIso, endDateIso]
    );

    return rows.map((r) => {
      const totalSales = Number(r.total_sales || 0);
      const ordersCount = Number(r.orders_count || 0);
      const avgTicket = ordersCount > 0 ? Math.round((totalSales / ordersCount) * 100) / 100 : 0;

      return {
        cashierId: r.cashier_id,
        cashierName: r.cashier_name,
        ordersCount,
        totalSalesBdt: totalSales,
        avgTicketBdt: avgTicket,
        discountsGivenBdt: Number(r.discounts_given || 0),
      };
    });
  },

  /**
   * Expense categories breakdown for the period.
   */
  async getExpenseBreakdown(
    startDateIso: string,
    endDateIso: string
  ): Promise<ExpenseCategoryBreakdown[]> {
    const rows = await dbQuery<{
      category_id: string | null;
      category_name: string;
      amount: number;
      exp_count: number;
    }>(
      `SELECT 
        category_id,
        category_name,
        COALESCE(SUM(amount_bdt), 0) as amount,
        COUNT(id) as exp_count
      FROM expenses
      WHERE deleted_at IS NULL
        AND (
          (expense_date >= ? AND expense_date <= ?)
          OR (created_at >= ? AND created_at <= ?)
        )
      GROUP BY category_name
      ORDER BY amount DESC`,
      [startDateIso, endDateIso, startDateIso, endDateIso]
    );

    const totalExp = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);

    return rows.map((r) => {
      const amount = Number(r.amount || 0);
      const percentage = totalExp > 0 ? Math.round((amount / totalExp) * 1000) / 10 : 0;
      return {
        categoryId: r.category_id,
        categoryName: r.category_name,
        amountBdt: amount,
        count: Number(r.exp_count || 0),
        percentage,
      };
    });
  },

  /**
   * Physical Counter Cash Flow summary (Reconciliation).
   */
  async getCashFlowSummary(startDateIso: string, endDateIso: string): Promise<CashFlowSummary> {
    // 1. Cash from POS sales
    const cashSalesRow = await dbQuery<{ total: number }>(
      `SELECT COALESCE(SUM(sp.amount_bdt), 0) as total
      FROM sale_payments sp
      JOIN sales s ON sp.sale_id = s.id
      WHERE s.status = 'completed'
        AND lower(sp.payment_method) = 'cash'
        AND s.created_at >= ? AND s.created_at <= ?`,
      [startDateIso, endDateIso]
    );
    let cashSalesBdt = Number(cashSalesRow[0]?.total || 0);

    if (cashSalesBdt === 0) {
      const directCash = await dbQuery<{ total: number }>(
        `SELECT COALESCE(SUM(paid_amount_bdt), 0) as total
        FROM sales
        WHERE status = 'completed'
          AND lower(payment_method) = 'cash'
          AND created_at >= ? AND created_at <= ?`,
        [startDateIso, endDateIso]
      );
      cashSalesBdt = Number(directCash[0]?.total || 0);
    }

    // 2. Customer dues cash payments
    let customerDueCollectionsCashBdt = 0;
    try {
      const duePayRow = await dbQuery<{ total: number }>(
        `SELECT COALESCE(SUM(amount_bdt), 0) as total
        FROM customer_payments
        WHERE lower(payment_method) = 'cash'
          AND created_at >= ? AND created_at <= ?`,
        [startDateIso, endDateIso]
      );
      customerDueCollectionsCashBdt = Number(duePayRow[0]?.total || 0);
    } catch {
      // ignore if table doesn't have records
    }

    // 3. Cash expenses
    const expRow = await dbQuery<{ total: number }>(
      `SELECT COALESCE(SUM(amount_bdt), 0) as total
      FROM expenses
      WHERE deleted_at IS NULL
        AND lower(payment_method) = 'cash'
        AND (
          (expense_date >= ? AND expense_date <= ?)
          OR (created_at >= ? AND created_at <= ?)
        )`,
      [startDateIso, endDateIso, startDateIso, endDateIso]
    );
    const cashExpensesBdt = Number(expRow[0]?.total || 0);

    // 4. Cash purchases
    let cashSupplierPurchasesBdt = 0;
    try {
      const purRow = await dbQuery<{ total: number }>(
        `SELECT COALESCE(SUM(paid_amount_bdt), 0) as total
        FROM purchases
        WHERE lower(payment_method) = 'cash'
          AND created_at >= ? AND created_at <= ?`,
        [startDateIso, endDateIso]
      );
      cashSupplierPurchasesBdt = Number(purRow[0]?.total || 0);
    } catch {
      // ignore
    }

    const totalCashInflowBdt = Math.round((cashSalesBdt + customerDueCollectionsCashBdt) * 100) / 100;
    const totalCashOutflowBdt = Math.round((cashExpensesBdt + cashSupplierPurchasesBdt) * 100) / 100;
    const netCashFlowBdt = Math.round((totalCashInflowBdt - totalCashOutflowBdt) * 100) / 100;

    return {
      cashSalesBdt,
      customerDueCollectionsCashBdt,
      totalCashInflowBdt,
      cashExpensesBdt,
      cashSupplierPurchasesBdt,
      totalCashOutflowBdt,
      netCashFlowBdt,
    };
  },

  /**
   * Total inventory valuation at cost vs retail price, plus stock health metrics.
   */
  async getInventoryValuation(): Promise<InventoryValuationSummary> {
    const rows = await dbQuery<{
      total_skus: number;
      total_units: number;
      total_cost_val: number;
      healthy_count: number;
      low_count: number;
      out_of_stock_count: number;
    }>(
      `SELECT 
        COUNT(id) as total_skus,
        COALESCE(SUM(current_quantity), 0) as total_units,
        COALESCE(SUM(current_quantity * cost_price_bdt), 0) as total_cost_val,
        COUNT(CASE WHEN current_quantity > min_alert_quantity AND current_quantity > 0 THEN 1 END) as healthy_count,
        COUNT(CASE WHEN current_quantity <= min_alert_quantity AND current_quantity > 0 THEN 1 END) as low_count,
        COUNT(CASE WHEN current_quantity <= 0 THEN 1 END) as out_of_stock_count
      FROM stock_items
      WHERE deleted_at IS NULL`
    );

    const totalSkus = Number(rows[0]?.total_skus || 0);
    const totalUnitsInStock = Math.round(Number(rows[0]?.total_units || 0) * 100) / 100;
    const totalCostValueBdt = Math.round(Number(rows[0]?.total_cost_val || 0) * 100) / 100;
    const healthyStockCount = Number(rows[0]?.healthy_count || 0);
    const lowStockCount = Number(rows[0]?.low_count || 0);
    const outOfStockCount = Number(rows[0]?.out_of_stock_count || 0);

    // Compute retail value from sellables mapped via sellable_components
    let totalRetailValueBdt = totalCostValueBdt * 1.5; // fallback
    try {
      const retailRow = await dbQuery<{ total_retail: number }>(
        `SELECT 
          COALESCE(SUM(si.current_quantity * COALESCE(s.retail_price_bdt, si.cost_price_bdt * 1.5)), 0) as total_retail
        FROM stock_items si
        LEFT JOIN sellable_components sc ON sc.stock_item_id = si.id
        LEFT JOIN sellables s ON sc.sellable_id = s.id AND s.deleted_at IS NULL
        WHERE si.deleted_at IS NULL`
      );
      if (retailRow.length > 0 && Number(retailRow[0]?.total_retail || 0) > 0) {
        totalRetailValueBdt = Math.round(Number(retailRow[0].total_retail) * 100) / 100;
      }
    } catch {
      // fallback
    }

    const potentialGrossProfitBdt =
      Math.max(0, Math.round((totalRetailValueBdt - totalCostValueBdt) * 100) / 100);
    const potentialMarginPercent =
      totalRetailValueBdt > 0
        ? Math.round((potentialGrossProfitBdt / totalRetailValueBdt) * 1000) / 10
        : 0;

    return {
      totalSkus,
      totalUnitsInStock,
      totalCostValueBdt,
      totalRetailValueBdt,
      potentialGrossProfitBdt,
      potentialMarginPercent,
      healthyStockCount,
      lowStockCount,
      outOfStockCount,
    };
  },

  /**
   * Fetch full sales transaction rows for CSV export.
   */
  async getSalesExportRows(startDateIso: string, endDateIso: string) {
    return dbQuery<{
      invoice_number: string;
      customer_name: string | null;
      customer_phone: string | null;
      cashier_username: string | null;
      subtotal_bdt: number;
      discount_amount_bdt: number;
      total_amount_bdt: number;
      paid_amount_bdt: number;
      due_amount_bdt: number;
      payment_method: string;
      status: string;
      created_at: string;
    }>(
      `SELECT 
        s.invoice_number,
        s.customer_name,
        s.customer_phone,
        COALESCE(u.display_name, u.username, 'Staff') as cashier_username,
        s.subtotal_bdt,
        s.discount_amount_bdt,
        s.total_amount_bdt,
        s.paid_amount_bdt,
        s.due_amount_bdt,
        s.payment_method,
        s.status,
        s.created_at
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE s.status = 'completed'
        AND s.created_at >= ? AND s.created_at <= ?
      ORDER BY s.created_at DESC`,
      [startDateIso, endDateIso]
    );
  },

  /**
   * Fetch detailed expense rows for CSV export.
   */
  async getExpensesExportRows(startDateIso: string, endDateIso: string) {
    return dbQuery<{
      title: string;
      category_name: string;
      amount_bdt: number;
      payment_method: string;
      reference_number: string | null;
      expense_date: string;
      created_by_username: string | null;
      notes: string | null;
    }>(
      `SELECT 
        title,
        category_name,
        amount_bdt,
        payment_method,
        reference_number,
        expense_date,
        created_by_username,
        notes
      FROM expenses
      WHERE deleted_at IS NULL
        AND (
          (expense_date >= ? AND expense_date <= ?)
          OR (created_at >= ? AND created_at <= ?)
        )
      ORDER BY expense_date DESC`,
      [startDateIso, endDateIso, startDateIso, endDateIso]
    );
  },
};
