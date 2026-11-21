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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
      <div className="w-full max-w-lg bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-hairline">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/12 border border-accent/25 flex items-center justify-center text-accent-ink shrink-0">
              <Banknote className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-base font-medium text-ink">Checkout &amp; payment</h3>
              <div className="flex items-center gap-2 text-xs text-ink-muted mt-0.5">
                <User className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                <span>
                  {customer ? (
                    <strong className="font-medium text-ink">
                      {customer.name} ({customer.phone})
                    </strong>
                  ) : (
                    <span>Walk-in customer</span>
                  )}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Total Payable Banner */}
        <div className="p-4 rounded-xl bg-raised border border-accent/30 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-ink-muted">
              Total payable amount
            </div>
            <div className="text-3xl font-medium text-accent-ink font-mono tabular-nums mt-0.5">
              ৳{totals.totalAmountBdt.toFixed(2)}
            </div>
          </div>

          <div className="text-right text-xs space-y-0.5 text-ink-muted tabular-nums">
            <div>Subtotal ৳{totals.subtotalBdt.toFixed(2)}</div>
            {(totals.itemDiscountBdt > 0 || totals.cartDiscountBdt > 0) && (
              <div className="text-positive font-medium">
                Discounts -৳{(totals.itemDiscountBdt + totals.cartDiscountBdt).toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-ink-secondary">
              Select payment method
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
                    className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1.5 transition-colors duration-150 ease-unslop text-xs font-medium ${
                      isSelected
                        ? 'bg-accent text-accent-fg border-accent font-semibold'
                        : 'bg-raised border-hairline text-ink-secondary hover:border-hairline-strong hover:text-ink'
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CASH PAYMENT SECTION */}
          {method === 'cash' && (
            <div className="p-4 rounded-xl bg-raised/70 border border-hairline space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                  Amount received / tendered (৳)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-base font-medium text-ink-muted">
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
                    className="w-full pl-9 pr-3 py-2 bg-surface border border-hairline rounded-lg text-lg text-ink font-mono tabular-nums font-medium focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickCash(0)}
                  className="px-2.5 py-1 rounded-md bg-surface hover:border-hairline-strong text-xs font-medium text-accent-ink border border-hairline tabular-nums"
                >
                  Exact (৳{totals.totalAmountBdt})
                </button>
                {[50, 100, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickCash(amt)}
                    className="px-2.5 py-1 rounded-md bg-surface hover:border-hairline-strong text-xs font-mono tabular-nums text-ink-secondary border border-hairline"
                  >
                    +{amt}
                  </button>
                ))}
              </div>

              {/* Change Due or Remaining Due */}
              <div className="pt-2 border-t border-hairline flex items-center justify-between">
                {change > 0 ? (
                  <div className="flex items-center gap-2 text-positive font-medium text-xs tabular-nums">
                    <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                    <span>Change due: ৳{change.toFixed(2)}</span>
                  </div>
                ) : due > 0 ? (
                  <div className="flex items-center gap-2 text-warning font-medium text-xs tabular-nums">
                    <AlertCircle className="w-4 h-4" strokeWidth={1.5} />
                    <span>Customer due: ৳{due.toFixed(2)}</span>
                  </div>
                ) : (
                  <span className="text-xs text-ink-muted">Payment matches bill</span>
                )}
              </div>
            </div>
          )}

          {/* BKASH / NAGAD / CARD SECTION */}
          {(method === 'bkash' || method === 'nagad' || method === 'card') && (
            <div className="p-4 rounded-xl bg-raised/70 border border-hairline space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted font-medium uppercase">
                  {method.toUpperCase()} digital payment
                </span>
                <span className="font-mono tabular-nums text-accent-ink font-medium">
                  ৳{totals.totalAmountBdt.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Transaction ID / slip reference (optional)
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
                  placeholder="9J47AB12XY"
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-xs text-ink font-mono placeholder-ink-muted focus:outline-none focus:border-accent uppercase"
                />
              </div>
            </div>
          )}

          {/* SPLIT PAYMENT SECTION */}
          {method === 'split' && (
            <div className="p-4 rounded-xl bg-raised/70 border border-hairline space-y-3">
              <h4 className="text-xs font-medium text-accent-ink">
                Split tender breakdown
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Cash tender (৳)
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
                    className="w-full px-3 py-1.5 bg-surface border border-hairline rounded-lg text-sm text-ink font-mono tabular-nums font-medium focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-ink-secondary">
                      Digital portion (৳)
                    </label>
                    <select
                      value={splitDigitalMethod}
                      onChange={(e) =>
                        setSplitDigitalMethod(e.target.value as 'bkash' | 'nagad' | 'card')
                      }
                      className="bg-surface border border-hairline text-[11px] text-accent-ink rounded px-1.5 py-0.5 focus:outline-none"
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
                    className="w-full px-3 py-1.5 bg-surface border border-hairline rounded-lg text-sm text-ink font-mono tabular-nums font-medium focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={splitRef}
                  onChange={(e) => setSplitRef(e.target.value)}
                  placeholder="Digital transaction reference (optional)"
                  className="w-full px-3 py-1.5 bg-surface border border-hairline rounded-lg text-xs text-ink font-mono placeholder-ink-muted focus:outline-none focus:border-accent uppercase"
                />
              </div>

              <div className="text-right text-xs font-mono tabular-nums font-medium text-ink-secondary">
                Total split paid: ৳{splitTotal.toFixed(2)} / ৳{totals.totalAmountBdt.toFixed(2)}
              </div>
            </div>
          )}

          {/* Action Buttons */}
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
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-positive hover:opacity-90 text-white font-semibold text-xs disabled:opacity-50 transition-opacity duration-150 ease-unslop cursor-pointer"
            >
              <span>{loading ? 'Finalizing Sale…' : 'Confirm & Complete Sale'}</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </form>
      </div>

      {/* Due Amount Confirmation Modal */}
      {pendingDueSale && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
          <div className="w-full max-w-sm bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-warning/10 border border-warning/25 flex items-center justify-center text-warning shrink-0">
                <AlertCircle className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="text-base font-medium text-ink">Confirm due amount</h4>
                <p className="text-xs text-ink-muted">Sale has an unpaid balance</p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-raised border border-hairline space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-ink-muted">Customer</span>
                <strong className="text-ink font-medium">
                  {customer ? `${customer.name} (${customer.phone})` : 'Walk-in customer'}
                </strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ink-muted">Total bill</span>
                <span className="font-mono tabular-nums text-ink">৳{totals.totalAmountBdt.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ink-muted">Paid now</span>
                <span className="font-mono tabular-nums text-positive">৳{pendingDueSale.finalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-hairline text-sm">
                <span className="font-medium text-warning">Remaining due</span>
                <span className="font-mono tabular-nums font-medium text-warning">
                  ৳{pendingDueSale.dueAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <p className="text-xs text-ink-secondary text-center">
              Confirm recording a due balance of{' '}
              <strong className="text-warning font-mono tabular-nums">৳{pendingDueSale.dueAmount.toFixed(2)}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-hairline">
              <button
                type="button"
                onClick={() => setPendingDueSale(null)}
                className="flex-1 py-2 rounded-lg border border-hairline bg-raised text-ink-secondary hover:text-ink text-xs font-medium transition-colors duration-150 ease-unslop cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => executeConfirmedSale(pendingDueSale)}
                className="flex-1 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs transition-colors duration-150 ease-unslop cursor-pointer"
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
