import React, { useEffect, useState } from 'react';
import { X, History, TrendingUp, TrendingDown, Clock, User as UserIcon } from 'lucide-react';
import { catalogRepo } from '../../data/repositories/catalogRepo';
import type { PriceHistoryEntry } from '../../domain/catalog/types';

interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellableId?: string;
  sellableName?: string;
}

export const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({
  isOpen,
  onClose,
  sellableId,
  sellableName,
}) => {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    catalogRepo
      .getPriceHistory(sellableId)
      .then((data) => setHistory(data))
      .catch((err) => console.error('Failed to load price history:', err))
      .finally(() => setLoading(false));
  }, [isOpen, sellableId]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] overflow-y-auto"
    >
      <div className="w-full max-w-2xl bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 my-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-hairline">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/12 border border-accent/25 flex items-center justify-center text-accent-ink">
              <History className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-base font-medium text-ink">Price revision audit log</h2>
              <p className="text-xs text-ink-muted">
                {sellableName ? `Audit trail for "${sellableName}"` : 'Recent price modifications'}
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

        {loading ? (
          <div className="py-12 text-center text-ink-muted text-xs">Loading price logs…</div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-ink-muted text-xs">
            No price revisions recorded yet
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-2.5 pr-1">
            {history.map((entry) => {
              const diff = entry.newPrice - entry.oldPrice;
              const isIncrease = diff > 0;
              const isNew = entry.oldPrice === 0;

              return (
                <div
                  key={entry.id}
                  className="p-3.5 rounded-xl bg-raised border border-hairline flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-ink">
                        {entry.sellableName || 'Product'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-medium capitalize bg-surface border border-hairline text-ink-secondary">
                        {entry.priceType} price
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-ink-muted tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" strokeWidth={1.5} />
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                      {entry.changedByUsername && (
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="w-3 h-3" strokeWidth={1.5} />
                          {entry.changedByUsername}
                        </span>
                      )}
                    </div>

                    {entry.changeReason && (
                      <p className="text-xs text-accent-ink">
                        &ldquo;{entry.changeReason}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs text-ink-muted font-mono tabular-nums line-through">
                        {isNew ? 'New' : `৳${entry.oldPrice}`}
                      </span>
                      <span className="text-sm font-medium text-ink font-mono tabular-nums">
                        ৳{entry.newPrice}
                      </span>
                    </div>

                    {!isNew && (
                      <div
                        className={`inline-flex items-center gap-0.5 text-xs font-mono tabular-nums font-medium ${
                          isIncrease ? 'text-positive' : 'text-negative'
                        }`}
                      >
                        {isIncrease ? (
                          <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
                        ) : (
                          <TrendingDown className="w-3 h-3" strokeWidth={1.5} />
                        )}
                        <span>
                          {isIncrease ? '+' : ''}
                          {diff} ৳
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-hairline">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-raised border border-hairline hover:border-hairline-strong text-ink text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
