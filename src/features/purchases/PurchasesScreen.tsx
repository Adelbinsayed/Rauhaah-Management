import { useAppStore } from '@/app/store';
import { purchasesRepo } from '@/data/repositories/purchasesRepo';
import type { Purchase, StockItemLookup, Supplier } from '@/domain/purchases/types';
import { calculateDateRange } from '@/lib/dates';
import {
  CreditCard,
  Eye,
  Layers,
  Plus,
  Search,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { NewPurchaseModal } from './components/NewPurchaseModal';
import { PurchaseDetailsModal } from './components/PurchaseDetailsModal';

interface PurchasesScreenProps {
  deviceId: string;
}

export const PurchasesScreen: React.FC<PurchasesScreenProps> = ({ deviceId }) => {
  const { currentUser } = useAppStore();

  // List states
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockItems, setStockItems] = useState<StockItemLookup[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [datePreset, setDatePreset] = useState<'today' | '7days' | 'month' | 'all'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modals
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [supList, stockList, poList, catList] = await Promise.all([
        purchasesRepo.getSuppliers(),
        purchasesRepo.getStockItems(),
        purchasesRepo.getPurchases({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          supplierId: supplierFilter !== 'all' ? supplierFilter : undefined,
          searchQuery: searchQuery || undefined,
        }),
        purchasesRepo.getCategories(),
      ]);
      setSuppliers(supList);
      setStockItems(stockList);
      setPurchases(poList);
      setCategories(catList);
    } catch (err) {
      console.error('Failed to load purchases data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, supplierFilter, searchQuery]);

  // Handle Preset changes
  const handlePresetChange = (preset: 'today' | '7days' | 'month' | 'all') => {
    setDatePreset(preset);
    const bounds = calculateDateRange(preset);
    setStartDate(bounds.startDateStr);
    setEndDate(bounds.endDateStr);
  };

  // View purchase details
  const handleViewPurchase = async (p: Purchase) => {
    setSelectedPurchase(p);
    setDetailLoading(true);
    try {
      const full = await purchasesRepo.getPurchaseDetails(p.id);
      if (full) setSelectedPurchase(full);
    } catch (err) {
      console.error('Failed to load purchase details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalSpent = purchases.reduce((acc, p) => acc + p.totalAmountBdt, 0);
    const totalPaid = purchases.reduce((acc, p) => acc + p.paidAmountBdt, 0);
    const totalDue = totalSpent - totalPaid;
    return { count: purchases.length, totalSpent, totalDue };
  }, [purchases]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-brand-gold" />
            <span>Purchases &amp; Stock Receiving</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Receive incoming fragrance oils (in tola, grams, ml, or litres), bottles, and accessories.
            Automatically updates inventory stock, tracks supplier dues, and updates cost history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsReceiveModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-gold text-brand-black text-xs font-bold hover:bg-brand-gold-light transition-all shadow-md shadow-brand-gold/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Receive New Stock (PO)</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              Total Purchases
            </div>
            <div className="text-lg font-bold text-neutral-900 dark:text-white font-mono mt-0.5">
              {metrics.count} Orders
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              Total Stock In Value
            </div>
            <div className="text-lg font-bold text-emerald-500 font-mono mt-0.5">
              ৳{metrics.totalSpent.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              Outstanding Supplier Due
            </div>
            <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
              ৳{metrics.totalDue.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-3 bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PO number, supplier, bill..."
            className="w-full pl-9 pr-3 py-1.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
          />
        </div>

        {/* Supplier Filter */}
        <div className="flex items-center gap-2">
          <span className="text-neutral-400 font-medium">Supplier:</span>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Presets */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-brand-black/80 p-1 rounded-xl border border-neutral-200 dark:border-brand-border">
          {(['today', '7days', 'month', 'all'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetChange(preset)}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                datePreset === preset
                  ? 'bg-brand-gold text-brand-black shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              {preset === 'today'
                ? 'Today'
                : preset === '7days'
                ? '7 Days'
                : preset === 'month'
                ? '30 Days'
                : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-brand-black/60 border-b border-neutral-200 dark:border-brand-border text-neutral-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Status / Paid</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-brand-border text-neutral-700 dark:text-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400">
                    Loading purchases...
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <ShoppingBag className="w-8 h-8 mx-auto text-neutral-500 mb-2 opacity-50" />
                    <p className="font-semibold text-neutral-300">No purchase records found</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Click &ldquo;Receive New Stock&rdquo; to record your first inventory shipment.
                    </p>
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => handleViewPurchase(p)}
                    className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-neutral-900 dark:text-white">
                      {p.purchaseNumber}
                    </td>
                    <td className="py-3 px-4 text-neutral-400 text-[11px]">
                      {new Date(p.receivedAt).toLocaleDateString()} &bull;{' '}
                      {new Date(p.receivedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                      <span>{p.supplierName}</span>
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      <span className="uppercase font-semibold text-neutral-300">
                        {p.paymentMethod}
                      </span>
                      {p.referenceNumber && (
                        <span className="text-neutral-500 font-mono ml-1">
                          ({p.referenceNumber})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-brand-gold">
                      ৳{p.totalAmountBdt.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.totalAmountBdt > p.paidAmountBdt ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Due ৳{(p.totalAmountBdt - p.paidAmountBdt).toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                          Paid
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewPurchase(p);
                        }}
                        className="p-1.5 rounded-lg border border-neutral-200 dark:border-brand-border text-neutral-400 hover:text-white hover:border-brand-gold transition-colors cursor-pointer"
                        title="View PO Details"
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

      {/* Receive Stock / New Purchase Modal */}
      <NewPurchaseModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        suppliers={suppliers}
        stockItems={stockItems}
        categories={categories}
        deviceId={deviceId}
        currentUser={currentUser}
        onPurchaseCompleted={loadData}
        onSuppliersUpdated={setSuppliers}
        onStockItemsUpdated={setStockItems}
      />

      {/* Purchase Details Modal */}
      <PurchaseDetailsModal
        selectedPurchase={selectedPurchase}
        detailLoading={detailLoading}
        onClose={() => setSelectedPurchase(null)}
      />
    </div>
  );
};
