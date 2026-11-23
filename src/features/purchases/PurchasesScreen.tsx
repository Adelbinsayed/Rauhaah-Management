import { useAppStore } from '@/app/store';
import { purchasesRepo } from '@/data/repositories/purchasesRepo';
import { canViewCost } from '@/domain/auth/permissions';
import type { Purchase, StockItemLookup, Supplier } from '@/domain/purchases/types';
import { calculateDateRange, formatDhakaDateTime } from '@/lib/dates';
import {
  CreditCard,
  Eye,
  Layers,
  Plus,
  Search,
  ShieldAlert,
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
  const { currentUser, permissions } = useAppStore();
  const allowCost = canViewCost(permissions);

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
  const [initialMonthRange] = useState(() => calculateDateRange('month'));
  const [startDate, setStartDate] = useState<string>(initialMonthRange.startDateStr);
  const [endDate, setEndDate] = useState<string>(initialMonthRange.endDateStr);

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
    if (!allowCost) {
      setLoading(false);
      return;
    }
    loadData();
  }, [startDate, endDate, supplierFilter, searchQuery, allowCost]);

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

  if (!allowCost) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-negative/15 border border-negative/25 text-negative flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-semibold text-ink">Access Denied</h2>
        <p className="text-xs text-ink-secondary mt-1">
          Only accounts with the <code>cost.view</code> permission can access purchases and stock intake.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-ink flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-accent-ink" strokeWidth={1.5} />
            <span>Purchases &amp; stock receiving</span>
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Receive incoming fragrance oils (in tola, grams, ml, or litres), bottles, and accessories. Updates inventory stock, supplier dues, and cost history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsReceiveModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover transition-colors duration-150 ease-unslop cursor-pointer"
        >
          <Plus className="w-4 h-4" strokeWidth={1.75} />
          <span>Receive New Stock (PO)</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-surface border border-hairline flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-raised border border-hairline flex items-center justify-center text-accent-ink">
            <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs text-ink-muted">
              Total purchases
            </div>
            <div className="text-lg font-medium text-ink font-mono tabular-nums mt-0.5">
              {metrics.count} orders
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-hairline flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-positive/10 border border-positive/25 flex items-center justify-center text-positive">
            <Layers className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs text-ink-muted">
              Total stock-in value
            </div>
            <div className="text-lg font-medium text-positive font-mono tabular-nums mt-0.5">
              ৳{metrics.totalSpent.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-hairline flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-warning/10 border border-warning/25 flex items-center justify-center text-warning">
            <CreditCard className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs text-ink-muted">
              Outstanding supplier due
            </div>
            <div className="text-lg font-medium text-warning font-mono tabular-nums mt-0.5">
              ৳{metrics.totalDue.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-3 bg-surface border border-hairline rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" strokeWidth={1.5} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PO number, supplier, bill"
            className="w-full pl-9 pr-3 py-1.5 bg-raised border border-hairline rounded-lg text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
          />
        </div>

        {/* Supplier Filter */}
        <div className="flex items-center gap-2">
          <span className="text-ink-muted font-medium">Supplier</span>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
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
        <div className="flex items-center gap-1 bg-raised p-1 rounded-lg border border-hairline">
          {(['today', '7days', 'month', 'all'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetChange(preset)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors duration-150 ease-unslop cursor-pointer ${
                datePreset === preset
                  ? 'bg-accent text-accent-fg font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {preset === 'today'
                ? 'Today'
                : preset === '7days'
                ? '7 Days'
                : preset === 'month'
                ? 'This Month'
                : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-surface border border-hairline rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-raised/70 border-b border-hairline text-ink-muted font-medium">
              <tr>
                <th className="py-3 px-4">PO number</th>
                <th className="py-3 px-4">Date &amp; time</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Payment method</th>
                <th className="py-3 px-4 text-right">Total amount</th>
                <th className="py-3 px-4 text-right">Status / paid</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-ink-secondary">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted">
                    Loading purchases…
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    <ShoppingBag className="w-7 h-7 mx-auto text-ink-muted mb-2 opacity-60" strokeWidth={1.5} />
                    <p className="font-medium text-ink-secondary">No purchase records found</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Click Receive New Stock (PO) to record your first inventory shipment
                    </p>
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => handleViewPurchase(p)}
                    className="hover:bg-raised/50 cursor-pointer transition-colors duration-150 ease-unslop"
                  >
                    <td className="py-3 px-4 font-mono tabular-nums font-medium text-ink">
                      {p.purchaseNumber}
                    </td>
                    <td className="py-3 px-4 text-ink-muted text-xs tabular-nums">
                      {formatDhakaDateTime(p.receivedAt)}
                    </td>
                    <td className="py-3 px-4 font-medium text-ink flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-accent-ink shrink-0" strokeWidth={1.5} />
                      <span>{p.supplierName}</span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="capitalize font-medium text-ink-secondary">
                        {p.paymentMethod}
                      </span>
                      {p.referenceNumber && (
                        <span className="text-ink-muted font-mono ml-1">
                          ({p.referenceNumber})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-accent-ink">
                      ৳{p.totalAmountBdt.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.totalAmountBdt > p.paidAmountBdt ? (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-warning/10 text-warning border border-warning/25 font-mono tabular-nums">
                          Due ৳{(p.totalAmountBdt - p.paidAmountBdt).toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-positive/10 text-positive border border-positive/25">
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
                        className="p-1.5 rounded-lg border border-hairline bg-raised text-ink-muted hover:text-ink hover:border-hairline-strong transition-colors duration-150 ease-unslop cursor-pointer"
                        title="View PO Details"
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
