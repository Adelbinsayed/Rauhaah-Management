import React, { useState, useEffect, useRef } from 'react';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Trash2,
  X,
  Building,
  ShoppingBag,
  Calendar,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Eye,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useAppStore } from '@/app/store';
import { canViewCost } from '@/domain/auth/permissions';
import { purchasesRepo } from '@/data/repositories/purchasesRepo';
import { Modal } from '@/components/ui';
import type { Supplier, Purchase } from '@/domain/purchases/types';

interface SuppliersScreenProps {
  deviceId: string;
}

export const SuppliersScreen: React.FC<SuppliersScreenProps> = ({ deviceId }) => {
  const { permissions } = useAppStore();
  const allowCost = canViewCost(permissions);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Supplier Purchases History View modal state
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [supplierPurchases, setSupplierPurchases] = useState<Purchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  const [purchaseDetailsCache, setPurchaseDetailsCache] = useState<Record<string, Purchase>>({});
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);
  const purchasesSeqRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (modalOpen) setModalOpen(false);
      else if (viewingSupplier) setViewingSupplier(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, viewingSupplier]);
  const [loadingPoId, setLoadingPoId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await purchasesRepo.getSuppliers();
      setSuppliers(data);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!allowCost) {
      setLoading(false);
      return;
    }
    loadSuppliers();
  }, [allowCost]);

  const openAddModal = () => {
    setEditingSupplier(null);
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
    setIsActive(true);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setName(sup.name);
    setContactPerson(sup.contactPerson || '');
    setPhone(sup.phone || '');
    setEmail(sup.email || '');
    setAddress(sup.address || '');
    setNotes(sup.notes || '');
    setIsActive(sup.isActive);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Supplier Name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingSupplier) {
        await purchasesRepo.updateSupplier(
          {
            id: editingSupplier.id,
            name,
            contactPerson,
            phone,
            email,
            address,
            notes,
            isActive,
          },
          deviceId
        );
      } else {
        await purchasesRepo.createSupplier(
          {
            name,
            contactPerson,
            phone,
            email,
            address,
            notes,
          },
          deviceId
        );
      }
      setModalOpen(false);
      await loadSuppliers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (sup: Supplier) => {
    setDeleteTarget(sup);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await purchasesRepo.deleteSupplier(deleteTarget.id, deviceId);
      if (viewingSupplier?.id === deleteTarget.id) {
        setViewingSupplier(null);
      }
      setDeleteTarget(null);
      await loadSuppliers();
    } catch (err) {
      console.error('Failed to delete supplier:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Click on a supplier card to view their purchases & ledger
  const handleViewSupplierPurchases = async (sup: Supplier) => {
    const seq = ++purchasesSeqRef.current;
    setViewingSupplier(sup);
    setSupplierPurchases([]);
    setLoadingPurchases(true);
    setExpandedPurchaseId(null);
    try {
      const pos = await purchasesRepo.getPurchases({ supplierId: sup.id });
      if (seq === purchasesSeqRef.current) {
        setSupplierPurchases(pos);
      }
    } catch (err) {
      if (seq === purchasesSeqRef.current) {
        console.error('Failed to load supplier purchases:', err);
      }
    } finally {
      if (seq === purchasesSeqRef.current) {
        setLoadingPurchases(false);
      }
    }
  };

  // Toggle expanding a specific purchase order in the supplier history
  const handleToggleExpandPurchase = async (poId: string) => {
    if (expandedPurchaseId === poId) {
      setExpandedPurchaseId(null);
      return;
    }

    setExpandedPurchaseId(poId);

    if (!purchaseDetailsCache[poId]) {
      setLoadingPoId(poId);
      try {
        const full = await purchasesRepo.getPurchaseDetails(poId);
        if (full) {
          setPurchaseDetailsCache((prev) => ({ ...prev, [poId]: full }));
        }
      } catch (err) {
        console.error('Failed to load purchase details:', err);
      } finally {
        setLoadingPoId(null);
      }
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      (s.address && s.address.toLowerCase().includes(q))
    );
  });

  if (!allowCost) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-negative/15 border border-negative/25 text-negative flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-semibold text-ink">Access Denied</h2>
        <p className="text-xs text-ink-secondary mt-1">
          Only accounts with the <code>cost.view</code> permission can view or manage suppliers.
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
            <Truck className="w-5 h-5 text-accent-ink" strokeWidth={1.5} />
            <span>Fragrance &amp; bottle suppliers</span>
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Directory of essential oil distilleries, perfume houses, bottle importers, and wholesale vendors. Select a supplier to view purchase history and dues.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover transition-colors duration-150 ease-unslop cursor-pointer"
        >
          <Plus className="w-4 h-4" strokeWidth={1.75} />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-surface border border-hairline flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-raised border border-hairline flex items-center justify-center text-accent-ink">
            <Truck className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs text-ink-muted">
              Registered suppliers
            </div>
            <div className="text-lg font-medium text-ink font-mono tabular-nums mt-0.5">
              {suppliers.length} vendors
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-hairline flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-positive/10 border border-positive/25 flex items-center justify-center text-positive">
            <Building className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs text-ink-muted">
              Total purchases value
            </div>
            <div className="text-lg font-medium text-positive font-mono tabular-nums mt-0.5">
              ৳{suppliers.reduce((acc, s) => acc + (s.totalPurchasedBdt || 0), 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-hairline flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-warning/10 border border-warning/25 flex items-center justify-center text-warning">
            <CreditCard className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs text-ink-muted">
              Total outstanding due
            </div>
            <div className="text-lg font-medium text-warning font-mono tabular-nums mt-0.5">
              ৳{suppliers.reduce((acc, s) => acc + (s.totalDueBdt || 0), 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" strokeWidth={1.5} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search supplier name, contact person, or phone"
          className="w-full pl-9 pr-4 py-2 bg-surface border border-hairline rounded-lg text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Suppliers Grid / List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-ink-muted">Loading suppliers…</div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-hairline rounded-xl bg-surface">
          <Truck className="w-8 h-8 mx-auto text-ink-muted mb-2 opacity-50" strokeWidth={1.5} />
          <h3 className="text-sm font-medium text-ink-secondary">
            No suppliers found
          </h3>
          <p className="text-xs text-ink-muted mt-1">
            {search ? 'Try adjusting your search keywords' : 'Add your first supplier to begin receiving stock'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((s) => (
            <div
              key={s.id}
              onClick={() => handleViewSupplierPurchases(s)}
              className="p-4 rounded-xl bg-surface border border-hairline hover:border-hairline-strong transition-colors duration-150 ease-unslop flex flex-col justify-between cursor-pointer group"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-raised border border-hairline flex items-center justify-center text-accent-ink">
                      <Building className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-ink leading-tight group-hover:text-accent-ink transition-colors duration-150 ease-unslop">
                        {s.name}
                      </h4>
                      {s.contactPerson && (
                        <p className="text-xs text-ink-muted">
                          {s.contactPerson}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                      s.isActive
                        ? 'bg-positive/10 text-positive border-positive/25'
                        : 'bg-raised text-ink-muted border-hairline'
                    }`}
                  >
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Details */}
                <div className="mt-4 space-y-1.5 text-xs text-ink-secondary">
                  {s.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-ink-muted shrink-0" strokeWidth={1.5} />
                      <span className="font-mono tabular-nums text-xs">{s.phone}</span>
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-ink-muted shrink-0" strokeWidth={1.5} />
                      <span className="truncate">{s.email}</span>
                    </div>
                  )}
                  {s.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-ink-muted shrink-0" strokeWidth={1.5} />
                      <span className="truncate">{s.address}</span>
                    </div>
                  )}
                  {s.notes && (
                    <div className="pt-2 mt-2 border-t border-hairline text-xs text-ink-muted">
                      &ldquo;{s.notes}&rdquo;
                    </div>
                  )}
                </div>

                {/* Orders & Dues Summary */}
                <div className="mt-3 p-2.5 rounded-lg bg-raised border border-hairline flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[11px] text-ink-muted">Total sourced</div>
                    <div className="font-mono tabular-nums font-medium text-ink text-xs mt-0.5">
                      ৳{(s.totalPurchasedBdt || 0).toFixed(2)}
                      <span className="text-[11px] text-ink-muted font-normal ml-1">
                        ({s.totalOrders || 0} POs)
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] text-ink-muted">Due balance</div>
                    {(s.totalDueBdt || 0) > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-warning/10 text-warning border border-warning/25 font-mono tabular-nums mt-0.5">
                        Due ৳{(s.totalDueBdt || 0).toFixed(2)}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-positive/10 text-positive border border-positive/25 mt-0.5">
                        All paid
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions & Click to View hint */}
              <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between">
                <span className="text-xs font-medium text-accent-ink group-hover:underline flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>View purchases &amp; ledger →</span>
                </span>

                <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(s);
                    }}
                    className="p-1.5 rounded-lg border border-hairline bg-raised text-ink-muted hover:text-accent-ink hover:border-hairline-strong transition-colors duration-150 ease-unslop"
                    title="Edit supplier details"
                  >
                    <Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s);
                    }}
                    className="p-1.5 rounded-lg border border-hairline bg-raised text-ink-muted hover:text-negative hover:border-negative/40 transition-colors duration-150 ease-unslop"
                    title="Delete supplier"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SUPPLIER PURCHASES & PROFILE MODAL */}
      {viewingSupplier && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-4xl bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-4 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-3 border-b border-hairline shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/12 border border-accent/25 flex items-center justify-center text-accent-ink">
                  <Building className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium text-ink">
                      {viewingSupplier.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                        viewingSupplier.isActive
                          ? 'bg-positive/10 text-positive border-positive/25'
                          : 'bg-raised text-ink-muted border-hairline'
                      }`}
                    >
                      {viewingSupplier.isActive ? 'Active supplier' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-xs text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                    {viewingSupplier.contactPerson && (
                      <span>Contact: <strong className="text-ink-secondary font-medium">{viewingSupplier.contactPerson}</strong></span>
                    )}
                    {viewingSupplier.phone && (
                      <span className="font-mono tabular-nums">Phone: {viewingSupplier.phone}</span>
                    )}
                    {viewingSupplier.address && (
                      <span>Origin: {viewingSupplier.address}</span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingSupplier(null)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 text-xs">
              <div className="p-3 rounded-xl bg-raised border border-hairline">
                <div className="text-xs text-ink-muted">Total sourced</div>
                <div className="text-base font-medium font-mono tabular-nums text-ink mt-0.5">
                  ৳{(viewingSupplier.totalPurchasedBdt || 0).toFixed(2)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-raised border border-hairline">
                <div className="text-xs text-ink-muted">Total paid</div>
                <div className="text-base font-medium font-mono tabular-nums text-positive mt-0.5">
                  ৳{(viewingSupplier.totalPaidBdt || 0).toFixed(2)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-raised border border-hairline">
                <div className="text-xs text-ink-muted">Due balance</div>
                <div className="text-base font-medium font-mono tabular-nums text-warning mt-0.5">
                  ৳{(viewingSupplier.totalDueBdt || 0).toFixed(2)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-raised border border-hairline">
                <div className="text-xs text-ink-muted">Purchase orders</div>
                <div className="text-base font-medium font-mono tabular-nums text-accent-ink mt-0.5">
                  {viewingSupplier.totalOrders || 0} POs
                </div>
              </div>
            </div>

            {/* Purchases History Table */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-ink-secondary flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
                  <span>Purchases &amp; shipment history ({supplierPurchases.length})</span>
                </h4>
              </div>

              {loadingPurchases ? (
                <div className="py-12 text-center text-xs text-ink-muted">
                  Loading purchase records…
                </div>
              ) : supplierPurchases.length === 0 ? (
                <div className="py-12 text-center text-xs text-ink-muted border border-dashed border-hairline rounded-xl">
                  <ShoppingBag className="w-7 h-7 mx-auto text-ink-muted mb-2 opacity-50" strokeWidth={1.5} />
                  <p className="font-medium text-ink-secondary">No purchase records found</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    No shipments have been recorded from {viewingSupplier.name} yet
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {supplierPurchases.map((po) => {
                    const isExpanded = expandedPurchaseId === po.id;
                    const cachedPo = purchaseDetailsCache[po.id];
                    const dueAmount = po.totalAmountBdt - po.paidAmountBdt;

                    return (
                      <div
                        key={po.id}
                        className="border border-hairline rounded-xl overflow-hidden bg-raised/50"
                      >
                        {/* PO Header Row */}
                        <div
                          onClick={() => handleToggleExpandPurchase(po.id)}
                          className="p-3 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-raised text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              className="text-ink-muted hover:text-ink"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
                              ) : (
                                <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
                              )}
                            </button>
                            <div>
                              <div className="font-mono tabular-nums font-medium text-ink flex items-center gap-2">
                                <span>{po.purchaseNumber}</span>
                                {po.referenceNumber && (
                                  <span className="text-[11px] font-normal text-ink-muted font-mono">
                                    Ref {po.referenceNumber}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-ink-muted flex items-center gap-1.5 mt-0.5 tabular-nums">
                                <Calendar className="w-3 h-3 text-accent-ink" strokeWidth={1.5} />
                                <span>{new Date(po.receivedAt).toLocaleDateString()}</span>
                                <span>·</span>
                                <Clock className="w-3 h-3" strokeWidth={1.5} />
                                <span>
                                  {new Date(po.receivedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <div className="text-[11px] text-ink-muted">
                                Total cost
                              </div>
                              <div className="font-mono tabular-nums font-medium text-accent-ink text-sm">
                                ৳{po.totalAmountBdt.toFixed(2)}
                              </div>
                            </div>

                            <div>
                              <div className="text-[11px] text-ink-muted capitalize">
                                Payment ({po.paymentMethod})
                              </div>
                              {dueAmount > 0 ? (
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-warning/10 text-warning border border-warning/25 font-mono tabular-nums">
                                  Due ৳{dueAmount.toFixed(2)}
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-positive/10 text-positive border border-positive/25 font-mono tabular-nums">
                                  Paid (৳{po.paidAmountBdt.toFixed(2)})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Line Items */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-2 border-t border-hairline bg-surface">
                            <div className="text-xs font-medium text-ink-muted pb-1.5">
                              Line items received
                            </div>

                            {loadingPoId === po.id ? (
                              <div className="py-3 text-center text-xs text-ink-muted">
                                Loading item details…
                              </div>
                            ) : cachedPo?.items && cachedPo.items.length > 0 ? (
                              <div className="border border-hairline rounded-lg overflow-hidden">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-raised/70 text-ink-muted font-medium border-b border-hairline">
                                    <tr>
                                      <th className="py-2 px-3">Product / SKU</th>
                                      <th className="py-2 px-3">Purchased qty</th>
                                      <th className="py-2 px-3">Purchased rate</th>
                                      <th className="py-2 px-3">Stock added</th>
                                      <th className="py-2 px-3 text-right">Line total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-hairline text-ink-secondary text-xs">
                                    {cachedPo.items.map((it) => (
                                      <tr key={it.id}>
                                        <td className="py-2 px-3">
                                          <div className="font-medium text-ink">
                                            {it.productName}
                                          </div>
                                          <div className="text-[11px] text-ink-muted font-mono">
                                            {it.sku}
                                          </div>
                                        </td>
                                        <td className="py-2 px-3 font-mono tabular-nums font-medium">
                                          {it.purchasedQuantity} {it.purchasedUnit}
                                        </td>
                                        <td className="py-2 px-3 font-mono tabular-nums text-ink-muted">
                                          ৳{it.unitRateBdt.toFixed(2)}/{it.purchasedUnit}
                                        </td>
                                        <td className="py-2 px-3 font-mono tabular-nums text-positive">
                                          +{it.convertedQuantityBase.toFixed(2)} {it.baseUnitCode}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-accent-ink">
                                          ৳{it.totalCostBdt.toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-xs text-ink-muted">
                                No individual line items recorded
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-hairline flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  const s = viewingSupplier;
                  setViewingSupplier(null);
                  openEditModal(s);
                }}
                className="px-4 py-2 rounded-lg border border-hairline bg-raised text-xs text-ink-secondary hover:text-ink font-medium flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
                <span>Edit Supplier Info</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingSupplier(null)}
                className="px-5 py-2 rounded-lg bg-accent text-accent-fg font-semibold text-xs hover:bg-accent-hover transition-colors duration-150 ease-unslop cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT SUPPLIER MODAL */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-hairline">
              <h3 className="text-base font-medium text-ink flex items-center gap-2">
                <Building className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
                <span>{editingSupplier ? 'Edit supplier' : 'Add new supplier'}</span>
              </h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Supplier / company name <span className="text-negative">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Surrati Perfumes Makkah"
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink-secondary mb-1">
                    Contact person
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Haji Rafiq"
                    className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs"
                  />
                </div>

                <div>
                  <label className="block font-medium text-ink-secondary mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017..."
                    className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="orders@supplier.com"
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Address / origin
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Chawkbazar, Dhaka"
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Notes &amp; specialities
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Supplies 12ml crystal bottles, delivery within 48h"
                  className="w-full px-3 py-2 bg-raised border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs"
                />
              </div>

              {editingSupplier && (
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded accent-accent"
                  />
                  <span className="text-xs text-ink-secondary">
                    Active supplier
                  </span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-hairline bg-raised text-xs text-ink-secondary hover:text-ink font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-accent text-accent-fg font-semibold text-xs hover:bg-accent-hover transition-colors duration-150 ease-unslop disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving…' : editingSupplier ? 'Update Supplier' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Supplier Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        maxWidth="sm"
        title="Remove Supplier"
        subtitle={deleteTarget?.name}
      >
        <div className="space-y-4">
          {(deleteTarget?.totalDueBdt || 0) > 0 && (
            <div className="p-3 rounded-xl bg-warning/10 border border-warning/25 text-xs text-warning">
              Warning: This supplier still has an unpaid payable balance of{' '}
              <strong className="font-mono">৳{(deleteTarget?.totalDueBdt || 0).toFixed(2)}</strong>.
            </div>
          )}
          <p className="text-xs text-ink-secondary">
            Are you sure you want to remove supplier <strong className="text-ink">&ldquo;{deleteTarget?.name}&rdquo;</strong>?
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-lg border border-hairline bg-raised text-xs text-ink-secondary hover:text-ink font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={confirmDelete}
              className="px-4 py-2 rounded-lg bg-negative text-white text-xs font-semibold hover:bg-negative/90 cursor-pointer disabled:opacity-50"
            >
              {deleting ? 'Removing…' : 'Remove Supplier'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
