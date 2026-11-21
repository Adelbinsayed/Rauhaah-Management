import React from 'react';
import type {
  CashFlowSummary,
  CashierPerformance,
  CategorySalesBreakdown,
  DailyTrendPoint,
  DateRangeFilter,
  ExpenseCategoryBreakdown,
  InventoryValuationSummary,
  PaymentMethodBreakdown,
  PnLSummary,
  TopSellingProduct,
} from '@/domain/reports/types';
import type { ShopSettings, User } from '@/domain/auth/types';
import { formatBdt, formatQty } from './reportsUtils';

export interface PrintableReportProps {
  reportType: 'pnl' | 'products' | 'payments' | 'staff' | 'inventory' | 'all';
  filter: DateRangeFilter;
  pnl: PnLSummary | null;
  dailyTrends: DailyTrendPoint[];
  topProducts: TopSellingProduct[];
  categorySales: CategorySalesBreakdown[];
  paymentMethods: PaymentMethodBreakdown[];
  cashierStats: CashierPerformance[];
  expenseCats: ExpenseCategoryBreakdown[];
  cashFlow: CashFlowSummary | null;
  inventoryVal: InventoryValuationSummary | null;
  shopSettings?: ShopSettings | null;
  currentUser?: User | null;
  allowCost?: boolean;
  allowProfit?: boolean;
}

