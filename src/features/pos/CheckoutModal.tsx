import React, { useState, useEffect, useMemo } from 'react';
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
  Landmark,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore } from '../../app/store';
import type { CartTotals, Customer, PaymentMethod, SalePayment } from '../../domain/pos/types';

function resolvePaymentMethodOption(raw: string): {
  id: PaymentMethod;
  label: string;
  icon: LucideIcon;
} {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'cash') return { id: 'cash', label: 'Cash', icon: Banknote };
  if (lower === 'bkash') return { id: 'bkash', label: 'bKash', icon: Smartphone };
  if (lower === 'nagad') return { id: 'nagad', label: 'Nagad', icon: Smartphone };
  if (lower === 'card' || lower === 'card / pos') {
    return { id: 'card', label: 'Card / POS', icon: CreditCard };
  }
  if (lower === 'bank' || lower === 'bank transfer') {
    return { id: 'bank', label: 'Bank', icon: Landmark };
  }
  return {
    id: lower.replace(/\s+/g, '_') as PaymentMethod,
    label: trimmed,
    icon: Wallet,
  };
}

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
  const { shopSettings } = useAppStore();

  const { methodButtons, splitDigitalOptions } = useMemo(() => {
    const rawMethods =
      shopSettings?.paymentMethods && shopSettings.paymentMethods.length > 0
        ? shopSettings.paymentMethods
        : ['Cash', 'bKash', 'Nagad', 'Card', 'Bank'];

    const seen = new Set<string>();
    const singleMethods: Array<{
      id: PaymentMethod;
      label: string;
      icon: LucideIcon;
    }> = [];

    for (const pm of rawMethods) {
      const opt = resolvePaymentMethodOption(pm);
      if (opt.id && opt.id !== 'split' && !seen.has(opt.id)) {
        seen.add(opt.id);
        singleMethods.push(opt);
      }
    }

    if (singleMethods.length === 0) {
      singleMethods.push({ id: 'cash', label: 'Cash', icon: Banknote });
    }

    const buttons =
      singleMethods.length >= 2
        ? [...singleMethods, { id: 'split' as PaymentMethod, label: 'Split Pay', icon: Split }]
        : singleMethods;

    const digitalOpts = singleMethods.filter((m) => m.id !== 'cash');
    return {
      methodButtons: buttons,
      splitDigitalOptions:
        digitalOpts.length > 0
          ? digitalOpts
          : [{ id: 'bkash' as PaymentMethod, label: 'bKash', icon: Smartphone }],
    };
  }, [shopSettings?.paymentMethods]);

  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [tenderAmount, setTenderAmount] = useState<string>(String(totals.totalAmountBdt));
  const [digitalRefs, setDigitalRefs] = useState<Record<string, string>>({});

  // Split payment amounts
  const [splitCash, setSplitCash] = useState<string>('0');
  const [splitDigital, setSplitDigital] = useState<string>(String(totals.totalAmountBdt));
  const [splitDigitalMethod, setSplitDigitalMethod] = useState<PaymentMethod>('bkash');
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
      const defaultMethod =
        methodButtons.find((m) => m.id === 'cash')?.id ?? methodButtons[0]?.id ?? 'cash';
      setMethod(defaultMethod);
      setSplitDigitalMethod(splitDigitalOptions[0]?.id ?? 'bkash');
      setTenderAmount(String(totals.totalAmountBdt));
      setDigitalRefs({});
      setSplitCash('0');
      setSplitDigital(String(totals.totalAmountBdt));
      setSplitRef('');
      setError(null);
      setLoading(false);
      setPendingDueSale(null);
    }
  }, [isOpen, totals.totalAmountBdt, methodButtons, splitDigitalOptions]);

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
      if (!Number.isFinite(parsedTender) || parsedTender < 0) {
        setError('Please enter a valid cash amount.');
        return;
      }
      if (parsedTender <= 0 && totals.totalAmountBdt > 0) {
        setError('Please enter amount received from customer.');
        return;
      }
      payments.push({
        method: 'cash',
        amountBdt: Math.min(parsedTender, totals.totalAmountBdt),
      });
      finalPaid = parsedTender;
    } else if (method === 'split') {
      if (
        !Number.isFinite(splitCashNum) ||
        !Number.isFinite(splitDigitalNum) ||
        splitCashNum < 0 ||
        splitDigitalNum < 0
      ) {
        setError('Split payment amounts must be zero or positive.');
        return;
      }
      if (splitTotal <= 0 && totals.totalAmountBdt > 0) {
        setError('Please enter split payment amounts.');
        return;
      }
      const netDigital = Math.min(splitDigitalNum, totals.totalAmountBdt);
      const netCash = Math.min(splitCashNum, Math.max(0, totals.totalAmountBdt - netDigital));
      if (netCash > 0) {
        payments.push({ method: 'cash', amountBdt: netCash });
      }
      if (netDigital > 0) {
        payments.push({
          method: splitDigitalMethod,
          amountBdt: netDigital,
          reference: splitRef.trim() || undefined,
        });
      }
      finalPaid = splitTotal;
    } else {
      payments.push({
        method,
        amountBdt: totals.totalAmountBdt,
        reference: (digitalRefs[method] || '').trim() || undefined,
      });
      finalPaid = totals.totalAmountBdt;
    }

    const finalDue = Math.max(0, totals.totalAmountBdt - finalPaid);

    // Block walk-in due sales (must have customer with phone)
    if (finalDue > 0.01 && (!customer || !customer.phone?.trim())) {
      setError('Customer phone and name are required to record an unpaid due balance.');
      return;
    }

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
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {methodButtons.map((m) => {
                const Icon = m.icon;
                const isSelected = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMethod(m.id);
                      setError(null);
                    }}
                    className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1.5 transition-colors duration-150 ease-unslop text-xs font-medium cursor-pointer ${
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

          {/* DIGITAL / BANK PAYMENT SECTION */}
          {method !== 'cash' && method !== 'split' && (
            <div className="p-4 rounded-xl bg-raised/70 border border-hairline space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted font-medium uppercase">
                  {methodButtons.find((b) => b.id === method)?.label || method.toUpperCase()} payment
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
                  value={digitalRefs[method] || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDigitalRefs((prev) => ({ ...prev, [method]: val }));
                  }}
                  placeholder={method === 'bank' ? 'Bank slip / Trx Ref' : '9J47AB12XY'}
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
                        setSplitDigitalMethod(e.target.value as PaymentMethod)
                      }
                      className="bg-surface border border-hairline text-[11px] text-accent-ink rounded px-1.5 py-0.5 focus:outline-none"
                    >
                      {splitDigitalOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
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
