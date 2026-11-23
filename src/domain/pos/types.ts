export type SellableKind = 'loose_decant' | 'sealed_product' | 'accessory' | 'custom_blend';

export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'card' | 'bank' | 'split';

export interface CartItem {
  id: string; // unique item line id in cart
  sellableId: string;
  productName: string;
  sku: string;
  barcode?: string | null;
  sellableType: SellableKind;
  unitCode: string; // 'ml' or 'pcs'
  bottleSizeMl?: number; // e.g. 3, 6, 12, or custom ml
  quantity: number; // in ml or pcs
  unitPriceBdt: number; // rate per unit
  idealRetailPriceBdt: number; // recommended benchmark
  costPriceBdt: number; // cost snapshot
  discountPercent: number;
  discountAmountBdt: number;
  discountReason?: string;
  lineTotalBdt: number;
  stockInHand: number;
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  notes?: string | null;
  dueBalanceBdt: number;
  visitCount?: number;
  totalSpendBdt?: number;
  lastVisitAt?: string | null;
  createdAt: string;
}

export interface SalePayment {
  method: PaymentMethod;
  amountBdt: number;
  reference?: string;
}

export interface CartTotals {
  subtotalBdt: number;
  itemDiscountBdt: number;
  cartDiscountPercent: number;
  cartDiscountBdt: number;
  cartDiscountReason?: string;
  totalAmountBdt: number;
  paidAmountBdt: number;
  changeAmountBdt: number;
  dueAmountBdt: number;
}

export interface HeldCart {
  id: string;
  heldAt: string;
  customer: Customer | null;
  items: CartItem[];
  note?: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  cashierId: string;
  cashierName?: string;
  subtotalBdt: number;
  discountAmountBdt: number;
  discountPercent: number;
  discountReason?: string | null;
  totalAmountBdt: number;
  paidAmountBdt: number;
  changeAmountBdt: number;
  dueAmountBdt: number;
  paymentMethod: PaymentMethod;
  status: 'completed' | 'voided' | 'returned';
  items?: CartItem[];
  payments?: SalePayment[];
  createdAt: string;
}
