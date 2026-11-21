import React, { useEffect, useState } from 'react';
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

  const handlePrint = async (forceSystemDialog = false) => {
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
          kickDrawer: shopSettings?.kickCashDrawer === true,
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
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* On-screen Modal View */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="w-full max-w-md bg-brand-surface border border-emerald-500/50 rounded-2xl shadow-2xl p-6 text-center space-y-4">
          {/* Animated Success Badge */}
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mb-1">
              Sale Completed &amp; Stock Deducted
            </span>
            <h3 className="text-xl font-bold text-white font-mono">{invoiceNumber}</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {new Date().toLocaleString()} &bull;{' '}
              {customer ? `${customer.name} (${customer.phone})` : 'Walk-in Customer'}
            </p>
          </div>

          {/* Line Items Summary */}
          <div className="bg-brand-black/70 border border-brand-border rounded-xl p-3.5 space-y-2 text-left text-xs max-h-48 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center text-neutral-300 py-0.5 border-b border-brand-border/30 last:border-0"
              >
                <div>
                  <div className="font-semibold text-white">
                    {item.productName}
                    {item.bottleSizeMl ? ` (${item.bottleSizeMl}ml)` : ''}
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono">
                    {item.quantity} {item.unitCode}{' '}
                    {item.unitPriceBdt ? `@ ৳${item.unitPriceBdt}/${item.unitCode}` : ''}
                  </div>
                </div>
                <div className="font-bold text-brand-gold font-mono">
                  ৳{item.lineTotalBdt.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Totals Breakdown */}
          <div className="bg-brand-black/90 border border-brand-gold/30 rounded-xl p-3 space-y-1.5 text-xs text-left">
            <div className="flex justify-between text-neutral-400">
              <span>Subtotal:</span>
              <span className="font-mono text-neutral-200">৳{totals.subtotalBdt.toFixed(2)}</span>
            </div>

            {(totals.itemDiscountBdt > 0 || totals.cartDiscountBdt > 0) && (
              <div className="flex justify-between text-emerald-400">
                <span>Discounts Applied:</span>
                <span className="font-mono font-bold">
                  -৳{(totals.itemDiscountBdt + totals.cartDiscountBdt).toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-base font-bold text-white pt-1 border-t border-brand-border">
              <span>Net Total:</span>
              <span className="font-mono text-brand-gold">৳{totals.totalAmountBdt.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-xs text-neutral-300 pt-1 border-t border-brand-border/40">
              <span>Paid ({payments.map((p) => p.method.toUpperCase()).join(' + ')}):</span>
              <span className="font-mono font-semibold">৳{totals.paidAmountBdt.toFixed(2)}</span>
            </div>

            {totals.changeAmountBdt > 0 && (
              <div className="flex justify-between text-emerald-400 font-bold">
                <span>Change Returned:</span>
                <span className="font-mono">৳{totals.changeAmountBdt.toFixed(2)}</span>
              </div>
            )}

            {totals.dueAmountBdt > 0 && (
              <div className="flex justify-between text-amber-400 font-bold">
                <span>Due Balance Added:</span>
                <span className="font-mono">৳{totals.dueAmountBdt.toFixed(2)}</span>
              </div>
            )}
          </div>

          {printStatus && (
            <div
              className={`p-2 rounded-lg text-xs border ${
                printStatus.success
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
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
                className="py-2.5 px-4 rounded-xl bg-brand-black border border-brand-gold/50 hover:border-brand-gold text-brand-gold hover:text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {shopSettings?.printerEngine === 'direct_escpos' ? (
                  <>
                    <Zap className="w-4 h-4 text-brand-gold" />
                    <span>{isPrinting ? 'Printing…' : 'Direct Print (P)'}</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>Print Invoice (P)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                autoFocus
                className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Next Sale (Enter)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {shopSettings?.printerEngine === 'direct_escpos' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => handlePrint(true)}
                  className="text-[11px] text-neutral-400 hover:text-white underline cursor-pointer"
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
