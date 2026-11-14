import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, Droplet, Box, Tag } from 'lucide-react';
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

  // Pricing (can be overridden manually)
  const [retailPrice, setRetailPrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('unit-vol-ml');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic unit measurement based on product type:
  // If oil -> unit is 'ml'. If packaged -> unit is 'pcs' / 'bottle'.
  useEffect(() => {
    if (productKind === 'oil') {
      const mlUnit = units.find((u) => u.code === 'ml');
      if (mlUnit) setSelectedUnitId(mlUnit.id);
      // Auto-set category if available
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

  // Auto-populate retail and wholesale if user hasn't explicitly entered them
  useEffect(() => {
    if (autoIdealSellRate > 0 && !retailPrice) {
      setRetailPrice(String(autoIdealSellRate));
    }
    if (autoWholesaleRate > 0 && !wholesalePrice) {
      setWholesalePrice(String(autoWholesaleRate));
    }
  }, [autoIdealSellRate, autoWholesaleRate, retailPrice, wholesalePrice]);

  if (!isOpen) return null;

  const unitCode = productKind === 'oil' ? 'ml' : 'pcs';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a product name.');
      return;
    }

    const rPrice = parseFloat(retailPrice) || autoIdealSellRate;
    const wPrice = parseFloat(wholesalePrice) || autoWholesaleRate;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-xl bg-brand-surface border border-brand-border rounded-xl shadow-2xl p-6 my-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-brand-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Add New Product</h2>
              <p className="text-xs text-neutral-400">
                Single entry product creation with automatic +15% cost &amp; +25% pricing rules.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Type Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-brand-black border border-brand-border rounded-lg">
          <button
            type="button"
            onClick={() => {
              setProductKind('oil');
              setQuantityBought('100');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-semibold transition-all ${
              productKind === 'oil'
                ? 'bg-brand-gold text-brand-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Droplet className="w-4 h-4" />
            <span>Attar / Perfume Oil (in ml)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProductKind('packaged');
              setQuantityBought('20');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-semibold transition-all ${
              productKind === 'packaged'
                ? 'bg-brand-gold text-brand-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Box className="w-4 h-4" />
            <span>Packaged Perfume / Accessory (in pieces)</span>
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={productKind === 'oil' ? 'e.g. Black Oud / Cambodian Dehn Al Oudh' : 'e.g. Baccarat Rouge EDP 50ml'}
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
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
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Brand / Fragrance House
              </label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
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
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                SKU (Optional)
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Barcode (Optional USB Scan)
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or type barcode"
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold font-mono"
              />
            </div>
          </div>

          {/* Initial Purchase & Costing Card */}
          <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                <span>Initial Purchase &amp; Automatic Pricing Engine</span>
              </h3>
              <span className="text-[11px] text-neutral-400">Unit: <strong>{unitCode}</strong></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Quantity / Volume Bought ({unitCode}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={quantityBought}
                  onChange={(e) => setQuantityBought(e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                />
                <span className="text-[10px] text-neutral-500 mt-0.5">Initial stock added to inventory</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Total Purchase Cost Paid (৳) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={purchaseCostTotal}
                  onChange={(e) => setPurchaseCostTotal(e.target.value)}
                  placeholder="10000"
                  className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                />
                <span className="text-[10px] text-neutral-500 mt-0.5">Total supplier invoice paid for this batch</span>
              </div>
            </div>

            {/* Live Automatic Math Cards (Protected: Owner/Manager only) */}
            {canViewCost && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-brand-border/60">
                <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-center">
                  <div className="text-[10px] text-neutral-400">Base Purchase Rate</div>
                  <div className="text-xs font-mono font-bold text-neutral-200 mt-0.5">
                    ৳{baseRate.toFixed(2)} / {unitCode}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-amber-300 font-semibold">
                    <span>+</span>
                    <input
                      type="number"
                      value={overheadPercent}
                      onChange={(e) => setOverheadPercent(e.target.value)}
                      className="w-7 text-center bg-transparent border-b border-amber-400 font-bold text-amber-300 text-[10px] focus:outline-none"
                    />
                    <span>% True Cost</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-amber-400 mt-0.5">
                    ৳{trueCostRate.toFixed(2)} / {unitCode}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-300 font-semibold">
                    <span>+</span>
                    <input
                      type="number"
                      value={marginPercent}
                      onChange={(e) => setMarginPercent(e.target.value)}
                      className="w-7 text-center bg-transparent border-b border-emerald-400 font-bold text-emerald-300 text-[10px] focus:outline-none"
                    />
                    <span>% Ideal Sell</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                    ৳{autoIdealSellRate} / {unitCode}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Benchmark Selling Prices */}
          <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-wider">
                Benchmark Selling Prices (৳ / {unitCode})
              </h3>
              <span className="text-[10px] text-neutral-400 italic">
                You can freely adjust prices at counter during sale
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Ideal Retail Price (৳ / {unitCode}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={retailPrice || (autoIdealSellRate > 0 ? String(autoIdealSellRate) : '')}
                  onChange={(e) => setRetailPrice(e.target.value)}
                  placeholder={String(autoIdealSellRate)}
                  className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-gold font-mono font-bold focus:outline-none focus:border-brand-gold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Wholesale Price (৳ / {unitCode})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={wholesalePrice || (autoWholesaleRate > 0 ? String(autoWholesaleRate) : '')}
                  onChange={(e) => setWholesalePrice(e.target.value)}
                  placeholder={String(autoWholesaleRate)}
                  className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-brand-border">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-brand-border text-neutral-300 hover:text-white hover:bg-neutral-800 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-brand-black font-semibold text-xs transition-colors shadow-lg shadow-brand-gold/20 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
