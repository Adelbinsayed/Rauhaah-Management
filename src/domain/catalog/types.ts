export type UnitType = 'volume' | 'weight' | 'count';

export interface Unit {
  id: string;
  code: string;
  name: string;
  unitType: UnitType;
  baseUnitCode: string;
  conversionFactor: number;
  isSystem: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Brand {
  id: string;
  name: string;
  description: string | null;
  countryOfOrigin: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StockItemType =
  | 'raw_oil'
  | 'empty_bottle'
  | 'packaging'
  | 'sealed_product'
  | 'accessory'
  | 'raw_material';

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  brandId: string | null;
  brandName?: string | null;
  categoryId: string | null;
  categoryName?: string | null;
  itemType: StockItemType;
  unitId: string;
  unitCode?: string;
  unitName?: string;
  densityGPerMl: number | null;
  currentQuantity: number;
  minAlertQuantity: number;
  costPriceBdt: number; // Protected: omitted or 0 for staff
  reorderQuantity: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SellableType = 'sealed_product' | 'loose_decant' | 'custom_blend' | 'accessory';

export interface SellableComponent {
  id: string;
  sellableId: string;
  stockItemId: string;
  stockItemName?: string;
  stockItemSku?: string;
  stockItemCostBdt?: number;
  stockItemCurrentQty?: number;
  quantity: number;
  unitId: string;
  unitCode?: string;
  isPrimary: boolean;
}

export interface Sellable {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  brandId: string | null;
  brandName?: string | null;
  categoryId: string | null;
  categoryName?: string | null;
  sellableType: SellableType;
  retailPriceBdt: number;
  wholesalePriceBdt: number;
  minPriceBdt: number;
  isTaxable: boolean;
  taxRatePercent: number;
  trackInventory: boolean;
  isActive: boolean;
  components?: SellableComponent[];
  calculatedCostBdt?: number; // Protected: only for owner/manager
  primaryStockQuantity?: number;
  primaryUnitCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type PriceType = 'retail' | 'wholesale' | 'min';

export interface PriceHistoryEntry {
  id: string;
  sellableId: string;
  sellableName?: string;
  priceType: PriceType;
  oldPrice: number;
  newPrice: number;
  changeReason: string | null;
  changedByUserId: string | null;
  changedByUsername?: string | null;
  createdAt: string;
}

export interface AttarSizeOption {
  sizeMl: number;
  label: string;
  enabled: boolean;
  costPriceBdt: number;
  idealSellPriceBdt: number;
  wholesalePriceBdt: number;
}

export interface CreateAttarIntakeInput {
  name: string;
  sku?: string;
  categoryId?: string;
  brandId?: string;
  boughtVolumeMl: number;
  totalPurchaseCostBdt: number;
  overheadPercent?: number; // default 15%
  marginPercent?: number; // default 25%
  sizes: AttarSizeOption[];
}

export interface CreateProductInput {
  name: string;
  sku?: string;
  barcode?: string;
  brandId?: string;
  categoryId?: string;
  sellableType: SellableType;
  retailPriceBdt: number;
  wholesalePriceBdt: number;
  minPriceBdt?: number;
  // If sealed_product or accessory: single-item auto-link
  costPriceBdt?: number;
  initialQuantity?: number;
  minAlertQuantity?: number;
  unitId?: string;
  // If decant or custom blend: components
  components?: Array<{
    stockItemId: string;
    quantity: number;
    unitId: string;
    isPrimary?: boolean;
  }>;
}

export interface CreateStockItemInput {
  name: string;
  sku?: string;
  brandId?: string;
  categoryId?: string;
  itemType: StockItemType;
  unitId: string;
  densityGPerMl?: number;
  currentQuantity: number;
  minAlertQuantity: number;
  costPriceBdt: number;
  notes?: string;
}

export interface BulkPriceUpdateItem {
  sellableId: string;
  retailPriceBdt?: number;
  wholesalePriceBdt?: number;
  minPriceBdt?: number;
  changeReason?: string;
}
