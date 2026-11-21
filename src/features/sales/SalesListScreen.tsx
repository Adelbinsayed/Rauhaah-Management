import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Receipt,
  Eye,
  CreditCard,
  User as UserIcon,
  RefreshCw,
  Printer,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { posRepo } from '@/data/repositories/posRepo';
import type { Sale } from '@/domain/pos/types';
import { useAppStore } from '@/app/store';
import { PrintableReceipt } from '@/features/pos/PrintableReceipt';
import { buildEscposReceipt, printDirectEscpos } from '@/domain/pos/escpos';
import { DateRangeBar, type DatePresetKey, Modal } from '@/components/ui';
import { formatBdtAmount } from '@/lib/money';
import { calculateDateRange, formatDhakaDateTime, getTodayDateString } from '@/lib/dates';

interface SalesListScreenProps {
  deviceId: string;
}

export const SalesListScreen: React.FC<SalesListScreenProps> = ({ deviceId: _deviceId }) => {
  const { shopSettings } = useAppStore();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Date Filtering State (Default: Today)
  const [datePreset, setDatePreset] = useState<DatePresetKey>('today');
  const [startDate, setStartDate] = useState<string>(getTodayDateString());
  const [endDate, setEndDate] = useState<string>(getTodayDateString());

  const handlePresetChange = (preset: DatePresetKey) => {
    setDatePreset(preset);
    const bounds = calculateDateRange(preset);
    setStartDate(bounds.startDateStr);
    setEndDate(bounds.endDateStr);
  };

  const handlePrintSale = async (forceDialog = false) => {
    if (!selectedSale) return;
    if (!forceDialog && shopSettings?.printerEngine === 'direct_escpos') {
      try {
        const pWidth = shopSettings?.invoicePaperWidth === '58mm' ? '58mm' : '80mm';
        const saleItems = selectedSale.items || [];
        const salePayments =
          selectedSale.payments && selectedSale.payments.length > 0
            ? selectedSale.payments
            : [{ method: selectedSale.paymentMethod, amountBdt: selectedSale.paidAmountBdt }];

        const data = buildEscposReceipt({
          invoiceNumber: selectedSale.invoiceNumber,
          createdAt: selectedSale.createdAt,
          cashierName: selectedSale.cashierName || 'Cashier',
          customer: selectedSale.customerPhone
            ? {
                id: selectedSale.customerId || '',
                name: selectedSale.customerName || 'Customer',
                phone: selectedSale.customerPhone,
                notes: null,
                dueBalanceBdt: 0,
                visitCount: 1,
                totalSpendBdt: 0,
                lastVisitAt: null,
                createdAt: '',
              }
            : null,
          items: saleItems.map((i) => ({
            id: i.id,
            sellableId: i.sellableId,
            productName: i.productName,
            sku: i.sku || '',
            sellableType: i.sellableType,
            quantity: i.quantity,
            unitCode: i.unitCode,
            unitPriceBdt: i.unitPriceBdt,
            idealRetailPriceBdt: i.unitPriceBdt,
            costPriceBdt: i.costPriceBdt,
            discountPercent: 0,
            discountAmountBdt: i.discountAmountBdt,
            lineTotalBdt: i.lineTotalBdt,
            bottleSizeMl: i.bottleSizeMl,
            stockInHand: 0,
          })),
          totals: {
            subtotalBdt: selectedSale.subtotalBdt,
            itemDiscountBdt: 0,
            cartDiscountPercent: 0,
            cartDiscountBdt: selectedSale.discountAmountBdt,
            totalAmountBdt: selectedSale.totalAmountBdt,
            paidAmountBdt: selectedSale.paidAmountBdt,
            changeAmountBdt: selectedSale.changeAmountBdt,
            dueAmountBdt: selectedSale.dueAmountBdt,
          },
          payments: salePayments.map((p) => ({
            method: p.method,
            amountBdt: p.amountBdt,
            reference: p.reference,
          })),
          shopSettings,
          paperWidth: pWidth,
          autoCut: shopSettings?.autoCutReceipt !== false,
          kickDrawer: false,
        });

        const res = await printDirectEscpos(data, shopSettings?.selectedPrinter);
        if (!res.success) {
          window.print();
        }
      } catch {
        window.print();
      }
    } else {
      window.print();
    }
  };

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const data = await posRepo.getSales({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 500,
      });
      setSales(data);
    } catch (err) {
      console.error('Failed to load sales history:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const viewSaleDetails = async (sale: Sale) => {
    setDetailLoading(true);
    setSelectedSale(sale);
    try {
      const fullDetails = await posRepo.getSaleDetails(sale.id);
      if (fullDetails) {
        setSelectedSale(fullDetails);
      }
    } catch (err) {
      console.error('Failed to load sale details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const matchesSearch =
        !searchQuery.trim() ||
        s.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.customerName && s.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.customerPhone && s.customerPhone.includes(searchQuery.trim()));

      const matchesPayment =
        paymentFilter === 'all' || s.paymentMethod === paymentFilter;

      return matchesSearch && matchesPayment;
    });
  }, [sales, searchQuery, paymentFilter]);

  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + s.totalAmountBdt, 0);
  }, [filteredSales]);

  return (
    <div className="h-full flex flex-col bg-brand-black text-white overflow-hidden p-6 gap-5">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-brand-gold" />
            <span>Sales &amp; Orders History</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Audit completed transactions, review invoice details, and verify payments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Metrics */}
          <div className="bg-brand-surface border border-brand-border px-4 py-2 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-gold/15 flex items-center justify-center text-brand-gold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
                Total Shown
              </div>
              <div className="text-base font-bold text-brand-gold font-mono">
                {formatBdtAmount(totalRevenue)}
              </div>
            </div>
          </div>

          <button
            onClick={loadSales}
            disabled={loading}
            className="p-2.5 rounded-xl bg-brand-surface border border-brand-border text-neutral-300 hover:text-white hover:border-brand-gold/50 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh sales list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Reusable Date Range Filter Bar */}
      <DateRangeBar
        preset={datePreset}
        startDate={startDate}
        endDate={endDate}
        onPresetChange={handlePresetChange}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onReset={() => handlePresetChange('all')}
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by invoice number (e.g. INV-202611-0001), customer name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider pl-1">
            Method:
          </span>
          {['all', 'cash', 'bkash', 'nagad', 'card', 'bank'].map((m) => (
            <button
              key={m}
              onClick={() => setPaymentFilter(m)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                paymentFilter === m
                  ? 'bg-brand-gold text-brand-black shadow-md shadow-brand-gold/20'
                  : 'bg-brand-surface border border-brand-border text-neutral-400 hover:text-white hover:border-brand-gold/40'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Invoices Table */}
      <div className="flex-1 bg-brand-surface border border-brand-border rounded-2xl overflow-hidden flex flex-col shadow-xl">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-brand-black/70 sticky top-0 border-b border-brand-border text-neutral-400 font-semibold tracking-wider uppercase text-[11px] select-none">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">Discount</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/40 text-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-500">
                    <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-brand-gold" />
                    Loading transactions history...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-500">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No sales records found matching the current filters.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => viewSaleDetails(sale)}
                    className="hover:bg-brand-black/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-white group-hover:text-brand-gold transition-colors">
                      {sale.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-400">
                      {formatDhakaDateTime(sale.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      {sale.customerName ? (
                        <div>
                          <div className="font-semibold text-white">{sale.customerName}</div>
                          {sale.customerPhone && (
                            <div className="text-[11px] text-neutral-400 font-mono">
                              {sale.customerPhone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-500 italic">Walk-in Customer</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-neutral-800 text-neutral-300 border border-brand-border">
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-300">
                      {formatBdtAmount(sale.subtotalBdt)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-400">
                      {sale.discountAmountBdt > 0 ? `-${formatBdtAmount(sale.discountAmountBdt)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-brand-gold">
                      {formatBdtAmount(sale.totalAmountBdt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {sale.dueAmountBdt > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Due {formatBdtAmount(sale.dueAmountBdt)}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                          Paid
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          viewSaleDetails(sale);
                        }}
                        className="p-1.5 rounded-lg bg-brand-surface border border-brand-border text-neutral-400 hover:text-white hover:border-brand-gold/50 transition-colors cursor-pointer"
                        title="View invoice details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Details Modal */}
      {selectedSale && (
        <>
          {/* Printable Receipt for window.print() */}
          <div className="hidden print:block">
            <PrintableReceipt
              invoiceNumber={selectedSale.invoiceNumber}
              createdAt={selectedSale.createdAt}
              customer={
                selectedSale.customerPhone || selectedSale.customerName
                  ? {
                      id: selectedSale.customerId || 'cust-adhoc',
                      name: selectedSale.customerName || 'Walk-in Customer',
                      phone: selectedSale.customerPhone || '',
                      notes: null,
                      dueBalanceBdt: selectedSale.dueAmountBdt,
                      visitCount: 1,
                      totalSpendBdt: selectedSale.totalAmountBdt,
                      lastVisitAt: selectedSale.createdAt,
                      createdAt: selectedSale.createdAt,
                    }
                  : null
              }
              items={selectedSale.items || []}
              totals={{
                subtotalBdt: selectedSale.subtotalBdt,
                itemDiscountBdt: 0,
                cartDiscountPercent: 0,
                cartDiscountBdt: selectedSale.discountAmountBdt,
                totalAmountBdt: selectedSale.totalAmountBdt,
                paidAmountBdt: selectedSale.paidAmountBdt,
                changeAmountBdt: selectedSale.changeAmountBdt,
                dueAmountBdt: selectedSale.dueAmountBdt,
              }}
              payments={selectedSale.payments || []}
              cashierName={selectedSale.cashierName}
              shopSettings={shopSettings}
            />
          </div>

          <Modal
            isOpen={Boolean(selectedSale)}
            onClose={() => setSelectedSale(null)}
            maxWidth="xl"
            title={
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-white">
                  {selectedSale.invoiceNumber}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {selectedSale.status}
                </span>
              </div>
            }
            subtitle={formatDhakaDateTime(selectedSale.createdAt)}
          >
            <div className="space-y-4">
              {/* Customer & Cashier Info */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-brand-black/60 p-3 rounded-xl border border-brand-border/60">
                <div>
                  <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                    Customer
                  </div>
                  <div className="font-semibold text-white mt-0.5 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-brand-gold" />
                    <span>{selectedSale.customerName || 'Walk-in Customer'}</span>
                  </div>
                  {selectedSale.customerPhone && (
                    <div className="text-neutral-400 font-mono text-[11px] mt-0.5">
                      {selectedSale.customerPhone}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                    Cashier / Served By
                  </div>
                  <div className="font-semibold text-white mt-0.5">
                    {selectedSale.cashierName || 'Cashier'}
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-brand-gold" />
                    <span>Payment: <strong className="uppercase">{selectedSale.paymentMethod}</strong></span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 border border-brand-border/40 rounded-xl p-3 bg-brand-black/40 max-h-56 overflow-y-auto">
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 pb-1 border-b border-brand-border/40">
                  Purchased Items
                </div>

                {detailLoading ? (
                  <div className="py-8 text-center text-xs text-neutral-400">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-1 text-brand-gold" />
                    Loading items...
                  </div>
                ) : selectedSale.items && selectedSale.items.length > 0 ? (
                  selectedSale.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center py-1.5 border-b border-brand-border/20 last:border-0 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">{item.productName}</div>
                        <div className="text-[11px] text-neutral-400 font-mono">
                          {item.quantity} {item.unitCode}{' '}
                          {item.bottleSizeMl ? `(Decant ${item.bottleSizeMl}ml)` : ''}{' '}
                          @ {formatBdtAmount(item.unitPriceBdt)}/{item.unitCode}
                        </div>
                        {item.discountAmountBdt > 0 && (
                          <div className="text-[10px] text-emerald-400">
                            Discount: -{formatBdtAmount(item.discountAmountBdt)}
                            {item.discountReason ? ` (${item.discountReason})` : ''}
                          </div>
                        )}
                      </div>
                      <div className="font-bold text-brand-gold font-mono text-sm">
                        {formatBdtAmount(item.lineTotalBdt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-center text-xs text-neutral-500">
                    No line items recorded.
                  </div>
                )}
              </div>

              {/* Financial Summary */}
              <div className="bg-brand-black/80 rounded-xl p-3.5 border border-brand-border space-y-1.5 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-white">{formatBdtAmount(selectedSale.subtotalBdt)}</span>
                </div>
                {selectedSale.discountAmountBdt > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>
                      Discount {selectedSale.discountReason ? `(${selectedSale.discountReason})` : ''}
                    </span>
                    <span className="font-mono">-{formatBdtAmount(selectedSale.discountAmountBdt)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-white pt-1.5 border-t border-brand-border/60">
                  <span>Total Amount</span>
                  <span className="font-mono text-brand-gold">
                    {formatBdtAmount(selectedSale.totalAmountBdt)}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-400 pt-1 border-t border-brand-border/30">
                  <span>Paid</span>
                  <span className="font-mono text-neutral-200">
                    {formatBdtAmount(selectedSale.paidAmountBdt)}
                  </span>
                </div>
                {selectedSale.changeAmountBdt > 0 && (
                  <div className="flex justify-between text-neutral-400">
                    <span>Change Given</span>
                    <span className="font-mono text-neutral-300">
                      {formatBdtAmount(selectedSale.changeAmountBdt)}
                    </span>
                  </div>
                )}
                {selectedSale.dueAmountBdt > 0 && (
                  <div className="flex justify-between text-amber-400 font-bold">
                    <span>Customer Due Balance</span>
                    <span className="font-mono">{formatBdtAmount(selectedSale.dueAmountBdt)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-border/40">
                {shopSettings?.printerEngine === 'direct_escpos' && (
                  <button
                    type="button"
                    onClick={() => handlePrintSale(true)}
                    className="text-[11px] text-neutral-400 hover:text-white underline mr-2 cursor-pointer"
                  >
                    System Dialog
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handlePrintSale(false)}
                  className="px-4 py-2 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-gold/50 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {shopSettings?.printerEngine === 'direct_escpos' ? (
                    <>
                      <Zap className="w-3.5 h-3.5 text-brand-gold" />
                      <span>Direct Print</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-3.5 h-3.5 text-brand-gold" />
                      <span>Print Invoice</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSale(null)}
                  className="px-5 py-2 rounded-xl bg-brand-gold text-brand-black font-bold text-xs hover:bg-brand-gold/90 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
};
