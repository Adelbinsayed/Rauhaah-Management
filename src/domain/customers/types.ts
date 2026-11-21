export interface Customer {
  id: string;
  phone: string;
  name: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  dueBalanceBdt: number;
  totalOrders: number;
  totalSpentBdt: number;
  lastOrderDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  amountBdt: number;
  paymentMethod: string;
  referenceNumber?: string | null;
  notes?: string | null;
  receivedByUserId?: string | null;
  receivedByUsername?: string | null;
  createdAt: string;
}

export interface CustomerSaleSummary {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  totalAmountBdt: number;
  paidAmountBdt: number;
  dueAmountBdt: number;
  paymentMethod: string;
  status: string;
}
