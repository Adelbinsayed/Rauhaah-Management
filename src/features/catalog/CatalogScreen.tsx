import React, { useEffect, useState, useMemo } from 'react';
import {
  Package,
  Plus,
  PlusCircle,
  Search,
  History,
  Sparkles,
  AlertTriangle,
  Droplet,
  Tag,
  Scan,
} from 'lucide-react';
import { catalogRepo } from '../../data/repositories/catalogRepo';
import type {
  Brand,
  Category,
  CreateProductInput,
  BulkPriceUpdateItem,
  Sellable,
  Unit,
} from '../../domain/catalog/types';
import { ProductModal } from './ProductModal';
import { RestockModal } from './RestockModal';
import { BulkPriceEditor } from './BulkPriceEditor';
import { PriceHistoryModal } from './PriceHistoryModal';
import { useAppStore } from '../../app/store';

interface CatalogScreenProps {
  deviceId?: string;
}

export const CatalogScreen: React.FC<CatalogScreenProps> = ({ deviceId = 'local-device' }) => {
  const { currentUser } = useAppStore();
  const canViewCost = Boolean(currentUser && currentUser.roleName !== 'staff');
  const canEdit = Boolean(currentUser && currentUser.roleName !== 'staff');

  const [activeTab, setActiveTab] = useState<'sellables' | 'bulk_prices' | 'taxonomy'>('sellables');

  const [sellables, setSellables] = useState<Sellable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [priceHistorySellable, setPriceHistorySellable] = useState<{
    id?: string;
    name?: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [u, c, b, s] = await Promise.all([
        catalogRepo.getUnits(),
        catalogRepo.getCategories(),
        catalogRepo.getBrands(),
        catalogRepo.getSellables(undefined, canViewCost),
      ]);
      setUnits(u);
      setCategories(c);
      setBrands(b);
      setSellables(s);
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [canViewCost]);

  const handleCreateProduct = async (data: CreateProductInput) => {
    if (!currentUser) return;
    await catalogRepo.createProduct(data, currentUser.id, deviceId);
    await loadData();
  };

  const handleRestock = async (
    sellableId: string,
    addedQuantity: number,
    totalCostPaid: number,
    updateRetailPrice?: number
  ) => {
    if (!currentUser) return;
    await catalogRepo.restockProduct(
      sellableId,
      addedQuantity,
      totalCostPaid,
      currentUser.id,
      deviceId,
      updateRetailPrice
    );
    await loadData();
  };

  const handleSaveBulkPrices = async (items: BulkPriceUpdateItem[]) => {
    if (!currentUser) return;
    await catalogRepo.bulkUpdatePrices(items, currentUser.id, deviceId);
    await loadData();
  };

  // Filtered lists
  const filteredSellables = useMemo(() => {
    return sellables.filter((s) => {
      const matchSearch =
        !search.trim() ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.sku.toLowerCase().includes(search.toLowerCase()) ||
        (s.barcode && s.barcode.toLowerCase().includes(search.toLowerCase()));

      const matchCat = selectedCategory === 'all' || s.categoryId === selectedCategory;
      const matchBrand = selectedBrand === 'all' || s.brandId === selectedBrand;
      const matchType = selectedType === 'all' || s.sellableType === selectedType;

      return matchSearch && matchCat && matchBrand && matchType;
    });
  }, [sellables, search, selectedCategory, selectedBrand, selectedType]);

  // KPI calculations
  const rawOilsCount = sellables.filter((s) => s.sellableType === 'loose_decant' || s.name.toLowerCase().includes('oud') || s.name.toLowerCase().includes('oil')).length;
  const lowStockCount = sellables.filter((s) => (s.primaryStockQuantity ?? 0) <= 5).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Product Catalog &amp; Pricing</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Manage your perfumes, attars, inventory stock, and flexible retail pricing.
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsRestockModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Restock / Add Purchase</span>
            </button>
            <button
              onClick={() => setIsProductModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-brand-black text-xs font-semibold transition-colors shadow-lg shadow-brand-gold/20"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Product</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-brand-surface border border-brand-border">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-xs font-medium">Total Products</span>
            <Tag className="w-4 h-4 text-brand-gold" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{sellables.length}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Active catalog items</div>
        </div>

        <div className="p-4 rounded-xl bg-brand-surface border border-brand-border">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-xs font-medium">Attar &amp; Oils</span>
            <Droplet className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{rawOilsCount}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Measured &amp; sold in ml</div>
        </div>

        <div className="p-4 rounded-xl bg-brand-surface border border-brand-border">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-xs font-medium">Packaged Perfumes</span>
            <Package className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{sellables.length - rawOilsCount}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Bottles, boxes &amp; accessories</div>
        </div>

        <div className="p-4 rounded-xl bg-brand-surface border border-brand-border">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-xs font-medium">Low Stock Alerts</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{lowStockCount}</div>
          <div className="text-[10px] text-red-400 mt-0.5">Items needing reorder (&le;5)</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-brand-border pb-1">
        {[
          { id: 'sellables', label: 'All Products & Stock', count: sellables.length },
          { id: 'bulk_prices', label: 'Price List & Bulk Editor' },
          { id: 'taxonomy', label: 'Brands & Categories' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-brand-surface text-brand-gold border border-brand-border'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full bg-brand-black text-[10px] font-mono text-neutral-400">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'sellables' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-brand-surface border border-brand-border rounded-xl">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-sm">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, SKU, or scan barcode..."
                  className="w-full pl-9 pr-3 py-1.5 bg-brand-black border border-brand-border rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
                />
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-brand-black border border-brand-border rounded-lg text-xs text-white"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="px-2.5 py-1.5 bg-brand-black border border-brand-border rounded-lg text-xs text-white"
              >
                <option value="all">All Brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-2.5 py-1.5 bg-brand-black border border-brand-border rounded-lg text-xs text-white"
              >
                <option value="all">All Product Types</option>
                <option value="loose_decant">Attar / Oils (ml)</option>
                <option value="sealed_product">Sealed Perfumes &amp; Boxes</option>
                <option value="accessory">Accessories</option>
              </select>
            </div>
          </div>

          {/* Sellables Table */}
          {loading ? (
            <div className="py-12 text-center text-neutral-400 text-xs">Loading products...</div>
          ) : filteredSellables.length === 0 ? (
            <div className="py-16 text-center rounded-xl border border-brand-border bg-brand-surface space-y-3">
              <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
                <Tag className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">No products found</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                {sellables.length === 0
                  ? 'Your product catalog is empty. Click "+ New Product" to add your first perfume, attar, or accessory.'
                  : 'No products match your current search and category filters.'}
              </p>
              {sellables.length === 0 && canEdit && (
                <button
                  onClick={() => setIsProductModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-gold text-brand-black text-xs font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Add First Product
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-surface">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-brand-border bg-brand-black/70 text-neutral-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Product Name &amp; SKU</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Stock in Hand</th>
                    <th className="py-3 px-3 text-right">Retail (৳)</th>
                    <th className="py-3 px-3 text-right">Wholesale (৳)</th>
                    {canViewCost && <th className="py-3 px-3 text-right">Unit Cost (৳)</th>}
                    {canViewCost && <th className="py-3 px-3 text-right">Margin</th>}
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/50 text-neutral-300">
                  {filteredSellables.map((s) => {
                    let marginPct: string | null = null;
                    if (canViewCost && s.calculatedCostBdt && s.retailPriceBdt > 0) {
                      const margin =
                        ((s.retailPriceBdt - s.calculatedCostBdt) / s.retailPriceBdt) * 100;
                      marginPct = `${margin.toFixed(1)}%`;
                    }

                    const isLow = (s.primaryStockQuantity ?? 0) <= 5;

                    return (
                      <tr key={s.id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{s.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400 font-mono">
                            <span>SKU: {s.sku}</span>
                            {s.barcode && (
                              <span className="flex items-center gap-0.5 text-neutral-400">
                                <Scan className="w-3 h-3 text-neutral-500" />
                                {s.barcode}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              s.sellableType === 'loose_decant'
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-neutral-800 text-neutral-300'
                            }`}
                          >
                            {s.sellableType === 'loose_decant' ? 'Attar / Oil' : 'Packaged'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-neutral-200">{s.categoryName || '—'}</div>
                          <div className="text-[10px] text-neutral-400">{s.brandName || '—'}</div>
                        </td>

                        {/* Stock Quantity */}
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <span className={isLow ? 'text-red-400' : 'text-emerald-400'}>
                            {s.primaryStockQuantity ?? 0} {s.primaryUnitCode}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-brand-gold">
                          ৳{s.retailPriceBdt.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-neutral-300">
                          ৳{s.wholesalePriceBdt.toFixed(2)}
                        </td>
                        {canViewCost && (
                          <td className="py-3 px-3 text-right font-mono text-neutral-400">
                            {s.calculatedCostBdt != null
                              ? `৳${s.calculatedCostBdt.toFixed(2)}`
                              : '—'}
                          </td>
                        )}
                        {canViewCost && (
                          <td className="py-3 px-3 text-right font-mono">
                            {marginPct ? (
                              <span
                                className={
                                  parseFloat(marginPct) > 0 ? 'text-emerald-400' : 'text-red-400'
                                }
                              >
                                {marginPct}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        )}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {canEdit && (
                              <button
                                onClick={() => setIsRestockModalOpen(true)}
                                title="Add Received Shipment / Restock"
                                className="p-1 rounded hover:bg-neutral-800 text-emerald-400 hover:text-emerald-300 transition-colors"
                              >
                                <PlusCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() =>
                                setPriceHistorySellable({ id: s.id, name: s.name })
                              }
                              title="View Price Revision History"
                              className="p-1 rounded text-neutral-400 hover:text-brand-gold hover:bg-neutral-800 transition-colors"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'bulk_prices' && (
        <BulkPriceEditor
          sellables={sellables}
          onSavePrices={handleSaveBulkPrices}
          canViewCost={canViewCost}
        />
      )}

      {activeTab === 'taxonomy' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Categories Card */}
          <div className="p-5 rounded-xl bg-brand-surface border border-brand-border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-brand-border">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-brand-gold" />
                <span>Categories ({categories.length})</span>
              </h3>
            </div>
            <div className="space-y-2">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-brand-black/50 border border-brand-border text-xs"
                >
                  <span className="font-semibold text-white">{c.name}</span>
                  <span className="text-[10px] text-neutral-500 font-mono">{c.slug}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Brands Card */}
          <div className="p-5 rounded-xl bg-brand-surface border border-brand-border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-brand-border">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-gold" />
                <span>Fragrance Brands &amp; Houses ({brands.length})</span>
              </h3>
            </div>
            <div className="space-y-2">
              {brands.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-brand-black/50 border border-brand-border text-xs"
                >
                  <div>
                    <span className="font-semibold text-white">{b.name}</span>
                    {b.description && (
                      <p className="text-[10px] text-neutral-400 mt-0.5">{b.description}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-brand-gold font-medium">
                    {b.countryOfOrigin || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSaveProduct={handleCreateProduct}
        categories={categories}
        brands={brands}
        units={units}
        canViewCost={canViewCost}
      />

      <RestockModal
        isOpen={isRestockModalOpen}
        onClose={() => setIsRestockModalOpen(false)}
        sellables={sellables}
        onRestock={handleRestock}
        canViewCost={canViewCost}
      />

      <PriceHistoryModal
        isOpen={Boolean(priceHistorySellable)}
        onClose={() => setPriceHistorySellable(null)}
        sellableId={priceHistorySellable?.id}
        sellableName={priceHistorySellable?.name}
      />
    </div>
  );
};
