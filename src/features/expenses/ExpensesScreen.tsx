import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Plus,
  Search,
  CreditCard,
  X,
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  Lock,
  Unlock,
} from 'lucide-react';
import { expensesRepo } from '@/data/repositories/expensesRepo';
import { useAppStore } from '@/app/store';
import type { Expense, ExpenseCategory, CashDrawerSummary } from '@/domain/expenses/types';
import { calculateDateRange } from '@/lib/dates';

interface ExpensesScreenProps {
  deviceId: string;
}

export const ExpensesScreen: React.FC<ExpensesScreenProps> = ({ deviceId }) => {
  const { currentUser } = useAppStore();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [drawerSummary, setDrawerSummary] = useState<CashDrawerSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [datePreset, setDatePreset] = useState<'today' | '7days' | 'month' | 'all'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isOpenDrawerOpen, setIsOpenDrawerOpen] = useState(false);
  const [isCloseDrawerOpen, setIsCloseDrawerOpen] = useState(false);

  // Add Expense form
  const [expTitle, setExpTitle] = useState('');
  const [expCategoryId, setExpCategoryId] = useState('');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expMethod, setExpMethod] = useState('cash');
  const [expRef, setExpRef] = useState('');
  const [expNotes, setExpNotes] = useState('');
  const [expSaving, setExpSaving] = useState(false);
  const [expError, setExpError] = useState<string | null>(null);

  // Open Drawer form
  const [openingFloat, setOpeningFloat] = useState<number>(0);
  const [drawerSubmitting, setDrawerSubmitting] = useState(false);

  // Close Drawer form
  const [actualCashCounted, setActualCashCounted] = useState<number>(0);
  const [closeNotes, setCloseNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [expList, catList, drawer] = await Promise.all([
        expensesRepo.getExpenses({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
          searchQuery: searchQuery || undefined,
        }),
        expensesRepo.getCategories(),
        expensesRepo.getCashDrawerSummary(),
      ]);

      setExpenses(expList);
      setCategories(catList);
      setDrawerSummary(drawer);
      if (drawer && drawer.expectedCashInDrawerBdt > 0) {
        setActualCashCounted(drawer.expectedCashInDrawerBdt);
      }
    } catch (err) {
      console.error('Failed to load expenses data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, categoryFilter, searchQuery]);

  // Handle Date Presets
  const handlePresetChange = (preset: 'today' | '7days' | 'month' | 'all') => {
    setDatePreset(preset);
    const bounds = calculateDateRange(preset);
    setStartDate(bounds.startDateStr);
    setEndDate(bounds.endDateStr);
  };

  // Open Add Expense
  const handleOpenAdd = () => {
    setExpTitle('');
    setExpCategoryId(categories[0]?.id || '');
    setExpAmount(0);
    setExpMethod('cash');
    setExpRef('');
    setExpNotes('');
    setExpError(null);
    setIsAddExpenseOpen(true);
  };

  // Submit Expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim()) {
      setExpError('Expense description is required.');
      return;
    }
    if (expAmount <= 0) {
      setExpError('Amount must be greater than zero.');
      return;
    }

    const catName = categories.find((c) => c.id === expCategoryId)?.name || 'General';

    setExpSaving(true);
    setExpError(null);
    try {
      await expensesRepo.createExpense(
        {
          title: expTitle,
          categoryId: expCategoryId || null,
          categoryName: catName,
          amountBdt: Number(expAmount),
          paymentMethod: expMethod,
          referenceNumber: expRef,
          notes: expNotes,
          userId: currentUser?.id || null,
          username: currentUser?.displayName || currentUser?.username || 'Staff',
        },
        deviceId
      );

      setIsAddExpenseOpen(false);
      await loadData();
    } catch (err: unknown) {
      setExpError(err instanceof Error ? err.message : String(err));
    } finally {
      setExpSaving(false);
    }
  };

  // Open Drawer Session
  const handleOpenDrawerSession = async () => {
    if (!currentUser) return;
    setDrawerSubmitting(true);
    try {
      await expensesRepo.openDrawerSession(
        Number(openingFloat) || 0,
        currentUser.id,
        currentUser.displayName || currentUser.username,
        deviceId
      );
      setIsOpenDrawerOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to open drawer session:', err);
    } finally {
      setDrawerSubmitting(false);
    }
  };

  // Close Drawer Session
  const handleCloseDrawerSession = async () => {
    if (!currentUser || !drawerSummary?.sessionId) return;
    setDrawerSubmitting(true);
    try {
      await expensesRepo.closeDrawerSession({
        sessionId: drawerSummary.sessionId,
        actualCashBdt: Number(actualCashCounted),
        expectedCashBdt: drawerSummary.expectedCashInDrawerBdt,
        notes: closeNotes,
        userId: currentUser.id,
        username: currentUser.displayName || currentUser.username,
        deviceId,
      });
      setIsCloseDrawerOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to close drawer session:', err);
    } finally {
      setDrawerSubmitting(false);
    }
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalAmount = expenses.reduce((acc, e) => acc + e.amountBdt, 0);
    const cashExpenses = expenses
      .filter((e) => e.paymentMethod === 'cash')
      .reduce((acc, e) => acc + e.amountBdt, 0);
    const digitalExpenses = totalAmount - cashExpenses;
    return { totalAmount, cashExpenses, digitalExpenses, count: expenses.length };
  }, [expenses]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
            <Wallet className="w-5 h-5 text-brand-gold" />
            <span>Daily Expenses & Cash Drawer</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Track daily operating overheads (rent, tea, bags, utilities) and balance physical counter cash in hand.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {drawerSummary?.isSessionOpen ? (
            <button
              type="button"
              onClick={() => setIsCloseDrawerOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-bold hover:bg-amber-500 hover:text-black transition-all cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Close / Reconcile Drawer</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setOpeningFloat(0);
                setIsOpenDrawerOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-bold hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>Start Cash Drawer Session</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-gold text-brand-black text-xs font-bold hover:bg-brand-gold-light transition-all shadow-md shadow-brand-gold/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Cash Drawer Real-Time Status Card */}
      {drawerSummary && (
        <div className="p-4 rounded-2xl bg-neutral-900 text-white border border-brand-border shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-3 h-3 rounded-full ${
                  drawerSummary.isSessionOpen ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'
                }`}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                {drawerSummary.isSessionOpen
                  ? `Active Drawer Shift (Opened by ${drawerSummary.openedByUsername || 'Staff'})`
                  : 'Cash Drawer Shift Currently Closed'}
              </span>
            </div>

            <div className="text-xs font-mono text-neutral-400">
              {drawerSummary.isSessionOpen && drawerSummary.openedAt && (
                <span>Started: {new Date(drawerSummary.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-3 text-xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-neutral-400">Opening Float</div>
              <div className="text-base font-bold font-mono text-white mt-0.5">
                ৳{drawerSummary.openingCashBdt.toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-400">(+) Cash Sales</div>
              <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                +৳{drawerSummary.cashSalesBdt.toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-400">(+) Due Collected</div>
              <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                +৳{drawerSummary.customerDueCollectedCashBdt.toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-red-400">(-) Cash Expenses</div>
              <div className="text-base font-bold font-mono text-red-400 mt-0.5">
                -৳{drawerSummary.cashExpensesBdt.toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-red-400">(-) Cash Purchases</div>
              <div className="text-base font-bold font-mono text-red-400 mt-0.5">
                -৳{drawerSummary.supplierPurchasesCashBdt.toFixed(2)}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-brand-surface border border-brand-gold/40">
              <div className="text-[10px] uppercase font-bold text-brand-gold">Expected In Drawer</div>
              <div className="text-lg font-bold font-mono text-brand-gold mt-0.5">
                ৳{drawerSummary.expectedCashInDrawerBdt.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              Total Expenses ({datePreset})
            </div>
            <div className="text-lg font-bold text-neutral-900 dark:text-white font-mono mt-0.5">
              ৳{metrics.totalAmount.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              Paid From Cash Drawer
            </div>
            <div className="text-lg font-bold text-neutral-900 dark:text-white font-mono mt-0.5">
              ৳{metrics.cashExpenses.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              Digital / Bank Transfers
            </div>
            <div className="text-lg font-bold text-blue-400 font-mono mt-0.5">
              ৳{metrics.digitalExpenses.toFixed(2)}
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
            placeholder="Search description, reference, notes..."
            className="w-full pl-9 pr-3 py-1.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <span className="text-neutral-400 font-medium">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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

      {/* Expenses Table */}
      <div className="bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-brand-black/60 border-b border-neutral-200 dark:border-brand-border text-neutral-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Description / Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Paid Via</th>
                <th className="py-3 px-4">Recorded By</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-brand-border text-neutral-700 dark:text-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-400">
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    <Wallet className="w-8 h-8 mx-auto text-neutral-500 mb-2 opacity-50" />
                    <p className="font-semibold text-neutral-300">No expenses recorded</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Click "Record Expense" to log overhead, refreshments, or bills.
                    </p>
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3 px-4 text-neutral-400 text-[11px] font-mono">
                      {new Date(e.expenseDate).toLocaleDateString()} &bull;{' '}
                      {new Date(e.expenseDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                      <div>{e.title}</div>
                      {e.referenceNumber && (
                        <div className="text-[10px] text-neutral-400 font-mono font-normal">
                          Ref: {e.referenceNumber}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-brand-black border border-neutral-300 dark:border-brand-border text-neutral-300">
                        {e.categoryName}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[11px]">
                      <span className="uppercase font-semibold text-neutral-300">
                        {e.paymentMethod === 'cash' ? '💵 Cash Drawer' : e.paymentMethod}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-neutral-400 text-[11px]">
                      {e.createdByUsername || 'Staff'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-red-400 text-sm">
                      ৳{e.amountBdt.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================== */}
      {/* RECORD EXPENSE MODAL                                 */}
      {/* ==================================================== */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-200 dark:border-brand-border">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-brand-gold" />
                <span>Record Store Expense</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(false)}
                className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {expError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
                {expError}
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                  Expense Description <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="e.g. Afternoon tea & biscuits for guests, Carry bags"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                    Category
                  </label>
                  <select
                    value={expCategoryId}
                    onChange={(e) => setExpCategoryId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                    Amount (৳) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={expAmount || ''}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    placeholder="e.g. 150"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white font-mono font-bold text-red-400 focus:outline-none focus:border-brand-gold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                    Payment Source
                  </label>
                  <select
                    value={expMethod}
                    onChange={(e) => setExpMethod(e.target.value)}
                    className="w-full px-2.5 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white uppercase font-semibold text-xs focus:outline-none focus:border-brand-gold"
                  >
                    <option value="cash">Cash in Drawer</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                    Voucher / Slip Ref #
                  </label>
                  <input
                    type="text"
                    value={expRef}
                    onChange={(e) => setExpRef(e.target.value)}
                    placeholder="e.g. VCH-001"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  placeholder="Optional details"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-brand-border">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-brand-border text-xs text-neutral-600 dark:text-neutral-400 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expSaving}
                  className="px-5 py-2 rounded-xl bg-brand-gold text-brand-black font-extrabold text-xs hover:bg-brand-gold-light transition-all shadow-md shadow-brand-gold/20 disabled:opacity-50 cursor-pointer"
                >
                  {expSaving ? 'Saving...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* START DRAWER SESSION MODAL                           */}
      {/* ==================================================== */}
      {isOpenDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-brand-surface border border-emerald-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Start Day's Cash Drawer</h3>
                <p className="text-[11px] text-neutral-400">Enter morning opening float in drawer.</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">
                  Opening Cash Float (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={openingFloat || ''}
                  onChange={(e) => setOpeningFloat(Number(e.target.value))}
                  placeholder="e.g. 2000"
                  className="w-full px-3 py-2.5 bg-brand-black border border-brand-border rounded-xl text-white font-mono font-bold text-lg text-emerald-400 focus:outline-none focus:border-brand-gold"
                />
                <p className="text-[10px] text-neutral-500 mt-1">
                  Cash already inside the counter drawer before any sales today.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-brand-border">
              <button
                type="button"
                onClick={() => setIsOpenDrawerOpen(false)}
                className="px-4 py-2 rounded-xl border border-brand-border text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={drawerSubmitting}
                onClick={handleOpenDrawerSession}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-xs transition-colors shadow cursor-pointer"
              >
                {drawerSubmitting ? 'Starting...' : 'Open Drawer Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* CLOSE / RECONCILE DRAWER SESSION MODAL               */}
      {/* ==================================================== */}
      {isCloseDrawerOpen && drawerSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-brand-surface border border-amber-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-brand-border">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reconcile & Close Cash Drawer</h3>
                <p className="text-[11px] text-neutral-400">Count physical cash and close the day's shift.</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-brand-black/60 border border-brand-border space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-neutral-400">
                  <span>Opening Float:</span>
                  <span>৳{drawerSummary.openingCashBdt.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>(+) Today's Cash Sales:</span>
                  <span>+৳{drawerSummary.cashSalesBdt.toFixed(2)}</span>
                </div>
                {drawerSummary.customerDueCollectedCashBdt > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>(+) Customer Dues Collected:</span>
                    <span>+৳{drawerSummary.customerDueCollectedCashBdt.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-red-400">
                  <span>(-) Cash Expenses:</span>
                  <span>-৳{drawerSummary.cashExpensesBdt.toFixed(2)}</span>
                </div>
                {drawerSummary.supplierPurchasesCashBdt > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>(-) Cash Supplier Purchases:</span>
                    <span>-৳{drawerSummary.supplierPurchasesCashBdt.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-brand-gold pt-1.5 border-t border-brand-border">
                  <span>Expected Counter Cash:</span>
                  <span>৳{drawerSummary.expectedCashInDrawerBdt.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">
                  Counted Physical Cash in Drawer (৳) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={actualCashCounted}
                  onChange={(e) => setActualCashCounted(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-xl text-white font-mono font-bold text-base focus:outline-none focus:border-brand-gold"
                />
              </div>

              {/* Real-time Discrepancy Alert */}
              <div className="p-2.5 rounded-xl border text-xs">
                {Math.abs(actualCashCounted - drawerSummary.expectedCashInDrawerBdt) < 0.01 ? (
                  <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Cash matches expected balance perfectly!</span>
                  </div>
                ) : actualCashCounted < drawerSummary.expectedCashInDrawerBdt ? (
                  <div className="text-red-400 font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      Shortage of ৳{(drawerSummary.expectedCashInDrawerBdt - actualCashCounted).toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="text-amber-400 font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      Overage/Surplus of ৳{(actualCashCounted - drawerSummary.expectedCashInDrawerBdt).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">
                  Shift Closing Notes (Optional)
                </label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="e.g. Evening shift close, cash deposited into locker"
                  className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-xl text-white text-xs focus:outline-none focus:border-brand-gold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-brand-border">
              <button
                type="button"
                onClick={() => setIsCloseDrawerOpen(false)}
                className="px-4 py-2 rounded-xl border border-brand-border text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={drawerSubmitting}
                onClick={handleCloseDrawerSession}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors shadow cursor-pointer"
              >
                {drawerSubmitting ? 'Closing...' : 'Close & Lock Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
