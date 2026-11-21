export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'this_month'
  | 'last_month'
  | 'custom';

export interface DateRangeFilter {
  preset: DateRangePreset;
  startDateIso: string;
  endDateIso: string;
  label: string;
}

export interface PnLSummary {
  grossSalesBdt: number;
  discountTotalBdt: number;
  netRevenueBdt: number;
  cogsBdt: number;
  grossProfitBdt: number;
  grossMarginPercent: number;
  operatingExpensesBdt: number;
  netProfitBdt: number;
  netMarginPercent: number;
  ordersCount: number;
  itemsSoldCount: number;
  averageOrderValueBdt: number;
  customerDuesIncurredBdt: number;
  customerDuesCollectedBdt: number;
}

export interface DailyTrendPoint {
  date: string; // YYYY-MM-DD
  dayLabel: string; // Mon, Tue, etc.
  revenueBdt: number;
  cogsBdt: number;
  grossProfitBdt: number;
  expensesBdt: number;
  netProfitBdt: number;
  ordersCount: number;
}

export interface PaymentMethodBreakdown {
  paymentMethod: string;
  displayName: string;
  amountBdt: number;
  count: number;
  percentage: number;
}

export interface TopSellingProduct {
  productId: string;
  productName: string;
  sku: string;
  sellableType: string;
  quantitySold: number;
  unitCode: string;
  revenueBdt: number;
  cogsBdt: number;
  grossProfitBdt: number;
  marginPercent: number;
}

export interface CategorySalesBreakdown {
  categoryId: string | null;
  categoryName: string;
  sellableType: string;
  itemsSold: number;
  revenueBdt: number;
  cogsBdt: number;
  grossProfitBdt: number;
  marginPercent: number;
  revenuePercentage: number;
}

export interface CashierPerformance {
  cashierId: string;
  cashierName: string;
  ordersCount: number;
  totalSalesBdt: number;
  avgTicketBdt: number;
  discountsGivenBdt: number;
}

export interface ExpenseCategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  amountBdt: number;
  count: number;
  percentage: number;
}

export interface CashFlowSummary {
  cashSalesBdt: number;
  customerDueCollectionsCashBdt: number;
  totalCashInflowBdt: number;
  cashExpensesBdt: number;
  cashSupplierPurchasesBdt: number;
  totalCashOutflowBdt: number;
  netCashFlowBdt: number;
}

export interface InventoryValuationSummary {
  totalSkus: number;
  totalUnitsInStock: number;
  totalCostValueBdt: number;
  totalRetailValueBdt: number;
  potentialGrossProfitBdt: number;
  potentialMarginPercent: number;
  healthyStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
}
