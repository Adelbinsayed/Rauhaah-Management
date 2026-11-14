import React, { useState } from 'react';
import { X, Sparkles, AlertCircle, Plus, Trash2 } from 'lucide-react';
import type {
  Brand,
  Category,
  CreateProductInput,
  SellableType,
  StockItem,
  Unit,
} from '../../domain/catalog/types';
import { POPULAR_DECANT_OPTIONS } from '../../domain/catalog/units';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateProductInput) => Promise<void>;
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  stockItems: StockItem[];
  canViewCost: boolean;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  brands,
  units,
  stockItems,
  canViewCost,
}) => {
  const [sellableType, setSellableType] = useState<SellableType>('sealed_product');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');

  // Pricing
  const [retailPrice, setRetailPrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');

  // Sealed / Accessory stock link
  const [initialQuantity, setInitialQuantity] = useState('');
  const [minAlertQuantity, setMinAlertQuantity] = useState('5');
  const [unitId, setUnitId] = useState('unit-cnt-pcs');

  // Decant / Custom Blend components
  const [decantOilId, setDecantOilId] = useState('');
  const [decantBottleId, setDecantBottleId] = useState('');
  const [decantVolumeMl, setDecantVolumeMl] = useState('12');

  // Custom blend components list
  const [components, setComponents] = useState<
    Array<{ stockItemId: string; quantity: number; unitId: string; isPrimary: boolean }>
  >([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const rawOils = stockItems.filter((s) => s.itemType === 'raw_oil');
  const emptyBottles = stockItems.filter((s) => s.itemType === 'empty_bottle');

  // Auto-calculate suggested decant cost if owner/manager
  const selectedOil = rawOils.find((o) => o.id === decantOilId);
  const selectedBottle = emptyBottles.find((b) => b.id === decantBottleId);
  let estimatedDecantCost = 0;
  if (canViewCost && selectedOil) {
    const vol = parseFloat(decantVolumeMl) || 0;
    // Assuming costPriceBdt on raw oil is per ml (or per base unit)
    estimatedDecantCost = selectedOil.costPriceBdt * vol + (selectedBottle?.costPriceBdt || 0);
  }

  const handleAddCustomComponent = () => {
    if (stockItems.length === 0) return;
    const first = stockItems[0];
    setComponents([
      ...components,
      {
        stockItemId: first.id,
        quantity: 1,
        unitId: first.unitId || 'unit-vol-ml',
        isPrimary: components.length === 0,
      },
    ]);
  };

  const handleRemoveComponent = (idx: number) => {
    setComponents(components.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rPrice = parseFloat(retailPrice);
    const wPrice = parseFloat(wholesalePrice);
    if (isNaN(rPrice) || rPrice < 0) {
      setError('Please provide a valid Retail Price.');
      return;
    }
    if (isNaN(wPrice) || wPrice < 0) {
      setError('Please provide a valid Wholesale Price.');
      return;
    }

    try {
      setLoading(true);

      const payload: CreateProductInput = {
        name: name.trim(),
        sku: sku.trim() || undefined,
        barcode: barcode.trim() || undefined,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        sellableType,
        retailPriceBdt: rPrice,
        wholesalePriceBdt: wPrice,
        minPriceBdt: minPrice ? parseFloat(minPrice) : wPrice,
      };

      if (sellableType === 'sealed_product' || sellableType === 'accessory') {
        payload.costPriceBdt = costPrice ? parseFloat(costPrice) : 0;
        payload.initialQuantity = initialQuantity ? parseFloat(initialQuantity) : 0;
        payload.minAlertQuantity = minAlertQuantity ? parseFloat(minAlertQuantity) : 5;
        payload.unitId = unitId;
      } else if (sellableType === 'loose_decant') {
        if (!decantOilId) {
          setError('Please select a base perfume oil for this decant.');
          setLoading(false);
          return;
        }
        const comps: CreateProductInput['components'] = [
          {
            stockItemId: decantOilId,
            quantity: parseFloat(decantVolumeMl) || 12,
            unitId: 'unit-vol-ml',
            isPrimary: true,
          },
        ];
        if (decantBottleId) {
          comps.push({
            stockItemId: decantBottleId,
            quantity: 1,
            unitId: 'unit-cnt-btl',
            isPrimary: false,
          });
        }
        payload.components = comps;
      } else if (sellableType === 'custom_blend') {
        if (components.length === 0) {
          setError('Please add at least one stock item component to this blend recipe.');
          setLoading(false);
          return;
        }
        payload.components = components;
      }

      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-brand-surface border border-brand-border rounded-xl shadow-2xl p-6 my-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-brand-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create New Product</h2>
              <p className="text-xs text-neutral-400">
                Add a sealed retail product, loose attar decant, custom blend, or accessory.
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

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
              Product Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: 'sealed_product', label: 'Sealed Perfume', sub: 'Boxed EDP/EDT' },
                { type: 'loose_decant', label: 'Loose Decant', sub: 'Attar / Oil by ml' },
                { type: 'custom_blend', label: 'Custom Blend', sub: 'Recipe mix' },
                { type: 'accessory', label: 'Accessory', sub: 'Bottle / Box / Other' },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setSellableType(item.type as SellableType)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    sellableType === item.type
                      ? 'border-brand-gold bg-brand-gold/10 text-white shadow-sm'
                      : 'border-brand-border bg-brand-black/50 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <p className="text-xs font-semibold text-white">{item.label}</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">{item.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Basic Info */}
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
                placeholder="e.g. Royal Oud Al-Maliki 12ml"
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                SKU (Stock Keeping Unit)
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Barcode (USB Scanner ready)
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or enter barcode"
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold font-mono"
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
                Brand
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
          </div>

          {/* Type-Specific Inventory & Recipes */}
          {(sellableType === 'sealed_product' || sellableType === 'accessory') && (
            <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-4">
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-wider">
                Initial Stock & Unit
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Initial Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={initialQuantity}
                    onChange={(e) => setInitialQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Low Stock Alert At
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={minAlertQuantity}
                    onChange={(e) => setMinAlertQuantity(e.target.value)}
                    placeholder="5"
                    className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Unit
                  </label>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
                  >
                    {units
                      .filter((u) => u.unitType === 'count')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {sellableType === 'loose_decant' && (
            <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-4">
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-wider">
                Decant Recipe Setup
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Source Bulk Oil (Raw Stock) *
                  </label>
                  <select
                    required
                    value={decantOilId}
                    onChange={(e) => setDecantOilId(e.target.value)}
                    className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
                  >
                    <option value="">Select bulk perfume oil...</option>
                    {rawOils.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} (Stock: {o.currentQuantity} {o.unitCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Packaging Bottle / Vial (Optional)
                  </label>
                  <select
                    value={decantBottleId}
                    onChange={(e) => setDecantBottleId(e.target.value)}
                    className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
                  >
                    <option value="">No bottle deducted (oil only)</option>
                    {emptyBottles.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (Stock: {b.currentQuantity} pcs)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1.5">
                    Decant Volume (ml / Tola)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {POPULAR_DECANT_OPTIONS.map((opt) => (
                      <button
                        key={opt.ml}
                        type="button"
                        onClick={() => setDecantVolumeMl(String(opt.ml))}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          decantVolumeMl === String(opt.ml)
                            ? 'border-brand-gold bg-brand-gold text-brand-black font-semibold'
                            : 'border-brand-border bg-brand-surface text-neutral-300 hover:border-neutral-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      required
                      value={decantVolumeMl}
                      onChange={(e) => setDecantVolumeMl(e.target.value)}
                      placeholder="Custom ml"
                      className="w-32 px-3 py-1.5 bg-brand-surface border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
                    />
                    <span className="text-xs text-neutral-400">ml per sold bottle</span>
                  </div>
                </div>
              </div>

              {canViewCost && estimatedDecantCost > 0 && (
                <div className="p-2.5 rounded-lg bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-xs flex justify-between items-center">
                  <span>Estimated Unit Cost:</span>
                  <span className="font-mono font-bold">৳{estimatedDecantCost.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {sellableType === 'custom_blend' && (
            <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-brand-gold uppercase tracking-wider">
                  Blend Recipe Components
                </h3>
                <button
                  type="button"
                  onClick={handleAddCustomComponent}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-brand-gold/15 text-brand-gold hover:bg-brand-gold/25 text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Component
                </button>
              </div>

              {components.length === 0 ? (
                <p className="text-xs text-neutral-500 italic">
                  No ingredients added yet. Click &quot;Add Component&quot; to build the blend formula.
                </p>
              ) : (
                <div className="space-y-2">
                  {components.map((comp, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={comp.stockItemId}
                        onChange={(e) => {
                          const updated = [...components];
                          updated[idx].stockItemId = e.target.value;
                          setComponents(updated);
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-brand-surface border border-brand-border rounded text-xs text-white"
                      >
                        {stockItems.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.unitCode})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={comp.quantity}
                        onChange={(e) => {
                          const updated = [...components];
                          updated[idx].quantity = parseFloat(e.target.value) || 0;
                          setComponents(updated);
                        }}
                        className="w-20 px-2 py-1.5 bg-brand-surface border border-brand-border rounded text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveComponent(idx)}
                        className="p-1.5 text-neutral-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pricing Grid */}
          <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-4">
            <h3 className="text-xs font-bold text-brand-gold uppercase tracking-wider">
              Pricing Details (BDT ৳)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Retail Price (৳) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Wholesale Price (৳) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Floor / Min Price (৳)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Defaults to wholesale"
                  className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                />
              </div>

              {canViewCost && (sellableType === 'sealed_product' || sellableType === 'accessory') && (
                <div className="sm:col-span-3 pt-1 border-t border-brand-border/60">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-semibold text-brand-gold mb-1">
                      Unit Cost Price (৳) (Owner/Manager Only)
                    </label>
                    {costPrice && retailPrice && (
                      <span className="text-[11px] text-neutral-400">
                        Gross Margin:{' '}
                        <span className="text-emerald-400 font-bold">
                          {(
                            ((parseFloat(retailPrice) - parseFloat(costPrice)) /
                              parseFloat(retailPrice)) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full sm:w-1/3 px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg border border-brand-border text-neutral-300 hover:text-white hover:bg-neutral-800 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-brand-black font-semibold text-xs transition-colors shadow-lg shadow-brand-gold/20 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
