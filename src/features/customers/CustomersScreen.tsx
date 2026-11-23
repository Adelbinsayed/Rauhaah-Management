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
import { canManageUsers, hasPermission } from '@/domain/auth/permissions';
import { downloadCsv } from '@/features/reports/reportsUtils';
import { MetricCard } from '@/components/ui';
import { formatDhakaDate, formatDhakaDateTime, getTodayDateString } from '@/lib/dates';
import { formatBdtAmount } from '@/lib/money';
import type { Customer, CustomerPayment, CustomerSaleSummary } from '@/domain/customers/types';

interface CustomersScreenProps {
  deviceId: string;
}

export const CustomersScreen: React.FC<CustomersScreenProps> = ({ deviceId }) => {
  const { currentUser, permissions, shopSettings, showToast } = useAppStore();
  const canDeleteCustomer =
    hasPermission(permissions, 'stock.adjust') || canManageUsers(permissions);

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
  const handleDeleteCustomer = async (cust: Customer) => {
    if (!canDeleteCustomer) return;
    if (cust.dueBalanceBdt > 0.01) {
      showToast({
        type: 'error',
        message: `Cannot delete customer with an unpaid due balance of ৳${cust.dueBalanceBdt.toFixed(2)}.`,
      });
      return;
    }
    if (!window.confirm(`Are you sure you want to remove customer "${cust.name}"?`)) {
      return;
    }
    try {
      await customersRepo.deleteCustomer(cust.id, deviceId);
      await loadCustomers();
      if (selectedCustomerId === cust.id) setSelectedCustomerId(null);
    } catch (err) {
      console.error('Failed to delete customer:', err);
      showToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete customer.',
      });
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
    if (paySubmitting || !payingCustomer) return;
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      setPayError('Payment amount must be greater than zero.');
      return;
    }
    if (payAmount > payingCustomer.dueBalanceBdt + 0.001) {
      setPayError(
        `Payment amount cannot exceed due balance of ৳${payingCustomer.dueBalanceBdt.toFixed(2)}.`
      );
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
        c.lastOrderDate ? formatDhakaDate(c.lastOrderDate) : 'Never',
        formatDhakaDate(c.createdAt),
      ]);

      const shopSlug =
        (shopSettings?.shopName || 'shop')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '') || 'shop';
      const filename = `${shopSlug}_customers_${getTodayDateString()}`;
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
          <h2 className="text-xl font-medium text-ink flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-accent-ink" strokeWidth={1.5} />
            <span>Customers &amp; credit ledger</span>
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Directory of registered retail and wholesale customers, order histories, and outstanding credit receivables
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCustomers}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-hairline bg-surface text-ink-secondary text-xs font-medium hover:border-hairline-strong hover:text-ink transition-colors duration-150 ease-unslop cursor-pointer disabled:opacity-50"
            title="Download full customer database as CSV"
          >
            <Download className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
            <span>{exporting ? 'Exporting…' : 'Export Customers (CSV)'}</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover transition-colors duration-150 ease-unslop cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            <span>Add New Customer</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Total customers"
          value={`${metrics.count} profiles`}
          icon={<UserCheck className="w-4 h-4" strokeWidth={1.5} />}
          subtitle="Registered customer directory"
        />

        <MetricCard
          label="Customer lifetime sales"
          value={formatBdtAmount(metrics.totalSpent)}
          icon={<ShoppingBag className="w-4 h-4" strokeWidth={1.5} />}
          subtitle="Accumulated billed revenue"
        />

        <MetricCard
          label="Outstanding receivables"
          value={formatBdtAmount(metrics.totalDue)}
          icon={<CreditCard className="w-4 h-4" strokeWidth={1.5} />}
          subtitle={`${metrics.withDueCount} accounts with pending balance`}
          highlight={metrics.totalDue > 0}
        />
      </div>

      {/* Filters Bar */}
      <div className="p-3 bg-surface border border-hairline rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" strokeWidth={1.5} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer name, phone, email"
            className="w-full pl-9 pr-3 py-1.5 bg-raised border border-hairline rounded-lg text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-raised p-1 rounded-lg border border-hairline">
          <button
            type="button"
            onClick={() => setFilterDueOnly(false)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors duration-150 ease-unslop cursor-pointer ${
              !filterDueOnly
                ? 'bg-accent text-accent-fg font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            All Customers ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterDueOnly(true)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors duration-150 ease-unslop cursor-pointer ${
              filterDueOnly
                ? 'bg-accent text-accent-fg font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Has Due Balance
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-surface border border-hairline rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-raised/70 border-b border-hairline text-ink-muted font-medium">
              <tr>
                <th className="py-3 px-4">Customer name</th>
                <th className="py-3 px-4">Phone number</th>
                <th className="py-3 px-4">Address / info</th>
                <th className="py-3 px-4 text-center">Orders</th>
                <th className="py-3 px-4 text-right">Lifetime spent</th>
                <th className="py-3 px-4 text-right">Due balance</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-ink-secondary">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted">
                    Loading customers…
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    <UserCheck className="w-7 h-7 mx-auto text-ink-muted mb-2 opacity-60" strokeWidth={1.5} />
                    <p className="font-medium text-ink-secondary">No customers found</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {search ? 'Try different search keywords' : 'Add a customer or complete a sale at POS to record one'}
                    </p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleOpenDetails(c)}
                    className="hover:bg-raised/50 cursor-pointer transition-colors duration-150 ease-unslop"
                  >
                    <td className="py-3 px-4 font-medium text-ink">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-accent/12 border border-accent/25 flex items-center justify-center text-accent-ink font-medium text-xs shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{c.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono tabular-nums text-ink">
                      {c.phone}
                    </td>

                    <td className="py-3 px-4 text-ink-muted text-xs max-w-xs truncate">
                      {c.address || c.email || (
                        <span className="text-ink-muted/70">None specified</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-mono tabular-nums text-ink-secondary">
                      {c.totalOrders}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-ink">
                      ৳{c.totalSpentBdt.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {c.dueBalanceBdt > 0.01 ? (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-warning/10 text-warning border border-warning/25 font-mono tabular-nums">
                          Due ৳{c.dueBalanceBdt.toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-positive/10 text-positive border border-positive/25">
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
                            className="px-2.5 py-1 rounded-md bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-[11px] transition-colors duration-150 ease-unslop"
                            title="Collect Due Payment"
                          >
                            Collect Due
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenDetails(c)}
                          className="p-1.5 rounded-lg border border-hairline bg-raised text-ink-muted hover:text-ink hover:border-hairline-strong transition-colors duration-150 ease-unslop"
                          title="View History & Invoices"
                        >
                          <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="p-1.5 rounded-lg border border-hairline bg-raised text-ink-muted hover:text-accent-ink hover:border-hairline-strong transition-colors duration-150 ease-unslop"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>

                        {canDeleteCustomer && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(c)}
                            className="p-1.5 rounded-lg border border-hairline bg-raised text-ink-muted hover:text-negative hover:border-negative/40 transition-colors duration-150 ease-unslop"
                            title="Delete Customer"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CUSTOMER PROFILE & HISTORY MODAL */}
      {selectedCustomerId && customerDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
          <div className="w-full max-w-4xl bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-4 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-start pb-3 border-b border-hairline shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/12 border border-accent/25 flex items-center justify-center text-accent-ink font-medium text-base">
                  {customerDetails.customer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-ink">
                    {customerDetails.customer.name}
                  </h3>
                  <div className="text-xs text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                    <span className="font-mono tabular-nums flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
                      {customerDetails.customer.phone}
                    </span>
                    {customerDetails.customer.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
                        {customerDetails.customer.email}
                      </span>
                    )}
                    {customerDetails.customer.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
                        {customerDetails.customer.address}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomerId(null)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0 text-xs">
              <div className="p-3.5 rounded-xl bg-raised border border-hairline">
                <div className="text-xs text-ink-muted">Total orders</div>
                <div className="text-base font-medium font-mono tabular-nums text-ink mt-0.5">
                  {customerDetails.customer.totalOrders} invoices
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-raised border border-hairline">
                <div className="text-xs text-ink-muted">Lifetime purchased</div>
                <div className="text-base font-medium font-mono tabular-nums text-positive mt-0.5">
                  ৳{customerDetails.customer.totalSpentBdt.toFixed(2)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-raised border border-hairline flex items-center justify-between">
                <div>
                  <div className="text-xs text-ink-muted">Due balance</div>
                  <div className="text-base font-medium font-mono tabular-nums text-warning mt-0.5">
                    ৳{customerDetails.customer.dueBalanceBdt.toFixed(2)}
                  </div>
                </div>
                {customerDetails.customer.dueBalanceBdt > 0.01 && (
                  <button
                    type="button"
                    onClick={() => openPayDueModal(customerDetails.customer)}
                    className="px-3 py-1.5 rounded-lg bg-accent text-accent-fg font-semibold text-xs hover:bg-accent-hover transition-colors duration-150 ease-unslop"
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
                <h4 className="text-xs font-medium text-ink-secondary flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
                  <span>Purchase invoices ({customerDetails.sales.length})</span>
                </h4>

                {customerDetails.sales.length === 0 ? (
                  <div className="p-4 text-center text-ink-muted border border-dashed border-hairline rounded-xl">
                    No sales recorded for this customer yet
                  </div>
                ) : (
                  <div className="border border-hairline rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-raised/70 text-ink-muted font-medium border-b border-hairline">
                        <tr>
                          <th className="py-2 px-3">Invoice</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Payment</th>
                          <th className="py-2 px-3 text-right">Total</th>
                          <th className="py-2 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline text-xs">
                        {customerDetails.sales.map((s) => (
                          <tr key={s.id}>
                            <td className="py-2 px-3 font-mono font-medium text-ink tabular-nums">
                              {s.invoiceNumber}
                            </td>
                            <td className="py-2 px-3 text-ink-muted tabular-nums">
                              {formatDhakaDate(s.createdAt)}
                            </td>
                            <td className="py-2 px-3 capitalize text-ink-secondary">
                              {s.paymentMethod}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-accent-ink">
                              ৳{s.totalAmountBdt.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">
                              {s.dueAmountBdt > 0.01 ? (
                                <span className="text-warning font-medium">
                                  Due ৳{s.dueAmountBdt.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-positive font-medium">Paid</span>
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
                <h4 className="text-xs font-medium text-ink-secondary flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
                  <span>Due settlements &amp; payments received ({customerDetails.payments.length})</span>
                </h4>

                {customerDetails.payments.length === 0 ? (
                  <div className="p-4 text-center text-ink-muted border border-dashed border-hairline rounded-xl">
                    No separate due settlements recorded yet
                  </div>
                ) : (
                  <div className="border border-hairline rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-raised/70 text-ink-muted font-medium border-b border-hairline">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3">Received by</th>
                          <th className="py-2 px-3">Ref / notes</th>
                          <th className="py-2 px-3 text-right">Amount collected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline text-xs">
                        {customerDetails.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 px-3 text-ink-muted tabular-nums">
                              {formatDhakaDateTime(p.createdAt)}
                            </td>
                            <td className="py-2 px-3 capitalize text-ink font-medium">
                              {p.paymentMethod}
                            </td>
                            <td className="py-2 px-3 text-ink-secondary">
                              {p.receivedByUsername || 'Cashier'}
                            </td>
                            <td className="py-2 px-3 text-ink-muted">
                              {p.referenceNumber ? `Ref: ${p.referenceNumber}` : p.notes || '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-positive">
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
            <div className="pt-3 border-t border-hairline flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCustomerId(null)}
                className="px-5 py-2 rounded-lg bg-accent text-accent-fg font-semibold text-xs hover:bg-accent-hover transition-colors duration-150 ease-unslop cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COLLECT DUE PAYMENT MODAL */}
      {payingCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-hairline">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-warning/10 border border-warning/25 flex items-center justify-center text-warning">
                  <CreditCard className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-base font-medium text-ink">Collect customer due</h3>
                  <p className="text-xs text-ink-muted">For {payingCustomer.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayingCustomer(null)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {payError && (
              <div className="p-2.5 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs">
                {payError}
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-lg bg-raised border border-hairline flex justify-between items-center">
                <span className="text-ink-muted">Outstanding due balance</span>
                <span className="font-mono tabular-nums text-base font-medium text-warning">
                  ৳{payingCustomer.dueBalanceBdt.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Amount paying now (৳) <span className="text-negative">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={payingCustomer.dueBalanceBdt}
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg font-mono tabular-nums font-medium text-base text-positive focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Payment method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink text-xs focus:outline-none focus:border-accent"
                >
                  <option value="cash">Cash in Hand</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="card">Debit / Credit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Reference (bKash TrxID / bank slip)
                </label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="Optional reference"
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted text-xs font-mono focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Partial cash payment at counter"
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted text-xs focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-hairline flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayingCustomer(null)}
                className="px-4 py-2 rounded-lg border border-hairline bg-raised text-xs text-ink-secondary hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={paySubmitting || payAmount <= 0}
                onClick={handleExecutePayment}
                className="px-5 py-2 rounded-lg bg-positive hover:opacity-90 text-white font-semibold text-xs transition-opacity duration-150 ease-unslop disabled:opacity-50 cursor-pointer tabular-nums"
              >
                {paySubmitting ? 'Recording…' : `Confirm Payment (৳${payAmount})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT CUSTOMER MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-hairline">
              <h3 className="text-base font-medium text-ink flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
                <span>{editingCustomer ? 'Edit customer' : 'Add new customer'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Customer name <span className="text-negative">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Tanvir Ahmed"
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Phone number <span className="text-negative">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="017..."
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Email address (optional)
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="tanvir@example.com"
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Address / city (optional)
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Dhanmondi, Dhaka"
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Notes / fragrance preferences
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Prefers white musk & oudh"
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-hairline bg-raised text-xs text-ink-secondary hover:text-ink font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2 rounded-lg bg-accent text-accent-fg font-semibold text-xs hover:bg-accent-hover transition-colors duration-150 ease-unslop disabled:opacity-50 cursor-pointer"
                >
                  {formSaving ? 'Saving…' : editingCustomer ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
