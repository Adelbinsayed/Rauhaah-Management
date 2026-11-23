import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ArrowRight, Printer, Zap } from 'lucide-react';
import type { CartItem, CartTotals, Customer, SalePayment } from '../../domain/pos/types';
import { useAppStore } from '../../app/store';
import { PrintableReceipt } from './PrintableReceipt';
import { buildEscposReceipt, printDirectEscpos } from '../../domain/pos/escpos';

interface SaleReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  customer: Customer | null;
  items: CartItem[];
  totals: CartTotals;
  payments: SalePayment[];
  cashierName?: string;
}

export const SaleReceiptModal: React.FC<SaleReceiptModalProps> = ({
  isOpen,
  onClose,
  invoiceNumber,
  customer,
  items,
  totals,
  payments,
  cashierName,
}) => {
  const { shopSettings, currentUser } = useAppStore();
  const [printStatus, setPrintStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const effectiveCashier =
    cashierName || currentUser?.displayName || currentUser?.username || 'Cashier';

  const handlePrint = useCallback(async (forceSystemDialog = false) => {
    if (!forceSystemDialog && shopSettings?.printerEngine === 'direct_escpos') {
      setIsPrinting(true);
      setPrintStatus(null);
      try {
        const pWidth = shopSettings?.invoicePaperWidth === '58mm' ? '58mm' : '80mm';
        const data = buildEscposReceipt({
          invoiceNumber,
          createdAt: new Date().toISOString(),
          cashierName: effectiveCashier,
          customer,
          items,
          totals,
          payments,
          shopSettings,
          paperWidth: pWidth,
          autoCut: shopSettings?.autoCutReceipt !== false,
          kickDrawer:
            shopSettings?.kickCashDrawer === true &&
            payments.some((p) => p.method === 'cash'),
        });

        const res = await printDirectEscpos(data, shopSettings?.selectedPrinter);
        if (res.success) {
          setPrintStatus({
            success: true,
            message: 'Receipt sent to thermal printer & auto-cut!',
          });
          setTimeout(() => setPrintStatus(null), 3500);
        } else {
          // If direct print fails, gracefully fallback to window.print()
          setPrintStatus({
            success: false,
            message: `${res.error || 'Direct print failed'} - Falling back to Windows print dialog.`,
          });
          setTimeout(() => {
            setPrintStatus(null);
            window.print();
          }, 1200);
        }
      } catch (err: unknown) {
        window.print();
      } finally {
        setIsPrinting(false);
      }
    } else {
      window.print();
    }
  }, [invoiceNumber, effectiveCashier, customer, items, totals, payments, shopSettings]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (isPrinting) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'p' || e.key === 'P') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handlePrint();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrint, isPrinting]);

  if (!isOpen) return null;

  return (
    <>
      {/* On-screen Modal View */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
      >
        <div className="w-full max-w-md bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 text-center space-y-4">
          {/* Success Badge */}
          <div className="mx-auto w-12 h-12 rounded-xl bg-positive/10 border border-positive/25 flex items-center justify-center text-positive">
            <CheckCircle2 className="w-6 h-6" strokeWidth={1.5} />
          </div>

          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium bg-positive/10 text-positive border border-positive/25 mb-1.5">
              Sale completed &amp; stock updated
            </span>
            <h3 className="text-xl font-medium text-ink font-mono tabular-nums">{invoiceNumber}</h3>
            <p className="text-xs text-ink-muted mt-0.5 tabular-nums">
              {new Date().toLocaleString()} ·{' '}
              {customer ? `${customer.name} (${customer.phone})` : 'Walk-in customer'}
            </p>
          </div>

          {/* Line Items Summary */}
          <div className="bg-raised border border-hairline rounded-xl p-3.5 space-y-2 text-left text-xs max-h-48 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center text-ink-secondary py-1 border-b border-hairline last:border-0"
              >
                <div>
                  <div className="font-medium text-ink">
                    {item.productName}
                    {item.bottleSizeMl ? ` (${item.bottleSizeMl}ml)` : ''}
                  </div>
                  <div className="text-[11px] text-ink-muted font-mono tabular-nums">
                    {item.quantity} {item.unitCode}{' '}
                    {item.unitPriceBdt ? `@ ৳${item.unitPriceBdt}/${item.unitCode}` : ''}
                  </div>
                </div>
                <div className="font-medium text-accent-ink font-mono tabular-nums">
                  ৳{item.lineTotalBdt.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Totals Breakdown */}
          <div className="bg-raised border border-accent/25 rounded-xl p-3.5 space-y-1.5 text-xs text-left">
            <div className="flex justify-between text-ink-muted">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums text-ink-secondary">৳{totals.subtotalBdt.toFixed(2)}</span>
            </div>

            {(totals.itemDiscountBdt > 0 || totals.cartDiscountBdt > 0) && (
              <div className="flex justify-between text-positive">
                <span>Discounts applied</span>
                <span className="font-mono tabular-nums font-medium">
                  -৳{(totals.itemDiscountBdt + totals.cartDiscountBdt).toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-base font-medium text-ink pt-1.5 border-t border-hairline">
              <span>Net total</span>
              <span className="font-mono tabular-nums text-accent-ink">৳{totals.totalAmountBdt.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-xs text-ink-secondary pt-1.5 border-t border-hairline">
              <span>Paid ({payments.map((p) => p.method.toUpperCase()).join(' + ')})</span>
              <span className="font-mono tabular-nums font-medium">৳{totals.paidAmountBdt.toFixed(2)}</span>
            </div>

            {totals.changeAmountBdt > 0 && (
              <div className="flex justify-between text-positive font-medium">
                <span>Change returned</span>
                <span className="font-mono tabular-nums">৳{totals.changeAmountBdt.toFixed(2)}</span>
              </div>
            )}

            {totals.dueAmountBdt > 0 && (
              <div className="flex justify-between text-warning font-medium">
                <span>Due balance added</span>
                <span className="font-mono tabular-nums">৳{totals.dueAmountBdt.toFixed(2)}</span>
              </div>
            )}
          </div>

          {printStatus && (
            <div
              className={`p-2 rounded-lg text-xs border ${
                printStatus.success
                  ? 'bg-positive/10 border-positive/25 text-positive'
                  : 'bg-warning/10 border-warning/25 text-warning'
              }`}
            >
              {printStatus.message}
            </div>
          )}

          {/* Actions: Print Invoice and Start Next Sale */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handlePrint(false)}
                disabled={isPrinting}
                className="py-2.5 px-4 rounded-lg bg-raised border border-hairline-strong hover:border-accent/50 text-accent-ink font-medium text-xs transition-colors duration-150 ease-unslop flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {shopSettings?.printerEngine === 'direct_escpos' ? (
                  <>
                    <Zap className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
                    <span>{isPrinting ? 'Printing…' : 'Direct Print (P)'}</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" strokeWidth={1.5} />
                    <span>Print Invoice (P)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                autoFocus
                className="py-2.5 px-4 rounded-lg bg-positive hover:opacity-90 text-white font-semibold text-xs transition-opacity duration-150 ease-unslop flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Next Sale (Enter)</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            {shopSettings?.printerEngine === 'direct_escpos' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => handlePrint(true)}
                  className="text-xs text-ink-muted hover:text-ink underline cursor-pointer"
                >
                  System Print Dialog (Ctrl+P)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dedicated Hidden Printable Receipt for Thermal / Laser Printing */}
      <div className="hidden print:block">
        <PrintableReceipt
          invoiceNumber={invoiceNumber}
          customer={customer}
          items={items}
          totals={totals}
          payments={payments}
          cashierName={effectiveCashier}
          shopSettings={shopSettings}
        />
      </div>
    </>
  );
};
