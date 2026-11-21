export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
}

export interface Expense {
  id: string;
  title: string;
  categoryId?: string | null;
  categoryName: string;
  amountBdt: number;
  paymentMethod: string; // 'cash' | 'bkash' | 'nagad' | 'bank'
  referenceNumber?: string | null;
  notes?: string | null;
  expenseDate: string;
  createdByUserId?: string | null;
  createdByUsername?: string | null;
  branchId: string;
  createdAt: string;
}

export interface CashDrawerSummary {
  openingCashBdt: number;
  cashSalesBdt: number;
  customerDueCollectedCashBdt: number;
  cashExpensesBdt: number;
  supplierPurchasesCashBdt: number;
  expectedCashInDrawerBdt: number;
  isSessionOpen: boolean;
  sessionId?: string | null;
  openedAt?: string | null;
  openedByUsername?: string | null;
}
