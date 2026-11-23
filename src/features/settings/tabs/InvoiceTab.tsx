import type { ShopSettings } from '@/domain/auth/types';
import { PrintableReceipt } from '@/features/pos/PrintableReceipt';
import { Printer, RefreshCw, Scissors, Zap } from 'lucide-react';
import React from 'react';

interface InvoiceTabProps {
  printerEngine: 'direct_escpos' | 'browser';
  onPrinterEngineChange: (engine: 'direct_escpos' | 'browser') => void;
  selectedPrinter: string;
  onSelectedPrinterChange: (printer: string) => void;
  availablePrinters: string[];
  defaultPrinter: string | null;
  loadingPrinters: boolean;
  onRefreshPrinters: () => void;
  testingPrinter: boolean;
  onTestPrintSlip: () => void;
  testSlipMsg: { success: boolean; text: string } | null;
  autoCutReceipt: boolean;
  onAutoCutReceiptChange: (val: boolean) => void;
  kickCashDrawer: boolean;
  onKickCashDrawerChange: (val: boolean) => void;
  invoiceSubtitle: string;
  onInvoiceSubtitleChange: (val: string) => void;
  invoicePaperWidth: '80mm' | '58mm' | 'a4';
  onInvoicePaperWidthChange: (val: '80mm' | '58mm' | 'a4') => void;
  invoiceFooterNote: string;
  onInvoiceFooterNoteChange: (val: string) => void;
  showLogoOnInvoice: boolean;
  onShowLogoOnInvoiceChange: (val: boolean) => void;
  showCashierOnInvoice: boolean;
  onShowCashierOnInvoiceChange: (val: boolean) => void;
  cashierName: string;
  previewShopSettings: ShopSettings;
}

