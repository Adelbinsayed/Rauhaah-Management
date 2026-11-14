import React, { useState } from 'react';
import { X, Package, AlertCircle } from 'lucide-react';
import type {
  Brand,
  Category,
  CreateStockItemInput,
  StockItemType,
  Unit,
} from '../../domain/catalog/types';

interface StockItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateStockItemInput) => Promise<void>;
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  canViewCost: boolean;
}

export const StockItemModal: React.FC<StockItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  brands,
  units,
  canViewCost,
}) => {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [itemType, setItemType] = useState<StockItemType>('raw_oil');
  const [unitId, setUnitId] = useState('unit-vol-ml');
  const [densityGPerMl, setDensityGPerMl] = useState('0.98');
  const [currentQuantity, setCurrentQuantity] = useState('0');
  const [minAlertQuantity, setMinAlertQuantity] = useState('100');
  const [costPriceBdt, setCostPriceBdt] = useState('0');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const qty = parseFloat(currentQuantity) || 0;
    const minQty = parseFloat(minAlertQuantity) || 0;
    const cost = parseFloat(costPriceBdt) || 0;
    const density = itemType === 'raw_oil' ? parseFloat(densityGPerMl) || undefined : undefined;

    try {
      setLoading(true);
      await onSave({
        name: name.trim(),
        sku: sku.trim() || undefined,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        itemType,
        unitId,
        densityGPerMl: density,
        currentQuantity: qty,
        minAlertQuantity: minQty,
        costPriceBdt: cost,
        notes: notes.trim() || undefined,
      });
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
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Add Raw Material / Stock Item</h2>
              <p className="text-xs text-neutral-400">
                Bulk perfume oils, empty bottles, vials, caps, packaging, or solvents.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Stock Item Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cambodian Dehn Al Oudh (Pure Grade A)"
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
                Item Type *
              </label>
              <select
                value={itemType}
                onChange={(e) => {
                  const val = e.target.value as StockItemType;
                  setItemType(val);
                  if (val === 'raw_oil') {
                    setUnitId('unit-vol-ml');
                  } else if (val === 'empty_bottle' || val === 'packaging') {
                    setUnitId('unit-cnt-pcs');
                  }
                }}
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
              >
                <option value="raw_oil">Raw Perfume Oil / Attar</option>
                <option value="empty_bottle">Empty Bottle / Crystal Vial</option>
                <option value="packaging">Packaging Box / Gift Bag</option>
                <option value="raw_material">Raw Material / Solvent / Carrier</option>
                <option value="accessory">Accessory</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Primary Inventory Unit *
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code}) - {u.unitType}
                  </option>
                ))}
              </select>
            </div>

            {itemType === 'raw_oil' && (
              <div className="sm:col-span-2 p-3 bg-brand-black/60 border border-brand-border rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-brand-gold">
                    Oil Density (g/ml)
                  </label>
                  <span className="text-[11px] text-neutral-400">
                    Typical attar: 0.95 – 1.05 g/ml
                  </span>
                </div>
                <input
                  type="number"
                  step="0.001"
                  min="0.1"
                  value={densityGPerMl}
                  onChange={(e) => setDensityGPerMl(e.target.value)}
                  placeholder="0.98"
                  className="w-full sm:w-1/2 px-3 py-1.5 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                />
                <p className="text-[11px] text-neutral-400">
                  Enables accurate automatic conversion between purchasing by weight (kg/g) and selling by volume (ml/tola).
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Brand / Supplier
              </label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
              >
                <option value="">None</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Current Stock Quantity
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={currentQuantity}
                onChange={(e) => setCurrentQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Low Stock Alert Threshold
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={minAlertQuantity}
                onChange={(e) => setMinAlertQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
              />
            </div>

            {canViewCost && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-brand-gold uppercase tracking-wider mb-1">
                  Cost Price per Unit (BDT ৳) (Owner/Manager Only)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={costPriceBdt}
                  onChange={(e) => setCostPriceBdt(e.target.value)}
                  className="w-full sm:w-1/2 px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Notes / Supplier Details
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional supplier batch notes or storage location"
                className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-brand-border text-neutral-300 hover:text-white text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Stock Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
