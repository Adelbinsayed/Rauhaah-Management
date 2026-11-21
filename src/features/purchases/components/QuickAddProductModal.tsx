import { purchasesRepo } from '@/data/repositories/purchasesRepo';
import type { StockItemLookup } from '@/domain/purchases/types';
import { AlertCircle, Package, X } from 'lucide-react';
import React, { useState } from 'react';

interface QuickAddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Array<{ id: string; name: string }>;
  deviceId: string;
  initialName?: string;
  currentUser: { id: string; username: string; displayName?: string | null } | null;
  onProductCreated: (item: StockItemLookup, costPrice: number) => void;
}

export const QuickAddProductModal: React.FC<QuickAddProductModalProps> = ({
  isOpen,
  onClose,
  categories,
  deviceId,
  initialName = '',
  currentUser,
  onProductCreated,
}) => {
  const [newProdName, setNewProdName] = useState(initialName);
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdItemType, setNewProdItemType] = useState('raw_oil');
  const [newProdUnitCode, setNewProdUnitCode] = useState('ml');
  const [newProdCategoryId, setNewProdCategoryId] = useState(categories[0]?.id || '');
  const [newProdDensity, setNewProdDensity] = useState<number>(1.0);
  const [newProdCostPrice, setNewProdCostPrice] = useState<number>(0);
  const [newProdIsSellable, setNewProdIsSellable] = useState(true);
  const [newProdRetailPrice, setNewProdRetailPrice] = useState<number>(0);
  const [newProdSaving, setNewProdSaving] = useState(false);
  const [newProdError, setNewProdError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!newProdName.trim()) {
      setNewProdError('Please provide a product name.');
      return;
    }

    setNewProdSaving(true);
    setNewProdError(null);
    try {
      const createdItem = await purchasesRepo.createStockItemQuick({
        name: newProdName.trim(),
        sku: newProdSku.trim() || undefined,
        itemType: newProdItemType,
        unitCode: newProdUnitCode,
        densityGPerMl: newProdItemType === 'raw_oil' ? Number(newProdDensity) || 1.0 : null,
        costPriceBdt: Number(newProdCostPrice) || 0,
        retailPriceBdt: newProdIsSellable ? Number(newProdRetailPrice) || 0 : undefined,
        categoryId: newProdCategoryId || null,
        userId: currentUser?.id || null,
        username: currentUser?.displayName || currentUser?.username || 'Admin',
        deviceId,
      });

      onProductCreated(createdItem, Number(newProdCostPrice) || 0);
      onClose();
    } catch (err: unknown) {
      setNewProdError(err instanceof Error ? err.message : String(err));
    } finally {
      setNewProdSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-surface border border-hairline-strong rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] flex flex-col relative z-[101]">
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-hairline shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-accent-ink">
              <Package className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink">Add New Product to Catalog</h3>
              <p className="text-xs text-ink-secondary">
                Instantly create an item and auto-select it for stock receiving.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {newProdError && (
          <div className="p-2.5 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{newProdError}</span>
          </div>
        )}

        {/* Modal Form */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
          {/* Product Name */}
          <div>
            <label className="block text-[11px] font-medium text-ink-secondary mb-1">
              Product / Item Name <span className="text-negative">*</span>
            </label>
            <input
              type="text"
              value={newProdName}
              onChange={(e) => setNewProdName(e.target.value)}
              placeholder="e.g. Royal White Musk, 12ml Octagon Crystal Bottle"
              className="w-full px-3 py-2 bg-canvas border border-hairline rounded-lg text-ink font-medium placeholder:text-ink-muted focus:outline-none focus:border-accent text-xs"
            />
          </div>

          {/* Item Type & Base Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                Item Type
              </label>
              <select
                value={newProdItemType}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewProdItemType(val);
                  if (val === 'raw_oil') setNewProdUnitCode('ml');
                  else setNewProdUnitCode('pcs');
                }}
                className="w-full px-3 py-2 bg-canvas border border-hairline rounded-lg text-ink font-medium focus:outline-none focus:border-accent text-xs"
              >
                <option value="raw_oil">Fragrance / Attar Oil</option>
                <option value="sealed_product">Sealed Perfume Box</option>
                <option value="empty_bottle">Empty Bottle / Vial</option>
                <option value="accessory">Accessory (Tasbih/Box)</option>
                <option value="packaging">Packaging / Cap</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                Base Storage Unit
              </label>
              <select
                value={newProdUnitCode}
                onChange={(e) => setNewProdUnitCode(e.target.value)}
                className="w-full px-3 py-2 bg-canvas border border-hairline rounded-lg text-ink font-semibold focus:outline-none focus:border-accent text-xs"
              >
                <option value="ml">Millilitres (ml)</option>
                <option value="pcs">Pieces (pcs)</option>
                <option value="g">Grams (g)</option>
              </select>
            </div>
          </div>

          {/* SKU & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                Custom SKU (Optional)
              </label>
              <input
                type="text"
                value={newProdSku}
                onChange={(e) => setNewProdSku(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full px-3 py-2 bg-canvas border border-hairline rounded-lg text-ink font-mono placeholder:text-ink-muted focus:outline-none focus:border-accent text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                Category (Optional)
              </label>
              <select
                value={newProdCategoryId}
                onChange={(e) => setNewProdCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-canvas border border-hairline rounded-lg text-ink focus:outline-none focus:border-accent text-xs"
              >
                <option value="">None / General</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Initial Cost Price & Density */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                Cost Price (৳ / {newProdUnitCode})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={newProdCostPrice || ''}
                onChange={(e) => setNewProdCostPrice(Number(e.target.value))}
                placeholder="e.g. 250"
                className="w-full px-3 py-2 bg-canvas border border-hairline rounded-lg text-accent-ink font-mono font-semibold tabular-nums placeholder:text-ink-muted focus:outline-none focus:border-accent text-xs"
              />
            </div>

            {newProdItemType === 'raw_oil' && (
              <div>
                <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                  Density (g / ml)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={newProdDensity || ''}
                  onChange={(e) => setNewProdDensity(Number(e.target.value))}
                  placeholder="1.0"
                  className="w-full px-3 py-2 bg-canvas border border-hairline rounded-lg text-ink font-mono tabular-nums placeholder:text-ink-muted focus:outline-none focus:border-accent text-xs"
                />
              </div>
            )}
          </div>

          {/* Sellable Toggle & Retail Price */}
          <div className="p-3 rounded-xl bg-subtle border border-hairline space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newProdIsSellable}
                onChange={(e) => setNewProdIsSellable(e.target.checked)}
                className="w-4 h-4 rounded accent-accent"
              />
              <span className="font-medium text-ink">
                Make available for POS Sale (Create Sellable Product)
              </span>
            </label>

            {newProdIsSellable && (
              <div className="pt-2 border-t border-hairline">
                <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                  POS Retail Selling Price (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={newProdRetailPrice || ''}
                  onChange={(e) => setNewProdRetailPrice(Number(e.target.value))}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-positive font-mono font-semibold tabular-nums placeholder:text-ink-muted focus:outline-none focus:border-accent text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-hairline flex justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-hairline text-xs text-ink-secondary hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={newProdSaving || !newProdName.trim()}
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {newProdSaving ? 'Creating...' : 'Save & Select Item'}
          </button>
        </div>
      </div>
    </div>
  );
};
