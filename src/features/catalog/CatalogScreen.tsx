import React, { useEffect, useState, useMemo } from 'react';
import {
  Package,
  Plus,
  PlusCircle,
  Search,
  History,
  Award,
  AlertTriangle,
  Droplet,
  Tag,
  Scan,
  CheckCircle2,
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
import { canEditPrices, canViewCost, hasPermission } from '../../domain/auth/permissions';

interface CatalogScreenProps {
  deviceId?: string;
}

export const CatalogScreen: React.FC<CatalogScreenProps> = ({ deviceId = 'local-device' }) => {
  const { currentUser, permissions } = useAppStore();
  const allowCost = canViewCost(permissions);
  const allowPriceEdit = canEditPrices(permissions);
  const allowStockAdjust = hasPermission(permissions, 'stock.adjust');

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
  const [restockTargetProduct, setRestockTargetProduct] = useState<Sellable | null>(null);
  const [priceHistorySellable, setPriceHistorySellable] = useState<{
    id?: string;
    name?: string;
  } | null>(null);

  // Success Feedback Dialog State
  const [successModal, setSuccessModal] = useState<{
    title: string;
    badgeText: string;
    productName: string;
    message: string;
    details: { label: string; value: string }[];
  } | null>(null);

  useEffect(() => {
    if (!successModal) return;
    const timer = setTimeout(() => {
      setSuccessModal(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [successModal]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [u, c, b, s] = await Promise.all([
        catalogRepo.getUnits(),
        catalogRepo.getCategories(),
        catalogRepo.getBrands(),
        catalogRepo.getSellables(undefined, allowCost),
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
  }, [allowCost]);

  useEffect(() => {
    if (!allowPriceEdit && activeTab === 'bulk_prices') {
      setActiveTab('sellables');
    }
  }, [allowPriceEdit, activeTab]);

  const handleCreateProduct = async (data: CreateProductInput) => {
    if (!currentUser || !allowStockAdjust) return;
    await catalogRepo.createProduct(data, currentUser.id, deviceId);
    await loadData();

    const isOil = data.sellableType === 'loose_decant';
    const unit = isOil ? 'ml' : 'pcs';
    setSuccessModal({
      title: 'Product Added Successfully!',
      badgeText: isOil ? 'Attar / Oil Registered' : 'Packaged Product Registered',
      productName: data.name,
      message: 'New product and inventory have been recorded into your catalog.',
      details: [
        { label: 'Product SKU', value: data.sku || 'Auto-generated' },
        { label: 'Initial Stock Added', value: `${data.initialQuantity || 0} ${unit}` },
        { label: 'Benchmark Retail Price', value: `৳${data.retailPriceBdt.toFixed(2)}` },
        { label: 'Wholesale Price', value: `৳${data.wholesalePriceBdt.toFixed(2)}` },
      ],
    });
  };

  const handleRestock = async (
    sellableId: string,
    addedQuantity: number,
    totalCostPaid: number,
    updateRetailPrice?: number
  ) => {
    if (!currentUser || !allowStockAdjust) return;
    const target = sellables.find((s) => s.id === sellableId);
    await catalogRepo.restockProduct(
      sellableId,
      addedQuantity,
      totalCostPaid,
      currentUser.id,
      deviceId,
      updateRetailPrice
    );
    await loadData();

    const isOil =
      target?.sellableType === 'loose_decant' ||
      target?.name.toLowerCase().includes('oil') ||
      target?.name.toLowerCase().includes('oud') ||
      target?.name.toLowerCase().includes('attar');
    const unit = isOil ? 'ml' : 'pcs';
    const currentQty = target?.primaryStockQuantity ?? 0;
    const newQty = currentQty + addedQuantity;

    setSuccessModal({
      title: 'Stock Updated Successfully!',
      badgeText: 'Restock Complete',
      productName: target?.name || 'Product Restock',
      message: 'Incoming shipment has been recorded and active stock updated.',
      details: [
        { label: 'Quantity Added', value: `+${addedQuantity} ${unit}` },
        { label: 'New Stock in Hand', value: `${newQty} ${unit}` },
        {
          label: 'Benchmark Retail Price',
          value: updateRetailPrice
            ? `৳${updateRetailPrice.toFixed(2)} / ${unit}`
            : `৳${target?.retailPriceBdt.toFixed(2) ?? '0.00'} / ${unit}`,
        },
        ...(allowCost && totalCostPaid > 0
          ? [{ label: 'Total Purchase Cost', value: `৳${totalCostPaid.toFixed(2)}` }]
          : []),
      ],
    });
  };

  const handleSaveBulkPrices = async (items: BulkPriceUpdateItem[]) => {
    if (!currentUser || !allowPriceEdit) return;
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
          <h1 className="text-xl font-medium text-ink flex items-center gap-2">
            <span>Product catalog &amp; pricing</span>
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Manage perfumes, attars, inventory stock, and flexible retail pricing
          </p>
        </div>

        {allowStockAdjust && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setRestockTargetProduct(null);
                setIsRestockModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-hairline hover:border-hairline-strong text-ink text-xs font-medium transition-colors duration-150 ease-unslop"
            >
              <PlusCircle className="w-4 h-4 text-positive" strokeWidth={1.5} />
              <span>+ Restock / Add Purchase</span>
            </button>
            <button
              onClick={() => setIsProductModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold transition-colors duration-150 ease-unslop"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} />
              <span>+ New Product</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-surface border border-hairline">
          <div className="flex items-center justify-between text-ink-muted mb-1.5">
            <span className="text-xs font-medium">Total products</span>
            <Tag className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
          </div>
          <div className="text-2xl font-medium text-ink font-mono tabular-nums">{sellables.length}</div>
          <div className="text-xs text-ink-muted mt-1">Active catalog items</div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-hairline">
          <div className="flex items-center justify-between text-ink-muted mb-1.5">
            <span className="text-xs font-medium">Attar &amp; oils</span>
            <Droplet className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
          </div>
          <div className="text-2xl font-medium text-ink font-mono tabular-nums">{rawOilsCount}</div>
          <div className="text-xs text-ink-muted mt-1">Measured &amp; sold in ml</div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-hairline">
          <div className="flex items-center justify-between text-ink-muted mb-1.5">
            <span className="text-xs font-medium">Packaged perfumes</span>
            <Package className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
          </div>
          <div className="text-2xl font-medium text-ink font-mono tabular-nums">{sellables.length - rawOilsCount}</div>
          <div className="text-xs text-ink-muted mt-1">Bottles, boxes &amp; accessories</div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-hairline">
          <div className="flex items-center justify-between text-ink-muted mb-1.5">
            <span className="text-xs font-medium">Low stock alerts</span>
            <AlertTriangle className="w-4 h-4 text-negative" strokeWidth={1.5} />
          </div>
          <div className="text-2xl font-medium text-ink font-mono tabular-nums">{lowStockCount}</div>
          <div className="text-xs text-negative mt-1">Items needing reorder (&le;5)</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-hairline pb-2">
        {[
          { id: 'sellables', label: 'All Products & Stock', count: sellables.length },
          ...(allowPriceEdit ? [{ id: 'bulk_prices', label: 'Price List & Bulk Editor' }] : []),
          { id: 'taxonomy', label: 'Brands & Categories' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors duration-150 ease-unslop flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-surface text-accent-ink border border-hairline-strong'
                : 'text-ink-muted hover:text-ink hover:bg-raised/60'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="px-1.5 py-0.5 rounded bg-raised text-[11px] font-mono tabular-nums text-ink-muted">
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
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface border border-hairline rounded-xl">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-sm">
                <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" strokeWidth={1.5} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, SKU, or barcode"
                  className="w-full pl-9 pr-3 py-1.5 bg-raised border border-hairline rounded-lg text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
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
                className="px-2.5 py-1.5 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
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
                className="px-2.5 py-1.5 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
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
            <div className="py-12 text-center text-ink-muted text-xs">Loading products…</div>
          ) : filteredSellables.length === 0 ? (
            <div className="py-16 text-center rounded-xl border border-hairline bg-surface space-y-3">
              <div className="w-11 h-11 rounded-xl bg-raised border border-hairline flex items-center justify-center mx-auto text-ink-muted">
                <Tag className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-medium text-ink">No products found</h3>
              <p className="text-xs text-ink-muted max-w-sm mx-auto">
                {sellables.length === 0
                  ? 'Your product catalog is empty. Click + New Product to add your first perfume, attar, or accessory'
                  : 'No products match your current search and category filters'}
              </p>
              {sellables.length === 0 && allowStockAdjust && (
                <button
                  onClick={() => setIsProductModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-accent-fg text-xs font-semibold"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.75} />
                  Add First Product
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-hairline bg-raised/70 text-ink-muted font-medium">
                    <th className="py-3 px-4">Product name &amp; SKU</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Stock in hand</th>
                    <th className="py-3 px-3 text-right">Retail (৳)</th>
                    <th className="py-3 px-3 text-right">Wholesale (৳)</th>
                    {allowCost && <th className="py-3 px-3 text-right">Unit cost (৳)</th>}
                    {allowCost && <th className="py-3 px-3 text-right">Margin</th>}
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline text-ink-secondary">
                  {filteredSellables.map((s) => {
                    let marginPct: string | null = null;
                    if (allowCost && s.calculatedCostBdt && s.retailPriceBdt > 0) {
                      const margin =
                        ((s.retailPriceBdt - s.calculatedCostBdt) / s.retailPriceBdt) * 100;
                      marginPct = `${margin.toFixed(1)}%`;
                    }

                    const isLow = (s.primaryStockQuantity ?? 0) <= 5;

                    return (
                      <tr key={s.id} className="hover:bg-raised/50 transition-colors duration-150 ease-unslop">
                        <td className="py-3 px-4">
                          <div className="font-medium text-ink">{s.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-ink-muted font-mono tabular-nums">
                            <span>SKU {s.sku}</span>
                            {s.barcode && (
                              <span className="flex items-center gap-0.5 text-ink-muted">
                                <Scan className="w-3 h-3" strokeWidth={1.5} />
                                {s.barcode}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                              s.sellableType === 'loose_decant'
                                ? 'bg-accent/12 text-accent-ink border-accent/25'
                                : 'bg-raised text-ink-secondary border-hairline'
                            }`}
                          >
                            {s.sellableType === 'loose_decant' ? 'Attar / Oil' : 'Packaged'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-ink-secondary">{s.categoryName || '—'}</div>
                          <div className="text-[11px] text-ink-muted">{s.brandName || '—'}</div>
                        </td>

                        {/* Stock Quantity */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-medium">
                          <span className={isLow ? 'text-negative' : 'text-positive'}>
                            {s.primaryStockQuantity ?? 0} {s.primaryUnitCode}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-accent-ink">
                          ৳{s.retailPriceBdt.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-ink-secondary">
                          ৳{s.wholesalePriceBdt.toFixed(2)}
                        </td>
                        {allowCost && (
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-ink-muted">
                            {s.calculatedCostBdt != null
                              ? `৳${s.calculatedCostBdt.toFixed(2)}`
                              : '—'}
                          </td>
                        )}
                        {allowCost && (
                          <td className="py-3 px-3 text-right font-mono tabular-nums">
                            {marginPct ? (
                              <span
                                className={
                                  parseFloat(marginPct) > 0 ? 'text-positive' : 'text-negative'
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
                            {allowStockAdjust && (
                              <button
                                onClick={() => {
                                  setRestockTargetProduct(s);
                                  setIsRestockModalOpen(true);
                                }}
                                title={`Direct Restock: ${s.name}`}
                                className="p-1.5 rounded-md hover:bg-raised text-positive transition-colors duration-150 ease-unslop"
                              >
                                <PlusCircle className="w-4 h-4" strokeWidth={1.5} />
                              </button>
                            )}
                            <button
                              onClick={() =>
                                setPriceHistorySellable({ id: s.id, name: s.name })
                              }
                              title="View Price Revision History"
                              className="p-1.5 rounded-md text-ink-muted hover:text-accent-ink hover:bg-raised transition-colors duration-150 ease-unslop"
                            >
                              <History className="w-4 h-4" strokeWidth={1.5} />
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

      {activeTab === 'bulk_prices' && allowPriceEdit && (
        <BulkPriceEditor
          sellables={sellables}
          onSavePrices={handleSaveBulkPrices}
          canViewCost={allowCost}
          canEdit={allowPriceEdit}
        />
      )}

      {activeTab === 'taxonomy' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Categories Card */}
          <div className="p-5 rounded-xl bg-surface border border-hairline space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-hairline">
              <h3 className="text-sm font-medium text-ink flex items-center gap-2">
                <Tag className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
                <span>Categories ({categories.length})</span>
              </h3>
            </div>
            <div className="space-y-2">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-raised/60 border border-hairline text-xs"
                >
                  <span className="font-medium text-ink">{c.name}</span>
                  <span className="text-[11px] text-ink-muted font-mono">{c.slug}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Brands Card */}
          <div className="p-5 rounded-xl bg-surface border border-hairline space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-hairline">
              <h3 className="text-sm font-medium text-ink flex items-center gap-2">
                <Award className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
                <span>Fragrance brands &amp; houses ({brands.length})</span>
              </h3>
            </div>
            <div className="space-y-2">
              {brands.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-raised/60 border border-hairline text-xs"
                >
                  <div>
                    <span className="font-medium text-ink">{b.name}</span>
                    {b.description && (
                      <p className="text-[11px] text-ink-muted mt-0.5">{b.description}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-accent-ink font-medium">
                    {b.countryOfOrigin || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {allowStockAdjust && (
        <ProductModal
          isOpen={isProductModalOpen}
          onClose={() => setIsProductModalOpen(false)}
          onSaveProduct={handleCreateProduct}
          categories={categories}
          brands={brands}
          units={units}
          canViewCost={allowCost}
        />
      )}

      {allowStockAdjust && (
        <RestockModal
          isOpen={isRestockModalOpen}
          initialProduct={restockTargetProduct}
          onClose={() => {
            setIsRestockModalOpen(false);
            setRestockTargetProduct(null);
          }}
          sellables={sellables}
          onRestock={handleRestock}
          canViewCost={allowCost}
        />
      )}

      <PriceHistoryModal
        isOpen={Boolean(priceHistorySellable)}
        onClose={() => setPriceHistorySellable(null)}
        sellableId={priceHistorySellable?.id}
        sellableName={priceHistorySellable?.name}
      />

      {/* Success Modal */}
      {successModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
          <div className="w-full max-w-sm bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-xl bg-positive/10 border border-positive/25 flex items-center justify-center text-positive">
              <CheckCircle2 className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium bg-positive/10 text-positive border border-positive/25 mb-1.5">
                {successModal.badgeText}
              </span>
              <h3 className="text-base font-medium text-ink">{successModal.title}</h3>
              <p className="text-sm font-medium text-accent-ink mt-0.5">{successModal.productName}</p>
              <p className="text-xs text-ink-muted mt-0.5">{successModal.message}</p>
            </div>

            <div className="bg-raised border border-hairline rounded-xl p-3 space-y-1.5 text-left text-xs">
              {successModal.details.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-ink-secondary">
                  <span className="text-ink-muted">{item.label}</span>
                  <span className="font-medium text-ink font-mono tabular-nums">{item.value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSuccessModal(null)}
              autoFocus
              className="w-full py-2.5 px-4 rounded-lg bg-positive hover:opacity-90 text-white font-semibold text-xs transition-opacity duration-150 ease-unslop cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
