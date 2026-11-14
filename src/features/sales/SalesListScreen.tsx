import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Receipt,
  Eye,
  Calendar,
  CreditCard,
  User as UserIcon,
  RefreshCw,
  X,
  Printer,
  TrendingUp,
} from 'lucide-react';
import { posRepo } from '@/data/repositories/posRepo';
import type { Sale } from '@/domain/pos/types';

interface SalesListScreenProps {
  deviceId: string;
}

export const SalesListScreen: React.FC<SalesListScreenProps> = ({ deviceId: _deviceId }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const data = await posRepo.getRecentSales(100);
      setSales(data);
    } catch (err) {
      console.error('Failed to load sales history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
            Sales &amp; Orders History
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
                ৳{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <button
            onClick={loadSales}
            disabled={loading}
            className="p-2.5 rounded-xl bg-brand-surface border border-brand-border text-neutral-300 hover:text-white hover:border-brand-gold/50 transition-colors disabled:opacity-50"
            title="Refresh sales list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

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

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['all', 'cash', 'bkash', 'nagad', 'card', 'split'] as const).map((method) => (
            <button
              key={method}
              onClick={() => setPaymentFilter(method)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                paymentFilter === method
                  ? 'bg-brand-gold text-brand-black font-bold'
                  : 'bg-brand-surface border border-brand-border text-neutral-400 hover:text-white hover:border-brand-gold/40'
              }`}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Table */}
      <div className="flex-1 min-h-0 bg-brand-surface border border-brand-border rounded-2xl overflow-hidden flex flex-col shadow-lg">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-black/60 border-b border-brand-border text-neutral-400 text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4 font-semibold">Invoice #</th>
                <th className="py-3 px-4 font-semibold">Date &amp; Time</th>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Cashier</th>
                <th className="py-3 px-4 font-semibold text-center">Payment</th>
                <th className="py-3 px-4 font-semibold text-right">Amount (৳)</th>
                <th className="py-3 px-4 font-semibold text-right">Status</th>
                <th className="py-3 px-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/40 font-normal">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-neutral-400">
                    <Receipt className="w-10 h-10 mx-auto text-neutral-600 mb-2" />
                    <p className="text-sm font-semibold">No transactions found</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {sales.length === 0
                        ? 'Completed sales from the POS will show up here.'
                        : 'Try adjusting your search or payment filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-brand-gold/5 transition-colors group cursor-pointer"
                    onClick={() => viewSaleDetails(sale)}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-white group-hover:text-brand-gold">
                      {sale.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-neutral-400 text-xs">
                      {new Date(sale.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      <span className="text-neutral-500">
                        {new Date(sale.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white">
                      <div className="font-medium text-xs">
                        {sale.customerName || 'Walk-in Customer'}
                      </div>
                      {sale.customerPhone && (
                        <div className="text-[11px] text-neutral-500 font-mono">
                          {sale.customerPhone}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-neutral-300 text-xs">
                      {sale.cashierName || 'Cashier'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          sale.paymentMethod === 'bkash'
                            ? 'bg-pink-500/15 text-pink-400 border border-pink-500/30'
                            : sale.paymentMethod === 'nagad'
                            ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                            : sale.paymentMethod === 'card'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            : sale.paymentMethod === 'split'
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-brand-gold">
                      ৳{sale.totalAmountBdt.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {sale.dueAmountBdt > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Due ৳{sale.dueAmountBdt.toFixed(2)}
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
                        className="p-1.5 rounded-lg bg-brand-surface border border-brand-border text-neutral-400 hover:text-white hover:border-brand-gold/50 transition-colors"
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

      {/* Sale Details Modal / Drawer */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-brand-surface border border-brand-border rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-brand-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white font-mono">
                    {selectedSale.invoiceNumber}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {selectedSale.status}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-brand-gold" />
                  {new Date(selectedSale.createdAt).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => setSelectedSale(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer & Cashier Info */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-brand-black/60 p-3 rounded-xl border border-brand-border/60">
              <div>
                <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                  Customer
                </div>
                <div className="font-semibold text-white mt-0.5 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-brand-gold" />
                  {selectedSale.customerName || 'Walk-in Customer'}
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
                  Payment: <span className="uppercase font-semibold">{selectedSale.paymentMethod}</span>
                </div>
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 border border-brand-border/40 rounded-xl p-3 bg-brand-black/40">
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
                        @ ৳{item.unitPriceBdt.toFixed(2)}/{item.unitCode}
                      </div>
                      {item.discountAmountBdt > 0 && (
                        <div className="text-[10px] text-emerald-400">
                          Discount: -৳{item.discountAmountBdt.toFixed(2)}
                          {item.discountReason ? ` (${item.discountReason})` : ''}
                        </div>
                      )}
                    </div>
                    <div className="font-bold text-brand-gold font-mono text-sm">
                      ৳{item.lineTotalBdt.toFixed(2)}
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
                <span className="font-mono text-white">৳{selectedSale.subtotalBdt.toFixed(2)}</span>
              </div>
              {selectedSale.discountAmountBdt > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>
                    Discount {selectedSale.discountReason ? `(${selectedSale.discountReason})` : ''}
                  </span>
                  <span className="font-mono">-৳{selectedSale.discountAmountBdt.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-white pt-1.5 border-t border-brand-border/60">
                <span>Total Amount</span>
                <span className="font-mono text-brand-gold">
                  ৳{selectedSale.totalAmountBdt.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-neutral-400 pt-1 border-t border-brand-border/30">
                <span>Paid</span>
                <span className="font-mono text-neutral-200">
                  ৳{selectedSale.paidAmountBdt.toFixed(2)}
                </span>
              </div>
              {selectedSale.changeAmountBdt > 0 && (
                <div className="flex justify-between text-neutral-400">
                  <span>Change Given</span>
                  <span className="font-mono text-neutral-300">
                    ৳{selectedSale.changeAmountBdt.toFixed(2)}
                  </span>
                </div>
              )}
              {selectedSale.dueAmountBdt > 0 && (
                <div className="flex justify-between text-amber-400 font-bold">
                  <span>Customer Due Balance</span>
                  <span className="font-mono">৳{selectedSale.dueAmountBdt.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-gold/50 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-brand-gold" />
                Print Invoice
              </button>
              <button
                onClick={() => setSelectedSale(null)}
                className="px-5 py-2 rounded-xl bg-brand-gold text-brand-black font-bold text-xs hover:bg-brand-gold/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
