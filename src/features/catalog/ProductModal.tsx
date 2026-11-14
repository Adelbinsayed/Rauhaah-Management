import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, Droplet, Box, Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import type {
  Brand,
  Category,
  CreateAttarIntakeInput,
  CreateProductInput,
  SellableType,
  StockItem,
  Unit,
} from '../../domain/catalog/types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveProduct: (data: CreateProductInput) => Promise<void>;
  onSaveAttarIntake: (data: CreateAttarIntakeInput) => Promise<void>;
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  stockItems: StockItem[];
  canViewCost: boolean;
}

interface DecantSizeRow {
  sizeMl: number;
  label: string;
  enabled: boolean;
  idealSell: string;
  wholesale: string;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSaveProduct,
  onSaveAttarIntake,
  categories,
  brands,
  units,
  stockItems,
  canViewCost,
}) => {
  // Mode: 'attar_intake' (default for bulk oils) vs 'standard' (sealed perfumes, combos, accessories, custom blends)
  const [modalMode, setModalMode] = useState<'attar_intake' | 'standard'>('attar_intake');

  // Common Info
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');

  // --- ATTAR INTAKE STATE ---
  const [boughtVolumeMl, setBoughtVolumeMl] = useState('100');
  const [purchaseCostTotal, setPurchaseCostTotal] = useState('10000');
  const [overheadPercent, setOverheadPercent] = useState('15'); // +15% automatic landing cost
  const [marginPercent, setMarginPercent] = useState('25'); // +25% ideal markup

  const [decantSizes, setDecantSizes] = useState<DecantSizeRow[]>([
    { sizeMl: 3, label: '3 ml', enabled: true, idealSell: '', wholesale: '' },
    { sizeMl: 6, label: '6 ml', enabled: true, idealSell: '', wholesale: '' },
    { sizeMl: 9, label: '9 ml', enabled: true, idealSell: '', wholesale: '' },
    { sizeMl: 12, label: '12 ml (1 Tola)', enabled: true, idealSell: '', wholesale: '' },
  ]);

  // --- STANDARD PRODUCT STATE ---
  const [sellableType, setSellableType] = useState<SellableType>('sealed_product');
  const [standardUnitId, setStandardUnitId] = useState('unit-cnt-pcs');
  const [initialQuantity, setInitialQuantity] = useState('10');
  const [minAlertQuantity, setMinAlertQuantity] = useState('5');
  const [retailPrice, setRetailPrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');

  // Custom blend components (COMPLETELY OPTIONAL)
  const [blendComponents, setBlendComponents] = useState<
    Array<{ stockItemId: string; quantity: number; unitId: string }>
  >([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic unit measurement based on type:
  // If oil -> 'ml'. If sealed, gift, combo, accessory -> 'pcs' / 'box' / 'bottle'.
  useEffect(() => {
    if (sellableType === 'loose_decant') {
      const mlUnit = units.find((u) => u.code === 'ml');
      if (mlUnit) setStandardUnitId(mlUnit.id);
    } else if (sellableType === 'sealed_product' || sellableType === 'accessory') {
      const pcsUnit = units.find((u) => u.code === 'pcs' || u.code === 'bottle');
      if (pcsUnit) setStandardUnitId(pcsUnit.id);
    }
  }, [sellableType, units]);

  // Set default category for attar intake
  useEffect(() => {
    if (modalMode === 'attar_intake' && !categoryId) {
      const attarCat = categories.find((c) => c.slug.includes('attar') || c.name.toLowerCase().includes('attar'));
      if (attarCat) setCategoryId(attarCat.id);
    }
  }, [modalMode, categories, categoryId]);

  // Calculate Attar Intake Numbers in real-time
  const vol = parseFloat(boughtVolumeMl) || 0;
  const paid = parseFloat(purchaseCostTotal) || 0;
  const overhead = parseFloat(overheadPercent) || 0;
  const margin = parseFloat(marginPercent) || 0;

  const baseCostPerMl = vol > 0 ? paid / vol : 0;
  const effectiveCostPerMl = baseCostPerMl * (1 + overhead / 100);
  const idealSellPerMl = effectiveCostPerMl * (1 + margin / 100);

  // Update ideal prices when inputs change
  useEffect(() => {
    setDecantSizes((prev) =>
      prev.map((row) => {
        const autoIdeal = Math.round(idealSellPerMl * row.sizeMl);
        const autoWholesale = Math.round(autoIdeal * 0.85);
        return {
          ...row,
          idealSell: row.idealSell || (autoIdeal > 0 ? String(autoIdeal) : ''),
          wholesale: row.wholesale || (autoWholesale > 0 ? String(autoWholesale) : ''),
        };
      })
    );
  }, [idealSellPerMl]);

  if (!isOpen) return null;

  const handleToggleSize = (index: number) => {
    setDecantSizes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], enabled: !next[index].enabled };
      return next;
    });
  };

  const handleSizePriceChange = (index: number, field: 'idealSell' | 'wholesale', value: string) => {
    setDecantSizes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddCustomBlendComponent = () => {
    if (stockItems.length === 0) return;
    const first = stockItems[0];
    setBlendComponents([
      ...blendComponents,
      { stockItemId: first.id, quantity: 1, unitId: first.unitId || 'unit-vol-ml' },
    ]);
  };

  const handleRemoveBlendComponent = (idx: number) => {
    setBlendComponents(blendComponents.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a product name.');
      return;
    }

    try {
      setLoading(true);

      if (modalMode === 'attar_intake') {
        if (vol <= 0 || paid <= 0) {
          setError('Please provide valid volume bought (ml) and total purchase cost.');
          setLoading(false);
          return;
        }

        const enabledSizes = decantSizes.filter((s) => s.enabled);
        if (enabledSizes.length === 0) {
          setError('Please enable at least one bottle size (e.g. 3ml, 6ml, 9ml, or 12ml).');
          setLoading(false);
          return;
        }

        await onSaveAttarIntake({
          name: name.trim(),
          sku: sku.trim() || undefined,
          categoryId: categoryId || undefined,
          brandId: brandId || undefined,
          boughtVolumeMl: vol,
          totalPurchaseCostBdt: paid,
          overheadPercent: overhead,
          marginPercent: margin,
          sizes: enabledSizes.map((s) => ({
            sizeMl: s.sizeMl,
            label: s.label,
            enabled: true,
            costPriceBdt: Math.round(effectiveCostPerMl * s.sizeMl),
            idealSellPriceBdt: parseFloat(s.idealSell) || Math.round(idealSellPerMl * s.sizeMl),
            wholesalePriceBdt:
              parseFloat(s.wholesale) || Math.round((parseFloat(s.idealSell) || idealSellPerMl * s.sizeMl) * 0.85),
          })),
        });
      } else {
        // Standard Product
        const rPrice = parseFloat(retailPrice);
        const wPrice = parseFloat(wholesalePrice) || Math.round(rPrice * 0.85);

        if (isNaN(rPrice) || rPrice < 0) {
          setError('Please provide a valid Retail Price.');
          setLoading(false);
          return;
        }

        const payload: CreateProductInput = {
          name: name.trim(),
          sku: sku.trim() || undefined,
          barcode: barcode.trim() || undefined,
          categoryId: categoryId || undefined,
          brandId: brandId || undefined,
          sellableType,
          retailPriceBdt: rPrice,
          wholesalePriceBdt: wPrice,
          minPriceBdt: wPrice,
          costPriceBdt: costPrice ? parseFloat(costPrice) : 0,
          initialQuantity: initialQuantity ? parseFloat(initialQuantity) : 0,
          minAlertQuantity: minAlertQuantity ? parseFloat(minAlertQuantity) : 5,
          unitId: standardUnitId,
          // Custom blend ingredients are completely OPTIONAL
          components: blendComponents.length > 0 ? blendComponents : undefined,
        };

        await onSaveProduct(payload);
      }

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
              <h2 className="text-lg font-bold text-white">Add New Product to Catalog</h2>
              <p className="text-xs text-neutral-400">
                Bulk attar intake with automatic +15% cost &amp; +25% margin, or standard packaged goods.
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

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-brand-black border border-brand-border rounded-lg">
          <button
            type="button"
            onClick={() => setModalMode('attar_intake')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
              modalMode === 'attar_intake'
                ? 'bg-brand-gold text-brand-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Droplet className="w-4 h-4" />
            <span>Attar / Bulk Oil Intake (Recommended)</span>
          </button>

          <button
            type="button"
            onClick={() => setModalMode('standard')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
              modalMode === 'standard'
                ? 'bg-brand-gold text-brand-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Box className="w-4 h-4" />
            <span>Packaged, Combo, Gift &amp; Accessories</span>
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Common Name & Details */}
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
                placeholder={modalMode === 'attar_intake' ? 'e.g. Black Oud / Cambodian Dehn Al Oudh' : 'e.g. Amber Magic EDP 50ml'}
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

          {/* ================= MODE A: ATTAR BULK INTAKE CALCULATOR ================= */}
          {modalMode === 'attar_intake' && (
            <div className="space-y-4">
              {/* Intake Volume & Purchase Cost */}
              <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-brand-gold uppercase tracking-wider flex items-center gap-1.5">
                    <Droplet className="w-3.5 h-3.5" />
                    <span>Bulk Purchase &amp; Automatic Pricing Engine</span>
                  </h3>
                  <span className="text-[11px] text-neutral-400">Unit: <strong>ml (Millilitres)</strong></span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Total Volume Bought (ml) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      required
                      value={boughtVolumeMl}
                      onChange={(e) => setBoughtVolumeMl(e.target.value)}
                      placeholder="100"
                      className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                    />
                    <span className="text-[10px] text-neutral-500 mt-0.5">e.g. 100 ml, 250 ml, 500 ml</span>
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
                    <span className="text-[10px] text-neutral-500 mt-0.5">Total invoice amount you paid to supplier</span>
                  </div>
                </div>

                {/* Live Automatic Math Cards */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-brand-border/60">
                  <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-center">
                    <div className="text-[10px] text-neutral-400">Base Purchase Rate</div>
                    <div className="text-xs font-mono font-bold text-neutral-200 mt-0.5">
                      ৳{baseCostPerMl.toFixed(2)} / ml
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] text-amber-300 font-semibold">
                      <span>+</span>
                      <input
                        type="number"
                        value={overheadPercent}
                        onChange={(e) => setOverheadPercent(e.target.value)}
                        className="w-8 text-center bg-transparent border-b border-amber-400 font-bold text-amber-300 text-[10px] focus:outline-none"
                      />
                      <span>% True Cost</span>
                    </div>
                    <div className="text-xs font-mono font-bold text-amber-400 mt-0.5">
                      ৳{effectiveCostPerMl.toFixed(2)} / ml
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-300 font-semibold">
                      <span>+</span>
                      <input
                        type="number"
                        value={marginPercent}
                        onChange={(e) => setMarginPercent(e.target.value)}
                        className="w-8 text-center bg-transparent border-b border-emerald-400 font-bold text-emerald-300 text-[10px] focus:outline-none"
                      />
                      <span>% Ideal Sell</span>
                    </div>
                    <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                      ৳{idealSellPerMl.toFixed(2)} / ml
                    </div>
                  </div>
                </div>
              </div>

              {/* Ready Bottle Sizes Selection */}
              <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Select Bottle Sizes to Auto-Generate:
                  </h4>
                  <span className="text-[10px] text-neutral-400 italic">
                    Prices are recommendations; you can increase or discount at counter
                  </span>
                </div>

                <div className="space-y-2">
                  {decantSizes.map((row, idx) => {
                    const rowCost = Math.round(effectiveCostPerMl * row.sizeMl);
                    return (
                      <div
                        key={row.sizeMl}
                        className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-3 transition-colors ${
                          row.enabled
                            ? 'bg-brand-surface border-brand-border'
                            : 'bg-brand-black/40 border-neutral-800 opacity-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSize(idx)}
                          className="flex items-center gap-2.5 text-left"
                        >
                          {row.enabled ? (
                            <CheckSquare className="w-4 h-4 text-brand-gold shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-500 shrink-0" />
                          )}
                          <div>
                            <span className="text-xs font-bold text-white">{row.label}</span>
                            <div className="text-[10px] text-neutral-400 font-mono">
                              Cost: ৳{rowCost}
                            </div>
                          </div>
                        </button>

                        {row.enabled && (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-neutral-400">Ideal Sell:</span>
                              <input
                                type="number"
                                step="any"
                                value={row.idealSell}
                                onChange={(e) => handleSizePriceChange(idx, 'idealSell', e.target.value)}
                                className="w-24 px-2 py-1 rounded bg-brand-black border border-brand-border font-mono text-xs text-brand-gold font-bold focus:outline-none focus:border-brand-gold text-right"
                              />
                              <span className="text-xs text-neutral-500">৳</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-neutral-400">Wholesale:</span>
                              <input
                                type="number"
                                step="any"
                                value={row.wholesale}
                                onChange={(e) => handleSizePriceChange(idx, 'wholesale', e.target.value)}
                                className="w-24 px-2 py-1 rounded bg-brand-black border border-brand-border font-mono text-xs text-white focus:outline-none focus:border-brand-gold text-right"
                              />
                              <span className="text-xs text-neutral-500">৳</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================= MODE B: STANDARD PACKAGED / COMBO / ACCESSORY ================= */}
          {modalMode === 'standard' && (
            <div className="space-y-4">
              {/* Product Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                  Product Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { type: 'sealed_product', label: 'Sealed Perfume', sub: 'Boxed EDP/EDT' },
                    { type: 'accessory', label: 'Accessory / Gift', sub: 'Bottle / Box / Beads' },
                    { type: 'custom_blend', label: 'Custom Blend', sub: 'Recipe mix (Optional)' },
                    { type: 'loose_decant', label: 'Single Decant', sub: 'Fixed volume' },
                  ].map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setSellableType(item.type as SellableType)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
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

              {/* Dynamic Unit & Stock Settings */}
              <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-brand-gold uppercase tracking-wider">
                    Inventory &amp; Unit of Measure
                  </h3>
                  <span className="text-[11px] text-emerald-400 font-medium">
                    Auto-set to {sellableType === 'loose_decant' ? 'Millilitres (ml)' : 'Pieces / Bottles'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                      Measurement Unit
                    </label>
                    <select
                      value={standardUnitId}
                      onChange={(e) => setStandardUnitId(e.target.value)}
                      className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.code}) - {u.unitType}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                      Initial Quantity in Stock
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={initialQuantity}
                      onChange={(e) => setInitialQuantity(e.target.value)}
                      placeholder="10"
                      className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                      Low Stock Alert
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={minAlertQuantity}
                      onChange={(e) => setMinAlertQuantity(e.target.value)}
                      placeholder="5"
                      className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Blend Recipe (100% OPTIONAL) */}
              {sellableType === 'custom_blend' && (
                <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Blend Recipe (Optional)
                      </h4>
                      <p className="text-[10px] text-neutral-400">
                        You can link source oils now, or leave empty and just track it as a product.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomBlendComponent}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-brand-gold/15 text-brand-gold hover:bg-brand-gold/25 text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Source Oil
                    </button>
                  </div>

                  {blendComponents.map((comp, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={comp.stockItemId}
                        onChange={(e) => {
                          const updated = [...blendComponents];
                          updated[idx].stockItemId = e.target.value;
                          setBlendComponents(updated);
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
                        value={comp.quantity}
                        onChange={(e) => {
                          const updated = [...blendComponents];
                          updated[idx].quantity = parseFloat(e.target.value) || 0;
                          setBlendComponents(updated);
                        }}
                        className="w-20 px-2 py-1.5 bg-brand-surface border border-brand-border rounded text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveBlendComponent(idx)}
                        className="p-1 text-neutral-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Standard Pricing */}
              <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-3">
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
                      Wholesale Price (৳)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={wholesalePrice}
                      onChange={(e) => setWholesalePrice(e.target.value)}
                      placeholder="Defaults to ~85% of retail"
                      className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                    />
                  </div>

                  {canViewCost && (
                    <div>
                      <label className="block text-[11px] font-semibold text-brand-gold mb-1">
                        Cost Price (৳)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={costPrice}
                        onChange={(e) => setCostPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-brand-border">
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
              {loading
                ? 'Saving...'
                : modalMode === 'attar_intake'
                ? 'Save Attar Intake & Generate Sizes'
                : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
