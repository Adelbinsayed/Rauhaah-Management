export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  totalOrders: number;
  totalPurchasedBdt: number;
  totalPaidBdt: number;
  totalDueBdt: number;
}

export type PurchaseStatus = 'received' | 'ordered' | 'cancelled';

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  stockItemId: string;
  productName: string;
  sku?: string;
  purchasedUnit: string; // 'tola', 'ml', 'l', 'g', 'kg', 'pcs', 'bottle', 'box'
  purchasedQuantity: number;
  unitRateBdt: number;
  totalCostBdt: number;
  convertedQuantityBase: number; // in base unit (e.g. ml or pcs)
  baseUnitCode: string;
  baseCostPerUnitBdt: number;
  notes?: string | null;
  createdAt: string;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierId?: string | null;
  supplierName: string;
  branchId: string;
  status: PurchaseStatus;
  totalAmountBdt: number;
  paidAmountBdt: number;
  paymentMethod: string;
  referenceNumber?: string | null;
  notes?: string | null;
  receivedByUserId?: string | null;
  receivedByUsername?: string | null;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  items?: PurchaseItem[];
}

export interface StockItemLookup {
  id: string;
  sku: string;
  name: string;
  itemType: string;
  unitCode: string;
  currentQuantity: number;
  costPriceBdt: number;
  densityGPerMl?: number | null;
  reorderQuantity?: number | null;
}

export interface StockMovement {
  id: string;
  stockItemId: string;
  movementType: 'purchase_received' | 'sale' | 'adjustment' | 'return' | 'blend_consumed' | 'blend_produced';
  referenceId?: string | null;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  costPriceBdt: number;
  reason?: string | null;
  createdAt: string;
}

/**
 * Converts a purchased quantity in any unit to the stock item's base unit (ml, g, or pcs).
 */
export function convertToBaseQuantity(
  purchasedUnit: string,
  quantity: number,
  baseUnitCode: string,
  densityGPerMl?: number | null
): number {
  if (quantity <= 0) return 0;
  const unit = purchasedUnit.toLowerCase();
  const base = baseUnitCode.toLowerCase();
  const density = densityGPerMl && densityGPerMl > 0 ? densityGPerMl : 1.0;

  // Case 1: Base unit is Millilitres (ml) - Standard for oils
  if (base === 'ml') {
    switch (unit) {
      case 'tola':
      case 'tola_vol':
        return quantity * 12.0; // 1 tola (volume) = 12 ml
      case 'tola_g':
      case 'tola_wt':
        return (quantity * 11.664) / density;
      case 'l':
      case 'litre':
      case 'liter':
        return quantity * 1000.0;
      case 'g':
      case 'gram':
        return quantity / density;
      case 'kg':
      case 'kilogram':
        return (quantity * 1000.0) / density;
      case 'ml':
      default:
        return quantity;
    }
  }

  // Case 2: Base unit is Grams (g)
  if (base === 'g') {
    switch (unit) {
      case 'tola_g':
      case 'tola_wt':
        return quantity * 11.664;
      case 'tola':
      case 'tola_vol':
        return quantity * 12.0 * density;
      case 'kg':
      case 'kilogram':
        return quantity * 1000.0;
      case 'ml':
        return quantity * density;
      case 'l':
      case 'litre':
      case 'liter':
        return quantity * 1000.0 * density;
      case 'g':
      default:
        return quantity;
    }
  }

  // Case 3: Base unit is Count / Pieces (pcs, bottle, box)
  if (base === 'pcs' || base === 'bottle') {
    switch (unit) {
      case 'box':
      case 'dozen':
        return quantity * 12.0;
      case 'gross':
        return quantity * 144.0;
      case 'carton':
        return quantity * 100.0;
      case 'pcs':
      case 'bottle':
      default:
        return quantity;
    }
  }

  return quantity;
}
