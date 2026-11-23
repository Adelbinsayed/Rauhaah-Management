import { dbQuery } from '../db';
import { utcIsoToDhakaDateString } from '@/lib/dates';
import type {
  DashboardSummary,
  LowStockItem,
  PaymentMethodShare,
  RecentSaleActivity,
  TopSellingItem,
} from '@/domain/dashboard/types';

export const dashboardRepo = {
  /**
   * Retrieves high-level operational summary for the selected period
   */
  async getSummary(
    startDateIso: string,
    endDateIso: string,
    label: string,
    canViewCost: boolean
  ): Promise<DashboardSummary> {
    const startYmd = utcIsoToDhakaDateString(startDateIso);
    const endYmd = utcIsoToDhakaDateString(endDateIso);

    // Execute all summary metric queries in parallel for instant dashboard rendering
    const [
      salesRows,
      cogsRows,
      expRows,
      cashSalesRows,
      collRows,
      cashExpRows,
      cashPurRows,
      dueRows,
    ] = await Promise.all([
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
      dbQuery<{ items_sold: number; cogs: number }>(
        `SELECT 
          COALESCE(SUM(si.quantity), 0) as items_sold,
          COALESCE(SUM(si.cost_price_bdt * si.quantity), 0) as cogs
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.status = 'completed'
          AND s.created_at >= ? AND s.created_at <= ?`,
        [startDateIso, endDateIso]
      ),
      canViewCost
        ? dbQuery<{ total_expenses: number }>(
            `SELECT COALESCE(SUM(amount_bdt), 0) as total_expenses
            FROM expenses
            WHERE deleted_at IS NULL
              AND (CASE WHEN length(expense_date) > 10 THEN date(expense_date, '+6 hours') ELSE substr(expense_date, 1, 10) END) >= ?
              AND (CASE WHEN length(expense_date) > 10 THEN date(expense_date, '+6 hours') ELSE substr(expense_date, 1, 10) END) <= ?`,
            [startYmd, endYmd]
          )
        : Promise.resolve([]),
      dbQuery<{ total_cash: number }>(
        `SELECT COALESCE(SUM(sp.amount_bdt), 0) as total_cash
        FROM sale_payments sp
        JOIN sales s ON sp.sale_id = s.id
        WHERE s.status = 'completed'
          AND LOWER(sp.payment_method) = 'cash'
          AND s.created_at >= ? AND s.created_at <= ?`,
        [startDateIso, endDateIso]
      ),
      dbQuery<{ total_coll: number }>(
        `SELECT COALESCE(SUM(amount_bdt), 0) as total_coll
        FROM customer_payments
        WHERE LOWER(payment_method) = 'cash'
          AND created_at >= ? AND created_at <= ?`,
        [startDateIso, endDateIso]
      ).catch(() => []),
      dbQuery<{ total_cash_exp: number }>(
        `SELECT COALESCE(SUM(amount_bdt), 0) as total_cash_exp
        FROM expenses
        WHERE deleted_at IS NULL
          AND LOWER(payment_method) = 'cash'
          AND (CASE WHEN length(expense_date) > 10 THEN date(expense_date, '+6 hours') ELSE substr(expense_date, 1, 10) END) >= ?
          AND (CASE WHEN length(expense_date) > 10 THEN date(expense_date, '+6 hours') ELSE substr(expense_date, 1, 10) END) <= ?`,
        [startYmd, endYmd]
      ),
      dbQuery<{ total_cash_pur: number }>(
        `SELECT COALESCE(SUM(paid_amount_bdt), 0) as total_cash_pur
        FROM purchases
        WHERE deleted_at IS NULL
          AND status = 'received'
          AND LOWER(payment_method) = 'cash'
          AND received_at >= ? AND received_at <= ?`,
        [startDateIso, endDateIso]
      ).catch(() => []),
      dbQuery<{ total_dues: number }>(
        `SELECT COALESCE(SUM(due_balance_bdt), 0) as total_dues
        FROM customers
        WHERE deleted_at IS NULL AND due_balance_bdt > 0`
      ).catch(() => []),
    ]);

    // 1. Sales, orders, and dues incurred
    const ordersCount = Number(salesRows[0]?.orders_count || 0);
    const grossSalesBdt = Number(salesRows[0]?.gross_sales || 0);
    const discountTotalBdt = Number(salesRows[0]?.discount_total || 0);
    const netRevenueBdt = Number(salesRows[0]?.net_revenue || 0);
    const customerDuesIncurredBdt = Number(salesRows[0]?.dues_incurred || 0);
    const averageOrderValueBdt = ordersCount > 0 ? Math.round((netRevenueBdt / ordersCount) * 100) / 100 : 0;

    // 2. Items sold and COGS (if permitted)
    const itemsSoldCount = Number(cogsRows[0]?.items_sold || 0);
    const cogsBdt = canViewCost ? Math.round(Number(cogsRows[0]?.cogs || 0) * 100) / 100 : 0;
    const grossProfitBdt = canViewCost ? Math.round((netRevenueBdt - cogsBdt) * 100) / 100 : 0;
    const grossMarginPercent =
      canViewCost && netRevenueBdt > 0 ? Math.round((grossProfitBdt / netRevenueBdt) * 1000) / 10 : 0;

    // 3. Operating expenses in this period (if permitted)
    const operatingExpensesBdt =
      canViewCost && expRows[0] ? Math.round(Number(expRows[0].total_expenses || 0) * 100) / 100 : 0;
    const netProfitBdt = canViewCost ? Math.round((grossProfitBdt - operatingExpensesBdt) * 100) / 100 : 0;

    // 4. Physical Cash Drawer movements
    const cashSalesBdt = Math.round(Number(cashSalesRows[0]?.total_cash || 0) * 100) / 100;
    const customerDuesCollectedCashBdt = Math.round(Number(collRows[0]?.total_coll || 0) * 100) / 100;
    const cashExpensesBdt = Math.round(Number(cashExpRows[0]?.total_cash_exp || 0) * 100) / 100;
    const cashPurchasesBdt = Math.round(Number(cashPurRows[0]?.total_cash_pur || 0) * 100) / 100;

    // Estimated counter cash balance added in this period
    const counterCashBalanceBdt =
      Math.round(
        (cashSalesBdt + customerDuesCollectedCashBdt - cashExpensesBdt - cashPurchasesBdt) * 100
      ) / 100;

    // 5. Total outstanding customer credit balance across whole store
    const totalOutstandingCustomerDuesBdt = Math.round(Number(dueRows[0]?.total_dues || 0) * 100) / 100;

    return {
      dateRangeLabel: label,
      startDateIso,
      endDateIso,
      netRevenueBdt,
      grossSalesBdt,
      discountTotalBdt,
      ordersCount,
      itemsSoldCount,
      averageOrderValueBdt,
      grossProfitBdt,
      grossMarginPercent,
      operatingExpensesBdt,
      netProfitBdt,
      counterCashBalanceBdt,
      cashSalesBdt,
      cashExpensesBdt,
      customerDuesCollectedCashBdt,
      customerDuesIncurredBdt,
      totalOutstandingCustomerDuesBdt,
    };
  },

  /**
   * Retrieves low stock inventory items below min_alert_quantity
   */
  async getLowStockAlerts(limit: number = 10): Promise<LowStockItem[]> {
    const rows = await dbQuery<{
      id: string;
      sku: string;
      name: string;
      category_name: string | null;
      current_quantity: number;
      min_alert_quantity: number;
      unit_code: string;
    }>(
      `SELECT s.id, s.sku, s.name, s.current_quantity, s.min_alert_quantity,
              c.name as category_name, COALESCE(u.code, 'pcs') as unit_code
      FROM stock_items s
      LEFT JOIN categories c ON s.category_id = c.id
      LEFT JOIN units u ON s.unit_id = u.id
      WHERE s.deleted_at IS NULL 
        AND s.current_quantity <= s.min_alert_quantity
      ORDER BY (s.current_quantity - s.min_alert_quantity) ASC
      LIMIT ?`,
      [limit]
    );

    return rows.map((r) => ({
      id: String(r.id),
      sku: String(r.sku),
      name: String(r.name),
      categoryName: r.category_name ? String(r.category_name) : null,
      currentQuantity: Number(r.current_quantity || 0),
      minAlertQuantity: Number(r.min_alert_quantity || 0),
      unitCode: String(r.unit_code),
    }));
  },

  /**
   * Retrieves top selling products for period
   */
  async getTopSelling(
    startDateIso: string,
    endDateIso: string,
    limit: number = 6
  ): Promise<TopSellingItem[]> {
    const rows = await dbQuery<{
      sku: string;
      product_name: string;
      sellable_type: string;
      total_qty: number;
      total_revenue: number;
    }>(
      `SELECT si.sku, si.product_name, si.sellable_type,
              COALESCE(SUM(si.quantity), 0) as total_qty,
              COALESCE(SUM(si.line_total_bdt), 0) as total_revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed'
        AND s.created_at >= ? AND s.created_at <= ?
      GROUP BY si.sellable_id, si.product_name
      ORDER BY total_revenue DESC
      LIMIT ?`,
      [startDateIso, endDateIso, limit]
    );

    return rows.map((r) => ({
      sku: String(r.sku),
      productName: String(r.product_name),
      sellableType: String(r.sellable_type || 'standard'),
      totalQty: Number(r.total_qty || 0),
      totalRevenueBdt: Math.round(Number(r.total_revenue || 0) * 100) / 100,
    }));
  },

  /**
   * Retrieves recent sales activity stream
   */
  async getRecentSales(limit: number = 8): Promise<RecentSaleActivity[]> {
    const rows = await dbQuery<{
      id: string;
      invoice_number: string;
      customer_name: string | null;
      customer_phone: string | null;
      cashier_name: string | null;
      total_amount_bdt: number;
      payment_method: string;
      item_count: number;
      created_at: string;
    }>(
      `SELECT s.id, s.invoice_number, s.customer_name, s.customer_phone,
              s.total_amount_bdt, s.payment_method, s.created_at,
              COALESCE(u.display_name, 'Cashier') as cashier_name,
              COUNT(si.id) as item_count
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status = 'completed'
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT ?`,
      [limit]
    );

    return rows.map((r) => ({
      id: String(r.id),
      invoiceNumber: String(r.invoice_number),
      customerName: r.customer_name ? String(r.customer_name) : null,
      customerPhone: r.customer_phone ? String(r.customer_phone) : null,
      cashierName: String(r.cashier_name),
      totalAmountBdt: Number(r.total_amount_bdt || 0),
      paymentMethod: String(r.payment_method || 'cash'),
      itemCount: Number(r.item_count || 0),
      createdAt: String(r.created_at),
    }));
  },

  /**
   * Retrieves payment method shares for period
   */
  async getPaymentMethodShares(
    startDateIso: string,
    endDateIso: string
  ): Promise<PaymentMethodShare[]> {
    const rows = await dbQuery<{
      payment_method: string;
      total_amount: number;
      tx_count: number;
    }>(
      `SELECT sp.payment_method,
              COALESCE(SUM(sp.amount_bdt), 0) as total_amount,
              COUNT(sp.id) as tx_count
      FROM sale_payments sp
      JOIN sales s ON sp.sale_id = s.id
      WHERE s.status = 'completed'
        AND s.created_at >= ? AND s.created_at <= ?
      GROUP BY sp.payment_method
      ORDER BY total_amount DESC`,
      [startDateIso, endDateIso]
    );

    const totalAll = rows.reduce((acc, r) => acc + Number(r.total_amount || 0), 0);

    const labels: Record<string, string> = {
      cash: 'Cash in Hand',
      bkash: 'bKash Wallet',
      nagad: 'Nagad Wallet',
      card: 'Card (Visa / MC)',
      bank: 'Bank Transfer',
      split: 'Split Payment',
      due: 'Unpaid Due',
    };

    return rows.map((r) => {
      const amount = Math.round(Number(r.total_amount || 0) * 100) / 100;
      const pct = totalAll > 0 ? Math.round((amount / totalAll) * 1000) / 10 : 0;
      const m = String(r.payment_method).toLowerCase();
      return {
        method: m,
        label: labels[m] || m.toUpperCase(),
        amountBdt: amount,
        count: Number(r.tx_count || 0),
        percentage: pct,
      };
    });
  },
};
