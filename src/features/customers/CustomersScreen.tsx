import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Edit2,
  Trash2,
  Eye,
  X,
  ShoppingBag,
  Receipt,
  Download,
} from 'lucide-react';
import { customersRepo } from '@/data/repositories/customersRepo';
import { useAppStore } from '@/app/store';
import { downloadCsv } from '@/features/reports/reportsUtils';
import { MetricCard } from '@/components/ui';
import { formatBdtAmount } from '@/lib/money';
import type { Customer, CustomerPayment, CustomerSaleSummary } from '@/domain/customers/types';

interface CustomersScreenProps {
  deviceId: string;
}

export const CustomersScreen: React.FC<CustomersScreenProps> = ({ deviceId }) => {
  const { currentUser, showToast } = useAppStore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDueOnly, setFilterDueOnly] = useState(false);

  // Add / Edit Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  // Customer Profile & History Modal state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState<{
    customer: Customer;
    sales: CustomerSaleSummary[];
    payments: CustomerPayment[];
  } | null>(null);

  // Collect Due Payment Modal state
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('cash');
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await customersRepo.getCustomers({
        search: search || undefined,
        onlyWithDues: filterDueOnly,
      });
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search, filterDueOnly]);

  // Open Details Modal
  const handleOpenDetails = async (cust: Customer) => {
    setSelectedCustomerId(cust.id);
    try {
      const res = await customersRepo.getCustomerDetails(cust.id);
      setCustomerDetails(res);
    } catch (err) {
      console.error('Failed to load customer details:', err);
    }
  };

  // Open Add Modal
  const openAddModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormNotes('');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormPhone(c.phone);
    setFormEmail(c.email || '');
    setFormAddress(c.address || '');
    setFormNotes(c.notes || '');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Save Customer (Add or Edit)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      setFormError('Name and Phone number are required.');
      return;
    }

    setFormSaving(true);
    setFormError(null);
    try {
      if (editingCustomer) {
        await customersRepo.updateCustomer(
          {
            id: editingCustomer.id,
            name: formName,
            phone: formPhone,
            email: formEmail,
            address: formAddress,
            notes: formNotes,
          },
          deviceId
        );
      } else {
        await customersRepo.createCustomer(
          {
            name: formName,
            phone: formPhone,
            email: formEmail,
            address: formAddress,
            notes: formNotes,
          },
          deviceId
        );
      }
      setIsFormModalOpen(false);
      await loadCustomers();
      if (selectedCustomerId) {
        const updated = await customersRepo.getCustomerDetails(selectedCustomerId);
        setCustomerDetails(updated);
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormSaving(false);
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove customer "${name}"?`)) {
      return;
    }
    try {
      await customersRepo.deleteCustomer(id, deviceId);
      await loadCustomers();
      if (selectedCustomerId === id) setSelectedCustomerId(null);
    } catch (err) {
      console.error('Failed to delete customer:', err);
    }
  };

  // Open Collect Due Modal
  const openPayDueModal = (cust: Customer) => {
    setPayingCustomer(cust);
    setPayAmount(cust.dueBalanceBdt);
    setPayMethod('cash');
    setPayReference('');
    setPayNotes('');
    setPayError(null);
  };

  // Submit Due Payment
  const handleExecutePayment = async () => {
    if (!payingCustomer) return;
    if (payAmount <= 0) {
      setPayError('Payment amount must be greater than zero.');
      return;
    }

    setPaySubmitting(true);
    setPayError(null);
    try {
      await customersRepo.recordDuePayment({
        customerId: payingCustomer.id,
        amountBdt: Number(payAmount),
        paymentMethod: payMethod,
        referenceNumber: payReference,
        notes: payNotes,
        receivedByUserId: currentUser?.id || null,
        receivedByUsername: currentUser?.displayName || currentUser?.username || 'Cashier',
        deviceId,
      });

      setPayingCustomer(null);
      await loadCustomers();

      if (selectedCustomerId === payingCustomer.id) {
        const updated = await customersRepo.getCustomerDetails(payingCustomer.id);
        setCustomerDetails(updated);
      }
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : String(err));
    } finally {
      setPaySubmitting(false);
    }
  };

  // Export Customer Database state & handler
  const [exporting, setExporting] = useState(false);

  const handleExportCustomers = async () => {
    try {
      setExporting(true);
      const allCustomers = await customersRepo.getCustomers();
      const headers = [
        'Customer Name',
        'Phone Number',
        'Email',
        'Address / Location',
        'Notes',
        'Total Orders',
        'Lifetime Spend (BDT)',
        'Outstanding Due Balance (BDT)',
        'Last Order Date',
        'Registration Date',
      ];
      const rows = allCustomers.map((c) => [
        c.name,
        c.phone,
        c.email || '',
        c.address || '',
        c.notes || '',
        c.totalOrders,
        c.totalSpentBdt,
        c.dueBalanceBdt,
        c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString() : 'Never',
        new Date(c.createdAt).toLocaleDateString(),
      ]);

      const filename = `rauhaah_customers_${new Date().toISOString().slice(0, 10)}`;
      const res = await downloadCsv(filename, headers, rows);
      if (res.success) {
        showToast({
          message: `Customer database exported successfully (${allCustomers.length} customers)! Saved to Downloads folder.`,
          filePath: res.path,
          type: 'success',
        });
      }
    } catch (err) {
      console.error('Failed to export customer database:', err);
    } finally {
      setExporting(false);
    }
  };

  // KPI Metrics Summary
  const metrics = useMemo(() => {
    const totalSpent = customers.reduce((acc, c) => acc + c.totalSpentBdt, 0);
    const totalDue = customers.reduce((acc, c) => acc + c.dueBalanceBdt, 0);
    const withDueCount = customers.filter((c) => c.dueBalanceBdt > 0.01).length;
    return { count: customers.length, totalSpent, totalDue, withDueCount };
  }, [customers]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-brand-gold" />
            <span>Customers & Credit Ledger</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Directory of registered retail and wholesale customers, order histories, and outstanding credit receivables.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCustomers}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface text-neutral-800 dark:text-neutral-200 text-xs font-semibold hover:border-brand-gold/50 hover:text-brand-gold transition-colors cursor-pointer disabled:opacity-50"
            title="Download full customer database as CSV"
          >
            <Download className="w-4 h-4 text-brand-gold" />
            <span>{exporting ? 'Exporting...' : 'Export Customers (CSV)'}</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-gold text-brand-black text-xs font-bold hover:bg-brand-gold-light transition-all shadow-md shadow-brand-gold/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Customer</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Total Customers"
          value={`${metrics.count} Profiles`}
          icon={<UserCheck className="w-4 h-4" />}
          subtitle="Registered customer database"
        />

        <MetricCard
          label="Customer Lifetime Sales"
          value={formatBdtAmount(metrics.totalSpent)}
          icon={<ShoppingBag className="w-4 h-4" />}
          subtitle="Accumulated billed revenue"
        />

        <MetricCard
          label="Outstanding Receivables (Dues)"
          value={formatBdtAmount(metrics.totalDue)}
          icon={<CreditCard className="w-4 h-4" />}
          subtitle={`${metrics.withDueCount} accounts with pending balance`}
          highlight={metrics.totalDue > 0}
        />
      </div>

      {/* Filters Bar */}
      <div className="p-3 bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, phone, or email..."
            className="w-full pl-9 pr-3 py-1.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-brand-black/80 p-1 rounded-xl border border-neutral-200 dark:border-brand-border">
          <button
            type="button"
            onClick={() => setFilterDueOnly(false)}
            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              !filterDueOnly
                ? 'bg-brand-gold text-brand-black shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            All Customers ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterDueOnly(true)}
            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              filterDueOnly
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Has Due Balance
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-brand-black/60 border-b border-neutral-200 dark:border-brand-border text-neutral-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Address / Info</th>
                <th className="py-3 px-4 text-center">Orders</th>
                <th className="py-3 px-4 text-right">Lifetime Spent</th>
                <th className="py-3 px-4 text-right">Due Balance</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-brand-border text-neutral-700 dark:text-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <UserCheck className="w-8 h-8 mx-auto text-neutral-500 mb-2 opacity-50" />
                    <p className="font-semibold text-neutral-300">No customers found</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {search ? 'Try different search keywords.' : 'Add a customer or complete a sale at POS to record one.'}
                    </p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleOpenDetails(c)}
                    className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold font-bold text-xs shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{c.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-medium text-neutral-900 dark:text-white">
                      {c.phone}
                    </td>

                    <td className="py-3 px-4 text-neutral-400 text-[11px] max-w-xs truncate">
                      {c.address || c.email || (
                        <span className="italic text-neutral-500">None specified</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-bold text-neutral-300">
                      {c.totalOrders}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 dark:text-white">
                      ৳{c.totalSpentBdt.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {c.dueBalanceBdt > 0.01 ? (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono">
                          Due ৳{c.dueBalanceBdt.toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                          Clear
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        {c.dueBalanceBdt > 0.01 && (
                          <button
                            type="button"
                            onClick={() => openPayDueModal(c)}
                            className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] shadow transition-colors"
                            title="Collect Due Payment"
                          >
                            Collect Due
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenDetails(c)}
                          className="p-1.5 rounded-lg border border-neutral-200 dark:border-brand-border text-neutral-400 hover:text-white hover:border-brand-gold transition-colors"
                          title="View History & Invoices"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="p-1.5 rounded-lg border border-neutral-200 dark:border-brand-border text-neutral-400 hover:text-brand-gold hover:border-brand-gold transition-colors"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCustomer(c.id, c.name)}
                          className="p-1.5 rounded-lg border border-neutral-200 dark:border-brand-border text-neutral-400 hover:text-red-400 hover:border-red-400/40 transition-colors"
                          title="Delete Customer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================== */}
      {/* CUSTOMER PROFILE & HISTORY MODAL                     */}
      {/* ==================================================== */}
      {selectedCustomerId && customerDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-2xl shadow-2xl p-6 space-y-4 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-start pb-3 border-b border-neutral-200 dark:border-brand-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold font-bold text-base">
                  {customerDetails.customer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    {customerDetails.customer.name}
                  </h3>
                  <div className="text-xs text-neutral-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                    <span className="font-mono flex items-center gap-1">
                      <Phone className="w-3 h-3 text-brand-gold" />
                      {customerDetails.customer.phone}
                    </span>
                    {customerDetails.customer.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-brand-gold" />
                        {customerDetails.customer.email}
                      </span>
                    )}
                    {customerDetails.customer.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-brand-gold" />
                        {customerDetails.customer.address}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomerId(null)}
                className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0 text-xs">
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-brand-black/60 border border-neutral-200 dark:border-brand-border">
                <div className="text-[10px] uppercase font-bold text-neutral-400">Total Orders</div>
                <div className="text-base font-bold font-mono text-neutral-900 dark:text-white mt-0.5">
                  {customerDetails.customer.totalOrders} Invoices
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-brand-black/60 border border-neutral-200 dark:border-brand-border">
                <div className="text-[10px] uppercase font-bold text-neutral-400">Lifetime Purchased</div>
                <div className="text-base font-bold font-mono text-emerald-500 mt-0.5">
                  ৳{customerDetails.customer.totalSpentBdt.toFixed(2)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-brand-black/60 border border-neutral-200 dark:border-brand-border flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-neutral-400">Due Balance</div>
                  <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
                    ৳{customerDetails.customer.dueBalanceBdt.toFixed(2)}
                  </div>
                </div>
                {customerDetails.customer.dueBalanceBdt > 0.01 && (
                  <button
                    type="button"
                    onClick={() => openPayDueModal(customerDetails.customer)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-extrabold text-[11px] shadow hover:bg-amber-400 transition-colors"
                  >
                    Collect Due
                  </button>
                )}
              </div>
            </div>

            {/* Content Body: Invoices History & Settlements */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {/* Invoices List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-brand-gold" />
                  <span>Purchase Invoices ({customerDetails.sales.length})</span>
                </h4>

                {customerDetails.sales.length === 0 ? (
                  <div className="p-4 text-center text-neutral-500 border border-dashed border-neutral-300 dark:border-brand-border rounded-xl">
                    No sales recorded for this customer yet.
                  </div>
                ) : (
                  <div className="border border-neutral-200 dark:border-brand-border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-100 dark:bg-brand-black/80 text-neutral-500 text-[10px] uppercase font-bold">
                        <tr>
                          <th className="py-2 px-3">Invoice #</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Payment</th>
                          <th className="py-2 px-3 text-right">Total</th>
                          <th className="py-2 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-brand-border/40 text-[11px]">
                        {customerDetails.sales.map((s) => (
                          <tr key={s.id}>
                            <td className="py-2 px-3 font-mono font-bold text-neutral-900 dark:text-white">
                              {s.invoiceNumber}
                            </td>
                            <td className="py-2 px-3 text-neutral-400">
                              {new Date(s.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-2 px-3 uppercase text-neutral-300">
                              {s.paymentMethod}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-brand-gold">
                              ৳{s.totalAmountBdt.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {s.dueAmountBdt > 0.01 ? (
                                <span className="text-amber-400 font-bold">
                                  Due ৳{s.dueAmountBdt.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-bold">Paid</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Payments History */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-brand-gold" />
                  <span>Due Settlements & Payments Received ({customerDetails.payments.length})</span>
                </h4>

                {customerDetails.payments.length === 0 ? (
                  <div className="p-4 text-center text-neutral-500 border border-dashed border-neutral-300 dark:border-brand-border rounded-xl">
                    No separate due settlements recorded yet.
                  </div>
                ) : (
                  <div className="border border-neutral-200 dark:border-brand-border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-100 dark:bg-brand-black/80 text-neutral-500 text-[10px] uppercase font-bold">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3">Received By</th>
                          <th className="py-2 px-3">Ref / Notes</th>
                          <th className="py-2 px-3 text-right">Amount Collected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-brand-border/40 text-[11px]">
                        {customerDetails.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 px-3 text-neutral-400">
                              {new Date(p.createdAt).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 uppercase text-white font-semibold">
                              {p.paymentMethod}
                            </td>
                            <td className="py-2 px-3 text-neutral-300">
                              {p.receivedByUsername || 'Cashier'}
                            </td>
                            <td className="py-2 px-3 text-neutral-400 italic">
                              {p.referenceNumber ? `Ref: ${p.referenceNumber}` : p.notes || '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                              ৳{p.amountBdt.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-neutral-200 dark:border-brand-border flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCustomerId(null)}
                className="px-5 py-2 rounded-xl bg-brand-gold text-brand-black font-extrabold text-xs hover:bg-brand-gold-light transition-all shadow cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* COLLECT DUE PAYMENT MODAL                            */}
      {/* ==================================================== */}
      {payingCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-brand-surface border border-brand-gold/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-brand-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Collect Customer Due</h3>
                  <p className="text-[11px] text-neutral-400">For {payingCustomer.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayingCustomer(null)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {payError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
                {payError}
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-brand-black/60 border border-brand-border flex justify-between items-center">
                <span className="text-neutral-400">Outstanding Due Balance</span>
                <span className="font-mono text-base font-bold text-amber-400">
                  ৳{payingCustomer.dueBalanceBdt.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">
                  Amount Paying Now (৳) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={payingCustomer.dueBalanceBdt}
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-xl text-white font-mono font-bold text-base text-emerald-400 focus:outline-none focus:border-brand-gold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-xl text-white font-semibold uppercase text-xs focus:outline-none focus:border-brand-gold"
                >
                  <option value="cash">Cash in Hand</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="card">Debit / Credit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">
                  Reference # (e.g. bKash TrxID / Bank Slip)
                </label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="Optional reference"
                  className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-xl text-white text-xs font-mono focus:outline-none focus:border-brand-gold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Partial cash payment at shop"
                  className="w-full px-3 py-2 bg-brand-black border border-brand-border rounded-xl text-white text-xs focus:outline-none focus:border-brand-gold"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-brand-border flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayingCustomer(null)}
                className="px-4 py-2 rounded-xl border border-brand-border text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={paySubmitting || payAmount <= 0}
                onClick={handleExecutePayment}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-xs transition-colors shadow disabled:opacity-50 cursor-pointer"
              >
                {paySubmitting ? 'Recording...' : `Confirm Payment (৳${payAmount})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ADD / EDIT CUSTOMER MODAL                            */}
      {/* ==================================================== */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-200 dark:border-brand-border">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-brand-gold" />
                <span>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                  Customer Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Tanvir Ahmed"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="017... / 018..."
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="tanvir@example.com"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                  Address / City (Optional)
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. Dhanmondi, Dhaka"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                  Notes / Fragrance Preferences
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Prefers white musk & fresh oudh, regular wholesale buyer"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-brand-border">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-brand-border text-xs text-neutral-600 dark:text-neutral-400 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2 rounded-xl bg-brand-gold text-brand-black font-bold text-xs hover:bg-brand-gold-light transition-all shadow-md shadow-brand-gold/20 disabled:opacity-50 cursor-pointer"
                >
                  {formSaving ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
