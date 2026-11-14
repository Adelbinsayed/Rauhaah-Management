import React, { useState } from 'react';
import { X, Droplet, ArrowRight, AlertTriangle } from 'lucide-react';
import type { Sellable } from '../../domain/catalog/types';

interface DecantPourModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Sellable | null;
  onConfirm: (params: {
    bottleSizeMl: number;
    unitPriceBdt: number;
    customLineTotalBdt?: number;
  }) => void;
}

const PRESET_BOTTLE_SIZES = [
  { size: 3, label: '3 ml' },
  { size: 6, label: '6 ml' },
  { size: 12, label: '12 ml (1 Tola)' },
];

export const DecantPourModal: React.FC<DecantPourModalProps> = ({
  isOpen,
  onClose,
  product,
  onConfirm,
}) => {
  const [selectedSize, setSelectedSize] = useState<number>(3);
  const [isCustom, setIsCustom] = useState(false);
  const [customMl, setCustomMl] = useState('10');

  // Flexible pricing
  const defaultRate = product?.retailPriceBdt ?? 0;
  const [unitRate, setUnitRate] = useState<string>(String(defaultRate));

  React.useEffect(() => {
    if (product) {
      setUnitRate(String(product.retailPriceBdt));
      setSelectedSize(3);
      setIsCustom(false);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const currentMl = isCustom ? parseFloat(customMl) || 0 : selectedSize;
  const parsedRate = parseFloat(unitRate) || 0;
  const lineTotal = Math.round(currentMl * parsedRate);
  const idealTotal = Math.round(currentMl * product.retailPriceBdt);
  const stockAvailable = product.primaryStockQuantity ?? 0;
  const isOverStock = currentMl > stockAvailable;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentMl <= 0 || parsedRate < 0) return;

    onConfirm({
      bottleSizeMl: currentMl,
      unitPriceBdt: parsedRate,
      customLineTotalBdt: lineTotal,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-brand-surface border border-brand-border rounded-2xl shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-brand-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Droplet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">{product.name}</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Stock in hand:{' '}
                <strong className={stockAvailable <= 5 ? 'text-red-400' : 'text-emerald-400'}>
                  {stockAvailable} ml
                </strong>
                {' '}&bull;{' '}Benchmark Rate:{' '}
                <strong className="text-brand-gold font-mono">৳{product.retailPriceBdt}/ml</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bottle Size Presets */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              1. Select Pouring Volume (Bottle Size)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_BOTTLE_SIZES.map((b) => (
                <button
                  key={b.size}
                  type="button"
                  onClick={() => {
                    setSelectedSize(b.size);
                    setIsCustom(false);
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                    !isCustom && selectedSize === b.size
                      ? 'bg-amber-500 text-brand-black shadow-md shadow-amber-500/20'
                      : 'bg-brand-black border border-brand-border text-neutral-300 hover:border-neutral-600'
                  }`}
                >
                  {b.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsCustom(true)}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                  isCustom
                    ? 'bg-amber-500 text-brand-black shadow-md shadow-amber-500/20'
                    : 'bg-brand-black border border-brand-border text-neutral-300 hover:border-neutral-600'
                }`}
              >
                Custom ml
              </button>
            </div>

            {isCustom && (
              <div className="pt-2">
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.5"
                    autoFocus
                    required
                    value={customMl}
                    onChange={(e) => setCustomMl(e.target.value)}
                    placeholder="Enter custom ml (e.g. 5, 8, 25)"
                    className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-xl text-sm text-white font-mono focus:outline-none focus:border-brand-gold"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-neutral-500 font-bold">
                    ml
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Flexible Price Per ML */}
          <div className="p-3.5 rounded-xl bg-brand-black/70 border border-brand-border space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                2. Rate Per ML (Flexible Pricing)
              </label>
              {parsedRate !== product.retailPriceBdt && (
                <button
                  type="button"
                  onClick={() => setUnitRate(String(product.retailPriceBdt))}
                  className="text-[10px] text-brand-gold hover:underline font-semibold"
                >
                  Reset to ৳{product.retailPriceBdt}
                </button>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-neutral-500 font-bold">৳</span>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={unitRate}
                onChange={(e) => setUnitRate(e.target.value)}
                className="w-full pl-8 pr-16 py-1.5 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono font-bold focus:outline-none focus:border-brand-gold"
              />
              <span className="absolute right-3 top-2 text-xs text-neutral-400">/ ml</span>
            </div>
            <p className="text-[10px] text-neutral-400">
              You can adjust this rate up or down freely for this customer sale.
            </p>
          </div>

          {/* Overstock Warning (allowed under negative-stock policy) */}
          {isOverStock && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Note: {currentMl} ml exceeds current stock ({stockAvailable} ml). Negative stock warning.
              </span>
            </div>
          )}

          {/* Line Total Summary Card */}
          <div className="p-4 rounded-xl bg-brand-black border border-brand-gold/40 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-neutral-400 uppercase font-semibold">Line Amount</div>
              <div className="text-xl font-bold text-brand-gold font-mono">
                ৳{lineTotal.toFixed(2)}
              </div>
            </div>

            <div className="text-right text-[11px] text-neutral-400">
              <div>
                Volume: <strong className="text-white font-mono">{currentMl} ml</strong>
              </div>
              {lineTotal !== idealTotal && (
                <div className="text-neutral-500 line-through font-mono">
                  Ideal: ৳{idealTotal}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-brand-border text-neutral-300 hover:text-white text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-gold hover:bg-brand-gold-light text-brand-black text-xs font-bold transition-all shadow-lg shadow-brand-gold/15"
            >
              <span>Add to Cart</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