export const PrintableReport: React.FC<PrintableReportProps> = ({
  reportType,
  filter,
  pnl,
  topProducts,
  categorySales,
  paymentMethods,
  cashierStats,
  expenseCats,
  inventoryVal,
  shopSettings,
  currentUser,
  allowCost = true,
  allowProfit = true,
}) => {
  const shopName = shopSettings?.shopName || 'RAUHAAH';
  const subtitle = shopSettings?.invoiceSubtitle || 'Live Peaceful • Luxury Fragrances & Lifestyle';
  const address = shopSettings?.address || 'Shop #G-04, Ground Floor, Dhaka, Bangladesh';
  const phone = shopSettings?.phone || '01970084325';
  const printedAt = new Date().toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const printedBy = currentUser?.displayName || currentUser?.username || 'Administrator';

  const getReportTitle = () => {
    switch (reportType) {
      case 'pnl':
        return 'PROFIT & LOSS FINANCIAL STATEMENT';
      case 'products':
        return 'BEST-SELLING FRAGRANCES & MARGINS REPORT';
      case 'payments':
        return 'PAYMENT METHODS & TENDER BREAKDOWN';
      case 'staff':
        return 'STAFF SALES PERFORMANCE REPORT';
      case 'inventory':
        return 'INVENTORY ASSET VALUATION REPORT';
      default:
        return 'EXECUTIVE FINANCIAL & OPERATIONAL REPORT';
    }
  };

  return (
    <div
      id="printable-report"
      className="bg-white text-black font-sans leading-normal text-xs p-6 md:p-8 max-w-[210mm] mx-auto select-text"
      style={{ minHeight: '297mm' }}
    >
      {/* 1. Executive Brand Letterhead */}
      <div className="border-b-2 border-black pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-widest uppercase">
                ✦ {shopName} ✦
              </span>
            </div>
            <p className="text-[11px] font-medium text-gray-700 italic mt-0.5 tracking-wide">
              {subtitle}
            </p>
            <p className="text-[10px] text-gray-600 mt-1">
              {address} | Hotline: <strong className="text-black">{phone}</strong>
            </p>
          </div>

          <div className="text-right text-[10px] space-y-0.5 text-gray-700">
            <div>
              <span className="font-semibold text-black">Printed:</span> {printedAt}
            </div>
            <div>
              <span className="font-semibold text-black">Prepared By:</span> {printedBy}
            </div>
            <div>
              <span className="font-semibold text-black">Currency:</span> BDT (৳)
            </div>
          </div>
        </div>

        {/* Report Banner */}
        <div className="mt-4 pt-3 border-t border-gray-300 flex justify-between items-center bg-gray-50 px-3 py-2 rounded">
          <div>
            <h1 className="text-sm font-extrabold uppercase tracking-wider text-black">
              {getReportTitle()}
            </h1>
            <p className="text-[10px] text-gray-600 font-medium">
              Filter Period: <strong className="text-black">{filter.label}</strong> ({new Date(filter.startDateIso).toLocaleDateString('en-GB')} – {new Date(filter.endDateIso).toLocaleDateString('en-GB')})
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block px-2.5 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded">
              OFFICIAL REPORT
            </span>
          </div>
        </div>
      </div>

      {/* 2. Executive KPI Summary Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="border border-gray-300 rounded p-2.5 bg-gray-50/70">
          <div className="text-[10px] uppercase font-bold text-gray-600 tracking-wider">
            Net Revenue
          </div>
          <div className="text-base font-black text-black mt-0.5">
            {formatBdt(pnl?.netRevenueBdt || 0)}
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5">
            {pnl?.ordersCount || 0} orders • {formatQty(pnl?.itemsSoldCount || 0)} units
          </div>
        </div>

        <div className="border border-gray-300 rounded p-2.5 bg-gray-50/70">
          <div className="text-[10px] uppercase font-bold text-gray-600 tracking-wider">
            Cost of Goods (COGS)
          </div>
          <div className="text-base font-black text-black mt-0.5">
            {allowCost ? formatBdt(pnl?.cogsBdt || 0) : '••••••'}
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5">
            {allowCost ? 'Weighted stock cost' : 'Hidden from role'}
          </div>
        </div>

        <div className="border border-gray-300 rounded p-2.5 bg-gray-50/70">
          <div className="text-[10px] uppercase font-bold text-gray-600 tracking-wider">
            Gross Profit & Margin
          </div>
          <div className="text-base font-black text-black mt-0.5">
            {allowProfit ? formatBdt(pnl?.grossProfitBdt || 0) : '••••••'}
          </div>
          <div className="text-[9px] font-semibold text-gray-700 mt-0.5">
            {allowProfit ? `Margin: ${pnl?.grossMarginPercent || 0}%` : 'Margin: Hidden'}
          </div>
        </div>

        <div className="border border-gray-300 rounded p-2.5 bg-gray-50/70">
          <div className="text-[10px] uppercase font-bold text-gray-600 tracking-wider">
            Net Operating Profit
          </div>
          <div className="text-base font-black text-black mt-0.5">
            {allowProfit ? formatBdt(pnl?.netProfitBdt || 0) : '••••••'}
          </div>
          <div className="text-[9px] font-semibold text-gray-700 mt-0.5">
            Expenses: {formatBdt(pnl?.operatingExpensesBdt || 0)}
          </div>
        </div>
      </div>

      {/* 3. Tab Specific Details */}

      {/* VIEW A: Profit & Loss Statement */}
      {(reportType === 'pnl' || reportType === 'all') && (
        <div className="mb-6 space-y-4">
          <div className="border-b border-black pb-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-black">
              1. Profit & Loss Financial Breakdown
            </h2>
          </div>

          <table className="w-full text-left border-collapse border border-gray-300 text-[11px]">
            <thead>
              <tr className="bg-gray-100 text-gray-800 border-b border-gray-300">
                <th className="py-2 px-3 font-bold">Financial Line Item</th>
                <th className="py-2 px-3 text-right font-bold">Amount (BDT)</th>
                <th className="py-2 px-3 font-bold">Notes / Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="py-1.5 px-3 font-semibold">Gross Product Sales</td>
                <td className="py-1.5 px-3 text-right font-mono font-bold">
                  {formatBdt(pnl?.grossSalesBdt || 0)}
                </td>
                <td className="py-1.5 px-3 text-gray-600 text-[10px]">Total retail sales before deductions</td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 text-gray-700 pl-6">(-) Discounts Allowed</td>
                <td className="py-1.5 px-3 text-right font-mono text-red-600">
                  -{formatBdt(pnl?.discountTotalBdt || 0)}
                </td>
                <td className="py-1.5 px-3 text-gray-600 text-[10px]">Promotional & cashier discounts</td>
              </tr>
              <tr className="bg-gray-50/50 font-bold">
                <td className="py-2 px-3">(=) Net Sales Revenue</td>
                <td className="py-2 px-3 text-right font-mono">
                  {formatBdt(pnl?.netRevenueBdt || 0)}
                </td>
                <td className="py-2 px-3 text-gray-600 text-[10px]">Effective top-line turnover</td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 text-gray-700 pl-6">(-) Cost of Goods Sold (COGS)</td>
                <td className="py-1.5 px-3 text-right font-mono text-red-600">
                  {allowCost ? `-${formatBdt(pnl?.cogsBdt || 0)}` : 'Hidden'}
                </td>
                <td className="py-1.5 px-3 text-gray-600 text-[10px]">Landed purchase cost of goods sold</td>
              </tr>
              <tr className="bg-gray-100 font-bold border-t border-b border-gray-300">
                <td className="py-2 px-3">(=) Gross Operating Profit</td>
                <td className="py-2 px-3 text-right font-mono text-black">
                  {allowProfit ? formatBdt(pnl?.grossProfitBdt || 0) : 'Hidden'}
                </td>
                <td className="py-2 px-3 text-gray-600 text-[10px]">
                  Gross Margin: <strong className="text-black">{pnl?.grossMarginPercent || 0}%</strong>
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 text-gray-700 pl-6">(-) Operating Expenses</td>
                <td className="py-1.5 px-3 text-right font-mono text-red-600">
                  -{formatBdt(pnl?.operatingExpensesBdt || 0)}
                </td>
                <td className="py-1.5 px-3 text-gray-600 text-[10px]">Shop rent, utilities, staff, packaging, etc.</td>
              </tr>
              <tr className="bg-gray-200 font-black text-xs border-t-2 border-b-2 border-black">
                <td className="py-2.5 px-3">(=) Net Operating Profit</td>
                <td className="py-2.5 px-3 text-right font-mono">
                  {allowProfit ? formatBdt(pnl?.netProfitBdt || 0) : 'Hidden'}
                </td>
                <td className="py-2.5 px-3 text-gray-700 text-[10px]">
                  Net Margin: <strong className="text-black">{pnl?.netMarginPercent || 0}%</strong>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Dues & Credit Summary */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="border border-gray-300 rounded p-2 text-[10px]">
              <span className="font-bold uppercase text-gray-600">Customer Dues Created (Period):</span>{' '}
              <strong className="font-mono text-black">{formatBdt(pnl?.customerDuesIncurredBdt || 0)}</strong>
            </div>
            <div className="border border-gray-300 rounded p-2 text-[10px]">
              <span className="font-bold uppercase text-gray-600">Customer Dues Recovered (Period):</span>{' '}
              <strong className="font-mono text-black">{formatBdt(pnl?.customerDuesCollectedBdt || 0)}</strong>
            </div>
          </div>

          {/* Expense Categories Breakdown */}
          {expenseCats.length > 0 && (
            <div className="pt-2">
              <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                Expense Categories Breakdown
              </h3>
              <table className="w-full text-left border-collapse border border-gray-300 text-[10px]">
                <thead>
                  <tr className="bg-gray-100 text-gray-800 border-b border-gray-300">
                    <th className="py-1.5 px-2 font-bold">Category</th>
                    <th className="py-1.5 px-2 text-right font-bold">Count</th>
                    <th className="py-1.5 px-2 text-right font-bold">Total (BDT)</th>
                    <th className="py-1.5 px-2 text-right font-bold">Share %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono">
                  {expenseCats.map((ec, idx) => (
                    <tr key={ec.categoryId || idx}>
                      <td className="py-1 px-2 font-sans font-semibold text-black">{ec.categoryName}</td>
                      <td className="py-1 px-2 text-right">{ec.count}</td>
                      <td className="py-1 px-2 text-right font-bold">{formatBdt(ec.amountBdt)}</td>
                      <td className="py-1 px-2 text-right">{ec.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW B: Best-Selling Products */}
      {(reportType === 'products' || reportType === 'all') && (
        <div className="mb-6 space-y-3">
          <div className="border-b border-black pb-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-black">
              2. Best-Selling Fragrances & Products Performance
            </h2>
          </div>

          <table className="w-full text-left border-collapse border border-gray-300 text-[10px]">
            <thead>
              <tr className="bg-gray-100 text-gray-800 border-b border-gray-300">
                <th className="py-2 px-2 font-bold w-8 text-center">#</th>
                <th className="py-2 px-2 font-bold">Product / Fragrance</th>
                <th className="py-2 px-2 font-bold">SKU</th>
                <th className="py-2 px-2 font-bold">Type</th>
                <th className="py-2 px-2 text-right font-bold">Units Sold</th>
                <th className="py-2 px-2 text-right font-bold">Revenue</th>
                <th className="py-2 px-2 text-right font-bold">COGS</th>
                <th className="py-2 px-2 text-right font-bold">Gross Profit</th>
                <th className="py-2 px-2 text-right font-bold">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-mono">
              {topProducts.slice(0, 25).map((p, idx) => (
                <tr key={p.productId || idx} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                  <td className="py-1 px-2 text-center text-gray-500">{idx + 1}</td>
                  <td className="py-1 px-2 font-sans font-semibold text-black">{p.productName}</td>
                  <td className="py-1 px-2 text-gray-600 text-[9px]">{p.sku}</td>
                  <td className="py-1 px-2 font-sans text-[9px] text-gray-600 uppercase">
                    {p.sellableType.replace('_', ' ')}
                  </td>
                  <td className="py-1 px-2 text-right font-bold">
                    {formatQty(p.quantitySold)} {p.unitCode}
                  </td>
                  <td className="py-1 px-2 text-right font-bold text-black">{formatBdt(p.revenueBdt)}</td>
                  <td className="py-1 px-2 text-right text-gray-600">
                    {allowCost ? formatBdt(p.cogsBdt) : 'Hidden'}
                  </td>
                  <td className="py-1 px-2 text-right font-bold text-gray-900">
                    {allowProfit ? formatBdt(p.grossProfitBdt) : 'Hidden'}
                  </td>
                  <td className="py-1 px-2 text-right font-bold text-black">
                    {allowProfit ? `${p.marginPercent}%` : 'Hidden'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {topProducts.length > 25 && (
            <p className="text-[9px] text-gray-500 italic text-right">
              Showing top 25 of {topProducts.length} best-selling items.
            </p>
          )}

          {/* Category Sales Breakdown */}
          {categorySales.length > 0 && (
            <div className="pt-2">
              <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                Category Sales Breakdown
              </h3>
              <table className="w-full text-left border-collapse border border-gray-300 text-[10px]">
                <thead>
                  <tr className="bg-gray-100 text-gray-800 border-b border-gray-300">
                    <th className="py-1.5 px-2 font-bold">Category</th>
                    <th className="py-1.5 px-2 text-right font-bold">Items Sold</th>
                    <th className="py-1.5 px-2 text-right font-bold">Revenue</th>
                    <th className="py-1.5 px-2 text-right font-bold">Share %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono">
                  {categorySales.map((cs, idx) => (
                    <tr key={cs.categoryId || idx}>
                      <td className="py-1 px-2 font-sans font-semibold text-black">{cs.categoryName}</td>
                      <td className="py-1 px-2 text-right">{cs.itemsSold}</td>
                      <td className="py-1 px-2 text-right font-bold">{formatBdt(cs.revenueBdt)}</td>
                      <td className="py-1 px-2 text-right">{cs.revenuePercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW C: Payments Breakdown */}
      {(reportType === 'payments' || reportType === 'all') && (
        <div className="mb-6 space-y-3">
          <div className="border-b border-black pb-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-black">
              3. Tender & Payment Methods Breakdown
            </h2>
          </div>

          <table className="w-full text-left border-collapse border border-gray-300 text-[11px]">
            <thead>
              <tr className="bg-gray-100 text-gray-800 border-b border-gray-300">
                <th className="py-2 px-3 font-bold">Payment Method</th>
                <th className="py-2 px-3 text-right font-bold">Transactions</th>
                <th className="py-2 px-3 text-right font-bold">Total Collected (BDT)</th>
                <th className="py-2 px-3 text-right font-bold">Share %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-mono">
              {paymentMethods.map((pm, idx) => (
                <tr key={pm.paymentMethod || idx} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                  <td className="py-1.5 px-3 font-sans font-bold text-black">{pm.displayName || pm.paymentMethod}</td>
                  <td className="py-1.5 px-3 text-right">{pm.count}</td>
                  <td className="py-1.5 px-3 text-right font-bold text-black">
                    {formatBdt(pm.amountBdt)}
                  </td>
                  <td className="py-1.5 px-3 text-right font-bold">{pm.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW D: Staff Performance */}
      {(reportType === 'staff' || reportType === 'all') && (
        <div className="mb-6 space-y-3">
          <div className="border-b border-black pb-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-black">
              4. Staff & Cashier Sales Performance
            </h2>
          </div>

          <table className="w-full text-left border-collapse border border-gray-300 text-[11px]">
            <thead>
              <tr className="bg-gray-100 text-gray-800 border-b border-gray-300">
                <th className="py-2 px-3 font-bold">Staff Member</th>
                <th className="py-2 px-3 text-right font-bold">Invoices Completed</th>
                <th className="py-2 px-3 text-right font-bold">Total Revenue (BDT)</th>
                <th className="py-2 px-3 text-right font-bold">Avg Ticket Value (BDT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-mono">
              {cashierStats.map((c, idx) => (
                <tr key={c.cashierId || idx} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                  <td className="py-1.5 px-3 font-sans font-bold text-black">
                    {c.cashierName}
                  </td>
                  <td className="py-1.5 px-3 text-right">{c.ordersCount}</td>
                  <td className="py-1.5 px-3 text-right font-bold text-black">
                    {formatBdt(c.totalSalesBdt)}
                  </td>
                  <td className="py-1.5 px-3 text-right font-bold">{formatBdt(c.avgTicketBdt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW E: Inventory Valuation */}
      {(reportType === 'inventory' || reportType === 'all') && inventoryVal && (
        <div className="mb-6 space-y-3">
          <div className="border-b border-black pb-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-black">
              5. Live Inventory Asset Valuation
            </h2>
          </div>

          <div className="grid grid-cols-4 gap-3 text-center mb-3">
            <div className="border border-gray-300 rounded p-2 bg-gray-50">
              <div className="text-[10px] uppercase font-bold text-gray-500">Total SKUs</div>
              <div className="text-sm font-black font-mono">{inventoryVal.totalSkus}</div>
            </div>
            <div className="border border-gray-300 rounded p-2 bg-gray-50">
              <div className="text-[10px] uppercase font-bold text-gray-500">Stock Cost Value</div>
              <div className="text-sm font-black font-mono">
                {allowCost ? formatBdt(inventoryVal.totalCostValueBdt) : 'Hidden'}
              </div>
            </div>
            <div className="border border-gray-300 rounded p-2 bg-gray-50">
              <div className="text-[10px] uppercase font-bold text-gray-500">Retail Selling Value</div>
              <div className="text-sm font-black font-mono">
                {formatBdt(inventoryVal.totalRetailValueBdt)}
              </div>
            </div>
            <div className="border border-gray-300 rounded p-2 bg-gray-50">
              <div className="text-[10px] uppercase font-bold text-gray-500">Potential Gross Profit</div>
              <div className="text-sm font-black font-mono">
                {allowProfit ? formatBdt(inventoryVal.potentialGrossProfitBdt) : 'Hidden'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Formal Executive Signature Footer */}
      <div className="mt-12 pt-6 border-t-2 border-black/80 flex justify-between items-end text-[10px] text-gray-700">
        <div className="space-y-1">
          <p className="font-semibold text-black">RAUHAAH MANAGEMENT POS SYSTEM</p>
          <p className="text-[9px] text-gray-500">
            System generated document. All figures calculated in Bangladeshi Taka (BDT).
          </p>
        </div>

        <div className="flex gap-12">
          <div className="text-center w-36">
            <div className="border-b border-black pb-1 mb-1 font-mono font-bold text-black">
              {printedBy}
            </div>
            <span className="text-[9px] uppercase tracking-wider text-gray-500">Prepared By</span>
          </div>

          <div className="text-center w-36">
            <div className="border-b border-black pb-1 mb-1">&nbsp;</div>
            <span className="text-[9px] uppercase tracking-wider text-gray-500">Verified & Approved</span>
          </div>
        </div>
      </div>
    </div>
  );
};
