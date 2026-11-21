import React, { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Users,
  Search,
  FileText,
  Clock,
  Award,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  Lock,
  ChevronRight,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { useAppStore, type NavRoute } from '@/app/store';
import { dashboardRepo } from '@/data/repositories/dashboardRepo';
import { canViewCost } from '@/domain/auth/permissions';
import type {
  DashboardSummary,
  LowStockItem,
  PaymentMethodShare,
  RecentSaleActivity,
  TopSellingItem,
} from '@/domain/dashboard/types';
import { formatBdt } from '@/features/reports/reportsUtils';
import { calculateDateRange, formatDhakaDateTime } from '@/lib/dates';

interface DashboardScreenProps {
  deviceId: string;
}

type TimeframePreset = 'today' | 'yesterday' | 'week' | 'month' | 'all';

export const DashboardScreen: React.FC<DashboardScreenProps> = () => {
  const { currentUser, permissions, setActiveRoute, shopSettings } = useAppStore();
  const hasCostPermission = canViewCost(permissions);

  const [timeframe, setTimeframe] = useState<TimeframePreset>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [topSelling, setTopSelling] = useState<TopSellingItem[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSaleActivity[]>([]);
  const [paymentShares, setPaymentShares] = useState<PaymentMethodShare[]>([]);

  const loadDashboardData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const bounds = calculateDateRange(timeframe === 'week' ? '7days' : timeframe);
        const { startDateIso: start, endDateIso: end, label } = bounds;

        const [sum, lowStock, top, recent, shares] = await Promise.all([
          dashboardRepo.getSummary(start, end, label, hasCostPermission),
          dashboardRepo.getLowStockAlerts(8),
          dashboardRepo.getTopSelling(start, end, 6),
          dashboardRepo.getRecentSales(8),
          dashboardRepo.getPaymentMethodShares(start, end),
        ]);

        setSummary(sum);
        setLowStockItems(lowStock);
        setTopSelling(top);
        setRecentSales(recent);
        setPaymentShares(shares);
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [timeframe, hasCostPermission]
  );

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleNavigate = (route: NavRoute) => {
    setActiveRoute(route);
  };

  if (loading && !summary) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-6 h-6 text-accent-ink animate-spin" strokeWidth={1.5} />
        <p className="text-xs text-ink-muted font-mono">Loading shop dashboard…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 select-none">
      {/* Top Counter Context & Period Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-surface border border-hairline text-ink">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-accent/12 text-accent-ink border border-accent/25">
              <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
              {currentUser?.roleDisplayName || 'Staff'} active
            </span>
            <span className="text-xs text-ink-muted font-mono">
              Terminal: {shopSettings?.shopName || 'Rauhaah Flagship'} · {currentUser?.displayName}
            </span>
          </div>
          <h1 className="text-2xl font-medium text-ink">
            Counter overview — {summary?.dateRangeLabel || 'Today'}
          </h1>
          <p className="text-xs text-ink-secondary">
            Retail counter sales, physical cash flow, and inventory levels
          </p>
        </div>

        {/* Timeframe Controls & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-raised rounded-lg p-1 border border-hairline">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'week', label: 'Last 7 Days' },
                { id: 'month', label: 'This Month' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeframe(t.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 ease-unslop ${
                  timeframe === t.id
                    ? 'bg-accent text-accent-fg font-semibold'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            title="Refresh Live Data"
            className="p-2 rounded-lg border border-hairline bg-raised text-ink-secondary hover:text-ink hover:border-hairline-strong transition-colors duration-150 ease-unslop"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-accent-ink' : ''}`} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Quick Action Navigation Hub */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => handleNavigate('pos')}
          className="flex flex-col items-center justify-center p-4 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs transition-colors duration-150 ease-unslop"
        >
          <ShoppingCart className="w-4 h-4 mb-2" strokeWidth={1.75} />
          <span>New Sale (POS)</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('price-checker')}
          className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface hover:bg-raised border border-hairline hover:border-hairline-strong text-ink font-medium text-xs transition-colors duration-150 ease-unslop"
        >
          <Search className="w-4 h-4 mb-2 text-accent-ink" strokeWidth={1.5} />
          <span>Price Checker</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('purchases')}
          className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface hover:bg-raised border border-hairline hover:border-hairline-strong text-ink font-medium text-xs transition-colors duration-150 ease-unslop"
        >
          <ShoppingBag className="w-4 h-4 mb-2 text-ink-muted" strokeWidth={1.5} />
          <span>Stock Intake</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('expenses')}
          className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface hover:bg-raised border border-hairline hover:border-hairline-strong text-ink font-medium text-xs transition-colors duration-150 ease-unslop"
        >
          <Wallet className="w-4 h-4 mb-2 text-ink-muted" strokeWidth={1.5} />
          <span>Daily Expense</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('customers')}
          className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface hover:bg-raised border border-hairline hover:border-hairline-strong text-ink font-medium text-xs transition-colors duration-150 ease-unslop"
        >
          <Users className="w-4 h-4 mb-2 text-ink-muted" strokeWidth={1.5} />
          <span>Customer Dues</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('reports')}
          className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface hover:bg-raised border border-hairline hover:border-hairline-strong text-ink font-medium text-xs transition-colors duration-150 ease-unslop"
        >
          <FileText className="w-4 h-4 mb-2 text-ink-muted" strokeWidth={1.5} />
          <span>Financial Reports</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Net Sales Revenue */}
        <div className="p-5 rounded-xl bg-surface border border-hairline flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-muted">
                Net sales ({summary?.dateRangeLabel || 'Period'})
              </span>
              <TrendingUp className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
            </div>
            <div className="text-2xl font-medium text-ink font-mono tabular-nums">
              {formatBdt(summary?.netRevenueBdt || 0)}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-hairline flex items-center justify-between text-xs text-ink-muted tabular-nums">
            <span>{summary?.ordersCount || 0} invoices</span>
            <span>Avg {formatBdt(summary?.averageOrderValueBdt || 0)}</span>
          </div>
        </div>

        {/* 2. Net Operating Profit or Sales Velocity */}
        <div className="p-5 rounded-xl bg-surface border border-hairline flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-muted">
                {hasCostPermission ? `Net profit (${summary?.dateRangeLabel})` : 'Items sold'}
              </span>
              {hasCostPermission ? (
                <DollarSign className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
              ) : (
                <Package className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
              )}
            </div>
            <div className="text-2xl font-medium text-ink font-mono tabular-nums">
              {hasCostPermission ? (
                formatBdt(summary?.netProfitBdt || 0)
              ) : (
                `${summary?.itemsSoldCount || 0} units`
              )}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-hairline flex items-center justify-between text-xs text-ink-muted tabular-nums">
            {hasCostPermission ? (
              <>
                <span className="text-positive font-medium">
                  Margin {summary?.grossMarginPercent || 0}%
                </span>
                <span>Exp {formatBdt(summary?.operatingExpensesBdt || 0)}</span>
              </>
            ) : (
              <span className="text-ink-muted flex items-center gap-1.5 text-xs">
                <Lock className="w-3.5 h-3.5" strokeWidth={1.5} /> Profit restricted to Admin
              </span>
            )}
          </div>
        </div>

        {/* 3. Physical Cash Drawer Added */}
        <div className="p-5 rounded-xl bg-surface border border-hairline flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-muted">
                Counter cash added
              </span>
              <Wallet className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
            </div>
            <div className="text-2xl font-medium text-ink font-mono tabular-nums">
              {formatBdt(summary?.counterCashBalanceBdt || 0)}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-hairline flex items-center justify-between text-xs tabular-nums">
            <span className="text-positive flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              In {formatBdt((summary?.cashSalesBdt || 0) + (summary?.customerDuesCollectedCashBdt || 0))}
            </span>
            <span className="text-negative flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              Out {formatBdt(summary?.cashExpensesBdt || 0)}
            </span>
          </div>
        </div>

        {/* 4. Customer Credit / Receivables */}
        <div className="p-5 rounded-xl bg-surface border border-hairline flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-muted">
                Customer dues ledger
              </span>
              <Users className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
            </div>
            <div className="text-2xl font-medium text-negative font-mono tabular-nums">
              {formatBdt(summary?.totalOutstandingCustomerDuesBdt || 0)}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-hairline flex items-center justify-between text-xs text-ink-muted tabular-nums">
            <span>Period {formatBdt(summary?.customerDuesIncurredBdt || 0)}</span>
            <button
              type="button"
              onClick={() => handleNavigate('customers')}
              className="text-accent-ink hover:underline font-medium"
            >
              Collect →
            </button>
          </div>
        </div>
      </div>

      {/* Middle Section: Inventory Alerts & Top Selling */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Low Stock Alerts + Payment Methods */}
        <div className="lg:col-span-2 space-y-6">
          {/* Inventory Low Stock Alert Widget */}
          <div className="p-5 rounded-xl bg-surface border border-hairline space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                    lowStockItems.length > 0
                      ? 'bg-warning/10 border-warning/25 text-warning'
                      : 'bg-positive/10 border-positive/25 text-positive'
                  }`}
                >
                  {lowStockItems.length > 0 ? (
                    <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-ink">Inventory health and stock alerts</h3>
                  <p className="text-xs text-ink-muted">
                    {lowStockItems.length > 0
                      ? `${lowStockItems.length} items below safety threshold`
                      : 'All products currently have adequate stock on hand'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleNavigate('stock')}
                className="text-xs text-accent-ink hover:underline font-medium flex items-center gap-1"
              >
                <span>View inventory</span>
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>

            {lowStockItems.length > 0 ? (
              <div className="divide-y divide-hairline">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-ink">{item.name}</div>
                      <div className="text-xs text-ink-muted">
                        SKU <span className="font-mono">{item.sku}</span> · {item.categoryName || 'General'}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right tabular-nums">
                        <div className="font-medium text-negative">
                          {item.currentQuantity} {item.unitCode}
                        </div>
                        <div className="text-[11px] text-ink-muted">
                          Min {item.minAlertQuantity} {item.unitCode}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleNavigate('purchases')}
                        className="px-2.5 py-1.5 rounded-lg bg-raised hover:border-hairline-strong border border-hairline text-accent-ink font-medium text-xs transition-colors duration-150 ease-unslop"
                      >
                        + Restock
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-9 h-9 rounded-lg bg-positive/10 border border-positive/25 flex items-center justify-center text-positive">
                  <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div className="text-xs font-medium text-positive">
                  All catalog products are safely above minimum stock levels
                </div>
                <p className="text-xs text-ink-muted max-w-sm">
                  Stock deductions update live at checkout and decant intake
                </p>
              </div>
            )}
          </div>

          {/* Payment Method Shares */}
          <div className="p-5 rounded-xl bg-surface border border-hairline space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <h3 className="text-sm font-medium text-ink flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                <span>Payment method breakdown ({summary?.dateRangeLabel})</span>
              </h3>
              <span className="text-xs text-ink-muted font-mono tabular-nums">
                Total {formatBdt(summary?.netRevenueBdt || 0)}
              </span>
            </div>

            {paymentShares.length > 0 ? (
              <div className="space-y-3">
                {paymentShares.map((p, idx) => (
                  <div key={p.method} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-secondary">{p.label}</span>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="text-ink-muted font-mono">
                          {p.count} bills ({p.percentage}%)
                        </span>
                        <span className="font-medium text-ink font-mono">{formatBdt(p.amountBdt)}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-raised overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ease-unslop ${
                          idx === 0
                            ? 'bg-accent'
                            : p.method === 'due'
                            ? 'bg-negative/75'
                            : idx === 1
                            ? 'bg-ink/55'
                            : idx === 2
                            ? 'bg-ink/40'
                            : 'bg-ink/25'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(2, p.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-ink-muted">
                No payment transactions recorded in {summary?.dateRangeLabel.toLowerCase()}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Top Selling Fragrances */}
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-surface border border-hairline space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <h3 className="text-sm font-medium text-ink flex items-center gap-2">
                <Award className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
                <span>Top fragrances and products</span>
              </h3>
              <span className="text-xs text-ink-muted">{summary?.dateRangeLabel}</span>
            </div>

            {topSelling.length > 0 ? (
              <div className="space-y-2">
                {topSelling.map((prod, idx) => (
                  <div
                    key={`${prod.sku}-${idx}`}
                    className="p-3 rounded-lg bg-raised/60 border border-hairline flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center font-mono font-medium text-xs shrink-0 ${
                          idx === 0
                            ? 'bg-accent text-accent-fg'
                            : 'bg-raised border border-hairline text-ink-secondary'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-ink truncate max-w-[150px]">
                          {prod.productName}
                        </div>
                        <div className="text-[11px] text-ink-muted tabular-nums">
                          {prod.totalQty} sold · {prod.sellableType.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                    <div className="font-medium font-mono tabular-nums text-accent-ink text-right shrink-0">
                      {formatBdt(prod.totalRevenueBdt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-ink-muted">
                No sales recorded in this period
              </div>
            )}
          </div>

          {/* Quick Counter Shortcut Card */}
          <div className="p-5 rounded-xl bg-surface border border-hairline space-y-3">
            <div className="flex items-center gap-2 text-ink font-medium text-sm">
              <Search className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
              <span>Quick price lookup</span>
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Use the Quick Price Checker to scan bottles, check tola conversions, wholesale margins, and available stock without touching an active cart.
            </p>
            <button
              type="button"
              onClick={() => handleNavigate('price-checker')}
              className="w-full py-2.5 px-3 rounded-lg bg-raised hover:border-hairline-strong border border-hairline text-ink font-medium text-xs transition-colors duration-150 ease-unslop flex items-center justify-center gap-2"
            >
              <span>Open Price Checker</span>
              <ChevronRight className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Counter Activity Stream */}
      <div className="p-5 rounded-xl bg-surface border border-hairline space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
            <h3 className="text-sm font-medium text-ink">Recent counter sales</h3>
          </div>
          <button
            type="button"
            onClick={() => handleNavigate('sales')}
            className="text-xs text-accent-ink hover:underline font-medium flex items-center gap-1"
          >
            <span>View all sales</span>
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-hairline text-ink-muted font-medium">
                <th className="py-2.5 px-3">Invoice</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Date & time</th>
                <th className="py-2.5 px-3">Cashier</th>
                <th className="py-2.5 px-3">Items</th>
                <th className="py-2.5 px-3">Payment</th>
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {recentSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-raised/50 transition-colors duration-150 ease-unslop">
                  <td className="py-2.5 px-3 font-mono font-medium text-accent-ink tabular-nums">
                    {sale.invoiceNumber}
                  </td>
                  <td className="py-2.5 px-3 text-ink font-medium">
                    {sale.customerName || (
                      <span className="text-ink-muted font-normal">Walk-in customer</span>
                    )}
                    {sale.customerPhone && (
                      <div className="text-[11px] text-ink-muted font-mono tabular-nums">
                        {sale.customerPhone}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-ink-secondary tabular-nums">
                    {formatDhakaDateTime(sale.createdAt)}
                  </td>
                  <td className="py-2.5 px-3 text-ink-secondary">{sale.cashierName}</td>
                  <td className="py-2.5 px-3 text-ink-muted tabular-nums">{sale.itemCount} items</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium capitalize border ${
                        sale.paymentMethod === 'due'
                          ? 'bg-negative/10 text-negative border-negative/25'
                          : 'bg-raised text-ink-secondary border-hairline'
                      }`}
                    >
                      {sale.paymentMethod}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-ink font-mono tabular-nums">
                    {formatBdt(sale.totalAmountBdt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
