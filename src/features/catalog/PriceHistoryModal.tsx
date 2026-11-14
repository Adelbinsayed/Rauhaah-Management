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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-brand-surface border border-brand-border rounded-xl shadow-2xl p-6 my-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-brand-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Price Revision Audit Log</h2>
              <p className="text-xs text-neutral-400">
                {sellableName ? `Audit trail for "${sellableName}"` : 'All recent price modifications'}
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

        {loading ? (
          <div className="py-12 text-center text-neutral-400 text-xs">Loading price logs...</div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 text-xs italic">
            No price revisions recorded yet.
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-3 pr-1">
            {history.map((entry) => {
              const diff = entry.newPrice - entry.oldPrice;
              const isIncrease = diff > 0;
              const isNew = entry.oldPrice === 0;

              return (
                <div
                  key={entry.id}
                  className="p-3.5 rounded-xl bg-brand-black/60 border border-brand-border flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {entry.sellableName || 'Product'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-neutral-800 text-neutral-300">
                        {entry.priceType} Price
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                      {entry.changedByUsername && (
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="w-3 h-3 text-neutral-500" />
                          {entry.changedByUsername}
                        </span>
                      )}
                    </div>

                    {entry.changeReason && (
                      <p className="text-xs text-brand-gold/90 italic">
                        &ldquo;{entry.changeReason}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs text-neutral-500 font-mono line-through">
                        {isNew ? 'New' : `৳${entry.oldPrice}`}
                      </span>
                      <span className="text-sm font-bold text-white font-mono">
                        ৳{entry.newPrice}
                      </span>
                    </div>

                    {!isNew && (
                      <div
                        className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-semibold ${
                          isIncrease ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {isIncrease ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
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

        <div className="flex justify-end pt-2 border-t border-brand-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
