import { useAppStore } from '@/app/store';
import type {
  CashFlowSummary,
  CashierPerformance,
  CategorySalesBreakdown,
  DailyTrendPoint,
  DateRangeFilter,
  DateRangePreset,
  ExpenseCategoryBreakdown,
  InventoryValuationSummary,
  PaymentMethodBreakdown,
  PnLSummary,
  TopSellingProduct,
} from '@/domain/reports/types';
import { canViewCost, canViewProfit } from '@/domain/auth/permissions';
import { reportsRepo } from '@/data/repositories/reportsRepo';
import { cn } from '@/lib/utils';
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  DollarSign,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Layers,
  Lock,
  Printer,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { downloadCsv, formatBdt, formatQty, getDateRangeForPreset } from './reportsUtils';
import { PrintableReport } from './PrintableReport';
import { PrintPreviewModal } from './PrintPreviewModal';

interface ReportsScreenProps {
  deviceId: string;
}

type ReportTab = 'pnl' | 'products' | 'payments' | 'staff' | 'inventory';

export function ReportsScreen({ deviceId: _deviceId }: ReportsScreenProps) {
  const { permissions, currentUser, shopSettings, showToast } = useAppStore();
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const allowCost = canViewCost(permissions);
  const allowProfit = canViewProfit(permissions);

  // Date range state
  const [activePreset, setActivePreset] = useState<DateRangePreset>('this_month');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [currentFilter, setCurrentFilter] = useState<DateRangeFilter>(() =>
    getDateRangeForPreset('this_month')
  );

  // Active view tab
  const [activeTab, setActiveTab] = useState<ReportTab>('pnl');

  // Loading and error states
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [pnl, setPnl] = useState<PnLSummary | null>(null);
  const [dailyTrends, setDailyTrends] = useState<DailyTrendPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopSellingProduct[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySalesBreakdown[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodBreakdown[]>([]);
  const [cashierStats, setCashierStats] = useState<CashierPerformance[]>([]);
  const [expenseCats, setExpenseCats] = useState<ExpenseCategoryBreakdown[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null);
  const [inventoryVal, setInventoryVal] = useState<InventoryValuationSummary | null>(null);

  // Sorting state for Best-Selling Fragrances & Products
  type ProductSortField = 'units' | 'revenue' | 'cogs' | 'profit' | 'margin' | 'name';
  const [productSortField, setProductSortField] = useState<ProductSortField>('revenue');
  const [productSortOrder, setProductSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleProductSort = (field: ProductSortField) => {
    if (productSortField === field) {
      setProductSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setProductSortField(field);
      setProductSortOrder('desc'); // Default to highest on first click
    }
  };

  const sortedTopProducts = useMemo(() => {
    const list = [...topProducts];
    list.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;
      switch (productSortField) {
        case 'units':
          valA = a.quantitySold;
          valB = b.quantitySold;
          break;
        case 'revenue':
          valA = a.revenueBdt;
          valB = b.revenueBdt;
          break;
        case 'cogs':
          valA = a.cogsBdt;
          valB = b.cogsBdt;
          break;
        case 'profit':
          valA = a.grossProfitBdt;
          valB = b.grossProfitBdt;
          break;
        case 'margin':
          valA = a.marginPercent;
          valB = b.marginPercent;
          break;
        case 'name':
          return productSortOrder === 'asc'
            ? a.productName.localeCompare(b.productName)
            : b.productName.localeCompare(a.productName);
      }
      return productSortOrder === 'asc'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    });
    return list;
  }, [topProducts, productSortField, productSortOrder]);

  // Update date filter when preset or custom dates change
  const handlePresetChange = (preset: DateRangePreset) => {
    setActivePreset(preset);
    const filter = getDateRangeForPreset(preset, customStart, customEnd);
    setCurrentFilter(filter);
  };

  const handleApplyCustomDate = () => {
    if (!customStart || !customEnd) return;
    setActivePreset('custom');
    const filter = getDateRangeForPreset('custom', customStart, customEnd);
    setCurrentFilter(filter);
  };

  // Load report data
  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        pnlData,
        trendsData,
        productsData,
        categoriesData,
        paymentsData,
        staffData,
        expensesData,
        cashFlowData,
        inventoryData,
      ] = await Promise.all([
        reportsRepo.getPnLSummary(currentFilter.startDateIso, currentFilter.endDateIso),
        reportsRepo.getDailyTrends(currentFilter.startDateIso, currentFilter.endDateIso),
        reportsRepo.getTopSellingProducts(currentFilter.startDateIso, currentFilter.endDateIso, 20),
        reportsRepo.getCategorySales(currentFilter.startDateIso, currentFilter.endDateIso),
        reportsRepo.getPaymentMethodBreakdown(currentFilter.startDateIso, currentFilter.endDateIso),
        reportsRepo.getCashierPerformance(currentFilter.startDateIso, currentFilter.endDateIso),
        reportsRepo.getExpenseBreakdown(currentFilter.startDateIso, currentFilter.endDateIso),
        reportsRepo.getCashFlowSummary(currentFilter.startDateIso, currentFilter.endDateIso),
        reportsRepo.getInventoryValuation(),
      ]);

      setPnl(pnlData);
      setDailyTrends(trendsData);
      setTopProducts(productsData);
      setCategorySales(categoriesData);
      setPaymentMethods(paymentsData);
      setCashierStats(staffData);
      setExpenseCats(expensesData);
      setCashFlow(cashFlowData);
      setInventoryVal(inventoryData);
    } catch (err: unknown) {
      console.error('Failed to load reports:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFilter]);

  // CSV Export Handlers
  const handleExportPnL = async () => {
    if (!pnl) return;
    const headers = ['Financial Metric', 'Amount (BDT)', 'Notes'];
    const rows: (string | number)[][] = [
      ['Date Range', currentFilter.label, ''],
      ['Gross Sales Revenue (Subtotal)', pnl.grossSalesBdt, 'Before cart discounts'],
      ['Total Discounts Surrendered', pnl.discountTotalBdt, 'Promotional / manual discounts'],
      ['Net Sales Revenue', pnl.netRevenueBdt, 'Actual sales billed'],
      ['Cost of Goods Sold (COGS)', allowCost ? pnl.cogsBdt : 'Hidden', 'Inventory weighted cost'],
      [
        'Gross Profit',
        allowProfit ? pnl.grossProfitBdt : 'Hidden',
        `Gross Margin: ${pnl.grossMarginPercent}%`,
      ],
      ['Operating Expenses', pnl.operatingExpensesBdt, 'Shop overheads, utilities, tea'],
      [
        'Net Profit',
        allowProfit ? pnl.netProfitBdt : 'Hidden',
        `Net Margin: ${pnl.netMarginPercent}%`,
      ],
      ['Total Orders Count', pnl.ordersCount, 'Completed transactions'],
      ['Total Units Sold', pnl.itemsSoldCount, 'Bottles, tolas, items'],
      ['Average Order Value (AOV)', pnl.averageOrderValueBdt, 'Per transaction'],
      ['Customer Dues Incurred', pnl.customerDuesIncurredBdt, 'Unpaid customer balance'],
      ['Customer Dues Collected', pnl.customerDuesCollectedBdt, 'Due recoveries during period'],
    ];

    const filename = `rauhaah_pnl_${activePreset}_${new Date().toISOString().slice(0, 10)}`;
    const res = await downloadCsv(filename, headers, rows);
    if (res.success) {
      showToast({
        message: 'Profit & Loss Statement exported successfully! Check your Downloads folder.',
        filePath: res.path,
        type: 'success',
      });
    }
  };

  const handleExportTopProducts = async () => {
    const headers = [
      'Rank',
      'Product Name',
      'SKU',
      'Type',
      'Qty Sold',
      'Unit',
      'Revenue (BDT)',
      'COGS (BDT)',
      'Gross Profit (BDT)',
      'Gross Margin %',
    ];
    const rows = sortedTopProducts.map((p, idx) => [
      idx + 1,
      p.productName,
      p.sku,
      p.sellableType,
      p.quantitySold,
      p.unitCode,
      p.revenueBdt,
      allowCost ? p.cogsBdt : 'Hidden',
      allowProfit ? p.grossProfitBdt : 'Hidden',
      allowProfit ? `${p.marginPercent}%` : 'Hidden',
    ]);
    const filename = `rauhaah_top_products_${activePreset}_${new Date().toISOString().slice(0, 10)}`;
    const res = await downloadCsv(filename, headers, rows);
    if (res.success) {
      showToast({
        message: 'Best-Selling Products report exported successfully! Check your Downloads folder.',
        filePath: res.path,
        type: 'success',
      });
    }
  };

  const handleExportSalesLedger = async () => {
    try {
      const salesRows = await reportsRepo.getSalesExportRows(
        currentFilter.startDateIso,
        currentFilter.endDateIso
      );
      const headers = [
        'Invoice #',
        'Customer Name',
        'Customer Phone',
        'Cashier',
        'Subtotal (BDT)',
        'Discount (BDT)',
        'Total (BDT)',
        'Paid (BDT)',
        'Due (BDT)',
        'Payment Method',
        'Status',
        'Date & Time',
      ];
      const rows = salesRows.map((s) => [
        s.invoice_number,
        s.customer_name || 'Walk-in Customer',
        s.customer_phone || '-',
        s.cashier_username || 'Staff',
        s.subtotal_bdt,
        s.discount_amount_bdt,
        s.total_amount_bdt,
        s.paid_amount_bdt,
        s.due_amount_bdt,
        s.payment_method,
        s.status,
        new Date(s.created_at).toLocaleString(),
      ]);
      const filename = `rauhaah_sales_ledger_${activePreset}_${new Date().toISOString().slice(0, 10)}`;
      const res = await downloadCsv(filename, headers, rows);
      if (res.success) {
        showToast({
          message: 'Sales Ledger exported successfully! Check your Downloads folder.',
          filePath: res.path,
          type: 'success',
        });
      }
    } catch (e) {
      console.error('Failed to export sales:', e);
    }
  };

  const handleExportExpenses = async () => {
    try {
      const expRows = await reportsRepo.getExpensesExportRows(
        currentFilter.startDateIso,
        currentFilter.endDateIso
      );
      const headers = [
        'Title',
        'Category',
        'Amount (BDT)',
        'Payment Method',
        'Reference #',
        'Expense Date',
        'Logged By',
        'Notes',
      ];
      const rows = expRows.map((e) => [
        e.title,
        e.category_name,
        e.amount_bdt,
        e.payment_method,
        e.reference_number || '-',
        new Date(e.expense_date).toLocaleDateString(),
        e.created_by_username || 'Staff',
        e.notes || '',
      ]);
      const filename = `rauhaah_expenses_${activePreset}_${new Date().toISOString().slice(0, 10)}`;
      const res = await downloadCsv(filename, headers, rows);
      if (res.success) {
        showToast({
          message: 'Expenses report exported successfully! Check your Downloads folder.',
          filePath: res.path,
          type: 'success',
        });
      }
    } catch (e) {
      console.error('Failed to export expenses:', e);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 select-none">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 dark:border-brand-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand-gold" />
              <span>Financial & Sales Reports</span>
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-gold/15 text-brand-gold border border-brand-gold/30">
              {currentFilter.label}
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Real-time P&L analysis, sales volume, operational margins, and live inventory valuation.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadReports}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-brand-border text-xs font-medium hover:bg-neutral-100 dark:hover:bg-brand-surface text-neutral-700 dark:text-neutral-300 transition-colors"
            title="Refresh Report Data"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin text-brand-gold')} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-brand-border text-xs font-semibold hover:border-brand-gold/60 bg-neutral-50 dark:bg-brand-surface text-neutral-800 dark:text-neutral-200 transition-colors shadow-sm"
            title="Open printable document preview or save as PDF"
          >
            <Printer className="w-3.5 h-3.5 text-brand-gold" />
            <span>Print View</span>
          </button>

          {/* Quick Export Dropdown Group */}
          <div className="flex items-center gap-1 border border-neutral-200 dark:border-brand-border rounded-lg p-0.5 bg-neutral-50 dark:bg-brand-surface">
            <button
              type="button"
              onClick={handleExportPnL}
              className="px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1"
              title="Export P&L Summary as CSV"
            >
              <Download className="w-3 h-3 text-brand-gold" />
              <span>P&L CSV</span>
            </button>
            <div className="h-4 w-[1px] bg-neutral-200 dark:bg-brand-border" />
            <button
              type="button"
              onClick={handleExportTopProducts}
              className="px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1"
              title="Export Top Products as CSV"
            >
              <Download className="w-3 h-3 text-brand-gold" />
              <span>Products CSV</span>
            </button>
            <div className="h-4 w-[1px] bg-neutral-200 dark:bg-brand-border" />
            <button
              type="button"
              onClick={handleExportSalesLedger}
              className="px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1"
              title="Export Full Sales Invoices Ledger as CSV"
            >
              <Download className="w-3 h-3 text-brand-gold" />
              <span>Sales CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-neutral-200 dark:border-brand-border bg-neutral-50 dark:bg-brand-surface/60">
        <div className="flex flex-wrap items-center gap-1.5">
          <Calendar className="w-4 h-4 text-brand-gold mr-1" />
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider mr-1">
            Period:
          </span>
          {(
            [
              { key: 'today', label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'last_7_days', label: 'Last 7 Days' },
              { key: 'this_month', label: 'This Month' },
              { key: 'last_month', label: 'Last Month' },
            ] as const
          ).map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handlePresetChange(preset.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                activePreset === preset.key
                  ? 'bg-brand-gold text-brand-black shadow-sm font-bold'
                  : 'bg-white dark:bg-brand-black/60 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-brand-border hover:border-brand-gold/50'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range Picker */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-400 font-medium">Custom:</span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-2 py-1 rounded bg-white dark:bg-brand-black border border-neutral-200 dark:border-brand-border text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
          />
          <span className="text-neutral-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-2 py-1 rounded bg-white dark:bg-brand-black border border-neutral-200 dark:border-brand-border text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
          />
          <button
            type="button"
            onClick={handleApplyCustomDate}
            className="px-2.5 py-1 rounded bg-brand-gold/15 text-brand-gold border border-brand-gold/40 hover:bg-brand-gold hover:text-brand-black font-semibold transition-colors text-xs"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs">
          <strong>Error loading report:</strong> {error}
        </div>
      )}

      {/* Top 5 Executive Metric Cards (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. Net Sales Revenue */}
        <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Revenue</span>
            <DollarSign className="w-4 h-4 text-brand-gold" />
          </div>
          <div className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
            {formatBdt(pnl?.netRevenueBdt || 0)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between pt-1">
            <span>{pnl?.ordersCount || 0} orders completed</span>
            <span>{formatQty(pnl?.itemsSoldCount || 0)} units</span>
          </div>
        </div>

        {/* 2. Cost of Goods Sold (COGS) */}
        <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">COGS (Stock Cost)</span>
            <ShoppingBag className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
            {allowCost ? formatBdt(pnl?.cogsBdt || 0) : '••••••'}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 pt-1">
            {allowCost ? (
              <span>Weighted inventory cost</span>
            ) : (
              <span className="flex items-center gap-1 text-amber-500">
                <Lock className="w-3 h-3" /> Cost hidden from role
              </span>
            )}
          </div>
        </div>

        {/* 3. Gross Profit */}
        <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Gross Profit</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-500 tracking-tight">
            {allowProfit ? formatBdt(pnl?.grossProfitBdt || 0) : '••••••'}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between pt-1">
            <span>Revenue − COGS</span>
            {allowProfit && (
              <span className="font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px]">
                {pnl?.grossMarginPercent}% margin
              </span>
            )}
          </div>
        </div>

        {/* 4. Operating Expenses */}
        <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Operating Expenses</span>
            <Wallet className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-500 tracking-tight">
            {formatBdt(pnl?.operatingExpensesBdt || 0)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 pt-1">
            <span>Shop rent, tea, packaging, bills</span>
          </div>
        </div>

        {/* 5. Net Profit */}
        <div className="rounded-xl border border-brand-gold/40 bg-brand-gold/5 dark:bg-brand-gold/10 p-4 space-y-1 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-brand-gold">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Profit</span>
            {(pnl?.netProfitBdt || 0) >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-brand-gold" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-rose-500" />
            )}
          </div>
          <div
            className={cn(
              'text-xl font-black tracking-tight',
              (pnl?.netProfitBdt || 0) >= 0 ? 'text-brand-gold' : 'text-rose-500'
            )}
          >
            {allowProfit ? formatBdt(pnl?.netProfitBdt || 0) : '••••••'}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between pt-1">
            <span>Gross − Expenses</span>
            {allowProfit && (
              <span className="font-bold text-brand-gold bg-brand-gold/20 px-1.5 py-0.5 rounded text-[10px]">
                {pnl?.netMarginPercent}% net
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sub-KPI Highlights Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-brand-border bg-neutral-50 dark:bg-brand-surface/40 text-xs">
        <div>
          <div className="text-neutral-400 text-[11px]">Average Order Value (AOV)</div>
          <div className="text-sm font-bold text-neutral-900 dark:text-white mt-0.5">
            {formatBdt(pnl?.averageOrderValueBdt || 0)}
          </div>
        </div>
        <div>
          <div className="text-neutral-400 text-[11px]">Promotional Discounts Given</div>
          <div className="text-sm font-bold text-rose-400 mt-0.5">
            {formatBdt(pnl?.discountTotalBdt || 0)}
          </div>
        </div>
        <div>
          <div className="text-neutral-400 text-[11px]">Customer Dues Incurred</div>
          <div className="text-sm font-bold text-amber-500 mt-0.5">
            {formatBdt(pnl?.customerDuesIncurredBdt || 0)}
          </div>
        </div>
        <div>
          <div className="text-neutral-400 text-[11px]">Customer Dues Recovered</div>
          <div className="text-sm font-bold text-emerald-500 mt-0.5">
            {formatBdt(pnl?.customerDuesCollectedBdt || 0)}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-brand-border overflow-x-auto pb-px">
        {[
          { id: 'pnl', label: 'Profit & Loss Statement (P&L)', icon: TrendingUp },
          { id: 'products', label: 'Top Products & Fragrances', icon: ShoppingBag },
          { id: 'payments', label: 'Payment Methods & Cashflow', icon: Wallet },
          { id: 'staff', label: 'Cashier & Staff Performance', icon: Users },
          { id: 'inventory', label: 'Current Inventory Valuation', icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap',
                active
                  ? 'border-brand-gold text-brand-gold bg-brand-gold/10 font-bold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-brand-surface'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT 1: P&L Statement and Daily Trends */}
      {activeTab === 'pnl' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income Statement Card */}
            <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-brand-border pb-3">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-brand-gold" />
                  <span>Statement of Profit and Loss</span>
                </h3>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {currentFilter.label}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* 1. Operating Revenue */}
                <div className="space-y-1.5 pb-2 border-b border-neutral-100 dark:border-brand-border/60">
                  <div className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">
                    1. Operating Revenue
                  </div>
                  <div className="flex justify-between items-center text-neutral-700 dark:text-neutral-300">
                    <span>Gross Sales</span>
                    <span className="font-mono font-medium">{formatBdt(pnl?.grossSalesBdt || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-rose-500">
                    <span>Less: POS Discounts Given</span>
                    <span className="font-mono font-medium">− {formatBdt(pnl?.discountTotalBdt || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-neutral-900 dark:text-white pt-1">
                    <span>Net Sales Revenue</span>
                    <span className="font-mono text-brand-gold">{formatBdt(pnl?.netRevenueBdt || 0)}</span>
                  </div>
                </div>

                {/* 2. Cost of Sales */}
                <div className="space-y-1.5 pb-2 border-b border-neutral-100 dark:border-brand-border/60">
                  <div className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">
                    2. Cost of Goods Sold (COGS)
                  </div>
                  <div className="flex justify-between items-center text-neutral-700 dark:text-neutral-300">
                    <span>Direct Material & Stock Cost</span>
                    <span className="font-mono font-medium">
                      {allowCost ? formatBdt(pnl?.cogsBdt || 0) : '••••••'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-emerald-500 pt-1">
                    <span>Gross Profit</span>
                    <span className="font-mono">
                      {allowProfit ? formatBdt(pnl?.grossProfitBdt || 0) : '••••••'}
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-400 text-right">
                    Gross Margin: {allowProfit ? `${pnl?.grossMarginPercent}%` : '••••'}
                  </div>
                </div>

                {/* 3. Operating Expenses */}
                <div className="space-y-1.5 pb-2 border-b border-neutral-100 dark:border-brand-border/60">
                  <div className="flex items-center justify-between font-bold text-neutral-400 uppercase tracking-wider text-[10px]">
                    <span>3. Operating Expenses</span>
                    <button
                      type="button"
                      onClick={handleExportExpenses}
                      className="text-brand-gold hover:underline capitalize font-normal flex items-center gap-1"
                    >
                      <Download className="w-2.5 h-2.5" /> CSV
                    </button>
                  </div>
                  {expenseCats.length === 0 ? (
                    <div className="text-neutral-400 italic text-[11px] py-1">
                      No expenses logged during this period.
                    </div>
                  ) : (
                    expenseCats.map((cat) => (
                      <div
                        key={cat.categoryName}
                        className="flex justify-between items-center text-neutral-600 dark:text-neutral-400"
                      >
                        <span className="truncate max-w-[220px]">
                          {cat.categoryName} ({cat.count})
                        </span>
                        <span className="font-mono">{formatBdt(cat.amountBdt)}</span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between items-center font-bold text-amber-500 pt-1">
                    <span>Total Operating Expenses</span>
                    <span className="font-mono">− {formatBdt(pnl?.operatingExpensesBdt || 0)}</span>
                  </div>
                </div>

                {/* 4. Net Operating Profit */}
                <div className="p-3 rounded-lg bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-between font-black text-sm text-neutral-900 dark:text-white">
                  <div>
                    <div>Net Operating Profit</div>
                    <div className="text-[10px] font-normal text-neutral-400">
                      Net Profit Margin: {allowProfit ? `${pnl?.netMarginPercent}%` : '••••'}
                    </div>
                  </div>
                  <div className="text-base font-mono text-brand-gold">
                    {allowProfit ? formatBdt(pnl?.netProfitBdt || 0) : '••••••'}
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Trend Table */}
            <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-brand-border pb-3">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-gold" />
                  <span>Daily Revenue & Profit Progression</span>
                </h3>
                <span className="text-xs text-neutral-400 font-mono">
                  {dailyTrends.length} days active
                </span>
              </div>

              {dailyTrends.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-neutral-400 text-xs italic">
                  No sales recorded for the selected date range.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="sticky top-0 bg-neutral-100 dark:bg-brand-black text-neutral-500 font-semibold border-b border-neutral-200 dark:border-brand-border">
                      <tr>
                        <th className="py-2 px-2.5">Date</th>
                        <th className="py-2 px-2 text-right">Orders</th>
                        <th className="py-2 px-2 text-right">Revenue</th>
                        {allowCost && <th className="py-2 px-2 text-right">COGS</th>}
                        <th className="py-2 px-2 text-right">Expenses</th>
                        {allowProfit && <th className="py-2 px-2.5 text-right">Net Profit</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-brand-border/40 font-mono">
                      {dailyTrends.map((dt) => (
                        <tr
                          key={dt.date}
                          className="hover:bg-neutral-50 dark:hover:bg-brand-surface/80"
                        >
                          <td className="py-2 px-2.5 font-sans font-medium text-neutral-900 dark:text-white flex items-center gap-1.5">
                            <span>{dt.date}</span>
                            <span className="text-[10px] text-neutral-400 uppercase font-bold">
                              {dt.dayLabel}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right text-neutral-500">{dt.ordersCount}</td>
                          <td className="py-2 px-2 text-right font-bold text-neutral-900 dark:text-white">
                            {formatBdt(dt.revenueBdt)}
                          </td>
                          {allowCost && (
                            <td className="py-2 px-2 text-right text-neutral-400">
                              {formatBdt(dt.cogsBdt)}
                            </td>
                          )}
                          <td className="py-2 px-2 text-right text-amber-500">
                            {dt.expensesBdt > 0 ? `− ${formatBdt(dt.expensesBdt)}` : '—'}
                          </td>
                          {allowProfit && (
                            <td
                              className={cn(
                                'py-2 px-2.5 text-right font-bold',
                                dt.netProfitBdt >= 0 ? 'text-emerald-500' : 'text-rose-500'
                              )}
                            >
                              {formatBdt(dt.netProfitBdt)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: Top Products & Fragrance Rankings */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* Category Distribution Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {categorySales.map((cat) => (
              <div
                key={`${cat.categoryName}-${cat.sellableType}`}
                className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-4 space-y-1.5"
              >
                <div className="flex items-center justify-between text-neutral-400">
                  <span className="text-xs font-bold truncate">{cat.categoryName}</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-brand-gold/15 text-brand-gold">
                    {cat.revenuePercentage}%
                  </span>
                </div>
                <div className="text-lg font-black text-neutral-900 dark:text-white">
                  {formatBdt(cat.revenueBdt)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                  <span>{formatQty(cat.itemsSold)} units sold</span>
                  {allowProfit && (
                    <span className="text-emerald-500 font-semibold">{cat.marginPercent}% margin</span>
                  )}
                </div>
                <div className="w-full bg-neutral-100 dark:bg-brand-black rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-brand-gold h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, cat.revenuePercentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Top Selling Products Table */}
          <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-brand-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-brand-gold" />
                  <span>Best-Selling Fragrances & Products</span>
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Sorted by <strong className="text-brand-gold capitalize">{productSortField.replace('_', ' ')}</strong> ({productSortOrder === 'asc' ? 'Ascending ↑' : 'Descending ↓'}) during {currentFilter.label}. Click column headers to reorder.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportTopProducts}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-brand-border text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-brand-surface text-brand-gold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Quick Sorting Options Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-neutral-50 dark:bg-brand-black/50 border border-neutral-200 dark:border-brand-border text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-brand-gold" />
                  Sort By:
                </span>
                {(
                  [
                    { key: 'revenue', label: 'Revenue' },
                    { key: 'units', label: 'Units Sold' },
                    ...(allowCost ? [{ key: 'cogs', label: 'COGS' }] : []),
                    ...(allowProfit ? [{ key: 'profit', label: 'Gross Profit' }] : []),
                    ...(allowProfit ? [{ key: 'margin', label: 'Margin %' }] : []),
                    { key: 'name', label: 'Product Name' },
                  ] as const
                ).map((item) => {
                  const isActive = productSortField === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleProductSort(item.key as ProductSortField)}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5',
                        isActive
                          ? 'bg-brand-gold text-brand-black shadow-sm font-bold'
                          : 'bg-white dark:bg-brand-surface text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-brand-border hover:border-brand-gold/60'
                      )}
                    >
                      <span>{item.label}</span>
                      {isActive && (
                        productSortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                        )
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setProductSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="px-2.5 py-1 rounded-md border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface text-neutral-700 dark:text-neutral-300 hover:text-brand-gold text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Toggle Sort Direction (Ascending / Descending)"
              >
                <span>{productSortOrder === 'desc' ? 'Highest First (↓)' : 'Lowest First (↑)'}</span>
              </button>
            </div>

            {sortedTopProducts.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-neutral-400 text-xs italic">
                No product sales found for this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-100 dark:bg-brand-black text-neutral-500 font-semibold border-b border-neutral-200 dark:border-brand-border">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th
                        onClick={() => handleProductSort('name')}
                        className="py-2.5 px-3 cursor-pointer select-none hover:text-brand-gold transition-colors"
                        title="Sort by Product Name"
                      >
                        <div className="flex items-center gap-1">
                          <span className={cn(productSortField === 'name' && 'text-brand-gold font-bold')}>
                            Product / Fragrance
                          </span>
                          {productSortField === 'name' ? (
                            productSortOrder === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-brand-gold" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-brand-gold" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th
                        onClick={() => handleProductSort('units')}
                        className="py-2.5 px-3 text-right cursor-pointer select-none hover:text-brand-gold transition-colors"
                        title="Sort by Units Sold"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span className={cn(productSortField === 'units' && 'text-brand-gold font-bold')}>
                            Units Sold
                          </span>
                          {productSortField === 'units' ? (
                            productSortOrder === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-brand-gold" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-brand-gold" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleProductSort('revenue')}
                        className="py-2.5 px-3 text-right cursor-pointer select-none hover:text-brand-gold transition-colors"
                        title="Sort by Revenue"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span className={cn(productSortField === 'revenue' && 'text-brand-gold font-bold')}>
                            Revenue
                          </span>
                          {productSortField === 'revenue' ? (
                            productSortOrder === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-brand-gold" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-brand-gold" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      {allowCost && (
                        <th
                          onClick={() => handleProductSort('cogs')}
                          className="py-2.5 px-3 text-right cursor-pointer select-none hover:text-brand-gold transition-colors"
                          title="Sort by Cost of Goods Sold"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span className={cn(productSortField === 'cogs' && 'text-brand-gold font-bold')}>
                              COGS
                            </span>
                            {productSortField === 'cogs' ? (
                              productSortOrder === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-brand-gold" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-brand-gold" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                            )}
                          </div>
                        </th>
                      )}
                      {allowProfit && (
                        <th
                          onClick={() => handleProductSort('profit')}
                          className="py-2.5 px-3 text-right cursor-pointer select-none hover:text-brand-gold transition-colors"
                          title="Sort by Gross Profit"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span className={cn(productSortField === 'profit' && 'text-brand-gold font-bold')}>
                              Gross Profit
                            </span>
                            {productSortField === 'profit' ? (
                              productSortOrder === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-brand-gold" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-brand-gold" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                            )}
                          </div>
                        </th>
                      )}
                      {allowProfit && (
                        <th
                          onClick={() => handleProductSort('margin')}
                          className="py-2.5 px-3 text-right cursor-pointer select-none hover:text-brand-gold transition-colors"
                          title="Sort by Margin %"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span className={cn(productSortField === 'margin' && 'text-brand-gold font-bold')}>
                              Margin %
                            </span>
                            {productSortField === 'margin' ? (
                              productSortOrder === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-brand-gold" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-brand-gold" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                            )}
                          </div>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-brand-border/40">
                    {sortedTopProducts.map((p, idx) => (
                      <tr
                        key={`${p.productId}-${p.sku}`}
                        className="hover:bg-neutral-50 dark:hover:bg-brand-surface/80"
                      >
                        <td className="py-2.5 px-3 text-center font-bold text-neutral-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-white">
                          {p.productName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-neutral-400 text-[11px]">{p.sku}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                              p.sellableType === 'loose_decant'
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                : p.sellableType === 'sealed_product'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20'
                            )}
                          >
                            {p.sellableType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-neutral-900 dark:text-white">
                          {formatQty(p.quantitySold, p.unitCode)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-white">
                          {formatBdt(p.revenueBdt)}
                        </td>
                        {allowCost && (
                          <td className="py-2.5 px-3 text-right font-mono text-neutral-400">
                            {formatBdt(p.cogsBdt)}
                          </td>
                        )}
                        {allowProfit && (
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-500">
                            {formatBdt(p.grossProfitBdt)}
                          </td>
                        )}
                        {allowProfit && (
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-brand-gold">
                            {p.marginPercent}%
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: Payments & Counter Cashflow */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Method Breakdown */}
            <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-brand-border pb-3">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-brand-gold" />
                  <span>Sales by Payment Method</span>
                </h3>
              </div>

              <div className="space-y-3">
                {paymentMethods.length === 0 ? (
                  <div className="text-neutral-400 italic text-xs py-4 text-center">
                    No payment records in this range.
                  </div>
                ) : (
                  paymentMethods.map((pm) => (
                    <div
                      key={pm.paymentMethod}
                      className="p-3 rounded-lg border border-neutral-100 dark:border-brand-border/60 bg-neutral-50 dark:bg-brand-black/40 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-neutral-900 dark:text-white">
                          {pm.displayName}
                        </span>
                        <span className="font-mono font-bold text-neutral-900 dark:text-white">
                          {formatBdt(pm.amountBdt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-neutral-400">
                        <span>{pm.count} transactions</span>
                        <span className="font-semibold text-brand-gold">{pm.percentage}%</span>
                      </div>
                      <div className="w-full bg-neutral-200 dark:bg-brand-black rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-brand-gold h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, pm.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Counter Physical Cash Reconciliation Card */}
            <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-brand-border pb-3">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-brand-gold" />
                  <span>Physical Cash Drawer Movements</span>
                </h3>
                <span className="text-[10px] text-neutral-400 font-mono">Cash Only</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="font-bold text-emerald-500 uppercase tracking-wider text-[10px]">
                    Total Cash Inflow
                  </div>
                  <div className="flex justify-between items-center text-neutral-700 dark:text-neutral-300">
                    <span>Cash Sales</span>
                    <span className="font-mono font-bold">
                      + {formatBdt(cashFlow?.cashSalesBdt || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-neutral-700 dark:text-neutral-300">
                    <span>Customer Due Cash Recoveries</span>
                    <span className="font-mono font-bold">
                      + {formatBdt(cashFlow?.customerDueCollectionsCashBdt || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-emerald-500 border-t border-emerald-500/20 pt-1">
                    <span>Total Cash Inflow</span>
                    <span className="font-mono font-black">
                      {formatBdt(cashFlow?.totalCashInflowBdt || 0)}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-2">
                  <div className="font-bold text-rose-500 uppercase tracking-wider text-[10px]">
                    Total Cash Outflow
                  </div>
                  <div className="flex justify-between items-center text-neutral-700 dark:text-neutral-300">
                    <span>Cash Expenses</span>
                    <span className="font-mono font-bold">
                      − {formatBdt(cashFlow?.cashExpensesBdt || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-neutral-700 dark:text-neutral-300">
                    <span>Supplier Stock Cash Purchases</span>
                    <span className="font-mono font-bold">
                      − {formatBdt(cashFlow?.cashSupplierPurchasesBdt || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-rose-500 border-t border-rose-500/20 pt-1">
                    <span>Total Cash Outflow</span>
                    <span className="font-mono font-black">
                      − {formatBdt(cashFlow?.totalCashOutflowBdt || 0)}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-neutral-100 dark:bg-brand-black border border-neutral-200 dark:border-brand-border flex items-center justify-between font-bold text-sm">
                  <span>Net Counter Cash Added</span>
                  <span
                    className={cn(
                      'font-mono font-black text-base',
                      (cashFlow?.netCashFlowBdt || 0) >= 0 ? 'text-brand-gold' : 'text-rose-500'
                    )}
                  >
                    {formatBdt(cashFlow?.netCashFlowBdt || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: Staff & Cashier Performance */}
      {activeTab === 'staff' && (
        <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-brand-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-gold" />
                <span>Cashier & Sales Staff Breakdown</span>
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Total transactions, sales billed, and discounts processed by each staff member.
              </p>
            </div>
          </div>

          {cashierStats.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-neutral-400 text-xs italic">
              No staff sales records found for this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-100 dark:bg-brand-black text-neutral-500 font-semibold border-b border-neutral-200 dark:border-brand-border">
                  <tr>
                    <th className="py-2.5 px-3">Cashier / Staff Name</th>
                    <th className="py-2.5 px-3 text-right">Orders Processed</th>
                    <th className="py-2.5 px-3 text-right">Total Sales Revenue</th>
                    <th className="py-2.5 px-3 text-right">Average Ticket Size</th>
                    <th className="py-2.5 px-3 text-right">Discounts Authorized</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-brand-border/40 font-mono">
                  {cashierStats.map((c) => (
                    <tr
                      key={c.cashierId}
                      className="hover:bg-neutral-50 dark:hover:bg-brand-surface/80"
                    >
                      <td className="py-2.5 px-3 font-sans font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-brand-gold/20 text-brand-gold flex items-center justify-center text-[10px] font-bold">
                          {c.cashierName.slice(0, 1).toUpperCase()}
                        </div>
                        <span>{c.cashierName}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-700 dark:text-neutral-300">
                        {c.ordersCount} txns
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-neutral-900 dark:text-white">
                        {formatBdt(c.totalSalesBdt)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-400">
                        {formatBdt(c.avgTicketBdt)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-400">
                        {c.discountsGivenBdt > 0 ? formatBdt(c.discountsGivenBdt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 5: Current Inventory Valuation */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface space-y-1">
              <div className="text-neutral-400 text-xs font-bold uppercase tracking-wider">
                Total Stock Valuation (Cost)
              </div>
              <div className="text-xl font-black text-neutral-900 dark:text-white">
                {allowCost ? formatBdt(inventoryVal?.totalCostValueBdt || 0) : '••••••'}
              </div>
              <div className="text-[11px] text-neutral-500">
                Capital locked across {inventoryVal?.totalSkus || 0} SKUs
              </div>
            </div>

            <div className="p-4 rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface space-y-1">
              <div className="text-neutral-400 text-xs font-bold uppercase tracking-wider">
                Total Selling Value (Retail)
              </div>
              <div className="text-xl font-black text-brand-gold">
                {formatBdt(inventoryVal?.totalRetailValueBdt || 0)}
              </div>
              <div className="text-[11px] text-neutral-500">
                At standard retail catalog prices
              </div>
            </div>

            <div className="p-4 rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface space-y-1">
              <div className="text-neutral-400 text-xs font-bold uppercase tracking-wider">
                Potential Gross Margin
              </div>
              <div className="text-xl font-black text-emerald-500">
                {allowProfit ? formatBdt(inventoryVal?.potentialGrossProfitBdt || 0) : '••••••'}
              </div>
              <div className="text-[11px] text-emerald-500 font-semibold">
                {allowProfit ? `+${inventoryVal?.potentialMarginPercent}% potential margin` : '••••'}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface space-y-1">
              <div className="text-neutral-400 text-xs font-bold uppercase tracking-wider">
                Total Units on Hand
              </div>
              <div className="text-xl font-black text-neutral-900 dark:text-white">
                {formatQty(inventoryVal?.totalUnitsInStock || 0)} units
              </div>
              <div className="text-[11px] text-neutral-500">
                Raw oils, bottles, perfumes, tasbihs
              </div>
            </div>
          </div>

          {/* Stock Health Badges */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>
                  Healthy Stock: <strong>{inventoryVal?.healthyStockCount || 0}</strong> SKUs
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-amber-500" />
                <span>
                  Low Stock Alert: <strong className="text-amber-500">{inventoryVal?.lowStockCount || 0}</strong> SKUs
                </span>
              </div>
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-rose-500" />
                <span>
                  Out of Stock: <strong className="text-rose-500">{inventoryVal?.outOfStockCount || 0}</strong> SKUs
                </span>
              </div>
            </div>
            <span className="text-[11px] text-neutral-400 italic">
              Live valuation based on current inventory on hand.
            </span>
          </div>
        </div>
      )}

      {/* Printable Report for Direct System Print (Ctrl+P) */}
      <div className="hidden print:block">
        <PrintableReport
          reportType={activeTab}
          filter={currentFilter}
          pnl={pnl}
          dailyTrends={dailyTrends}
          topProducts={sortedTopProducts}
          categorySales={categorySales}
          paymentMethods={paymentMethods}
          cashierStats={cashierStats}
          expenseCats={expenseCats}
          cashFlow={cashFlow}
          inventoryVal={inventoryVal}
          shopSettings={shopSettings}
          currentUser={currentUser}
          allowCost={allowCost}
          allowProfit={allowProfit}
        />
      </div>

      {/* On-Screen Print Preview Modal */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        defaultReportType={activeTab}
        filter={currentFilter}
        pnl={pnl}
        dailyTrends={dailyTrends}
        topProducts={sortedTopProducts}
        categorySales={categorySales}
        paymentMethods={paymentMethods}
        cashierStats={cashierStats}
        expenseCats={expenseCats}
        cashFlow={cashFlow}
        inventoryVal={inventoryVal}
        shopSettings={shopSettings}
        currentUser={currentUser}
        allowCost={allowCost}
        allowProfit={allowProfit}
      />
    </div>
  );
}
