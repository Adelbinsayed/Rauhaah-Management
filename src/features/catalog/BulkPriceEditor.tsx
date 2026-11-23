import React, { useState, useEffect } from 'react';
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
  canEdit: boolean;
}

export const BulkPriceEditor: React.FC<BulkPriceEditorProps> = ({
  sellables,
  onSavePrices,
  canViewCost,
  canEdit,
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

  useEffect(() => {
    const map: Record<
      string,
      { retailPrice: number; wholesalePrice: number; minPrice: number; changed: boolean }
    > = {};
    for (const s of sellables) {
      map[s.id] = {
        retailPrice: s.retailPriceBdt,
        wholesalePrice: s.wholesalePriceBdt,
        minPrice: s.minPriceBdt,
        changed: false,
      };
    }
    setEditedPrices(map);
  }, [sellables]);

  const changedCount = Object.values(editedPrices).filter((p) => p.changed).length;

  const handlePriceChange = (
    id: string,
    field: 'retailPrice' | 'wholesalePrice' | 'minPrice',
    val: number
  ) => {
    if (!canEdit) return;
    setEditedPrices((prev) => {
      const orig = sellables.find((s) => s.id === id);
      if (!orig) return prev;
      const current = prev[id] || {
        retailPrice: orig.retailPriceBdt,
        wholesalePrice: orig.wholesalePriceBdt,
        minPrice: orig.minPriceBdt,
        changed: false,
      };

      const safeVal = Number.isFinite(val) && val >= 0 ? val : 0;
      const next = { ...current, [field]: safeVal };
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
    if (!canEdit) return;
    const pct = parseFloat(markupPercent);
    if (!Number.isFinite(pct)) return;

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
          const newRetail = Math.max(0, Math.round(base * (1 + pct / 100)));
          next[s.id] = {
            ...cur,
            retailPrice: newRetail,
            changed:
              newRetail !== s.retailPriceBdt ||
              cur.wholesalePrice !== s.wholesalePriceBdt ||
              cur.minPrice !== s.minPriceBdt,
          };
        } else {
          const newWholesale = Math.max(0, Math.round(cur.wholesalePrice * (1 + pct / 100)));
          next[s.id] = {
            ...cur,
            wholesalePrice: newWholesale,
            changed:
              cur.retailPrice !== s.retailPriceBdt ||
              newWholesale !== s.wholesalePriceBdt ||
              cur.minPrice !== s.minPriceBdt,
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
    if (!canEdit) return;
    const changedItems: BulkPriceUpdateItem[] = [];
    for (const s of sellables) {
      const p = editedPrices[s.id];
      if (p && p.changed) {
        if (
          !Number.isFinite(p.retailPrice) ||
          p.retailPrice < 0 ||
          !Number.isFinite(p.wholesalePrice) ||
          p.wholesalePrice < 0 ||
          !Number.isFinite(p.minPrice) ||
          p.minPrice < 0
        ) {
          setError(`Invalid negative or non-numeric price for ${s.name}.`);
          return;
        }
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
      // clear changed flags without mutating state objects in place
      setEditedPrices((prev) => {
        const next = { ...prev };
        for (const it of changedItems) {
          if (next[it.sellableId]) {
            next[it.sellableId] = { ...next[it.sellableId], changed: false };
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
      <div className="p-4 rounded-xl bg-surface border border-hairline flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/12 border border-accent/25 flex items-center justify-center text-accent-ink">
            <Percent className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-ink">Batch price markup tool</h4>
            <p className="text-xs text-ink-muted">
              Adjust retail or wholesale prices across all listed items
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <select
            value={markupTarget}
            onChange={(e) => setMarkupTarget(e.target.value as 'retail' | 'wholesale')}
            disabled={!canEdit}
            className="px-3 py-1.5 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent disabled:opacity-50"
          >
            <option value="retail">Adjust Retail Price</option>
            <option value="wholesale">Adjust Wholesale Price</option>
          </select>

          {markupTarget === 'retail' && (
            <select
              value={markupBase}
              onChange={(e) => setMarkupBase(e.target.value as 'wholesale' | 'current')}
              disabled={!canEdit}
              className="px-3 py-1.5 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent disabled:opacity-50"
            >
              <option value="current">Based on Current Retail</option>
              <option value="wholesale">Based on Wholesale Price</option>
            </select>
          )}

          <div className="flex items-center gap-1 bg-raised border border-hairline rounded-lg px-2.5 py-1">
            <span className="text-xs text-ink-muted">+</span>
            <input
              type="number"
              step="any"
              value={markupPercent}
              onChange={(e) => setMarkupPercent(e.target.value)}
              disabled={!canEdit}
              className="w-12 bg-transparent text-xs text-ink font-mono tabular-nums focus:outline-none disabled:opacity-50"
            />
            <span className="text-xs text-ink-muted">%</span>
          </div>

          <button
            type="button"
            onClick={applyMarkupToAll}
            disabled={!canEdit}
            className="px-3 py-1.5 rounded-lg bg-raised hover:border-hairline-strong text-ink text-xs font-medium border border-hairline transition-colors duration-150 ease-unslop disabled:opacity-40"
          >
            Apply to All
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-positive/10 border border-positive/25 text-positive text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          <span>{success}</span>
        </div>
      )}

      {/* Save bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface border border-hairline rounded-xl">
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-secondary">
            Unsaved changes{' '}
            <span
              className={`font-medium font-mono tabular-nums px-2 py-0.5 rounded text-xs ${
                changedCount > 0 ? 'bg-accent text-accent-fg font-semibold' : 'bg-raised text-ink-muted'
              }`}
            >
              {changedCount}
            </span>
          </span>

          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={!canEdit}
            placeholder="Reason for revision (saved to audit history)"
            className="px-3 py-1.5 bg-raised border border-hairline rounded-lg text-xs text-ink placeholder-ink-muted w-64 focus:outline-none focus:border-accent disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!canEdit || changedCount === 0 || saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hairline bg-raised text-ink-secondary hover:text-ink text-xs font-medium disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canEdit || changedCount === 0 || saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs disabled:opacity-40 transition-colors duration-150 ease-unslop tabular-nums"
          >
            <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
            {saving ? 'Saving…' : `Save ${changedCount} Changes`}
          </button>
        </div>
      </div>

      {/* Table grid */}
      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-hairline bg-raised/70 text-ink-muted font-medium">
              <th className="py-3 px-4">Product name &amp; SKU</th>
              <th className="py-3 px-3">Type</th>
              {canViewCost && <th className="py-3 px-3 text-right">Cost (৳)</th>}
              <th className="py-3 px-3 text-right">Retail price (৳)</th>
              <th className="py-3 px-3 text-right">Wholesale price (৳)</th>
              <th className="py-3 px-3 text-right">Floor / min (৳)</th>
              {canViewCost && <th className="py-3 px-3 text-right">Margin %</th>}
              <th className="py-3 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-ink-secondary">
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
                  className={`hover:bg-raised/50 transition-colors duration-150 ease-unslop ${
                    state.changed ? 'bg-accent/5' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="font-medium text-ink">{s.name}</div>
                    <div className="text-[11px] text-ink-muted font-mono">{s.sku}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="capitalize text-xs text-ink-muted">
                      {s.sellableType.replace('_', ' ')}
                    </span>
                  </td>
                  {canViewCost && (
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-ink-muted">
                      {s.calculatedCostBdt != null ? `৳${s.calculatedCostBdt.toFixed(2)}` : '—'}
                    </td>
                  )}
                  <td className="py-3 px-3 text-right">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      disabled={!canEdit}
                      value={state.retailPrice}
                      onChange={(e) =>
                        handlePriceChange(s.id, 'retailPrice', parseFloat(e.target.value))
                      }
                      className={`w-24 text-right px-2 py-1 rounded bg-raised border font-mono tabular-nums text-xs focus:outline-none disabled:opacity-50 ${
                        state.retailPrice !== s.retailPriceBdt
                          ? 'border-accent text-accent-ink font-semibold'
                          : 'border-hairline text-ink'
                      }`}
                    />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      disabled={!canEdit}
                      value={state.wholesalePrice}
                      onChange={(e) =>
                        handlePriceChange(s.id, 'wholesalePrice', parseFloat(e.target.value))
                      }
                      className={`w-24 text-right px-2 py-1 rounded bg-raised border font-mono tabular-nums text-xs focus:outline-none disabled:opacity-50 ${
                        state.wholesalePrice !== s.wholesalePriceBdt
                          ? 'border-accent text-accent-ink font-semibold'
                          : 'border-hairline text-ink'
                      }`}
                    />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      disabled={!canEdit}
                      value={state.minPrice}
                      onChange={(e) =>
                        handlePriceChange(s.id, 'minPrice', parseFloat(e.target.value))
                      }
                      className="w-24 text-right px-2 py-1 rounded bg-raised border border-hairline font-mono tabular-nums text-xs text-ink-muted focus:outline-none focus:border-accent disabled:opacity-50"
                    />
                  </td>
                  {canViewCost && (
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {marginPct ? (
                        <span
                          className={
                            parseFloat(marginPct) > 0 ? 'text-positive' : 'text-negative'
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
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-accent/15 text-accent-ink font-medium">
                        Modified
                      </span>
                    ) : (
                      <span className="text-[11px] text-ink-muted">Saved</span>
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
