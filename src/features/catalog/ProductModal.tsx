import React, { useState, useEffect } from 'react';
import { X, PackagePlus, AlertCircle, Droplet, Box, Tag, RefreshCw } from 'lucide-react';
import type {
  Brand,
  Category,
  CreateProductInput,
  SellableType,
  Unit,
} from '../../domain/catalog/types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveProduct: (data: CreateProductInput) => Promise<void>;
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  canViewCost: boolean;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSaveProduct,
  categories,
  brands,
  units,
  canViewCost,
}) => {
  const [productKind, setProductKind] = useState<'oil' | 'packaged'>('oil');

  // Common Info
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');

  // Volume / Quantity bought
  const [quantityBought, setQuantityBought] = useState('100');
  const [purchaseCostTotal, setPurchaseCostTotal] = useState('10000');
  const [overheadPercent, setOverheadPercent] = useState('15'); // +15% landing cost
  const [marginPercent, setMarginPercent] = useState('25'); // +25% markup

  // Pricing: if null, automatically follows the live formula!
  const [customRetailPrice, setCustomRetailPrice] = useState<string | null>(null);
  const [customWholesalePrice, setCustomWholesalePrice] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState('unit-vol-ml');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic unit measurement based on product type:
  // If oil -> unit is 'ml'. If packaged -> unit is 'pcs' / 'bottle'.
  useEffect(() => {
    if (productKind === 'oil') {
      const mlUnit = units.find((u) => u.code === 'ml');
      if (mlUnit) setSelectedUnitId(mlUnit.id);
      const attarCat = categories.find((c) => c.slug.includes('attar') || c.name.toLowerCase().includes('attar'));
      if (attarCat && !categoryId) setCategoryId(attarCat.id);
    } else {
      const pcsUnit = units.find((u) => u.code === 'pcs' || u.code === 'bottle');
      if (pcsUnit) setSelectedUnitId(pcsUnit.id);
    }
  }, [productKind, units, categories, categoryId]);

  // Real-time automatic math
  const qty = parseFloat(quantityBought) || 0;
  const totalCost = parseFloat(purchaseCostTotal) || 0;
  const overhead = parseFloat(overheadPercent) || 0;
  const margin = parseFloat(marginPercent) || 0;

  const baseRate = qty > 0 ? totalCost / qty : 0;
  const trueCostRate = baseRate * (1 + overhead / 100);
  const autoIdealSellRate = Math.round(trueCostRate * (1 + margin / 100));
  const autoWholesaleRate = Math.round(autoIdealSellRate * 0.85);

  const displayRetail = customRetailPrice !== null ? customRetailPrice : (autoIdealSellRate > 0 ? String(autoIdealSellRate) : '');
  const displayWholesale = customWholesalePrice !== null ? customWholesalePrice : (autoWholesaleRate > 0 ? String(autoWholesaleRate) : '');

  const handleQuantityChange = (val: string) => {
    setQuantityBought(val);
    setCustomRetailPrice(null); // auto-sync to new calculation
    setCustomWholesalePrice(null);
  };

  const handleCostChange = (val: string) => {
    setPurchaseCostTotal(val);
    setCustomRetailPrice(null); // auto-sync to new calculation
    setCustomWholesalePrice(null);
  };

  const handleOverheadChange = (val: string) => {
    setOverheadPercent(val);
    setCustomRetailPrice(null);
    setCustomWholesalePrice(null);
  };

  const handleMarginChange = (val: string) => {
    setMarginPercent(val);
    setCustomRetailPrice(null);
    setCustomWholesalePrice(null);
  };

  if (!isOpen) return null;

  const unitCode = productKind === 'oil' ? 'ml' : 'pcs';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a product name.');
      return;
    }

    const rPrice = parseFloat(displayRetail) || autoIdealSellRate;
    const wPrice = parseFloat(displayWholesale) || autoWholesaleRate;

    if (rPrice <= 0) {
      setError('Please specify a valid Retail Selling Price.');
      return;
    }

    try {
      setLoading(true);

      const sellableType: SellableType =
        productKind === 'oil' ? 'loose_decant' : 'sealed_product';

      const payload: CreateProductInput = {
        name: name.trim(),
        sku: sku.trim() || undefined,
        barcode: barcode.trim() || undefined,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        sellableType,
        retailPriceBdt: rPrice,
        wholesalePriceBdt: wPrice,
        minPriceBdt: Math.round(trueCostRate),
        costPriceBdt: Math.round(trueCostRate * 100) / 100,
        initialQuantity: qty,
        minAlertQuantity: productKind === 'oil' ? 20 : 5,
        unitId: selectedUnitId,
      };

      await onSaveProduct(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] overflow-y-auto">
      <div className="w-full max-w-xl bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 my-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-hairline">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/12 border border-accent/25 flex items-center justify-center text-accent-ink">
              <PackagePlus className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-base font-medium text-ink">Add new product</h2>
              <p className="text-xs text-ink-muted">
                Automatic +15% true cost &amp; +25% live benchmark pricing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised transition-colors duration-150 ease-unslop"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Product Type Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-raised border border-hairline rounded-lg">
          <button
            type="button"
            onClick={() => {
              setProductKind('oil');
              handleQuantityChange('100');
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors duration-150 ease-unslop ${
              productKind === 'oil'
                ? 'bg-accent text-accent-fg font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Droplet className="w-4 h-4" strokeWidth={1.5} />
            <span>Attar / Perfume Oil (ml)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProductKind('packaged');
              handleQuantityChange('20');
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors duration-150 ease-unslop ${
              productKind === 'packaged'
                ? 'bg-accent text-accent-fg font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Box className="w-4 h-4" strokeWidth={1.5} />
            <span>Packaged / Accessory (pcs)</span>
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-ink-secondary mb-1">
                Product name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={productKind === 'oil' ? 'Black Oud / Cambodian Dehn Al Oudh' : 'Baccarat Rouge EDP 50ml'}
                className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-sm text-ink focus:outline-none focus:border-accent"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">
                Brand / fragrance house
              </label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-sm text-ink focus:outline-none focus:border-accent"
              >
                <option value="">Select Brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">
                SKU (optional)
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">
                Barcode (optional USB scan)
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or type barcode"
                className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent font-mono"
              />
            </div>
          </div>

          {/* Initial Purchase & Costing Card */}
          <div className="p-4 rounded-xl bg-raised/60 border border-hairline space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-accent-ink flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Purchase volume &amp; cost</span>
              </h3>
              <span className="text-xs text-ink-muted">Unit: <strong className="text-ink font-medium">{unitCode}</strong></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Quantity / volume bought ({unitCode}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={quantityBought}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-sm text-ink font-mono tabular-nums focus:outline-none focus:border-accent"
                />
                <span className="text-[11px] text-ink-muted mt-0.5 block">Quantity added to inventory</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Total purchase cost paid (৳) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={purchaseCostTotal}
                  onChange={(e) => handleCostChange(e.target.value)}
                  placeholder="10000"
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-sm text-ink font-mono tabular-nums focus:outline-none focus:border-accent"
                />
                <span className="text-[11px] text-ink-muted mt-0.5 block">Total paid to supplier</span>
              </div>
            </div>

            {/* Live Automatic Math Cards (Protected: Owner/Manager only) */}
            {canViewCost && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-hairline">
                <div className="p-2.5 rounded-lg bg-surface border border-hairline text-center">
                  <div className="text-[11px] text-ink-muted">Base purchase rate</div>
                  <div className="text-xs font-mono tabular-nums font-medium text-ink mt-0.5">
                    ৳{baseRate.toFixed(2)} / {unitCode}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-warning/10 border border-warning/25 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-warning font-medium">
                    <span>+</span>
                    <input
                      type="number"
                      value={overheadPercent}
                      onChange={(e) => handleOverheadChange(e.target.value)}
                      className="w-7 text-center bg-transparent border-b border-warning font-medium text-warning text-[11px] focus:outline-none tabular-nums"
                    />
                    <span>% true cost</span>
                  </div>
                  <div className="text-xs font-mono tabular-nums font-medium text-warning mt-0.5">
                    ৳{trueCostRate.toFixed(2)} / {unitCode}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-positive/10 border border-positive/25 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-positive font-medium">
                    <span>+</span>
                    <input
                      type="number"
                      value={marginPercent}
                      onChange={(e) => handleMarginChange(e.target.value)}
                      className="w-7 text-center bg-transparent border-b border-positive font-medium text-positive text-[11px] focus:outline-none tabular-nums"
                    />
                    <span>% ideal sell</span>
                  </div>
                  <div className="text-xs font-mono tabular-nums font-medium text-positive mt-0.5">
                    ৳{autoIdealSellRate} / {unitCode}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Benchmark Selling Prices */}
          <div className="p-4 rounded-xl bg-raised/60 border border-hairline space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-accent-ink flex items-center gap-2">
                <span>Benchmark selling prices (৳ / {unitCode})</span>
                {customRetailPrice === null && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-positive/10 text-positive font-medium">
                    auto-updating
                  </span>
                )}
              </h3>
              {customRetailPrice !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomRetailPrice(null);
                    setCustomWholesalePrice(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline"
                >
                  <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                  Reset to auto-formula
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Ideal retail price (৳ / {unitCode}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={displayRetail}
                  onChange={(e) => setCustomRetailPrice(e.target.value)}
                  placeholder={String(autoIdealSellRate)}
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-sm text-accent-ink font-mono tabular-nums font-medium focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Wholesale price (৳ / {unitCode})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={displayWholesale}
                  onChange={(e) => setCustomWholesalePrice(e.target.value)}
                  placeholder={String(autoWholesaleRate)}
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-sm text-ink font-mono tabular-nums focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            <p className="text-xs text-ink-muted">
              Benchmark reference price. At the POS counter you can adjust or discount freely during sales negotiation.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-hairline">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-hairline bg-raised text-ink-secondary hover:text-ink text-xs font-medium transition-colors duration-150 ease-unslop"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs transition-colors duration-150 ease-unslop disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
