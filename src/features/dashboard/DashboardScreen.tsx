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
  Sparkles,
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
        <RefreshCw className="w-8 h-8 text-brand-gold animate-spin" />
        <p className="text-xs text-neutral-400 font-mono">Loading live shop dashboard…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 select-none">
      {/* Top Welcome & Shift Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-neutral-900 border border-brand-border text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-brand-gold/10 to-transparent pointer-events-none" />

        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-gold/20 text-brand-gold border border-brand-gold/40 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              {currentUser?.roleDisplayName || 'Staff'} Active
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              Terminal: {shopSettings?.shopName || 'Rauhaah Flagship'}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>Welcome, {currentUser?.displayName}!</span>
          </h1>
          <p className="text-xs text-neutral-400">
            Live overview of today’s retail counter, physical cash flow, and stock movements.
          </p>
        </div>

        {/* Timeframe Controls & Refresh */}
        <div className="flex items-center gap-2 relative z-10 flex-wrap">
          <div className="flex items-center bg-brand-surface rounded-xl p-1 border border-brand-border">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeframe === t.id
                    ? 'bg-brand-gold text-black shadow-md'
                    : 'text-neutral-400 hover:text-white'
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
            className="p-2.5 rounded-xl border border-brand-border bg-brand-surface text-neutral-300 hover:text-brand-gold hover:border-brand-gold/50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-brand-gold' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Action Navigation Hub */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => handleNavigate('pos')}
          className="group flex flex-col items-center justify-center p-3.5 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-black font-bold text-xs transition-all shadow-lg shadow-brand-gold/10 hover:shadow-brand-gold/20"
        >
          <ShoppingCart className="w-5 h-5 mb-1.5 group-hover:scale-110 transition-transform" />
          <span>New Sale (POS)</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('price-checker')}
          className="group flex flex-col items-center justify-center p-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700/80 border border-brand-border text-white font-semibold text-xs transition-all hover:border-brand-gold/50"
        >
          <Search className="w-5 h-5 mb-1.5 text-brand-gold group-hover:scale-110 transition-transform" />
          <span>Price Checker</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('purchases')}
          className="group flex flex-col items-center justify-center p-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700/80 border border-brand-border text-white font-semibold text-xs transition-all hover:border-brand-gold/50"
        >
          <ShoppingBag className="w-5 h-5 mb-1.5 text-blue-400 group-hover:scale-110 transition-transform" />
          <span>Stock Intake</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('expenses')}
          className="group flex flex-col items-center justify-center p-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700/80 border border-brand-border text-white font-semibold text-xs transition-all hover:border-brand-gold/50"
        >
          <Wallet className="w-5 h-5 mb-1.5 text-rose-400 group-hover:scale-110 transition-transform" />
          <span>Daily Expense</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('customers')}
          className="group flex flex-col items-center justify-center p-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700/80 border border-brand-border text-white font-semibold text-xs transition-all hover:border-brand-gold/50"
        >
          <Users className="w-5 h-5 mb-1.5 text-emerald-400 group-hover:scale-110 transition-transform" />
          <span>Customer Dues</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('reports')}
          className="group flex flex-col items-center justify-center p-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700/80 border border-brand-border text-white font-semibold text-xs transition-all hover:border-brand-gold/50"
        >
          <FileText className="w-5 h-5 mb-1.5 text-amber-400 group-hover:scale-110 transition-transform" />
          <span>Financial Reports</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Net Sales Revenue */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-brand-border flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Net Sales ({summary?.dateRangeLabel || 'Period'})
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white tracking-tight">
              {formatBdt(summary?.netRevenueBdt || 0)}
            </div>
          </div>
          <div className="pt-4 border-t border-brand-border/60 flex items-center justify-between text-xs text-neutral-400">
            <span>{summary?.ordersCount || 0} Invoices</span>
            <span>Avg: {formatBdt(summary?.averageOrderValueBdt || 0)}</span>
          </div>
        </div>

        {/* 2. Net Operating Profit or Sales Velocity */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-brand-border flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                {hasCostPermission ? `Net Profit (${summary?.dateRangeLabel})` : 'Items Sold & Velocity'}
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-brand-gold">
                {hasCostPermission ? <DollarSign className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              </div>
            </div>
            <div className="text-2xl font-black text-white tracking-tight">
              {hasCostPermission ? (
                formatBdt(summary?.netProfitBdt || 0)
              ) : (
                `${summary?.itemsSoldCount || 0} Units Sold`
              )}
            </div>
          </div>
          <div className="pt-4 border-t border-brand-border/60 flex items-center justify-between text-xs text-neutral-400">
            {hasCostPermission ? (
              <>
                <span className="text-emerald-400 font-semibold">
                  Margin: {summary?.grossMarginPercent || 0}%
                </span>
                <span>Exp: {formatBdt(summary?.operatingExpensesBdt || 0)}</span>
              </>
            ) : (
              <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                <Lock className="w-3 h-3" /> Profit confidential to Admin
              </span>
            )}
          </div>
        </div>

        {/* 3. Physical Cash Drawer Added */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-brand-border flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Counter Cash Added
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white tracking-tight">
              {formatBdt(summary?.counterCashBalanceBdt || 0)}
            </div>
          </div>
          <div className="pt-4 border-t border-brand-border/60 flex items-center justify-between text-xs text-neutral-400">
            <span className="text-emerald-400 flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" />
              In: {formatBdt((summary?.cashSalesBdt || 0) + (summary?.customerDuesCollectedCashBdt || 0))}
            </span>
            <span className="text-rose-400 flex items-center gap-0.5">
              <ArrowDownRight className="w-3.5 h-3.5" />
              Out: {formatBdt(summary?.cashExpensesBdt || 0)}
            </span>
          </div>
        </div>

        {/* 4. Customer Credit / Receivables */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-brand-border flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Customer Dues / Ledger
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-400 tracking-tight">
              {formatBdt(summary?.totalOutstandingCustomerDuesBdt || 0)}
            </div>
          </div>
          <div className="pt-4 border-t border-brand-border/60 flex items-center justify-between text-xs text-neutral-400">
            <span>Period Incurred: {formatBdt(summary?.customerDuesIncurredBdt || 0)}</span>
            <button
              type="button"
              onClick={() => handleNavigate('customers')}
              className="text-brand-gold hover:underline font-semibold"
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
          <div className="p-5 rounded-2xl bg-neutral-900 border border-brand-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    lowStockItems.length > 0
                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                      : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {lowStockItems.length > 0 ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Inventory Health & Stock Alerts</h3>
                  <p className="text-[11px] text-neutral-400">
                    {lowStockItems.length > 0
                      ? `${lowStockItems.length} items have fallen below their safety threshold`
                      : 'All products currently have adequate stock on hand'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleNavigate('stock')}
                className="text-xs text-brand-gold hover:underline font-semibold flex items-center gap-1"
              >
                <span>View Inventory</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {lowStockItems.length > 0 ? (
              <div className="divide-y divide-brand-border/40">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-white">{item.name}</div>
                      <div className="text-[11px] text-neutral-400">
                        SKU: <span className="font-mono">{item.sku}</span> · {item.categoryName || 'General'}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold text-rose-400">
                          {item.currentQuantity} {item.unitCode}
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          Min Alert: {item.minAlertQuantity} {item.unitCode}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleNavigate('purchases')}
                        className="px-2.5 py-1 rounded-md bg-brand-surface hover:bg-neutral-800 border border-brand-border text-brand-gold font-semibold text-[11px] transition-colors"
                      >
                        + Restock
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold text-emerald-400">
                  All 55 catalog products are safely above minimum stock levels!
                </div>
                <p className="text-[11px] text-neutral-500 max-w-sm">
                  Stock deductions are tracked live at checkout and decant intake.
                </p>
              </div>
            )}
          </div>

          {/* Payment Method Shares */}
          <div className="p-5 rounded-2xl bg-neutral-900 border border-brand-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand-gold" />
                <span>Payment Method Breakdown ({summary?.dateRangeLabel})</span>
              </h3>
              <span className="text-xs text-neutral-400">
                Total: {formatBdt(summary?.netRevenueBdt || 0)}
              </span>
            </div>

            {paymentShares.length > 0 ? (
              <div className="space-y-3">
                {paymentShares.map((p) => (
                  <div key={p.method} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-300">{p.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400 font-mono">
                          {p.count} bills ({p.percentage}%)
                        </span>
                        <span className="font-bold text-white">{formatBdt(p.amountBdt)}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          p.method === 'cash'
                            ? 'bg-blue-400'
                            : p.method === 'bkash'
                            ? 'bg-pink-500'
                            : p.method === 'nagad'
                            ? 'bg-orange-500'
                            : p.method === 'card'
                            ? 'bg-emerald-400'
                            : 'bg-brand-gold'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(2, p.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-500">
                No payment transactions recorded in {summary?.dateRangeLabel.toLowerCase()}.
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Top Selling Fragrances */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-neutral-900 border border-brand-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-gold" />
                <span>Top Fragrances & Products</span>
              </h3>
              <span className="text-xs text-neutral-400">{summary?.dateRangeLabel}</span>
            </div>

            {topSelling.length > 0 ? (
              <div className="space-y-3">
                {topSelling.map((prod, idx) => (
                  <div
                    key={`${prod.sku}-${idx}`}
                    className="p-3 rounded-xl bg-neutral-800/60 border border-brand-border/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                          idx === 0
                            ? 'bg-brand-gold text-black'
                            : idx === 1
                            ? 'bg-neutral-300 text-black'
                            : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-neutral-700 text-neutral-300'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-white truncate max-w-[150px]">
                          {prod.productName}
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          {prod.totalQty} units sold · {prod.sellableType.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                    <div className="font-bold text-brand-gold text-right">
                      {formatBdt(prod.totalRevenueBdt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-neutral-500">
                No sales recorded in this period yet.
              </div>
            )}
          </div>

          {/* Quick Counter Shortcut Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-brand-gold/15 to-transparent border border-brand-gold/30 space-y-3 text-white">
            <div className="flex items-center gap-2 text-brand-gold font-bold text-sm">
              <Search className="w-4 h-4" />
              <span>Customer Asking Prices?</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Use the fast <strong>Quick Price Checker</strong> to scan bottles, check tola conversions, wholesale margins, and available stock without touching an active cart.
            </p>
            <button
              type="button"
              onClick={() => handleNavigate('price-checker')}
              className="w-full py-2.5 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-black font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              <span>Launch Quick Price Checker</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Counter Activity Stream */}
      <div className="p-5 rounded-2xl bg-neutral-900 border border-brand-border space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-brand-border">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-gold" />
            <h3 className="text-sm font-bold text-white">Recent Counter Sales Stream</h3>
          </div>
          <button
            type="button"
            onClick={() => handleNavigate('sales')}
            className="text-xs text-brand-gold hover:underline font-semibold flex items-center gap-1"
          >
            <span>View All Sales & Invoices</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-brand-border text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Cashier</th>
                <th className="py-2.5 px-3">Items</th>
                <th className="py-2.5 px-3">Payment</th>
                <th className="py-2.5 px-3 text-right">Total (৳)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/40">
              {recentSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-neutral-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-brand-gold">
                    {sale.invoiceNumber}
                  </td>
                  <td className="py-2.5 px-3 text-white font-medium">
                    {sale.customerName || (
                      <span className="text-neutral-500 italic">Walk-in Customer</span>
                    )}
                    {sale.customerPhone && (
                      <div className="text-[10px] text-neutral-500 font-mono">
                        {sale.customerPhone}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-400">
                    {formatDhakaDateTime(sale.createdAt)}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-300">{sale.cashierName}</td>
                  <td className="py-2.5 px-3 text-neutral-400">{sale.itemCount} items</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        sale.paymentMethod === 'cash'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : sale.paymentMethod === 'bkash'
                          ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                          : sale.paymentMethod === 'nagad'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : sale.paymentMethod === 'due'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {sale.paymentMethod}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-white font-mono">
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
