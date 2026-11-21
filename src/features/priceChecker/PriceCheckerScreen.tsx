import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Barcode,
  Droplet,
  Package,
  Tag,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ChevronRight,
  Calculator,
  X,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/app/store';
import { catalogRepo } from '@/data/repositories/catalogRepo';
import { canViewCost } from '@/domain/auth/permissions';
import type { Category, Sellable } from '@/domain/catalog/types';
import { formatBdt } from '@/features/reports/reportsUtils';

interface PriceCheckerScreenProps {
  deviceId: string;
}

export const PriceCheckerScreen: React.FC<PriceCheckerScreenProps> = () => {
  const { permissions, setActiveRoute } = useAppStore();
  const hasCostPermission = canViewCost(permissions);

  const [products, setProducts] = useState<Sellable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Sellable | null>(null);

  // Custom decant calculator state
  const [customMl, setCustomMl] = useState<string>('5');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load Catalog
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [prodList, catList] = await Promise.all([
          catalogRepo.getSellables(undefined, hasCostPermission),
          catalogRepo.getCategories(),
        ]);
        setProducts(prodList);
        setCategories(catList);

        // Preselect the first product if none selected
        if (prodList.length > 0 && !selectedProduct) {
          setSelectedProduct(prodList[0]);
        }
      } catch (err) {
        console.error('Failed to load products for price checker:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hasCostPermission]);

  // Autofocus search on mount and hotkeys
  useEffect(() => {
    searchInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchTerm('');
        searchInputRef.current?.focus();
      } else if (e.key === 'F2' || (e.key === '/' && document.activeElement !== searchInputRef.current)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter products by search & category
  const filteredProducts = useMemo(() => {
    let result = products;

    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.categoryId === selectedCategory);
    }

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          (p.barcode && p.barcode.toLowerCase().includes(term))
      );
    }

    return result;
  }, [products, selectedCategory, searchTerm]);

  // Auto-spotlight if exact match or single result
  useEffect(() => {
    if (filteredProducts.length === 1 && searchTerm.trim()) {
      setSelectedProduct(filteredProducts[0]);
    }
  }, [filteredProducts, searchTerm]);

  // Calculation helpers for Attar & Loose Decants
  const isDecant = selectedProduct?.sellableType === 'loose_decant';
  const baseRate = selectedProduct?.retailPriceBdt || 0;
  const stockQty = selectedProduct?.primaryStockQuantity ?? 0;

  // Compute preset ml pricing
  const decant3mlPrice = isDecant ? Math.round(baseRate * (3 / (selectedProduct?.name.includes('12 ml') ? 12 : 1))) : 0;
  const decant6mlPrice = isDecant ? Math.round(baseRate * (6 / (selectedProduct?.name.includes('12 ml') ? 12 : 1))) : 0;
  const decant9mlPrice = isDecant ? Math.round(baseRate * (9 / (selectedProduct?.name.includes('12 ml') ? 12 : 1))) : 0;
  const decant12mlPrice = isDecant ? Math.round(baseRate * (12 / (selectedProduct?.name.includes('12 ml') ? 12 : 1))) : 0;

  // Custom ML calculation
  const parsedCustomMl = Math.max(0, parseFloat(customMl) || 0);
  const customCalculatedPrice = isDecant
    ? Math.round(baseRate * (parsedCustomMl / (selectedProduct?.name.includes('12 ml') ? 12 : 1)))
    : Math.round(baseRate * parsedCustomMl);

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-7 h-7 text-accent-ink animate-spin" />
        <p className="text-xs text-ink-secondary font-mono">Loading product price matrix…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 select-none">
      {/* Header & Search Bar */}
      <div className="p-6 rounded-xl bg-surface border border-hairline text-ink space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium text-ink flex items-center gap-2.5">
              <Tag className="w-5 h-5 text-accent-ink" strokeWidth={1.5} />
              <span>Quick price &amp; decant checker</span>
            </h1>
            <p className="text-xs text-ink-muted mt-1">
              Scan barcodes or search products to check retail rates, wholesale pricing, tola conversions, and stock availability
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <kbd className="px-2 py-1 rounded bg-raised border border-hairline font-mono text-[11px] text-ink-secondary">
              F2 / /
            </kbd>
            <span>Focus search</span>
            <kbd className="px-2 py-1 rounded bg-raised border border-hairline font-mono text-[11px] text-ink-secondary ml-2">
              Esc
            </kbd>
            <span>Clear</span>
          </div>
        </div>

        {/* Big Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-accent-ink pointer-events-none" strokeWidth={1.5} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Scan barcode or search fragrance, SKU, brand"
            className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-raised border border-hairline focus:border-accent text-ink text-base placeholder-ink-muted font-normal outline-none transition-colors duration-150 ease-unslop"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition-colors duration-150 ease-unslop"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg font-medium shrink-0 transition-colors duration-150 ease-unslop ${
              selectedCategory === 'all'
                ? 'bg-accent text-accent-fg font-semibold'
                : 'bg-raised text-ink-secondary hover:text-ink border border-hairline'
            }`}
          >
            All Products ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg font-medium shrink-0 transition-colors duration-150 ease-unslop ${
                  selectedCategory === cat.id
                    ? 'bg-accent text-accent-fg font-semibold'
                    : 'bg-raised text-ink-secondary hover:text-ink border border-hairline'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content: Spotlight Hero Card + Product Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Selected Product Details / Spotlight */}
        <div className="lg:col-span-5 space-y-4">
          {selectedProduct ? (
            <div className="p-6 rounded-xl bg-surface border border-hairline-strong text-ink space-y-5 sticky top-4">
              {/* Top Identity */}
              <div className="space-y-2 pb-4 border-b border-hairline">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-accent/12 text-accent-ink border border-accent/25">
                    {selectedProduct.categoryName || 'General Product'}
                  </span>

                  {/* Stock Status Badge */}
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-xs font-medium flex items-center gap-1.5 border ${
                      stockQty <= 0
                        ? 'bg-negative/10 text-negative border-negative/25'
                        : stockQty <= 10
                        ? 'bg-warning/10 text-warning border-warning/25'
                        : 'bg-positive/10 text-positive border-positive/25'
                    }`}
                  >
                    {stockQty <= 0 ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Out of stock
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        <span className="tabular-nums">In stock: {stockQty} {isDecant ? 'ml' : 'pcs'}</span>
                      </>
                    )}
                  </span>
                </div>

                <h2 className="text-xl font-medium text-ink leading-tight">
                  {selectedProduct.name}
                </h2>

                <div className="flex items-center gap-3 text-xs text-ink-muted font-mono tabular-nums">
                  <span>SKU: {selectedProduct.sku}</span>
                  {selectedProduct.barcode && (
                    <span className="flex items-center gap-1 text-ink-secondary">
                      <Barcode className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
                      {selectedProduct.barcode}
                    </span>
                  )}
                </div>
              </div>

              {/* Retail Price Display */}
              <div className="p-4 rounded-xl bg-raised border border-hairline flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-accent-ink">
                    {isDecant ? 'Catalog rate' : 'Retail price'}
                  </span>
                  <div className="text-3xl font-medium text-ink font-mono tabular-nums mt-0.5">
                    {formatBdt(selectedProduct.retailPriceBdt)}
                  </div>
                  {isDecant && (
                    <div className="text-xs text-ink-muted mt-0.5">
                      Standard pricing base
                    </div>
                  )}
                </div>
                <div className="w-11 h-11 rounded-xl bg-surface border border-hairline flex items-center justify-center text-accent-ink">
                  <Tag className="w-5 h-5" strokeWidth={1.5} />
                </div>
              </div>

              {/* Attar Decant Bottle Sizes Breakdown */}
              {isDecant && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between text-xs font-medium text-ink-secondary">
                    <span className="flex items-center gap-1.5">
                      <Droplet className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
                      <span>Standard decant sizes</span>
                    </span>
                    <span className="text-xs text-ink-muted font-normal">
                      Counter rates
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-lg bg-raised border border-hairline flex items-center justify-between">
                      <div className="text-xs">
                        <div className="font-medium text-ink">3 ml</div>
                        <div className="text-[11px] text-ink-muted">Quarter Tola</div>
                      </div>
                      <div className="font-medium font-mono tabular-nums text-accent-ink text-sm">
                        {formatBdt(decant3mlPrice)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-raised border border-hairline flex items-center justify-between">
                      <div className="text-xs">
                        <div className="font-medium text-ink">6 ml</div>
                        <div className="text-[11px] text-ink-muted">Half Tola</div>
                      </div>
                      <div className="font-medium font-mono tabular-nums text-accent-ink text-sm">
                        {formatBdt(decant6mlPrice)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-raised border border-hairline flex items-center justify-between">
                      <div className="text-xs">
                        <div className="font-medium text-ink">9 ml</div>
                        <div className="text-[11px] text-ink-muted">3/4 Tola</div>
                      </div>
                      <div className="font-medium font-mono tabular-nums text-accent-ink text-sm">
                        {formatBdt(decant9mlPrice)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-accent/12 border border-accent/30 flex items-center justify-between">
                      <div className="text-xs">
                        <div className="font-medium text-accent-ink">12 ml</div>
                        <div className="text-[11px] text-ink-secondary">Full 1 Tola</div>
                      </div>
                      <div className="font-medium font-mono tabular-nums text-accent-ink text-sm">
                        {formatBdt(decant12mlPrice)}
                      </div>
                    </div>
                  </div>

                  {/* Custom Decant Calculator */}
                  <div className="p-3 rounded-lg bg-raised border border-hairline space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-secondary flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
                        <span>Custom volume calculator</span>
                      </span>
                      <span className="font-medium text-ink font-mono tabular-nums">
                        {formatBdt(customCalculatedPrice)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={customMl}
                          onChange={(e) => setCustomMl(e.target.value)}
                          placeholder="ml (e.g. 5)"
                          className="w-full px-3 py-1.5 rounded-lg bg-surface border border-hairline text-ink text-xs font-mono tabular-nums outline-none focus:border-accent"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-muted">
                          ml
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {['2', '5', '10', '15', '20'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCustomMl(val)}
                            className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors duration-150 ease-unslop ${
                              customMl === val
                                ? 'bg-accent text-accent-fg border-accent font-semibold'
                                : 'bg-surface text-ink-muted border-hairline hover:text-ink'
                            }`}
                          >
                            {val}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Wholesale & Commercial Guardrails */}
              <div className="p-3.5 rounded-lg bg-raised border border-hairline space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-hairline">
                  <span className="text-ink-muted font-medium">Wholesale rate</span>
                  <span className="font-medium text-ink font-mono tabular-nums">
                    {selectedProduct.wholesalePriceBdt
                      ? formatBdt(selectedProduct.wholesalePriceBdt)
                      : 'None set'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-hairline">
                  <span className="text-ink-muted font-medium">Minimum allowed price</span>
                  <span className="font-medium text-accent-ink font-mono tabular-nums">
                    {selectedProduct.minPriceBdt
                      ? formatBdt(selectedProduct.minPriceBdt)
                      : formatBdt(selectedProduct.retailPriceBdt)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-muted font-medium">Cost price</span>
                  {hasCostPermission ? (
                    <span className="font-medium text-ink-secondary font-mono tabular-nums">
                      {selectedProduct.calculatedCostBdt
                        ? formatBdt(selectedProduct.calculatedCostBdt)
                        : '৳0.00'}
                    </span>
                  ) : (
                    <span className="text-ink-muted flex items-center gap-1 text-xs">
                      <Lock className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} /> Hidden (Admin)
                    </span>
                  )}
                </div>
              </div>

              {/* Quick POS Navigation Shortcut */}
              <button
                type="button"
                onClick={() => setActiveRoute('pos')}
                className="w-full py-2.5 px-4 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs transition-colors duration-150 ease-unslop flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" strokeWidth={1.75} />
                <span>Open POS Register to Sell</span>
                <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <div className="p-12 rounded-xl bg-surface border border-hairline text-center text-ink-muted space-y-3">
              <Package className="w-10 h-10 mx-auto text-ink-muted" strokeWidth={1.5} />
              <div className="text-sm font-medium text-ink-secondary">No product selected</div>
              <p className="text-xs">Scan a barcode or select a product from the catalog list to view its price matrix</p>
            </div>
          )}
        </div>

        {/* Right Column (7 Cols): Product Catalog List */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs text-ink-muted px-1">
            <span className="tabular-nums">
              Showing <strong className="font-medium text-ink">{filteredProducts.length}</strong> matching products
            </span>
            <span>Click any product to inspect prices</span>
          </div>

          <div className="rounded-xl bg-surface border border-hairline overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-hairline text-ink-muted font-medium bg-raised/70">
                    <th className="py-3 px-3.5">Product name</th>
                    <th className="py-3 px-3.5">Category</th>
                    <th className="py-3 px-3.5 text-right">Retail rate</th>
                    <th className="py-3 px-3.5 text-right">Wholesale</th>
                    <th className="py-3 px-3.5 text-right">Stock</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {filteredProducts.map((prod) => {
                    const isSelected = selectedProduct?.id === prod.id;
                    const stock = prod.primaryStockQuantity ?? 0;
                    return (
                      <tr
                        key={prod.id}
                        onClick={() => setSelectedProduct(prod)}
                        className={`cursor-pointer transition-colors duration-150 ease-unslop ${
                          isSelected
                            ? 'bg-accent/12 hover:bg-accent/15'
                            : 'hover:bg-raised/60'
                        }`}
                      >
                        <td className="py-3 px-3.5">
                          <div
                            className={`font-medium ${
                              isSelected ? 'text-accent-ink' : 'text-ink'
                            }`}
                          >
                            {prod.name}
                          </div>
                          <div className="text-[11px] text-ink-muted font-mono tabular-nums">
                            {prod.sku} {prod.barcode ? `· ${prod.barcode}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-ink-secondary">
                          <span className="px-2 py-0.5 rounded-md text-[11px] bg-raised border border-hairline text-ink-secondary">
                            {prod.categoryName || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-medium text-ink font-mono tabular-nums">
                          {formatBdt(prod.retailPriceBdt)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-medium text-ink-secondary font-mono tabular-nums">
                          {prod.wholesalePriceBdt ? formatBdt(prod.wholesalePriceBdt) : '—'}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono tabular-nums">
                          <span
                            className={
                              stock <= 0
                                ? 'text-negative font-medium'
                                : stock <= 10
                                ? 'text-warning font-medium'
                                : 'text-positive'
                            }
                          >
                            {stock} {prod.sellableType === 'loose_decant' ? 'ml' : 'pcs'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(prod);
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 ease-unslop ${
                              isSelected
                                ? 'bg-accent text-accent-fg font-semibold'
                                : 'bg-raised hover:border-hairline-strong text-ink-secondary border border-hairline'
                            }`}
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-ink-muted">
                        No products match &ldquo;{searchTerm}&rdquo;. Try another name or clear search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
