import React, { useEffect, useState } from 'react';
import { FileText, Printer, X } from 'lucide-react';
import type {
  CashFlowSummary,
  CashierPerformance,
  CategorySalesBreakdown,
  DailyTrendPoint,
  DateRangeFilter,
  ExpenseCategoryBreakdown,
  InventoryValuationSummary,
  PaymentMethodBreakdown,
  PnLSummary,
  TopSellingProduct,
} from '@/domain/reports/types';
import type { ShopSettings, User } from '@/domain/auth/types';
import { PrintableReport } from './PrintableReport';

export interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultReportType: 'pnl' | 'products' | 'payments' | 'staff' | 'inventory';
  filter: DateRangeFilter;
  pnl: PnLSummary | null;
  dailyTrends: DailyTrendPoint[];
  topProducts: TopSellingProduct[];
  categorySales: CategorySalesBreakdown[];
  paymentMethods: PaymentMethodBreakdown[];
  cashierStats: CashierPerformance[];
  expenseCats: ExpenseCategoryBreakdown[];
  cashFlow: CashFlowSummary | null;
  inventoryVal: InventoryValuationSummary | null;
  shopSettings?: ShopSettings | null;
  currentUser?: User | null;
  allowCost?: boolean;
  allowProfit?: boolean;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  defaultReportType,
  filter,
  pnl,
  dailyTrends,
  topProducts,
  categorySales,
  paymentMethods,
  cashierStats,
  expenseCats,
  cashFlow,
  inventoryVal,
  shopSettings,
  currentUser,
  allowCost,
  allowProfit,
}) => {
  const [selectedType, setSelectedType] = useState<'pnl' | 'products' | 'payments' | 'staff' | 'inventory' | 'all'>(
    defaultReportType
  );

  useEffect(() => {
    setSelectedType(defaultReportType);
  }, [defaultReportType]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      {/* Top Floating Control Bar */}
      <header className="h-16 shrink-0 bg-neutral-900 border-b border-brand-border px-6 flex items-center justify-between text-white select-none shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <span>Report Print Preview</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
                A4 Document
              </span>
            </h2>
            <p className="text-[11px] text-neutral-400">
              Filter: <strong className="text-neutral-200">{filter.label}</strong> • Ready to print or export as PDF
            </p>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="hidden md:flex items-center gap-1 bg-neutral-800/80 p-1 rounded-xl border border-brand-border">
          {(
            [
              { key: 'pnl', label: 'P&L Statement' },
              { key: 'products', label: 'Top Products' },
              { key: 'payments', label: 'Payments' },
              { key: 'staff', label: 'Staff' },
              { key: 'inventory', label: 'Inventory' },
              { key: 'all', label: 'Complete Summary' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedType(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                selectedType === tab.key
                  ? 'bg-brand-gold text-brand-black shadow-sm font-bold'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="py-2 px-4 rounded-xl bg-brand-gold hover:bg-brand-gold-light text-brand-black text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-brand-gold/20 cursor-pointer"
            title="Open system print preview or save as PDF (Ctrl+P)"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF (Ctrl+P)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Close Preview (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Sheet Canvas Scroll Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-neutral-950 flex justify-center items-start">
        <div className="w-full max-w-[210mm] shadow-2xl rounded-lg overflow-hidden bg-white">
          <PrintableReport
            reportType={selectedType}
            filter={filter}
            pnl={pnl}
            dailyTrends={dailyTrends}
            topProducts={topProducts}
            categorySales={categorySales}
            paymentMethods={paymentMethods}
            cashierStats={cashierStats}
            expenseCats={expenseCats}
            cashFlow={cashFlow}
            inventoryVal={inventoryVal}
            shopSettings={shopSettings}
            currentUser={currentUser}
            allowCost={allowCost}
            allowProfit={allowProfit}
          />
        </div>
      </main>
    </div>
  );
};
