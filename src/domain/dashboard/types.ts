export interface DashboardSummary {
  dateRangeLabel: string;
  startDateIso: string;
  endDateIso: string;
  netRevenueBdt: number;
  grossSalesBdt: number;
  discountTotalBdt: number;
  ordersCount: number;
  itemsSoldCount: number;
  averageOrderValueBdt: number;
  grossProfitBdt: number;
  grossMarginPercent: number;
  operatingExpensesBdt: number;
  netProfitBdt: number;
  counterCashBalanceBdt: number;
  cashSalesBdt: number;
  cashExpensesBdt: number;
  customerDuesCollectedCashBdt: number;
  customerDuesIncurredBdt: number;
  totalOutstandingCustomerDuesBdt: number;
}

export interface LowStockItem {
  id: string;
  sku: string;
  name: string;
  categoryName: string | null;
  currentQuantity: number;
  minAlertQuantity: number;
  unitCode: string;
}

export interface TopSellingItem {
  sku: string;
  productName: string;
  sellableType: string;
  totalQty: number;
  totalRevenueBdt: number;
}

export interface RecentSaleActivity {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  cashierName: string;
  totalAmountBdt: number;
  paymentMethod: string;
  itemCount: number;
  createdAt: string;
}

export interface PaymentMethodShare {
  method: string;
  label: string;
  amountBdt: number;
  count: number;
  percentage: number;
}
