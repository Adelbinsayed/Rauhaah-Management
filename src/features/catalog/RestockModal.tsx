import React, { useState, useMemo } from 'react';
import { X, PlusCircle, Search, AlertCircle, ArrowRight, Package } from 'lucide-react';
import type { Sellable } from '../../domain/catalog/types';

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellables: Sellable[];
  onRestock: (
    sellableId: string,
    addedQuantity: number,
    totalCostPaid: number,
    updateRetailPrice?: number
  ) => Promise<void>;
  canViewCost: boolean;
}

export const RestockModal: React.FC<RestockModalProps> = ({
  isOpen,
  onClose,
  sellables,
  onRestock,
  canViewCost,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSellableId, setSelectedSellableId] = useState<string>('');
  const [addedQuantity, setAddedQuantity] = useState('100');
  const [totalCostPaid, setTotalCostPaid] = useState('10000');
  const [overheadPercent, setOverheadPercent] = useState('15');
  const [marginPercent, setMarginPercent] = useState('25');
  const [updatePrice, setUpdatePrice] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = useMemo(() => {
    return sellables.find((s) => s.id === selectedSellableId);
  }, [sellables, selectedSellableId]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return sellables.slice(0, 8);
    const term = searchTerm.toLowerCase();
    return sellables.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.sku.toLowerCase().includes(term) ||
        (s.barcode && s.barcode.toLowerCase().includes(term))
    );
  }, [sellables, searchTerm]);

  // Pricing calculations
  const qty = parseFloat(addedQuantity) || 0;
  const cost = parseFloat(totalCostPaid) || 0;
  const overhead = parseFloat(overheadPercent) || 0;
  const margin = parseFloat(marginPercent) || 0;

  const baseRate = qty > 0 ? cost / qty : 0;
  const trueCostRate = baseRate * (1 + overhead / 100);
  const recommendedSellRate = Math.round(trueCostRate * (1 + margin / 100));

  if (!isOpen) return null;

  const isOil =
    selectedProduct?.sellableType === 'loose_decant' ||
    selectedProduct?.name.toLowerCase().includes('oil') ||
    selectedProduct?.name.toLowerCase().includes('oud') ||
    selectedProduct?.name.toLowerCase().includes('attar');

  const unitLabel = isOil ? 'ml' : 'pcs';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedSellableId) {
      setError('Please search and select an existing product to restock.');
      return;
    }

    if (qty <= 0) {
      setError('Please enter a valid quantity received.');
      return;
    }

    try {
      setLoading(true);
      await onRestock(
        selectedSellableId,
        qty,
        cost,
        updatePrice ? recommendedSellRate : undefined
      );
      onClose();
      // Reset form
      setSelectedSellableId('');
      setSearchTerm('');
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
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Restock / Add Purchase</h2>
              <p className="text-xs text-neutral-400">
                Received a new shipment? Search the existing product and add the volume or units.
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
          {/* Step 1: Search & Select Existing Product */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              1. Search &amp; Select Existing Product *
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type product name (e.g. Black Oud, Baccarat) or SKU..."
                className="w-full pl-9 pr-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
              />
            </div>

            {/* Quick selector list */}
            <div className="max-h-36 overflow-y-auto space-y-1 p-1 bg-brand-black/60 border border-brand-border rounded-lg">
              {searchResults.length === 0 ? (
                <p className="text-xs text-neutral-500 p-2 italic text-center">
                  No matching product found. If this is a new product, use &ldquo;+ New Product&rdquo;.
                </p>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedSellableId(item.id);
                      setSearchTerm(item.name);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded text-left text-xs transition-colors ${
                      selectedSellableId === item.id
                        ? 'bg-brand-gold text-brand-black font-semibold'
                        : 'text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-[10px] opacity-75 font-mono ml-2">({item.sku})</span>
                    </div>
                    <span className="font-mono">৳{item.retailPriceBdt}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Selected Product Summary Card */}
          {selectedProduct && (
            <div className="p-3.5 rounded-xl bg-brand-black/80 border border-brand-gold/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-brand-gold shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white">{selectedProduct.name}</h4>
                  <p className="text-[11px] text-neutral-400">
                    Current Retail: <strong className="text-brand-gold font-mono">৳{selectedProduct.retailPriceBdt}</strong> / {unitLabel}
                  </p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-brand-gold/20 text-brand-gold font-semibold uppercase">
                Selected
              </span>
            </div>
          )}

          {/* Step 2: Quantity and Cost */}
          {selectedProduct && (
            <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-4">
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-wider">
                2. Enter Received Shipment Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Quantity / Volume Added ({unitLabel}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={addedQuantity}
                    onChange={(e) => setAddedQuantity(e.target.value)}
                    placeholder="100"
                    className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                  />
                  <span className="text-[10px] text-neutral-500 mt-0.5">
                    Will be added directly to your active inventory
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Total Invoice Cost Paid (৳) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={totalCostPaid}
                    onChange={(e) => setTotalCostPaid(e.target.value)}
                    placeholder="10000"
                    className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                  />
                  <span className="text-[10px] text-neutral-500 mt-0.5">
                    Total amount paid to supplier for this batch
                  </span>
                </div>
              </div>

              {/* Automatic Math Breakdown (Owner/Manager only) */}
              {canViewCost && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-brand-border/60">
                  <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-center">
                    <div className="text-[10px] text-neutral-400">Base Purchase Rate</div>
                    <div className="text-xs font-mono font-bold text-neutral-200 mt-0.5">
                      ৳{baseRate.toFixed(2)} / {unitLabel}
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
                      ৳{trueCostRate.toFixed(2)} / {unitLabel}
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
                      ৳{recommendedSellRate} / {unitLabel}
                    </div>
                  </div>
                </div>
              )}

              {/* Optional price update checkbox */}
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updatePrice}
                  onChange={(e) => setUpdatePrice(e.target.checked)}
                  className="rounded border-brand-border text-brand-gold focus:ring-brand-gold bg-brand-surface"
                />
                <span className="text-xs text-neutral-300">
                  Update product retail price to new recommended benchmark (৳{recommendedSellRate} / {unitLabel})
                </span>
              </label>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-brand-border">
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
              disabled={loading || !selectedProduct}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-colors"
            >
              <span>{loading ? 'Adding...' : 'Confirm & Add to Stock'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
