import React, { useState } from 'react';
import {
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Percent,
} from 'lucide-react';
import type { BulkPriceUpdateItem, Sellable } from '../../domain/catalog/types';

interface BulkPriceEditorProps {
  sellables: Sellable[];
  onSavePrices: (items: BulkPriceUpdateItem[]) => Promise<void>;
  canViewCost: boolean;
}

export const BulkPriceEditor: React.FC<BulkPriceEditorProps> = ({
  sellables,
  onSavePrices,
  canViewCost,
}) => {
  const [editedPrices, setEditedPrices] = useState<
    Record<
      string,
      {
        retailPrice: number;
        wholesalePrice: number;
        minPrice: number;
        changed: boolean;
      }
    >
  >(() => {
    const map: Record<string, { retailPrice: number; wholesalePrice: number; minPrice: number; changed: boolean }> =
      {};
    for (const s of sellables) {
      map[s.id] = {
        retailPrice: s.retailPriceBdt,
        wholesalePrice: s.wholesalePriceBdt,
        minPrice: s.minPriceBdt,
        changed: false,
      };
    }
    return map;
  });

  const [markupPercent, setMarkupPercent] = useState('10');
  const [markupTarget, setMarkupTarget] = useState<'retail' | 'wholesale'>('retail');
  const [markupBase, setMarkupBase] = useState<'wholesale' | 'current'>('current');
  const [reason, setReason] = useState('Catalog price adjustment');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changedCount = Object.values(editedPrices).filter((p) => p.changed).length;

  const handlePriceChange = (
    id: string,
    field: 'retailPrice' | 'wholesalePrice' | 'minPrice',
    val: number
  ) => {
    setEditedPrices((prev) => {
      const orig = sellables.find((s) => s.id === id);
      if (!orig) return prev;
      const current = prev[id] || {
        retailPrice: orig.retailPriceBdt,
        wholesalePrice: orig.wholesalePriceBdt,
        minPrice: orig.minPriceBdt,
        changed: false,
      };

      const next = { ...current, [field]: isNaN(val) ? 0 : val };
      const hasChanged =
        next.retailPrice !== orig.retailPriceBdt ||
        next.wholesalePrice !== orig.wholesalePriceBdt ||
        next.minPrice !== orig.minPriceBdt;

      return {
        ...prev,
        [id]: { ...next, changed: hasChanged },
      };
    });
  };

  const applyMarkupToAll = () => {
    const pct = parseFloat(markupPercent);
    if (isNaN(pct)) return;

    setEditedPrices((prev) => {
      const next = { ...prev };
      for (const s of sellables) {
        const cur = next[s.id] || {
          retailPrice: s.retailPriceBdt,
          wholesalePrice: s.wholesalePriceBdt,
          minPrice: s.minPriceBdt,
          changed: false,
        };

        if (markupTarget === 'retail') {
          const base = markupBase === 'wholesale' ? cur.wholesalePrice : cur.retailPrice;
          const newRetail = Math.round(base * (1 + pct / 100));
          next[s.id] = {
            ...cur,
            retailPrice: newRetail,
            changed: newRetail !== s.retailPriceBdt || cur.wholesalePrice !== s.wholesalePriceBdt,
          };
        } else {
          const newWholesale = Math.round(cur.wholesalePrice * (1 + pct / 100));
          next[s.id] = {
            ...cur,
            wholesalePrice: newWholesale,
            changed: cur.retailPrice !== s.retailPriceBdt || newWholesale !== s.wholesalePriceBdt,
          };
        }
      }
      return next;
    });
  };

  const handleReset = () => {
    const map: Record<string, { retailPrice: number; wholesalePrice: number; minPrice: number; changed: boolean }> =
      {};
    for (const s of sellables) {
      map[s.id] = {
        retailPrice: s.retailPriceBdt,
        wholesalePrice: s.wholesalePriceBdt,
        minPrice: s.minPriceBdt,
        changed: false,
      };
    }
    setEditedPrices(map);
    setSuccess(null);
    setError(null);
  };

  const handleSave = async () => {
    const changedItems: BulkPriceUpdateItem[] = [];
    for (const s of sellables) {
      const p = editedPrices[s.id];
      if (p && p.changed) {
        changedItems.push({
          sellableId: s.id,
          retailPriceBdt: p.retailPrice,
          wholesalePriceBdt: p.wholesalePrice,
          minPriceBdt: p.minPrice,
          changeReason: reason.trim() || 'Bulk price revision',
        });
      }
    }

    if (changedItems.length === 0) return;

    try {
      setSaving(true);
      setError(null);
      await onSavePrices(changedItems);
      setSuccess(`Successfully updated prices for ${changedItems.length} products!`);
      // clear changed flags
      setEditedPrices((prev) => {
        const next = { ...prev };
        for (const it of changedItems) {
          if (next[it.sellableId]) {
            next[it.sellableId].changed = false;
          }
        }
        return next;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Batch markup helper card */}
      <div className="p-4 rounded-xl bg-brand-surface border border-brand-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Batch Price Markup Tool</h4>
            <p className="text-xs text-neutral-400">
              Quickly adjust retail or wholesale prices across all listed items.
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <select
            value={markupTarget}
            onChange={(e) => setMarkupTarget(e.target.value as 'retail' | 'wholesale')}
            className="px-3 py-1.5 bg-brand-black border border-brand-border rounded-lg text-xs text-white"
          >
            <option value="retail">Adjust Retail Price</option>
            <option value="wholesale">Adjust Wholesale Price</option>
          </select>

          {markupTarget === 'retail' && (
            <select
              value={markupBase}
              onChange={(e) => setMarkupBase(e.target.value as 'wholesale' | 'current')}
              className="px-3 py-1.5 bg-brand-black border border-brand-border rounded-lg text-xs text-white"
            >
              <option value="current">Based on Current Retail</option>
              <option value="wholesale">Based on Wholesale Price</option>
            </select>
          )}

          <div className="flex items-center gap-1 bg-brand-black border border-brand-border rounded-lg px-2.5 py-1">
            <span className="text-xs text-neutral-400">+</span>
            <input
              type="number"
              step="any"
              value={markupPercent}
              onChange={(e) => setMarkupPercent(e.target.value)}
              className="w-12 bg-transparent text-xs text-white font-mono focus:outline-none"
            />
            <span className="text-xs text-neutral-400">%</span>
          </div>

          <button
            type="button"
            onClick={applyMarkupToAll}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition-colors"
          >
            Apply to All
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Save bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-brand-surface border border-brand-border rounded-xl">
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-300">
            Unsaved changes:{' '}
            <span
              className={`font-bold font-mono px-2 py-0.5 rounded text-xs ${
                changedCount > 0 ? 'bg-brand-gold text-brand-black' : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {changedCount}
            </span>
          </span>

          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for revision (saved to audit history)"
            className="px-3 py-1.5 bg-brand-black border border-brand-border rounded-lg text-xs text-white placeholder-neutral-500 w-64 focus:outline-none focus:border-brand-gold"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={changedCount === 0 || saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-border text-neutral-400 hover:text-white text-xs font-semibold disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={changedCount === 0 || saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-brand-black font-semibold text-xs shadow-md shadow-brand-gold/20 disabled:opacity-40 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : `Save ${changedCount} Changes`}
          </button>
        </div>
      </div>

      {/* Table grid */}
      <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-surface">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-brand-border bg-brand-black/70 text-neutral-400 uppercase tracking-wider font-semibold">
              <th className="py-3 px-4">Product Name & SKU</th>
              <th className="py-3 px-3">Type</th>
              {canViewCost && <th className="py-3 px-3 text-right">Cost (৳)</th>}
              <th className="py-3 px-3 text-right">Retail Price (৳)</th>
              <th className="py-3 px-3 text-right">Wholesale Price (৳)</th>
              <th className="py-3 px-3 text-right">Floor / Min (৳)</th>
              {canViewCost && <th className="py-3 px-3 text-right">Margin %</th>}
              <th className="py-3 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border/50 text-neutral-300">
            {sellables.map((s) => {
              const state = editedPrices[s.id] || {
                retailPrice: s.retailPriceBdt,
                wholesalePrice: s.wholesalePriceBdt,
                minPrice: s.minPriceBdt,
                changed: false,
              };

              let marginPct: string | null = null;
              if (canViewCost && s.calculatedCostBdt && state.retailPrice > 0) {
                const margin =
                  ((state.retailPrice - s.calculatedCostBdt) / state.retailPrice) * 100;
                marginPct = `${margin.toFixed(1)}%`;
              }

              return (
                <tr
                  key={s.id}
                  className={`hover:bg-neutral-800/40 transition-colors ${
                    state.changed ? 'bg-brand-gold/5' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{s.name}</div>
                    <div className="text-[10px] text-neutral-500 font-mono">{s.sku}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="capitalize text-[11px] text-neutral-400">
                      {s.sellableType.replace('_', ' ')}
                    </span>
                  </td>
                  {canViewCost && (
                    <td className="py-3 px-3 text-right font-mono text-neutral-400">
                      {s.calculatedCostBdt != null ? `৳${s.calculatedCostBdt.toFixed(2)}` : '—'}
                    </td>
                  )}
                  <td className="py-3 px-3 text-right">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={state.retailPrice}
                      onChange={(e) =>
                        handlePriceChange(s.id, 'retailPrice', parseFloat(e.target.value))
                      }
                      className={`w-24 text-right px-2 py-1 rounded bg-brand-black border font-mono text-xs text-white focus:outline-none ${
                        state.retailPrice !== s.retailPriceBdt
                          ? 'border-brand-gold text-brand-gold font-bold'
                          : 'border-brand-border'
                      }`}
                    />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={state.wholesalePrice}
                      onChange={(e) =>
                        handlePriceChange(s.id, 'wholesalePrice', parseFloat(e.target.value))
                      }
                      className={`w-24 text-right px-2 py-1 rounded bg-brand-black border font-mono text-xs text-white focus:outline-none ${
                        state.wholesalePrice !== s.wholesalePriceBdt
                          ? 'border-brand-gold text-brand-gold font-bold'
                          : 'border-brand-border'
                      }`}
                    />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={state.minPrice}
                      onChange={(e) =>
                        handlePriceChange(s.id, 'minPrice', parseFloat(e.target.value))
                      }
                      className="w-24 text-right px-2 py-1 rounded bg-brand-black border border-brand-border font-mono text-xs text-neutral-400 focus:outline-none"
                    />
                  </td>
                  {canViewCost && (
                    <td className="py-3 px-3 text-right font-mono">
                      {marginPct ? (
                        <span
                          className={
                            parseFloat(marginPct) > 0 ? 'text-emerald-400' : 'text-red-400'
                          }
                        >
                          {marginPct}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  <td className="py-3 px-3 text-center">
                    {state.changed ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-brand-gold/20 text-brand-gold font-semibold">
                        Modified
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-600">Saved</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