export const InvoiceTab: React.FC<InvoiceTabProps> = ({
  printerEngine,
  onPrinterEngineChange,
  selectedPrinter,
  onSelectedPrinterChange,
  availablePrinters,
  defaultPrinter,
  loadingPrinters,
  onRefreshPrinters,
  testingPrinter,
  onTestPrintSlip,
  testSlipMsg,
  autoCutReceipt,
  onAutoCutReceiptChange,
  kickCashDrawer,
  onKickCashDrawerChange,
  invoiceSubtitle,
  onInvoiceSubtitleChange,
  invoicePaperWidth,
  onInvoicePaperWidthChange,
  invoiceFooterNote,
  onInvoiceFooterNoteChange,
  showLogoOnInvoice,
  onShowLogoOnInvoiceChange,
  showCashierOnInvoice,
  onShowCashierOnInvoiceChange,
  cashierName,
  previewShopSettings,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Receipt Template &amp; Thermal Printer Settings
            </h3>
            <p className="text-xs text-ink-secondary mt-0.5">
              Configure direct ESC/POS high-speed thermal printing, paper width, and footer policies.
            </p>
          </div>
        </div>
      </div>

      {/* Direct ESC/POS Thermal Printing Hardware Controls */}
      <div className="p-4 rounded-xl border border-accent/25 bg-canvas space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-accent-ink text-xs font-semibold">
            <Zap className="w-4 h-4" strokeWidth={1.5} />
            <span>Printing Engine &amp; Hardware Bypass</span>
          </div>
          <button
            type="button"
            onClick={onTestPrintSlip}
            disabled={testingPrinter || printerEngine !== 'direct_escpos'}
            title={
              printerEngine !== 'direct_escpos'
                ? 'Select Direct ESC/POS Thermal engine to run hardware test print'
                : undefined
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/40 bg-surface hover:border-accent text-xs font-medium text-accent-ink hover:text-ink transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{testingPrinter ? 'Printing Slip…' : 'Test Direct Thermal Print'}</span>
          </button>
        </div>

        {testSlipMsg && (
          <div
            className={`p-2.5 rounded-lg text-xs border ${
              testSlipMsg.success
                ? 'bg-positive/10 border-positive/25 text-positive'
                : 'bg-negative/10 border-negative/25 text-negative'
            }`}
          >
            {testSlipMsg.text}
          </div>
        )}

        {/* Engine Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              printerEngine === 'direct_escpos'
                ? 'bg-accent/10 border-accent text-ink'
                : 'bg-surface border-hairline text-ink-secondary hover:text-ink'
            }`}
          >
            <input
              type="radio"
              name="printer_engine"
              value="direct_escpos"
              checked={printerEngine === 'direct_escpos'}
              onChange={() => onPrinterEngineChange('direct_escpos')}
              className="accent-accent mt-1"
            />
            <div>
              <div className="font-semibold text-xs text-ink flex items-center gap-1.5">
                <span>Direct ESC/POS Thermal (Recommended)</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/15 text-accent-ink font-mono">
                  FAST
                </span>
              </div>
              <div className="text-[11px] text-ink-secondary mt-0.5">
                Bypasses the Windows print preview dialog for 1-click silent receipt print and instant auto-cut.
              </div>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              printerEngine === 'browser'
                ? 'bg-accent/10 border-accent text-ink'
                : 'bg-surface border-hairline text-ink-secondary hover:text-ink'
            }`}
          >
            <input
              type="radio"
              name="printer_engine"
              value="browser"
              checked={printerEngine === 'browser'}
              onChange={() => onPrinterEngineChange('browser')}
              className="accent-accent mt-1"
            />
            <div>
              <div className="font-semibold text-xs text-ink">System Print Dialog (Preview)</div>
              <div className="text-[11px] text-ink-secondary mt-0.5">
                Opens the standard Windows print preview dialog (best for sheet paper or PDF exports).
              </div>
            </div>
          </label>
        </div>

        {/* Printer Select */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-hairline">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-ink-secondary">
                Target Thermal Printer
              </label>
              <button
                type="button"
                onClick={onRefreshPrinters}
                disabled={loadingPrinters}
                className="text-[11px] text-accent-ink hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingPrinters ? 'animate-spin' : ''}`} />
                <span>Scan Printers</span>
              </button>
            </div>
            <select
              value={selectedPrinter}
              onChange={(e) => onSelectedPrinterChange(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
            >
              <option value="">
                {defaultPrinter ? `Default: ${defaultPrinter}` : '-- Select Printer --'}
              </option>
              {availablePrinters.map((p) => (
                <option key={p} value={p}>
                  {p} {p === defaultPrinter ? '(System Default)' : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-ink-muted mt-1">
              Detected via Windows raw spooler. Select your 80mm/58mm USB or Network thermal POS printer.
            </p>
          </div>

          {/* Auto Cut & Cash Drawer toggles */}
          <div className="space-y-2 pt-1 sm:pt-4">
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={autoCutReceipt}
                onChange={(e) => onAutoCutReceiptChange(e.target.checked)}
                className="rounded accent-accent h-4 w-4"
              />
              <Scissors className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
              <span className="text-ink font-medium">Auto-Cut Paper after printing (GS V)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={kickCashDrawer}
                onChange={(e) => onKickCashDrawerChange(e.target.checked)}
                className="rounded accent-accent h-4 w-4"
              />
              <Zap className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
              <span className="text-ink font-medium">Kick Cash Drawer on Cash Sale (ESC p)</span>
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Column: Form Controls */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">
              Receipt Subtitle / Tagline
            </label>
            <input
              type="text"
              value={invoiceSubtitle}
              onChange={(e) => onInvoiceSubtitleChange(e.target.value)}
              placeholder="Optional receipt tagline or subtitle"
              className="w-full px-3.5 py-2.5 bg-canvas border border-hairline rounded-lg text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
            />
            <p className="text-[11px] text-ink-muted mt-1">
              Printed directly under the shop header. Leave blank to omit.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">
              Thermal Paper Width &amp; Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['80mm', '58mm', 'a4'] as const).map((width) => (
                <button
                  key={width}
                  type="button"
                  onClick={() => onInvoicePaperWidthChange(width)}
                  className={`p-2.5 rounded-lg border text-xs font-semibold transition-colors text-left cursor-pointer ${
                    invoicePaperWidth === width
                      ? 'bg-accent/15 border-accent text-accent-ink'
                      : 'bg-canvas border-hairline text-ink-secondary hover:text-ink'
                  }`}
                >
                  <div>{width === '80mm' ? '80mm Standard' : width === '58mm' ? '58mm Compact' : 'A4 Page'}</div>
                  <div className="text-[10px] font-normal text-ink-muted mt-0.5">
                    {width === '80mm' ? 'Standard 3" POS roll' : width === '58mm' ? 'Portable 2" roll' : 'Sheet paper'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">
              Exchange Policy &amp; Footer Note
            </label>
            <textarea
              rows={3}
              value={invoiceFooterNote}
              onChange={(e) => onInvoiceFooterNoteChange(e.target.value)}
              placeholder="Items can be exchanged within 7 days with original invoice & intact seal. Poured oils are non-exchangeable."
              className="w-full px-3.5 py-2.5 bg-canvas border border-hairline rounded-lg text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
            />
            <p className="text-[11px] text-ink-muted mt-1">
              Custom policy note displayed at the bottom of the receipt.
            </p>
          </div>

          <div className="pt-2 border-t border-hairline space-y-3">
            <label className="flex items-center gap-3 p-2.5 rounded-lg border border-hairline bg-canvas cursor-pointer">
              <input
                type="checkbox"
                checked={showLogoOnInvoice}
                onChange={(e) => onShowLogoOnInvoiceChange(e.target.checked)}
                className="rounded accent-accent h-4 w-4"
              />
              <div>
                <div className="font-medium text-xs text-ink">
                  Show Brand Logo on Receipt
                </div>
                <div className="text-[11px] text-ink-secondary">
                  Prints the decorative brand emblem beside your shop name at the top of the invoice.
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-2.5 rounded-lg border border-hairline bg-canvas cursor-pointer">
              <input
                type="checkbox"
                checked={showCashierOnInvoice}
                onChange={(e) => onShowCashierOnInvoiceChange(e.target.checked)}
                className="rounded accent-accent h-4 w-4"
              />
              <div>
                <div className="font-medium text-xs text-ink">
                  Show Cashier Name on Receipt
                </div>
                <div className="text-[11px] text-ink-secondary">
                  Includes &ldquo;Served by: [Cashier Name]&rdquo; on the receipt header.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Right Column: Live Receipt Preview */}
        <div className="bg-subtle p-4 rounded-xl border border-hairline flex flex-col items-center">
          <div className="w-full flex justify-between items-center pb-2 mb-2 border-b border-hairline">
            <span className="text-[11px] font-medium text-ink-secondary">
              Live Preview ({invoicePaperWidth})
            </span>
            <span className="text-[11px] text-ink-muted font-mono">
              Real-time update
            </span>
          </div>

          <div className="bg-white text-black p-3 shadow-md border border-neutral-300 rounded font-mono text-[11px] leading-tight w-full max-w-[320px] max-h-[480px] overflow-y-auto">
            <PrintableReceipt
              invoiceNumber="INV-202611-00042"
              createdAt={new Date().toISOString()}
              customer={{
                id: 'c1',
                name: 'Rahim Ahmed',
                phone: '01712345678',
                notes: null,
                dueBalanceBdt: 0,
                visitCount: 3,
                totalSpendBdt: 5400,
                lastVisitAt: null,
                createdAt: '',
              }}
              items={[
                {
                  id: 'item-1',
                  sellableId: 'prod-1',
                  productName: 'Musk Al Madinah',
                  sku: 'RAUH-025',
                  sellableType: 'sealed_product',
                  quantity: 1,
                  unitCode: 'bottle',
                  unitPriceBdt: 700,
                  idealRetailPriceBdt: 700,
                  costPriceBdt: 450,
                  discountPercent: 0,
                  discountAmountBdt: 0,
                  lineTotalBdt: 700,
                  stockInHand: 10,
                },
                {
                  id: 'item-2',
                  sellableId: 'prod-2',
                  productName: 'Musk Rizali (Decant)',
                  sku: 'RAUH-014',
                  sellableType: 'loose_decant',
                  quantity: 12,
                  bottleSizeMl: 12,
                  unitCode: 'ml',
                  unitPriceBdt: 50,
                  idealRetailPriceBdt: 50,
                  costPriceBdt: 30,
                  discountPercent: 0,
                  discountAmountBdt: 0,
                  lineTotalBdt: 600,
                  stockInHand: 50,
                },
              ]}
              totals={{
                subtotalBdt: 1300,
                itemDiscountBdt: 0,
                cartDiscountPercent: 0,
                cartDiscountBdt: 0,
                totalAmountBdt: 1300,
                paidAmountBdt: 1300,
                changeAmountBdt: 0,
                dueAmountBdt: 0,
              }}
              payments={[
                {
                  method: 'card',
                  amountBdt: 1300,
                  reference: 'TRX-9482',
                },
              ]}
              cashierName={cashierName}
              shopSettings={previewShopSettings}
              isPreview={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
