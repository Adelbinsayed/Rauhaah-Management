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
        <RefreshCw className="w-8 h-8 text-brand-gold animate-spin" />
        <p className="text-xs text-neutral-400 font-mono">Loading product price matrix…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 select-none">
      {/* Header & Search Bar */}
      <div className="p-6 rounded-2xl bg-neutral-900 border border-brand-border text-white shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Tag className="w-6 h-6 text-brand-gold" />
              <span>Quick Price & Decant Checker</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Instantly scan barcodes or search products to check retail rates, wholesale pricing, tola conversions, and stock availability.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="px-2 py-1 rounded bg-neutral-800 border border-brand-border font-mono">
              F2 / /
            </span>
            <span>Focus Search</span>
            <span className="px-2 py-1 rounded bg-neutral-800 border border-brand-border font-mono ml-2">
              Esc
            </span>
            <span>Clear</span>
          </div>
        </div>

        {/* Big Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-brand-gold pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Scan barcode or type fragrance name, SKU, or brand..."
            className="w-full pl-13 pr-12 py-4 rounded-xl bg-neutral-800/90 border-2 border-brand-border focus:border-brand-gold text-white text-base placeholder-neutral-500 font-medium tracking-wide outline-none shadow-inner transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-all ${
              selectedCategory === 'all'
                ? 'bg-brand-gold text-black shadow-md'
                : 'bg-neutral-800 text-neutral-400 hover:text-white border border-brand-border'
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
                className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-brand-gold text-black shadow-md'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white border border-brand-border'
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
            <div className="p-6 rounded-2xl bg-neutral-900 border-2 border-brand-gold/60 text-white shadow-2xl space-y-5 sticky top-4">
              {/* Top Identity */}
              <div className="space-y-2 pb-4 border-b border-brand-border">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-gold/20 text-brand-gold border border-brand-gold/40">
                    {selectedProduct.categoryName || 'General Product'}
                  </span>

                  {/* Stock Status Badge */}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                      stockQty <= 0
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : stockQty <= 10
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {stockQty <= 0 ? (
                      <>
                        <AlertTriangle className="w-3 h-3" />
                        Out of Stock
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        In Stock: {stockQty} {isDecant ? 'ml' : 'pcs'}
                      </>
                    )}
                  </span>
                </div>

                <h2 className="text-xl font-black text-white leading-tight">
                  {selectedProduct.name}
                </h2>

                <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono">
                  <span>SKU: {selectedProduct.sku}</span>
                  {selectedProduct.barcode && (
                    <span className="flex items-center gap-1 text-neutral-300">
                      <Barcode className="w-3.5 h-3.5 text-brand-gold" />
                      {selectedProduct.barcode}
                    </span>
                  )}
                </div>
              </div>

              {/* Retail Price Display */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-brand-gold/15 to-transparent border border-brand-gold/30 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-gold">
                    {isDecant ? 'Catalog Rate' : 'Retail Price'}
                  </span>
                  <div className="text-3xl font-black text-white tracking-tight">
                    {formatBdt(selectedProduct.retailPriceBdt)}
                  </div>
                  {isDecant && (
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      Standard pricing base
                    </div>
                  )}
                </div>
                <div className="w-12 h-12 rounded-2xl bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold">
                  <Tag className="w-6 h-6" />
                </div>
              </div>

              {/* Attar Decant Bottle Sizes Breakdown */}
              {isDecant && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
                    <span className="flex items-center gap-1.5">
                      <Droplet className="w-4 h-4 text-amber-400" />
                      <span>Standard Decant Sizes</span>
                    </span>
                    <span className="text-[11px] text-neutral-400 font-normal">
                      Instant Counter Rates
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-neutral-800/80 border border-brand-border flex items-center justify-between">
                      <div className="text-xs">
                        <div className="font-bold text-white">3 ml</div>
                        <div className="text-[10px] text-neutral-400">Quarter Tola</div>
                      </div>
                      <div className="font-black text-brand-gold text-sm">
                        {formatBdt(decant3mlPrice)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-neutral-800/80 border border-brand-border flex items-center justify-between">
                      <div className="text-xs">
                        <div className="font-bold text-white">6 ml</div>
                        <div className="text-[10px] text-neutral-400">Half Tola</div>
                      </div>
                      <div className="font-black text-brand-gold text-sm">
                        {formatBdt(decant6mlPrice)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-neutral-800/80 border border-brand-border flex items-center justify-between">
                      <div className="text-xs">
                        <div className="font-bold text-white">9 ml</div>
                        <div className="text-[10px] text-neutral-400">3/4 Tola</div>
                      </div>
                      <div className="font-black text-brand-gold text-sm">
                        {formatBdt(decant9mlPrice)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-neutral-800/80 border border-brand-border flex items-center justify-between bg-amber-500/10 border-amber-500/30">
                      <div className="text-xs">
                        <div className="font-bold text-amber-300">12 ml</div>
                        <div className="text-[10px] text-amber-400/80">Full 1 Tola</div>
                      </div>
                      <div className="font-black text-amber-300 text-sm">
                        {formatBdt(decant12mlPrice)}
                      </div>
                    </div>
                  </div>

                  {/* Custom Decant Calculator */}
                  <div className="p-3 rounded-xl bg-neutral-800 border border-brand-border space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-brand-gold" />
                        <span>Custom Volume Calculator</span>
                      </span>
                      <span className="font-bold text-white font-mono">
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
                          placeholder="Type ml (e.g. 5)"
                          className="w-full px-3 py-1.5 rounded-lg bg-neutral-900 border border-brand-border text-white text-xs font-mono outline-none focus:border-brand-gold"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">
                          ml
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {['2', '5', '10', '15', '20'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCustomMl(val)}
                            className={`px-2 py-1 rounded text-[10px] font-semibold border ${
                              customMl === val
                                ? 'bg-brand-gold text-black border-brand-gold'
                                : 'bg-neutral-900 text-neutral-400 border-brand-border hover:text-white'
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
              <div className="p-3.5 rounded-xl bg-neutral-800/80 border border-brand-border space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-brand-border/60">
                  <span className="text-neutral-400 font-semibold">Wholesale Rate:</span>
                  <span className="font-bold text-blue-400 font-mono">
                    {selectedProduct.wholesalePriceBdt
                      ? formatBdt(selectedProduct.wholesalePriceBdt)
                      : 'None set'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-1.5 border-b border-brand-border/60">
                  <span className="text-neutral-400 font-semibold">Min Allowed Price:</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {selectedProduct.minPriceBdt
                      ? formatBdt(selectedProduct.minPriceBdt)
                      : formatBdt(selectedProduct.retailPriceBdt)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 font-semibold">Cost Price:</span>
                  {hasCostPermission ? (
                    <span className="font-bold text-neutral-300 font-mono">
                      {selectedProduct.calculatedCostBdt
                        ? formatBdt(selectedProduct.calculatedCostBdt)
                        : '৳0.00'}
                    </span>
                  ) : (
                    <span className="text-neutral-500 flex items-center gap-1 text-[11px]">
                      <Lock className="w-3 h-3 text-brand-gold" /> Hidden (Admin)
                    </span>
                  )}
                </div>
              </div>

              {/* Quick POS Navigation Shortcut */}
              <button
                type="button"
                onClick={() => setActiveRoute('pos')}
                className="w-full py-3 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-black font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-gold/10"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Open POS Register to Sell</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="p-12 rounded-2xl bg-neutral-900 border border-brand-border text-center text-neutral-500 space-y-3">
              <Package className="w-10 h-10 mx-auto text-neutral-600" />
              <div className="text-sm font-semibold text-neutral-400">No Product Selected</div>
              <p className="text-xs">Scan a barcode or click any product from the catalog list to view its price matrix.</p>
            </div>
          )}
        </div>

        {/* Right Column (7 Cols): Product Catalog List */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
            <span>
              Showing <strong>{filteredProducts.length}</strong> matching products
            </span>
            <span>Click any product to inspect prices</span>
          </div>

          <div className="rounded-2xl bg-neutral-900 border border-brand-border overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-brand-border text-neutral-400 font-semibold uppercase tracking-wider text-[10px] bg-neutral-800/40">
                    <th className="py-3 px-3.5">Product Name</th>
                    <th className="py-3 px-3.5">Category</th>
                    <th className="py-3 px-3.5 text-right">Retail Rate</th>
                    <th className="py-3 px-3.5 text-right">Wholesale</th>
                    <th className="py-3 px-3.5 text-right">Stock</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/40">
                  {filteredProducts.map((prod) => {
                    const isSelected = selectedProduct?.id === prod.id;
                    const stock = prod.primaryStockQuantity ?? 0;
                    return (
                      <tr
                        key={prod.id}
                        onClick={() => setSelectedProduct(prod)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-brand-gold/15 hover:bg-brand-gold/20'
                            : 'hover:bg-neutral-800/50'
                        }`}
                      >
                        <td className="py-3 px-3.5">
                          <div
                            className={`font-semibold ${
                              isSelected ? 'text-brand-gold' : 'text-white'
                            }`}
                          >
                            {prod.name}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {prod.sku} {prod.barcode ? `· ${prod.barcode}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-neutral-400">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 border border-brand-border text-neutral-300">
                            {prod.categoryName || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-white font-mono">
                          {formatBdt(prod.retailPriceBdt)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-medium text-blue-400 font-mono">
                          {prod.wholesalePriceBdt ? formatBdt(prod.wholesalePriceBdt) : '—'}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono">
                          <span
                            className={
                              stock <= 0
                                ? 'text-red-400 font-bold'
                                : stock <= 10
                                ? 'text-amber-400 font-bold'
                                : 'text-emerald-400'
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
                            className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                              isSelected
                                ? 'bg-brand-gold text-black'
                                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-brand-border'
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
                      <td colSpan={6} className="py-12 text-center text-neutral-500">
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
