import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Split,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  User,
} from 'lucide-react';
import type { CartTotals, Customer, PaymentMethod, SalePayment } from '../../domain/pos/types';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  totals: CartTotals;
  customer: Customer | null;
  onCompleteSale: (payments: SalePayment[], paidAmount: number) => Promise<void>;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  totals,
  customer,
  onCompleteSale,
}) => {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [tenderAmount, setTenderAmount] = useState<string>(String(totals.totalAmountBdt));
  const [bkashRef, setBkashRef] = useState('');
  const [nagadRef, setNagadRef] = useState('');
  const [cardRef, setCardRef] = useState('');

  // Split payment amounts
  const [splitCash, setSplitCash] = useState<string>('0');
  const [splitDigital, setSplitDigital] = useState<string>(String(totals.totalAmountBdt));
  const [splitDigitalMethod, setSplitDigitalMethod] = useState<'bkash' | 'nagad' | 'card'>('bkash');
  const [splitRef, setSplitRef] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Due confirmation prompt state
  const [pendingDueSale, setPendingDueSale] = useState<{
    payments: SalePayment[];
    finalPaid: number;
    dueAmount: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTenderAmount(String(totals.totalAmountBdt));
      setSplitCash('0');
      setSplitDigital(String(totals.totalAmountBdt));
      setError(null);
      setLoading(false);
      setPendingDueSale(null);
    }
  }, [isOpen, totals.totalAmountBdt]);

  if (!isOpen) return null;

  const parsedTender = parseFloat(tenderAmount) || 0;
  const change = Math.max(0, parsedTender - totals.totalAmountBdt);
  const due = Math.max(0, totals.totalAmountBdt - parsedTender);

  const splitCashNum = parseFloat(splitCash) || 0;
  const splitDigitalNum = parseFloat(splitDigital) || 0;
  const splitTotal = splitCashNum + splitDigitalNum;

  const handleQuickCash = (extra: number) => {
    if (extra === 0) {
      setTenderAmount(String(totals.totalAmountBdt));
    } else {
      setTenderAmount(String(Math.ceil((totals.totalAmountBdt + extra) / 50) * 50));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payments: SalePayment[] = [];
    let finalPaid = 0;

    if (method === 'cash') {
      if (parsedTender <= 0 && totals.totalAmountBdt > 0) {
        setError('Please enter amount received from customer.');
        return;
      }
      payments.push({
        method: 'cash',
        amountBdt: Math.min(parsedTender, totals.totalAmountBdt),
      });
      finalPaid = parsedTender;
    } else if (method === 'bkash') {
      payments.push({
        method: 'bkash',
        amountBdt: totals.totalAmountBdt,
        reference: bkashRef.trim() || undefined,
      });
      finalPaid = totals.totalAmountBdt;
    } else if (method === 'nagad') {
      payments.push({
        method: 'nagad',
        amountBdt: totals.totalAmountBdt,
        reference: nagadRef.trim() || undefined,
      });
      finalPaid = totals.totalAmountBdt;
    } else if (method === 'card') {
      payments.push({
        method: 'card',
        amountBdt: totals.totalAmountBdt,
        reference: cardRef.trim() || undefined,
      });
      finalPaid = totals.totalAmountBdt;
    } else if (method === 'split') {
      if (splitCashNum > 0) {
        payments.push({ method: 'cash', amountBdt: splitCashNum });
      }
      if (splitDigitalNum > 0) {
        payments.push({
          method: splitDigitalMethod,
          amountBdt: splitDigitalNum,
          reference: splitRef.trim() || undefined,
        });
      }
      finalPaid = splitTotal;
    }

    const finalDue = Math.max(0, totals.totalAmountBdt - finalPaid);

    // If there is an unpaid due amount, prompt cashier for explicit confirmation
    if (finalDue > 0.01) {
      setPendingDueSale({
        payments,
        finalPaid,
        dueAmount: finalDue,
      });
      return;
    }

    try {
      setLoading(true);
      await onCompleteSale(payments, finalPaid);
      onClose();
    } catch (err: unknown) {
      console.error('Sale finalization error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const executeConfirmedSale = async (saleToExecute: { payments: SalePayment[]; finalPaid: number }) => {
    setPendingDueSale(null);
    try {
      setLoading(true);
      await onCompleteSale(saleToExecute.payments, saleToExecute.finalPaid);
      onClose();
    } catch (err: unknown) {
      console.error('Sale finalization error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-brand-surface border border-brand-border rounded-2xl shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-brand-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold shrink-0">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Checkout &amp; Payment</h3>
              <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                <User className="w-3.5 h-3.5 text-neutral-500" />
                <span>
                  {customer ? (
                    <strong className="text-white">
                      {customer.name} ({customer.phone})
                    </strong>
                  ) : (
                    <span className="italic">Walk-in Customer</span>
                  )}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Payable Banner */}
        <div className="p-4 rounded-xl bg-brand-black border border-brand-gold/40 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">
              Total Payable Amount
            </div>
            <div className="text-3xl font-extrabold text-brand-gold font-mono mt-0.5">
              ৳{totals.totalAmountBdt.toFixed(2)}
            </div>
          </div>

          <div className="text-right text-xs space-y-0.5 text-neutral-400">
            <div>Subtotal: ৳{totals.subtotalBdt.toFixed(2)}</div>
            {(totals.itemDiscountBdt > 0 || totals.cartDiscountBdt > 0) && (
              <div className="text-emerald-400 font-semibold">
                Discounts: -৳{(totals.itemDiscountBdt + totals.cartDiscountBdt).toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Select Payment Method
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: 'cash', label: 'Cash', icon: Banknote },
                { id: 'bkash', label: 'bKash', icon: Smartphone },
                { id: 'nagad', label: 'Nagad', icon: Smartphone },
                { id: 'card', label: 'Card / POS', icon: CreditCard },
                { id: 'split', label: 'Split Pay', icon: Split },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMethod(m.id as PaymentMethod);
                      setError(null);
                    }}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold ${
                      isSelected
                        ? 'bg-brand-gold text-brand-black border-brand-gold shadow-md shadow-brand-gold/20'
                        : 'bg-brand-black border-brand-border text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CASH PAYMENT SECTION */}
          {method === 'cash' && (
            <div className="p-4 rounded-xl bg-brand-black/70 border border-brand-border space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Amount Received / Tendered (৳)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-base font-bold text-neutral-500">
                    ৳
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    autoFocus
                    required
                    value={tenderAmount}
                    onChange={(e) => setTenderAmount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-brand-surface border border-brand-border rounded-xl text-lg text-white font-mono font-bold focus:outline-none focus:border-brand-gold"
                  />
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickCash(0)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-brand-gold border border-brand-border"
                >
                  Exact (৳{totals.totalAmountBdt})
                </button>
                {[50, 100, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickCash(amt)}
                    className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs font-mono text-neutral-300 border border-neutral-800"
                  >
                    +{amt}
                  </button>
                ))}
              </div>

              {/* Change Due or Remaining Due */}
              <div className="pt-2 border-t border-brand-border/60 flex items-center justify-between">
                {change > 0 ? (
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Change Due: ৳{change.toFixed(2)}</span>
                  </div>
                ) : due > 0 ? (
                  <div className="flex items-center gap-2 text-amber-400 font-bold">
                    <AlertCircle className="w-5 h-5" />
                    <span>Customer Due: ৳{due.toFixed(2)}</span>
                  </div>
                ) : (
                  <span className="text-xs text-neutral-400">Payment matches bill exactly</span>
                )}
              </div>
            </div>
          )}

          {/* BKASH / NAGAD / CARD SECTION */}
          {(method === 'bkash' || method === 'nagad' || method === 'card') && (
            <div className="p-4 rounded-xl bg-brand-black/70 border border-brand-border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400 font-semibold uppercase">
                  {method.toUpperCase()} Digital Payment
                </span>
                <span className="font-mono text-brand-gold font-bold">
                  ৳{totals.totalAmountBdt.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Transaction ID / Slip Reference (Optional)
                </label>
                <input
                  type="text"
                  autoFocus
                  value={
                    method === 'bkash' ? bkashRef : method === 'nagad' ? nagadRef : cardRef
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (method === 'bkash') setBkashRef(val);
                    else if (method === 'nagad') setNagadRef(val);
                    else setCardRef(val);
                  }}
                  placeholder="e.g. 9J47AB12XY"
                  className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-xl text-xs text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-brand-gold uppercase"
                />
              </div>
            </div>
          )}

          {/* SPLIT PAYMENT SECTION */}
          {method === 'split' && (
            <div className="p-4 rounded-xl bg-brand-black/70 border border-brand-border space-y-3">
              <h4 className="text-xs font-bold text-brand-gold uppercase tracking-wider">
                Split Tender Breakdown
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Cash Tender (৳)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={splitCash}
                    onChange={(e) => {
                      const c = parseFloat(e.target.value) || 0;
                      setSplitCash(e.target.value);
                      setSplitDigital(String(Math.max(0, totals.totalAmountBdt - c)));
                    }}
                    className="w-full px-3 py-1.5 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono font-bold focus:outline-none focus:border-brand-gold"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-neutral-300">
                      Digital Portion (৳)
                    </label>
                    <select
                      value={splitDigitalMethod}
                      onChange={(e) =>
                        setSplitDigitalMethod(e.target.value as 'bkash' | 'nagad' | 'card')
                      }
                      className="bg-brand-surface border border-brand-border text-[10px] text-brand-gold rounded px-1.5 py-0.5 focus:outline-none"
                    >
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="card">Card</option>
                    </select>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={splitDigital}
                    onChange={(e) => setSplitDigital(e.target.value)}
                    className="w-full px-3 py-1.5 bg-brand-surface border border-brand-border rounded-lg text-sm text-white font-mono font-bold focus:outline-none focus:border-brand-gold"
                  />
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={splitRef}
                  onChange={(e) => setSplitRef(e.target.value)}
                  placeholder="Digital transaction reference (optional)..."
                  className="w-full px-3 py-1.5 bg-brand-surface border border-brand-border rounded-lg text-xs text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-brand-gold uppercase"
                />
              </div>

              <div className="text-right text-xs font-mono font-bold text-neutral-300">
                Total Split Paid: ৳{splitTotal.toFixed(2)} / ৳{totals.totalAmountBdt.toFixed(2)}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-brand-border">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-brand-border text-neutral-300 hover:text-white text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              <span>{loading ? 'Finalizing Sale...' : 'Confirm & Complete Sale'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Due Amount Confirmation Modal */}
      {pendingDueSale && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-brand-surface border border-amber-500/50 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Confirm Due Amount</h4>
                <p className="text-[11px] text-neutral-400">Sale has an unpaid balance.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-brand-black border border-brand-border space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Customer:</span>
                <strong className="text-white">
                  {customer ? `${customer.name} (${customer.phone})` : 'Walk-in Customer'}
                </strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Total Bill:</span>
                <span className="font-mono text-white">৳{totals.totalAmountBdt.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Paid Now:</span>
                <span className="font-mono text-emerald-400">৳{pendingDueSale.finalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-brand-border text-sm">
                <span className="font-bold text-amber-400">Remaining Due:</span>
                <span className="font-mono font-bold text-amber-400">
                  ৳{pendingDueSale.dueAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-200 font-semibold text-center">
              Are you sure to put a due amount of{' '}
              <strong className="text-amber-400 font-mono">৳{pendingDueSale.dueAmount.toFixed(2)}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-brand-border">
              <button
                type="button"
                onClick={() => setPendingDueSale(null)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-700 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => executeConfirmedSale(pendingDueSale)}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-brand-black font-extrabold text-xs transition-colors shadow cursor-pointer"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
