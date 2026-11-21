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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-brand-surface border border-brand-border rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-brand-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-white font-mono">
                {selectedPurchase.purchaseNumber}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {selectedPurchase.status}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-brand-gold" />
              {new Date(selectedPurchase.receivedAt).toLocaleString()}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Supplier & Payment Header */}
        <div className="grid grid-cols-2 gap-3 text-xs bg-brand-black/60 p-3 rounded-xl border border-brand-border/60">
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
              Supplier / Vendor
            </div>
            <div className="font-semibold text-white mt-0.5 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-brand-gold" />
              {selectedPurchase.supplierName}
            </div>
            {selectedPurchase.referenceNumber && (
              <div className="text-neutral-400 font-mono text-[11px] mt-0.5">
                Bill Ref: {selectedPurchase.referenceNumber}
              </div>
            )}
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
              Received By / Recorded
            </div>
            <div className="font-semibold text-white mt-0.5">
              {selectedPurchase.receivedByUsername || 'Admin'}
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-brand-gold" />
              Paid via:{' '}
              <span className="uppercase font-semibold">
                {selectedPurchase.paymentMethod}
              </span>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 border border-brand-border/40 rounded-xl p-3 bg-brand-black/40">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 pb-1 border-b border-brand-border/40">
            Received Line Items
          </div>

          {detailLoading ? (
            <div className="py-6 text-center text-xs text-neutral-400">Loading items...</div>
          ) : selectedPurchase.items && selectedPurchase.items.length > 0 ? (
            selectedPurchase.items.map((it) => (
              <div
                key={it.id}
                className="flex justify-between items-center py-2 border-b border-brand-border/20 last:border-0 text-xs"
              >
                <div>
                  <div className="font-semibold text-white">{it.productName}</div>
                  <div className="text-[11px] text-neutral-400 font-mono">
                    Received: {it.purchasedQuantity} {it.purchasedUnit} @ ৳{it.unitRateBdt.toFixed(2)}/{it.purchasedUnit}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono">
                    Inventory Added: +{it.convertedQuantityBase.toFixed(2)} {it.baseUnitCode} (Cost: ৳{it.baseCostPerUnitBdt.toFixed(2)}/{it.baseUnitCode})
                  </div>
                </div>
                <div className="font-bold text-brand-gold font-mono text-sm">
                  ৳{it.totalCostBdt.toFixed(2)}
                </div>
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-xs text-neutral-500">
              No line items recorded for this purchase.
            </div>
          )}
        </div>

        {/* Financial Summary */}
        <div className="bg-brand-black/80 rounded-xl p-3.5 border border-brand-border space-y-1.5 text-xs">
          <div className="flex justify-between text-base font-bold text-white">
            <span>Total Shipment Cost</span>
            <span className="font-mono text-brand-gold">
              ৳{selectedPurchase.totalAmountBdt.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-neutral-300 pt-1 border-t border-brand-border/30">
            <span>Paid</span>
            <span className="font-mono">৳{selectedPurchase.paidAmountBdt.toFixed(2)}</span>
          </div>
          {selectedPurchase.totalAmountBdt > selectedPurchase.paidAmountBdt && (
            <div className="flex justify-between text-amber-400 font-bold">
              <span>Supplier Balance Due</span>
              <span className="font-mono">
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
            className="px-5 py-2 rounded-xl bg-brand-gold text-brand-black font-bold text-xs hover:bg-brand-gold/90 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
