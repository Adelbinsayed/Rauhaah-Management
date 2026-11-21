import type { Purchase } from '@/domain/purchases/types';
import { Calendar, CreditCard, Truck, X } from 'lucide-react';
import React from 'react';

interface PurchaseDetailsModalProps {
  selectedPurchase: Purchase | null;
  detailLoading: boolean;
  onClose: () => void;
}

export const PurchaseDetailsModal: React.FC<PurchaseDetailsModalProps> = ({
  selectedPurchase,
  detailLoading,
  onClose,
}) => {
  if (!selectedPurchase) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-hairline pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium text-ink font-mono tabular-nums">
                {selectedPurchase.purchaseNumber}
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium capitalize bg-positive/10 text-positive border border-positive/25">
                {selectedPurchase.status}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-1 flex items-center gap-2 tabular-nums">
              <Calendar className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
              {new Date(selectedPurchase.receivedAt).toLocaleString()}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised transition-colors duration-150 ease-unslop cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Supplier & Payment Header */}
        <div className="grid grid-cols-2 gap-3 text-xs bg-raised p-3.5 rounded-xl border border-hairline">
          <div>
            <div className="text-xs text-ink-muted">
              Supplier / vendor
            </div>
            <div className="font-medium text-ink mt-0.5 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
              {selectedPurchase.supplierName}
            </div>
            {selectedPurchase.referenceNumber && (
              <div className="text-ink-muted font-mono text-xs mt-0.5">
                Bill ref {selectedPurchase.referenceNumber}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs text-ink-muted">
              Received by
            </div>
            <div className="font-medium text-ink mt-0.5">
              {selectedPurchase.receivedByUsername || 'Admin'}
            </div>
            <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
              Paid via{' '}
              <span className="capitalize font-medium text-ink-secondary">
                {selectedPurchase.paymentMethod}
              </span>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 border border-hairline rounded-xl p-3.5 bg-raised/50">
          <div className="text-xs font-medium text-ink-muted pb-1.5 border-b border-hairline">
            Received line items
          </div>

          {detailLoading ? (
            <div className="py-6 text-center text-xs text-ink-muted">Loading items…</div>
          ) : selectedPurchase.items && selectedPurchase.items.length > 0 ? (
            selectedPurchase.items.map((it) => (
              <div
                key={it.id}
                className="flex justify-between items-center py-2 border-b border-hairline last:border-0 text-xs"
              >
                <div>
                  <div className="font-medium text-ink">{it.productName}</div>
                  <div className="text-xs text-ink-muted font-mono tabular-nums">
                    Received {it.purchasedQuantity} {it.purchasedUnit} @ ৳{it.unitRateBdt.toFixed(2)}/{it.purchasedUnit}
                  </div>
                  <div className="text-[11px] text-positive font-mono tabular-nums">
                    Inventory +{it.convertedQuantityBase.toFixed(2)} {it.baseUnitCode} (Cost ৳{it.baseCostPerUnitBdt.toFixed(2)}/{it.baseUnitCode})
                  </div>
                </div>
                <div className="font-medium text-accent-ink font-mono tabular-nums text-sm">
                  ৳{it.totalCostBdt.toFixed(2)}
                </div>
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-xs text-ink-muted">
              No line items recorded for this purchase
            </div>
          )}
        </div>

        {/* Financial Summary */}
        <div className="bg-raised rounded-xl p-3.5 border border-hairline space-y-1.5 text-xs">
          <div className="flex justify-between text-base font-medium text-ink">
            <span>Total shipment cost</span>
            <span className="font-mono tabular-nums text-accent-ink">
              ৳{selectedPurchase.totalAmountBdt.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-ink-secondary pt-1.5 border-t border-hairline">
            <span>Paid</span>
            <span className="font-mono tabular-nums">৳{selectedPurchase.paidAmountBdt.toFixed(2)}</span>
          </div>
          {selectedPurchase.totalAmountBdt > selectedPurchase.paidAmountBdt && (
            <div className="flex justify-between text-warning font-medium">
              <span>Supplier balance due</span>
              <span className="font-mono tabular-nums">
                ৳{(selectedPurchase.totalAmountBdt - selectedPurchase.paidAmountBdt).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-accent text-accent-fg font-semibold text-xs hover:bg-accent-hover transition-colors duration-150 ease-unslop cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
