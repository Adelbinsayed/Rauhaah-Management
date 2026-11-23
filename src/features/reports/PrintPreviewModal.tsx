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

export type PrintReportType = 'pnl' | 'products' | 'payments' | 'staff' | 'inventory' | 'all';

const REPORT_TYPE_OPTIONS: ReadonlyArray<{ key: PrintReportType; label: string }> = [
  { key: 'pnl', label: 'P&L Statement' },
  { key: 'products', label: 'Top Products' },
  { key: 'payments', label: 'Payments' },
  { key: 'staff', label: 'Staff' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'all', label: 'Complete Summary' },
];

export interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultReportType: 'pnl' | 'products' | 'payments' | 'staff' | 'inventory';
  reportType?: PrintReportType;
  onReportTypeChange?: (type: PrintReportType) => void;
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
  reportType: controlledReportType,
  onReportTypeChange,
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
  const [internalSelectedType, setInternalSelectedType] = useState<PrintReportType>(
    defaultReportType
  );

  const selectedType = controlledReportType ?? internalSelectedType;

  const handleSelectType = (nextType: PrintReportType) => {
    setInternalSelectedType(nextType);
    onReportTypeChange?.(nextType);
  };

  useEffect(() => {
    setInternalSelectedType(defaultReportType);
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Report Print Preview"
      className="fixed inset-0 z-50 flex flex-col bg-black/60 dark:bg-black/75 backdrop-blur-sm duration-150"
    >
      {/* Top Floating Control Bar */}
      <header className="min-h-16 shrink-0 bg-surface border-b border-hairline px-4 md:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-ink select-none shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-accent-ink">
            <FileText className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-ink flex items-center gap-2">
              <span>Report Print Preview</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent-ink border border-accent/25">
                A4 Document
              </span>
            </h2>
            <p className="text-[11px] text-ink-secondary">
              Filter: <strong className="text-ink">{filter.label}</strong> • Ready to print or export as PDF
            </p>
          </div>
        </div>

        {/* View Mode Tabs (Desktop) & Select (Mobile/Compact) */}
        <select
          aria-label="Report type"
          value={selectedType}
          onChange={(e) => handleSelectType(e.target.value as PrintReportType)}
          className="md:hidden px-2.5 py-1.5 rounded-lg bg-canvas border border-hairline text-xs font-medium text-ink"
        >
          {REPORT_TYPE_OPTIONS.map((tab) => (
            <option key={tab.key} value={tab.key}>
              {tab.label}
            </option>
          ))}
        </select>

        <div className="hidden md:flex flex-wrap items-center gap-1 bg-canvas p-1 rounded-lg border border-hairline">
          {REPORT_TYPE_OPTIONS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleSelectType(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                selectedType === tab.key
                  ? 'bg-accent text-accent-fg font-semibold'
                  : 'text-ink-secondary hover:text-ink hover:bg-subtle'
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
            className="py-2 px-4 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            title="Open system print preview or save as PDF (Ctrl+P)"
          >
            <Printer className="w-4 h-4" strokeWidth={1.5} />
            <span>Print / Save PDF (Ctrl+P)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
            title="Close Preview (Esc)"
            aria-label="Close print preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Sheet Canvas Scroll Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-canvas flex justify-center items-start">
        <div className="w-full max-w-[210mm] shadow-lg rounded-lg overflow-hidden bg-white">
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
            isPreview={true}
          />
        </div>
      </main>
    </div>
  );
};
