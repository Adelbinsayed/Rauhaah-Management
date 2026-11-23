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
  ShieldAlert,
  Unlock,
} from 'lucide-react';
import { expensesRepo } from '@/data/repositories/expensesRepo';
import { useAppStore } from '@/app/store';
import { canViewProfit } from '@/domain/auth/permissions';
import type { Expense, ExpenseCategory, CashDrawerSummary } from '@/domain/expenses/types';
import { calculateDateRange, formatDhakaDate, formatDhakaDateTime } from '@/lib/dates';

const PRESET_LABELS: Record<'today' | '7days' | 'month' | 'all', string> = {
  today: 'Today',
  '7days': '7 Days',
  month: 'This Month',
  all: 'All Time',
};

interface ExpensesScreenProps {
  deviceId: string;
}

export const ExpensesScreen: React.FC<ExpensesScreenProps> = ({ deviceId }) => {
  const { currentUser, permissions, showToast } = useAppStore();
  const allowProfit = canViewProfit(permissions);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [drawerSummary, setDrawerSummary] = useState<CashDrawerSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [datePreset, setDatePreset] = useState<'today' | '7days' | 'month' | 'all'>('month');
  const [initialMonthRange] = useState(() => calculateDateRange('month'));
  const [startDate, setStartDate] = useState(initialMonthRange.startDateStr);
  const [endDate, setEndDate] = useState(initialMonthRange.endDateStr);

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
    if (!allowProfit) {
      setLoading(false);
      return;
    }
    loadData();
  }, [startDate, endDate, categoryFilter, searchQuery, allowProfit]);

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
    if (!Number.isFinite(expAmount) || expAmount <= 0) {
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
    if (!currentUser || drawerSubmitting) return;
    const floatVal = Number(openingFloat);
    if (!Number.isFinite(floatVal) || floatVal < 0) {
      showToast({ type: 'error', message: 'Opening cash float must be zero or positive.' });
      return;
    }
    setDrawerSubmitting(true);
    try {
      await expensesRepo.openDrawerSession(
        floatVal,
        currentUser.id,
        currentUser.displayName || currentUser.username,
        deviceId
      );
      setIsOpenDrawerOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to open drawer session:', err);
      showToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to open drawer session.',
      });
    } finally {
      setDrawerSubmitting(false);
    }
  };

  // Close Drawer Session
  const handleCloseDrawerSession = async () => {
    if (!currentUser || !drawerSummary?.sessionId || drawerSubmitting) return;
    const actualVal = Number(actualCashCounted);
    if (!Number.isFinite(actualVal) || actualVal < 0) {
      showToast({ type: 'error', message: 'Counted cash must be zero or positive.' });
      return;
    }
    setDrawerSubmitting(true);
    try {
      await expensesRepo.closeDrawerSession({
        sessionId: drawerSummary.sessionId,
        actualCashBdt: actualVal,
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
      showToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to close drawer session.',
      });
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

  if (!allowProfit) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-negative/15 border border-negative/25 text-negative flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-semibold text-ink">Access Denied</h2>
        <p className="text-xs text-ink-secondary mt-1">
          Only accounts with the <code>profit.view</code> permission can access daily expenses and cash drawer reconciliation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-ink flex items-center gap-2.5">
            <Wallet className="w-5 h-5 text-accent-ink" strokeWidth={1.5} />
            <span>Daily expenses &amp; cash drawer</span>
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Track daily operating overheads (rent, refreshments, bags, utilities) and balance physical counter cash in hand
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {drawerSummary?.isSessionOpen ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  const latest = await expensesRepo.getCashDrawerSummary();
                  setDrawerSummary(latest);
                  setActualCashCounted(latest.expectedCashInDrawerBdt);
                } catch {}
                setIsCloseDrawerOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-warning/35 bg-warning/10 text-warning text-xs font-medium hover:bg-warning hover:text-accent-fg transition-colors duration-150 ease-unslop cursor-pointer"
            >
              <Lock className="w-4 h-4" strokeWidth={1.5} />
              <span>Close / Reconcile Drawer</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setOpeningFloat(0);
                setIsOpenDrawerOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-positive/35 bg-positive/10 text-positive text-xs font-medium hover:bg-positive hover:text-white transition-colors duration-150 ease-unslop cursor-pointer"
            >
              <Unlock className="w-4 h-4" strokeWidth={1.5} />
              <span>Start Cash Drawer Session</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover transition-colors duration-150 ease-unslop cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Cash Drawer Real-Time Status Card */}
      {drawerSummary && (
        <div className="p-4 rounded-xl bg-surface text-ink border border-hairline">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-hairline">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  drawerSummary.isSessionOpen ? 'bg-positive' : 'bg-ink-muted/50'
                }`}
              />
              <span className="text-xs font-medium text-ink-secondary">
                {drawerSummary.isSessionOpen
                  ? `Active drawer shift (opened by ${drawerSummary.openedByUsername || 'Staff'})`
                  : 'Cash drawer shift currently closed'}
              </span>
            </div>

            <div className="text-xs font-mono text-ink-muted tabular-nums">
              {drawerSummary.isSessionOpen && drawerSummary.openedAt && (
                <span>Started {formatDhakaDateTime(drawerSummary.openedAt)}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-3 text-xs items-center">
            <div>
              <div className="text-xs text-ink-muted">Opening float</div>
              <div className="text-base font-medium font-mono tabular-nums text-ink mt-0.5">
                ৳{drawerSummary.openingCashBdt.toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-xs text-positive">+ Cash sales</div>
              <div className="text-base font-medium font-mono tabular-nums text-positive mt-0.5">
                +৳{drawerSummary.cashSalesBdt.toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-xs text-positive">+ Due collected</div>
              <div className="text-base font-medium font-mono tabular-nums text-positive mt-0.5">
                +৳{drawerSummary.customerDueCollectedCashBdt.toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-xs text-negative">− Cash expenses</div>
              <div className="text-base font-medium font-mono tabular-nums text-negative mt-0.5">
                -৳{drawerSummary.cashExpensesBdt.toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-xs text-negative">− Cash purchases</div>
              <div className="text-base font-medium font-mono tabular-nums text-negative mt-0.5">
                -৳{drawerSummary.supplierPurchasesCashBdt.toFixed(2)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-raised border border-accent/30">
              <div className="text-xs font-medium text-accent-ink">Expected in drawer</div>
              <div className="text-lg font-medium font-mono tabular-nums text-accent-ink mt-0.5">
                ৳{drawerSummary.expectedCashInDrawerBdt.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-surface border border-hairline flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-negative/10 border border-negative/25 flex items-center justify-center text-negative">
            <TrendingDown className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs text-ink-muted">
              Total expenses ({PRESET_LABELS[datePreset]})
            </div>
            <div className="text-lg font-medium text-ink font-mono tabular-nums mt-0.5">
              ৳{metrics.totalAmount.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-hairline flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-raised border border-hairline flex items-center justify-center text-accent-ink">
            <Wallet className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs text-ink-muted">
              Paid from cash drawer
            </div>
            <div className="text-lg font-medium text-ink font-mono tabular-nums mt-0.5">
              ৳{metrics.cashExpenses.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-hairline flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-raised border border-hairline flex items-center justify-center text-ink-secondary">
            <CreditCard className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs text-ink-muted">
              Digital / bank transfers
            </div>
            <div className="text-lg font-medium text-ink font-mono tabular-nums mt-0.5">
              ৳{metrics.digitalExpenses.toFixed(2)}
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
            placeholder="Search description, reference, notes"
            className="w-full pl-9 pr-3 py-1.5 bg-raised border border-hairline rounded-lg text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <span className="text-ink-muted font-medium">Category</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
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
              {PRESET_LABELS[preset]}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-surface border border-hairline rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-raised/70 border-b border-hairline text-ink-muted font-medium">
              <tr>
                <th className="py-3 px-4">Date &amp; time</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Paid via</th>
                <th className="py-3 px-4">Recorded by</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-ink-secondary">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted">
                    Loading expenses…
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ink-muted">
                    <Wallet className="w-7 h-7 mx-auto text-ink-muted mb-2 opacity-60" strokeWidth={1.5} />
                    <p className="font-medium text-ink-secondary">No expenses recorded</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Click Record Expense to log overhead, refreshments, or bills
                    </p>
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-raised/50 transition-colors duration-150 ease-unslop">
                    <td className="py-3 px-4 text-ink-muted text-xs font-mono tabular-nums">
                      {e.expenseDate.length <= 10
                        ? formatDhakaDate(e.expenseDate)
                        : formatDhakaDateTime(e.expenseDate)}
                    </td>

                    <td className="py-3 px-4 font-medium text-ink">
                      <div>{e.title}</div>
                      {e.referenceNumber && (
                        <div className="text-[11px] text-ink-muted font-mono font-normal">
                          Ref {e.referenceNumber}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-raised border border-hairline text-ink-secondary">
                        {e.categoryName}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-xs">
                      <span className="capitalize font-medium text-ink-secondary">
                        {e.paymentMethod === 'cash' ? 'Cash drawer' : e.paymentMethod}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-ink-muted text-xs">
                      {e.createdByUsername || 'Staff'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-negative text-sm">
                      ৳{e.amountBdt.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD EXPENSE MODAL */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-hairline">
              <h3 className="text-base font-medium text-ink flex items-center gap-2">
                <Wallet className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
                <span>Record store expense</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(false)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-raised cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {expError && (
              <div className="p-2.5 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs">
                {expError}
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Expense description <span className="text-negative">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="Carry bags, refreshments, utilities"
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink-secondary mb-1">
                    Category
                  </label>
                  <select
                    value={expCategoryId}
                    onChange={(e) => setExpCategoryId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-raised border border-hairline rounded-lg text-ink focus:outline-none focus:border-accent text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-ink-secondary mb-1">
                    Amount (৳) <span className="text-negative">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={expAmount || ''}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    placeholder="150"
                    className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg font-mono tabular-nums font-medium text-negative focus:outline-none focus:border-accent text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink-secondary mb-1">
                    Payment source
                  </label>
                  <select
                    value={expMethod}
                    onChange={(e) => setExpMethod(e.target.value)}
                    className="w-full px-2.5 py-2 bg-raised border border-hairline rounded-lg text-ink text-xs focus:outline-none focus:border-accent"
                  >
                    <option value="cash">Cash in Drawer</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-ink-secondary mb-1">
                    Voucher / slip ref
                  </label>
                  <input
                    type="text"
                    value={expRef}
                    onChange={(e) => setExpRef(e.target.value)}
                    placeholder="VCH-001"
                    className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  placeholder="Optional details"
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 py-2 rounded-lg border border-hairline bg-raised text-xs text-ink-secondary hover:text-ink font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expSaving}
                  className="px-5 py-2 rounded-lg bg-accent text-accent-fg font-semibold text-xs hover:bg-accent-hover transition-colors duration-150 ease-unslop disabled:opacity-50 cursor-pointer"
                >
                  {expSaving ? 'Saving…' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* START DRAWER SESSION MODAL */}
      {isOpenDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
          <div className="w-full max-w-sm bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-positive/10 border border-positive/25 flex items-center justify-center text-positive">
                <Unlock className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-base font-medium text-ink">Start day cash drawer</h3>
                <p className="text-xs text-ink-muted">Enter morning opening float in drawer</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Opening cash float (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={openingFloat || ''}
                  onChange={(e) => setOpeningFloat(Number(e.target.value))}
                  placeholder="2000"
                  className="w-full px-3 py-2.5 bg-raised border border-hairline rounded-lg font-mono tabular-nums font-medium text-lg text-positive focus:outline-none focus:border-accent"
                />
                <p className="text-xs text-ink-muted mt-1.5">
                  Cash already inside the counter drawer before any sales today
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
              <button
                type="button"
                onClick={() => setIsOpenDrawerOpen(false)}
                className="px-4 py-2 rounded-lg border border-hairline bg-raised text-xs text-ink-secondary hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={drawerSubmitting}
                onClick={handleOpenDrawerSession}
                className="px-5 py-2 rounded-lg bg-positive hover:opacity-90 text-white font-semibold text-xs transition-opacity duration-150 ease-unslop cursor-pointer"
              >
                {drawerSubmitting ? 'Starting…' : 'Open Drawer Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLOSE / RECONCILE DRAWER SESSION MODAL */}
      {isCloseDrawerOpen && drawerSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-hairline">
              <div className="w-9 h-9 rounded-lg bg-warning/10 border border-warning/25 flex items-center justify-center text-warning">
                <Lock className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-base font-medium text-ink">Reconcile &amp; close cash drawer</h3>
                <p className="text-xs text-ink-muted">Count physical cash and close the shift</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-raised border border-hairline space-y-1.5 font-mono tabular-nums text-xs">
                <div className="flex justify-between text-ink-muted">
                  <span>Opening float</span>
                  <span>৳{drawerSummary.openingCashBdt.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-positive">
                  <span>+ Cash sales</span>
                  <span>+৳{drawerSummary.cashSalesBdt.toFixed(2)}</span>
                </div>
                {drawerSummary.customerDueCollectedCashBdt > 0 && (
                  <div className="flex justify-between text-positive">
                    <span>+ Customer dues collected</span>
                    <span>+৳{drawerSummary.customerDueCollectedCashBdt.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-negative">
                  <span>− Cash expenses</span>
                  <span>-৳{drawerSummary.cashExpensesBdt.toFixed(2)}</span>
                </div>
                {drawerSummary.supplierPurchasesCashBdt > 0 && (
                  <div className="flex justify-between text-negative">
                    <span>− Cash supplier purchases</span>
                    <span>-৳{drawerSummary.supplierPurchasesCashBdt.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium text-accent-ink pt-2 border-t border-hairline">
                  <span>Expected counter cash</span>
                  <span>৳{drawerSummary.expectedCashInDrawerBdt.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Counted physical cash in drawer (৳) <span className="text-negative">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={actualCashCounted}
                  onChange={(e) => setActualCashCounted(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink font-mono tabular-nums font-medium text-base focus:outline-none focus:border-accent"
                />
              </div>

              {/* Real-time Discrepancy Alert */}
              <div className="p-2.5 rounded-lg border border-hairline bg-raised/60 text-xs">
                {Math.abs(actualCashCounted - drawerSummary.expectedCashInDrawerBdt) < 0.01 ? (
                  <div className="text-positive font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                    <span>Cash matches expected balance</span>
                  </div>
                ) : actualCashCounted < drawerSummary.expectedCashInDrawerBdt ? (
                  <div className="text-negative font-medium flex items-center gap-1.5 tabular-nums">
                    <AlertCircle className="w-4 h-4" strokeWidth={1.5} />
                    <span>
                      Shortage of ৳{(drawerSummary.expectedCashInDrawerBdt - actualCashCounted).toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="text-warning font-medium flex items-center gap-1.5 tabular-nums">
                    <AlertCircle className="w-4 h-4" strokeWidth={1.5} />
                    <span>
                      Surplus of ৳{(actualCashCounted - drawerSummary.expectedCashInDrawerBdt).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Shift closing notes (optional)
                </label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Evening shift close, cash deposited into locker"
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted text-xs focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
              <button
                type="button"
                onClick={() => setIsCloseDrawerOpen(false)}
                className="px-4 py-2 rounded-lg border border-hairline bg-raised text-xs text-ink-secondary hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={drawerSubmitting}
                onClick={handleCloseDrawerSession}
                className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs transition-colors duration-150 ease-unslop cursor-pointer"
              >
                {drawerSubmitting ? 'Closing…' : 'Close & Lock Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
