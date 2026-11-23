import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Receipt,
  Eye,
  CreditCard,
  User as UserIcon,
  RefreshCw,
  Printer,
  ShieldAlert,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { posRepo } from '@/data/repositories/posRepo';
import { hasPermission } from '@/domain/auth/permissions';
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
  const { currentUser, permissions, shopSettings } = useAppStore();
  const canViewAllSales =
    hasPermission(permissions, 'report.view') || hasPermission(permissions, 'sale.void');
  const canViewOwnSales = hasPermission(permissions, 'sale.view_own');

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
    if (!canViewAllSales && (!canViewOwnSales || !currentUser?.id)) {
      setSales([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await posRepo.getSales({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        cashierId: canViewAllSales ? undefined : currentUser?.id,
        limit: 500,
      });
      setSales(data);
    } catch (err) {
      console.error('Failed to load sales history:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, canViewAllSales, canViewOwnSales, currentUser?.id]);

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

  if (!canViewAllSales && !canViewOwnSales) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-negative/15 border border-negative/25 text-negative flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-semibold text-ink">Access Denied</h2>
        <p className="text-xs text-ink-secondary mt-1">
          Your role does not have permission to view sales history.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-canvas text-ink overflow-hidden gap-5">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium text-ink flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-accent-ink" strokeWidth={1.5} />
            <span>Sales &amp; orders history</span>
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Audit completed transactions, review invoice details, and verify payments
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Metrics */}
          <div className="bg-surface border border-hairline px-4 py-2 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-raised border border-hairline flex items-center justify-center text-accent-ink">
              <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-xs text-ink-muted">
                Total shown
              </div>
              <div className="text-base font-medium text-accent-ink font-mono tabular-nums">
                {formatBdtAmount(totalRevenue)}
              </div>
            </div>
          </div>

          <button
            onClick={loadSales}
            disabled={loading}
            className="p-2.5 rounded-lg bg-surface border border-hairline text-ink-secondary hover:text-ink hover:border-hairline-strong transition-colors duration-150 ease-unslop disabled:opacity-50 cursor-pointer"
            title="Refresh sales list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
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
          <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search invoice number (e.g. INV-202611-0001), customer name, phone"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent transition-colors duration-150 ease-unslop"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-ink-muted font-medium pl-1">
            Method
          </span>
          {['all', 'cash', 'bkash', 'nagad', 'card', 'bank'].map((m) => (
            <button
              key={m}
              onClick={() => setPaymentFilter(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-colors duration-150 ease-unslop cursor-pointer ${
                paymentFilter === m
                  ? 'bg-accent text-accent-fg font-semibold'
                  : 'bg-surface border border-hairline text-ink-secondary hover:text-ink hover:border-hairline-strong'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Invoices Table */}
      <div className="flex-1 bg-surface border border-hairline rounded-xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-raised/70 sticky top-0 border-b border-hairline text-ink-muted font-medium select-none">
              <tr>
                <th className="py-3 px-4">Invoice</th>
                <th className="py-3 px-4">Date &amp; time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">Discount</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-ink-secondary">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-muted">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-accent-ink" strokeWidth={1.5} />
                    Loading transactions history…
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-muted">
                    <Receipt className="w-7 h-7 mx-auto mb-2 opacity-40" strokeWidth={1.5} />
                    No sales records match the current filters
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => viewSaleDetails(sale)}
                    className="hover:bg-raised/50 cursor-pointer transition-colors duration-150 ease-unslop group"
                  >
                    <td className="py-3 px-4 font-mono tabular-nums font-medium text-ink group-hover:text-accent-ink transition-colors duration-150 ease-unslop">
                      {sale.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-ink-muted">
                      {formatDhakaDateTime(sale.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      {sale.customerName ? (
                        <div>
                          <div className="font-medium text-ink">{sale.customerName}</div>
                          {sale.customerPhone && (
                            <div className="text-[11px] text-ink-muted font-mono tabular-nums">
                              {sale.customerPhone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-ink-muted">Walk-in customer</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium capitalize bg-raised text-ink-secondary border border-hairline">
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-ink-secondary">
                      {formatBdtAmount(sale.subtotalBdt)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-positive">
                      {sale.discountAmountBdt > 0 ? `-${formatBdtAmount(sale.discountAmountBdt)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-accent-ink">
                      {formatBdtAmount(sale.totalAmountBdt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {sale.dueAmountBdt > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-warning/10 text-warning border border-warning/25 font-mono tabular-nums">
                          Due {formatBdtAmount(sale.dueAmountBdt)}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-positive/10 text-positive border border-positive/25">
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
                        className="p-1.5 rounded-lg bg-raised border border-hairline text-ink-muted hover:text-ink hover:border-hairline-strong transition-colors duration-150 ease-unslop cursor-pointer"
                        title="View invoice details"
                      >
                        <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
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
                <span className="font-mono tabular-nums text-base font-medium text-ink">
                  {selectedSale.invoiceNumber}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium capitalize bg-positive/10 text-positive border border-positive/25">
                  {selectedSale.status}
                </span>
              </div>
            }
            subtitle={formatDhakaDateTime(selectedSale.createdAt)}
          >
            <div className="space-y-4">
              {/* Customer & Cashier Info */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-raised p-3.5 rounded-xl border border-hairline">
                <div>
                  <div className="text-xs text-ink-muted">
                    Customer
                  </div>
                  <div className="font-medium text-ink mt-0.5 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
                    <span>{selectedSale.customerName || 'Walk-in customer'}</span>
                  </div>
                  {selectedSale.customerPhone && (
                    <div className="text-ink-muted font-mono tabular-nums text-xs mt-0.5">
                      {selectedSale.customerPhone}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-ink-muted">
                    Cashier / served by
                  </div>
                  <div className="font-medium text-ink mt-0.5">
                    {selectedSale.cashierName || 'Cashier'}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
                    <span>Payment <strong className="capitalize font-medium text-ink-secondary">{selectedSale.paymentMethod}</strong></span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 border border-hairline rounded-xl p-3.5 bg-raised/60 max-h-56 overflow-y-auto">
                <div className="text-xs font-medium text-ink-muted pb-1.5 border-b border-hairline">
                  Purchased items
                </div>

                {detailLoading ? (
                  <div className="py-8 text-center text-xs text-ink-muted">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-1 text-accent-ink" strokeWidth={1.5} />
                    Loading items…
                  </div>
                ) : selectedSale.items && selectedSale.items.length > 0 ? (
                  selectedSale.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center py-1.5 border-b border-hairline last:border-0 text-xs"
                    >
                      <div>
                        <div className="font-medium text-ink">{item.productName}</div>
                        <div className="text-xs text-ink-muted font-mono tabular-nums">
                          {item.quantity} {item.unitCode}{' '}
                          {item.bottleSizeMl ? `(Decant ${item.bottleSizeMl}ml)` : ''}{' '}
                          @ {formatBdtAmount(item.unitPriceBdt)}/{item.unitCode}
                        </div>
                        {item.discountAmountBdt > 0 && (
                          <div className="text-[11px] text-positive">
                            Discount -{formatBdtAmount(item.discountAmountBdt)}
                            {item.discountReason ? ` (${item.discountReason})` : ''}
                          </div>
                        )}
                      </div>
                      <div className="font-medium text-accent-ink font-mono tabular-nums text-sm">
                        {formatBdtAmount(item.lineTotalBdt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-center text-xs text-ink-muted">
                    No line items recorded
                  </div>
                )}
              </div>

              {/* Financial Summary */}
              <div className="bg-raised rounded-xl p-3.5 border border-hairline space-y-1.5 text-xs">
                <div className="flex justify-between text-ink-muted">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums text-ink">{formatBdtAmount(selectedSale.subtotalBdt)}</span>
                </div>
                {selectedSale.discountAmountBdt > 0 && (
                  <div className="flex justify-between text-positive">
                    <span>
                      Discount {selectedSale.discountReason ? `(${selectedSale.discountReason})` : ''}
                    </span>
                    <span className="font-mono tabular-nums">-{formatBdtAmount(selectedSale.discountAmountBdt)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-medium text-ink pt-1.5 border-t border-hairline">
                  <span>Total amount</span>
                  <span className="font-mono tabular-nums text-accent-ink">
                    {formatBdtAmount(selectedSale.totalAmountBdt)}
                  </span>
                </div>
                <div className="flex justify-between text-ink-muted pt-1.5 border-t border-hairline">
                  <span>Paid</span>
                  <span className="font-mono tabular-nums text-ink-secondary">
                    {formatBdtAmount(selectedSale.paidAmountBdt)}
                  </span>
                </div>
                {selectedSale.changeAmountBdt > 0 && (
                  <div className="flex justify-between text-ink-muted">
                    <span>Change given</span>
                    <span className="font-mono tabular-nums text-ink-secondary">
                      {formatBdtAmount(selectedSale.changeAmountBdt)}
                    </span>
                  </div>
                )}
                {selectedSale.dueAmountBdt > 0 && (
                  <div className="flex justify-between text-warning font-medium">
                    <span>Customer due balance</span>
                    <span className="font-mono tabular-nums">{formatBdtAmount(selectedSale.dueAmountBdt)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-hairline">
                {shopSettings?.printerEngine === 'direct_escpos' && (
                  <button
                    type="button"
                    onClick={() => handlePrintSale(true)}
                    className="text-xs text-ink-muted hover:text-ink underline mr-2 cursor-pointer"
                  >
                    System Dialog
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handlePrintSale(false)}
                  className="px-4 py-2 rounded-lg bg-raised border border-hairline hover:border-hairline-strong text-ink font-medium text-xs flex items-center gap-1.5 transition-colors duration-150 ease-unslop cursor-pointer"
                >
                  {shopSettings?.printerEngine === 'direct_escpos' ? (
                    <>
                      <Zap className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
                      <span>Direct Print</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
                      <span>Print Invoice</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSale(null)}
                  className="px-5 py-2 rounded-lg bg-accent text-accent-fg font-semibold text-xs hover:bg-accent-hover transition-colors duration-150 ease-unslop cursor-pointer"
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
