import React, { useState, useMemo } from 'react';
import { X, PlusCircle, Search, AlertCircle, ArrowRight, Package } from 'lucide-react';
import type { Sellable } from '../../domain/catalog/types';

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellables: Sellable[];
  initialProduct?: Sellable | null;
  onRestock: (
    sellableId: string,
    addedQuantity: number,
    totalCostPaid: number,
    updateRetailPrice?: number,
    overheadPercent?: number
  ) => Promise<void>;
  canViewCost: boolean;
}

export const RestockModal: React.FC<RestockModalProps> = ({
  isOpen,
  onClose,
  sellables,
  initialProduct,
  onRestock,
  canViewCost,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSellableId, setSelectedSellableId] = useState<string>('');
  const [addedQuantity, setAddedQuantity] = useState('');
  const [totalCostPaid, setTotalCostPaid] = useState('');
  const [overheadPercent, setOverheadPercent] = useState('15');
  const [marginPercent, setMarginPercent] = useState('25');
  const [updatePrice, setUpdatePrice] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      if (initialProduct) {
        setSelectedSellableId(initialProduct.id);
        setSearchTerm(initialProduct.name);
      } else {
        setSelectedSellableId('');
        setSearchTerm('');
      }
      setAddedQuantity('');
      setTotalCostPaid('');
      setError(null);
    }
  }, [isOpen, initialProduct]);

  const selectedProduct = useMemo(() => {
    if (initialProduct) return initialProduct;
    return sellables.find((s) => s.id === selectedSellableId);
  }, [sellables, selectedSellableId, initialProduct]);

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
  const parsedQty = parseFloat(addedQuantity);
  const qty = Number.isFinite(parsedQty) ? parsedQty : 0;
  const parsedCost = parseFloat(totalCostPaid);
  const cost = canViewCost && Number.isFinite(parsedCost) ? parsedCost : 0;
  const parsedOverhead = parseFloat(overheadPercent);
  const overhead = Number.isFinite(parsedOverhead) ? Math.max(0, parsedOverhead) : 0;
  const parsedMargin = parseFloat(marginPercent);
  const margin = Number.isFinite(parsedMargin) ? Math.max(0, parsedMargin) : 0;

  const baseRate = canViewCost && qty > 0 ? cost / qty : 0;
  const trueCostRate = canViewCost ? baseRate * (1 + overhead / 100) : 0;
  const recommendedSellRate = canViewCost ? Math.round(trueCostRate * (1 + margin / 100)) : 0;

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

    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Please enter a valid quantity received.');
      return;
    }

    if (canViewCost && (!Number.isFinite(cost) || cost < 0)) {
      setError('Total cost paid cannot be negative.');
      return;
    }

    try {
      setLoading(true);
      await onRestock(
        selectedSellableId,
        qty,
        cost,
        canViewCost && updatePrice && recommendedSellRate > 0 ? recommendedSellRate : undefined,
        canViewCost ? overhead : 15
      );
      onClose();
      // Reset form
      setSelectedSellableId('');
      setSearchTerm('');
      setAddedQuantity('');
      setTotalCostPaid('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] overflow-y-auto"
    >
      <div className="w-full max-w-xl bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 my-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-hairline">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-positive/10 border border-positive/25 flex items-center justify-center text-positive">
              <PlusCircle className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-base font-medium text-ink">
                {initialProduct ? `Restock: ${initialProduct.name}` : 'Restock / add purchase'}
              </h2>
              <p className="text-xs text-ink-muted">
                {initialProduct
                  ? 'Record incoming shipment, update stock, and recalculate benchmark price'
                  : 'Select an existing product to record incoming shipment, cost, and benchmark price'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised transition-colors duration-150 ease-unslop"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* If opened directly from row, show Product Details Header directly */}
          {initialProduct ? (
            <div className="p-4 rounded-xl bg-raised border border-accent/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/12 border border-accent/25 flex items-center justify-center text-accent-ink shrink-0">
                  <Package className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-medium text-ink">{selectedProduct?.name}</h4>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-surface border border-hairline text-ink-muted font-mono">
                      {selectedProduct?.sku}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                        isOil
                          ? 'bg-accent/12 text-accent-ink border-accent/25'
                          : 'bg-surface text-ink-secondary border-hairline'
                      }`}
                    >
                      {isOil ? 'Attar / Oil' : 'Packaged'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-1 tabular-nums">
                    In hand <strong className="text-positive font-mono font-medium">{selectedProduct?.primaryStockQuantity ?? 0} {unitLabel}</strong>
                    {' '}·{' '}
                    Retail <strong className="text-accent-ink font-mono font-medium">৳{selectedProduct?.retailPriceBdt}</strong> / {unitLabel}
                  </p>
                </div>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-md bg-positive/10 text-positive border border-positive/25 font-medium shrink-0">
                Direct restock
              </span>
            </div>
          ) : (
            <>
              {/* Step 1: Search & Select Existing Product */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-ink-secondary">
                  1. Search &amp; select existing product *
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" strokeWidth={1.5} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search product name or SKU"
                    className="w-full pl-9 pr-3 py-2 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Quick selector list */}
                <div className="max-h-36 overflow-y-auto space-y-1 p-1 bg-raised/60 border border-hairline rounded-lg">
                  {searchResults.length === 0 ? (
                    <p className="text-xs text-ink-muted p-2 text-center">
                      No matching product found. Use + New Product for new items.
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
                        className={`w-full flex items-center justify-between p-2 rounded-md text-left text-xs transition-colors duration-150 ease-unslop ${
                          selectedSellableId === item.id
                            ? 'bg-accent text-accent-fg font-semibold'
                            : 'text-ink-secondary hover:bg-surface hover:text-ink'
                        }`}
                      >
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-[11px] opacity-75 font-mono ml-2">({item.sku})</span>
                        </div>
                        <span className="font-mono tabular-nums">৳{item.retailPriceBdt}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Selected Product Summary Card */}
              {selectedProduct && (
                <div className="p-3.5 rounded-xl bg-raised border border-accent/25 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Package className="w-4 h-4 text-accent-ink shrink-0" strokeWidth={1.5} />
                    <div>
                      <h4 className="text-xs font-medium text-ink">{selectedProduct.name}</h4>
                      <p className="text-xs text-ink-muted tabular-nums">
                        Current retail <strong className="text-accent-ink font-mono font-medium">৳{selectedProduct.retailPriceBdt}</strong> / {unitLabel}
                        {' '}·{' '}Stock <strong className="text-ink font-mono font-medium">{selectedProduct.primaryStockQuantity ?? 0} {unitLabel}</strong>
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-accent/12 text-accent-ink font-medium">
                    Selected
                  </span>
                </div>
              )}
            </>
          )}

          {/* Step 2: Quantity and Cost */}
          {selectedProduct && (
            <div className="p-4 rounded-xl bg-raised/60 border border-hairline space-y-4">
              <h3 className="text-xs font-medium text-accent-ink">
                {initialProduct ? 'Received shipment details' : '2. Received shipment details'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Quantity / volume added ({unitLabel}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    autoFocus={Boolean(initialProduct)}
                    value={addedQuantity}
                    onChange={(e) => setAddedQuantity(e.target.value)}
                    placeholder={unitLabel === 'ml' ? '100, 250' : '20, 50'}
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-sm text-ink font-mono tabular-nums focus:outline-none focus:border-accent"
                  />
                  <span className="text-[11px] text-ink-muted mt-0.5 block">
                    Added directly to active stock
                  </span>
                </div>

                {canViewCost && (
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1">
                      Total invoice cost paid (৳) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={totalCostPaid}
                      onChange={(e) => setTotalCostPaid(e.target.value)}
                      placeholder="10000"
                      className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-sm text-ink font-mono tabular-nums focus:outline-none focus:border-accent"
                    />
                    <span className="text-[11px] text-ink-muted mt-0.5 block">
                      Total paid to supplier for this batch
                    </span>
                  </div>
                )}
              </div>

              {/* Automatic Math Breakdown (Owner/Manager only) */}
              {canViewCost && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-hairline">
                  <div className="p-2.5 rounded-lg bg-surface border border-hairline text-center">
                    <div className="text-[11px] text-ink-muted">Base purchase rate</div>
                    <div className="text-xs font-mono tabular-nums font-medium text-ink mt-0.5">
                      {baseRate > 0 ? `৳${baseRate.toFixed(2)} / ${unitLabel}` : '—'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-warning/10 border border-warning/25 text-center">
                    <div className="flex items-center justify-center gap-1 text-[11px] text-warning font-medium">
                      <span>+</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={overheadPercent}
                        onChange={(e) => setOverheadPercent(e.target.value)}
                        className="w-7 text-center bg-transparent border-b border-warning font-medium text-warning text-[11px] focus:outline-none tabular-nums"
                      />
                      <span>% true cost</span>
                    </div>
                    <div className="text-xs font-mono tabular-nums font-medium text-warning mt-0.5">
                      {trueCostRate > 0 ? `৳${trueCostRate.toFixed(2)} / ${unitLabel}` : '—'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-positive/10 border border-positive/25 text-center">
                    <div className="flex items-center justify-center gap-1 text-[11px] text-positive font-medium">
                      <span>+</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={marginPercent}
                        onChange={(e) => setMarginPercent(e.target.value)}
                        className="w-7 text-center bg-transparent border-b border-positive font-medium text-positive text-[11px] focus:outline-none tabular-nums"
                      />
                      <span>% ideal sell</span>
                    </div>
                    <div className="text-xs font-mono tabular-nums font-medium text-positive mt-0.5">
                      {recommendedSellRate > 0 ? `৳${recommendedSellRate} / ${unitLabel}` : '—'}
                    </div>
                  </div>
                </div>
              )}

              {/* Live Price Comparison and Update Toggle */}
              {canViewCost && recommendedSellRate > 0 && (
                <div className="p-3 rounded-lg bg-surface border border-hairline space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-muted">Current benchmark price</span>
                    <span className="font-mono tabular-nums text-ink-secondary">৳{selectedProduct.retailPriceBdt} / {unitLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-positive font-medium">New calculated benchmark</span>
                    <span className="font-mono tabular-nums font-medium text-positive text-sm">৳{recommendedSellRate} / {unitLabel}</span>
                  </div>

                  <label className="flex items-center gap-2 pt-2 border-t border-hairline cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updatePrice}
                      onChange={(e) => setUpdatePrice(e.target.checked)}
                      className="rounded border-hairline-strong accent-accent"
                    />
                    <span className="text-xs text-ink-secondary">
                      Update product benchmark price to <strong className="text-ink font-mono font-medium">৳{recommendedSellRate} / {unitLabel}</strong>
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-hairline">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-hairline bg-raised text-ink-secondary hover:text-ink text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedProduct}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-positive hover:opacity-90 text-white font-semibold text-xs disabled:opacity-50 transition-opacity duration-150 ease-unslop"
            >
              <span>{loading ? 'Adding…' : 'Confirm & Add to Stock'}</span>
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
