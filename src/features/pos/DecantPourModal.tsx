import React, { useState } from 'react';
import { X, Droplet, ArrowRight, AlertTriangle, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../app/store';
import { STANDARD_TOLA_GRAMS } from '../../domain/catalog/units';
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

export const DecantPourModal: React.FC<DecantPourModalProps> = ({
  isOpen,
  onClose,
  product,
  onConfirm,
}) => {
  const { shopSettings } = useAppStore();
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

  const isWeightTola = (shopSettings?.tolaConvention ?? 'volume_12ml') === 'weight_11g';
  const baseUnit = product.primaryUnitCode || 'ml';
  const presetBottleSizes = isWeightTola
    ? [
        { size: 3, label: `3 ${baseUnit}` },
        { size: 6, label: `6 ${baseUnit}` },
        { size: STANDARD_TOLA_GRAMS, label: `${STANDARD_TOLA_GRAMS} g (1 Tola)` },
      ]
    : [
        { size: 3, label: `3 ${baseUnit}` },
        { size: 6, label: `6 ${baseUnit}` },
        { size: 12, label: '12 ml (1 Tola)' },
      ];

  const currentMl = isCustom ? parseFloat(customMl) || 0 : selectedSize;
  const parsedRate = parseFloat(unitRate) || 0;
  const lineTotal = Math.round(currentMl * parsedRate);
  const idealTotal = Math.round(currentMl * product.retailPriceBdt);
  const stockAvailable = product.primaryStockQuantity ?? 0;
  const isOverStock = currentMl > stockAvailable;
  const policy = shopSettings?.negativeStockPolicy ?? 'warn_allow';
  const isStrictBlock = policy === 'block' && isOverStock;
  const showWarnAllow = policy === 'warn_allow' && isOverStock;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isStrictBlock) return;
    if (
      !Number.isFinite(currentMl) ||
      currentMl <= 0 ||
      !Number.isFinite(parsedRate) ||
      parsedRate < 0
    ) {
      return;
    }

    onConfirm({
      bottleSizeMl: currentMl,
      unitPriceBdt: parsedRate,
      customLineTotalBdt: lineTotal,
    });
    onClose();
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-md bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-hairline">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/12 border border-accent/25 flex items-center justify-center text-accent-ink shrink-0">
              <Droplet className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-base font-medium text-ink leading-tight">{product.name}</h3>
              <p className="text-xs text-ink-muted mt-0.5 tabular-nums">
                In hand{' '}
                <strong className={`font-medium ${stockAvailable <= 5 ? 'text-negative' : 'text-positive'}`}>
                  {stockAvailable} ml
                </strong>
                {' '}· Benchmark{' '}
                <strong className="text-accent-ink font-mono font-medium">৳{product.retailPriceBdt}/ml</strong>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bottle Size Presets */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-ink-secondary">
              1. Pouring volume (bottle size)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {presetBottleSizes.map((b) => (
                <button
                  key={b.size}
                  type="button"
                  onClick={() => {
                    setSelectedSize(b.size);
                    setIsCustom(false);
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors duration-150 ease-unslop ${
                    !isCustom && selectedSize === b.size
                      ? 'bg-accent text-accent-fg font-semibold'
                      : 'bg-raised border border-hairline text-ink-secondary hover:border-hairline-strong hover:text-ink'
                  }`}
                >
                  {b.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsCustom(true)}
                className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors duration-150 ease-unslop ${
                  isCustom
                    ? 'bg-accent text-accent-fg font-semibold'
                    : 'bg-raised border border-hairline text-ink-secondary hover:border-hairline-strong hover:text-ink'
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
                    placeholder="Custom ml (e.g. 5, 8, 25)"
                    className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-sm text-ink font-mono tabular-nums focus:outline-none focus:border-accent"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-ink-muted font-medium">
                    ml
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Flexible Price Per ML */}
          <div className="p-3.5 rounded-lg bg-raised/70 border border-hairline space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ink-secondary">
                2. Rate per ml
              </label>
              {parsedRate !== product.retailPriceBdt && (
                <button
                  type="button"
                  onClick={() => setUnitRate(String(product.retailPriceBdt))}
                  className="text-xs text-accent-ink hover:underline font-medium"
                >
                  Reset to ৳{product.retailPriceBdt}
                </button>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-ink-muted font-medium">৳</span>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={unitRate}
                onChange={(e) => setUnitRate(e.target.value)}
                className="w-full pl-8 pr-16 py-1.5 bg-surface border border-hairline rounded-lg text-sm text-ink font-mono tabular-nums font-medium focus:outline-none focus:border-accent"
              />
              <span className="absolute right-3 top-2 text-xs text-ink-muted">/ ml</span>
            </div>
            <p className="text-xs text-ink-muted">
              You can adjust this rate up or down for this sale
            </p>
          </div>

          {/* Stock Policy Feedback */}
          {isStrictBlock && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span className="tabular-nums">
                Insufficient stock (strict block policy enabled: {currentMl} {baseUnit} requested, {stockAvailable} {baseUnit} available)
              </span>
            </div>
          )}
          {showWarnAllow && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/25 text-warning text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span className="tabular-nums">
                {currentMl} {baseUnit} exceeds current stock ({stockAvailable} {baseUnit})
              </span>
            </div>
          )}

          {/* Line Total Summary Card */}
          <div className="p-4 rounded-xl bg-raised border border-accent/30 flex items-center justify-between">
            <div>
              <div className="text-xs text-ink-muted font-medium">Line amount</div>
              <div className="text-xl font-medium text-accent-ink font-mono tabular-nums">
                ৳{lineTotal.toFixed(2)}
              </div>
            </div>

            <div className="text-right text-xs text-ink-muted tabular-nums">
              <div>
                Volume <strong className="text-ink font-mono font-medium">{currentMl} ml</strong>
              </div>
              {lineTotal !== idealTotal && (
                <div className="text-ink-muted line-through font-mono">
                  Ideal ৳{idealTotal}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-hairline bg-raised text-ink-secondary hover:text-ink text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isStrictBlock}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold transition-colors duration-150 ease-unslop disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Add to Cart</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
