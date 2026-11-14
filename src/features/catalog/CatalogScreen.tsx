import React, { useEffect, useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  History,
  Sparkles,
  AlertTriangle,
  Layers,
  Droplet,
  Tag,
  Scan,
} from 'lucide-react';
import { catalogRepo } from '../../data/repositories/catalogRepo';
import type {
  Brand,
  Category,
  CreateAttarIntakeInput,
  CreateProductInput,
  CreateStockItemInput,
  BulkPriceUpdateItem,
  Sellable,
  StockItem,
  Unit,
} from '../../domain/catalog/types';
import { ProductModal } from './ProductModal';
import { StockItemModal } from './StockItemModal';
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

  const [activeTab, setActiveTab] = useState<'sellables' | 'stock' | 'bulk_prices' | 'taxonomy'>(
    'sellables'
  );

  const [sellables, setSellables] = useState<Sellable[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
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
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [priceHistorySellable, setPriceHistorySellable] = useState<{
    id?: string;
    name?: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [u, c, b, s, st] = await Promise.all([
        catalogRepo.getUnits(),
        catalogRepo.getCategories(),
        catalogRepo.getBrands(),
        catalogRepo.getSellables(undefined, canViewCost),
        catalogRepo.getStockItems(undefined, canViewCost),
      ]);
      setUnits(u);
      setCategories(c);
      setBrands(b);
      setSellables(s);
      setStockItems(st);
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

  const handleSaveAttarIntake = async (data: CreateAttarIntakeInput) => {
    if (!currentUser) return;
    await catalogRepo.createAttarIntake(data, currentUser.id, deviceId);
    await loadData();
  };

  const handleCreateStockItem = async (data: CreateStockItemInput) => {
    if (!currentUser) return;
    await catalogRepo.createStockItem(data, currentUser.id, deviceId);
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

  const filteredStockItems = useMemo(() => {
    return stockItems.filter((st) => {
      const matchSearch =
        !search.trim() ||
        st.name.toLowerCase().includes(search.toLowerCase()) ||
        st.sku.toLowerCase().includes(search.toLowerCase());

      const matchCat = selectedCategory === 'all' || st.categoryId === selectedCategory;
      const matchBrand = selectedBrand === 'all' || st.brandId === selectedBrand;
      const matchType = selectedType === 'all' || st.itemType === selectedType;

      return matchSearch && matchCat && matchBrand && matchType;
    });
  }, [stockItems, search, selectedCategory, selectedBrand, selectedType]);

  // KPI calculations
  const rawOilsCount = stockItems.filter((s) => s.itemType === 'raw_oil').length;
  const lowStockCount = stockItems.filter((s) => s.currentQuantity <= s.minAlertQuantity).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Product Catalog & Pricing</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Manage perfume oils, decants, sealed products, packaging, and wholesale/retail price lists.
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsStockModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition-colors"
            >
              <Package className="w-4 h-4 text-emerald-400" />
              <span>+ Stock Item</span>
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
            <span className="text-xs font-medium">Sellable Products</span>
            <Tag className="w-4 h-4 text-brand-gold" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{sellables.length}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Active retail & wholesale SKUs</div>
        </div>

        <div className="p-4 rounded-xl bg-brand-surface border border-brand-border">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-xs font-medium">Bulk Attar / Oils</span>
            <Droplet className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{rawOilsCount}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Concentrated perfume oils</div>
        </div>

        <div className="p-4 rounded-xl bg-brand-surface border border-brand-border">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-xs font-medium">Total Stock Items</span>
            <Layers className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stockItems.length}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Raw oils, bottles & boxes</div>
        </div>

        <div className="p-4 rounded-xl bg-brand-surface border border-brand-border">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-xs font-medium">Low Stock Alerts</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{lowStockCount}</div>
          <div className="text-[10px] text-red-400 mt-0.5">Items needing reorder</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-brand-border pb-1">
        {[
          { id: 'sellables', label: 'Products (Sellables)', count: sellables.length },
          { id: 'stock', label: 'Raw Stock & Packaging', count: stockItems.length },
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
                <option value="sealed_product">Sealed Perfumes</option>
                <option value="loose_decant">Loose Decants</option>
                <option value="custom_blend">Custom Blends</option>
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
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Category & Brand</th>
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
                                : s.sellableType === 'custom_blend'
                                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                : 'bg-neutral-800 text-neutral-300'
                            }`}
                          >
                            {s.sellableType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-neutral-200">{s.categoryName || '—'}</div>
                          <div className="text-[10px] text-neutral-400">{s.brandName || '—'}</div>
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
                          <button
                            onClick={() =>
                              setPriceHistorySellable({ id: s.id, name: s.name })
                            }
                            title="View Price Revision History"
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-brand-gold hover:bg-brand-black transition-colors"
                          >
                            <History className="w-4 h-4" />
                          </button>
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

      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Stock Search Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-brand-surface border border-brand-border rounded-xl">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-sm">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search raw oils, bottles, boxes..."
                  className="w-full pl-9 pr-3 py-1.5 bg-brand-black border border-brand-border rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-2.5 py-1.5 bg-brand-black border border-brand-border rounded-lg text-xs text-white"
              >
                <option value="all">All Item Types</option>
                <option value="raw_oil">Raw Perfume Oil</option>
                <option value="empty_bottle">Empty Bottles</option>
                <option value="packaging">Packaging / Boxes</option>
                <option value="raw_material">Raw Materials</option>
              </select>
            </div>
          </div>

          {/* Stock Table */}
          {loading ? (
            <div className="py-12 text-center text-neutral-400 text-xs">Loading stock items...</div>
          ) : filteredStockItems.length === 0 ? (
            <div className="py-16 text-center rounded-xl border border-brand-border bg-brand-surface space-y-3">
              <Package className="w-8 h-8 text-neutral-500 mx-auto" />
              <h3 className="text-sm font-semibold text-white">No stock items</h3>
              <p className="text-xs text-neutral-400">
                Bulk oils, empty bottles, and packaging materials appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-surface">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-brand-border bg-brand-black/70 text-neutral-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Item Name & SKU</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3 text-right">Current Stock</th>
                    <th className="py-3 px-3 text-right">Density</th>
                    {canViewCost && <th className="py-3 px-3 text-right">Cost Price (৳)</th>}
                    <th className="py-3 px-3 text-center">Alert Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/50 text-neutral-300">
                  {filteredStockItems.map((st) => {
                    const isLow = st.currentQuantity <= st.minAlertQuantity;
                    return (
                      <tr key={st.id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{st.name}</div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            SKU: {st.sku}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="capitalize text-[11px] text-neutral-300">
                            {st.itemType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white">
                          {st.currentQuantity} {st.unitCode}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-neutral-400">
                          {st.densityGPerMl ? `${st.densityGPerMl} g/ml` : '—'}
                        </td>
                        {canViewCost && (
                          <td className="py-3 px-3 text-right font-mono text-emerald-400">
                            ৳{st.costPriceBdt.toFixed(2)} / {st.unitCode}
                          </td>
                        )}
                        <td className="py-3 px-3 text-center">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 font-semibold border border-red-500/30">
                              <AlertTriangle className="w-3 h-3" />
                              Low Stock (&le;{st.minAlertQuantity})
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-400">Normal</span>
                          )}
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
                <span>Fragrance Brands & Houses ({brands.length})</span>
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
        onSaveAttarIntake={handleSaveAttarIntake}
        categories={categories}
        brands={brands}
        units={units}
        stockItems={stockItems}
        canViewCost={canViewCost}
      />

      <StockItemModal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        onSave={handleCreateStockItem}
        categories={categories}
        brands={brands}
        units={units}
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
