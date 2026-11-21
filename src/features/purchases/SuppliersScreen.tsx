import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { purchasesRepo } from '@/data/repositories/purchasesRepo';
import type { Supplier, Purchase } from '@/domain/purchases/types';

interface SuppliersScreenProps {
  deviceId: string;
}

export const SuppliersScreen: React.FC<SuppliersScreenProps> = ({ deviceId }) => {
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
    loadSuppliers();
  }, []);

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

  const handleDelete = async (id: string, supName: string) => {
    if (!window.confirm(`Are you sure you want to remove supplier "${supName}"?`)) {
      return;
    }
    try {
      await purchasesRepo.deleteSupplier(id, deviceId);
      await loadSuppliers();
      if (viewingSupplier?.id === id) {
        setViewingSupplier(null);
      }
    } catch (err) {
      console.error('Failed to delete supplier:', err);
    }
  };

  // Click on a supplier card to view their purchases & ledger
  const handleViewSupplierPurchases = async (sup: Supplier) => {
    setViewingSupplier(sup);
    setLoadingPurchases(true);
    setExpandedPurchaseId(null);
    try {
      const pos = await purchasesRepo.getPurchases({ supplierId: sup.id });
      setSupplierPurchases(pos);
    } catch (err) {
      console.error('Failed to load supplier purchases:', err);
    } finally {
      setLoadingPurchases(false);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-brand-gold" />
            <span>Fragrance & Bottle Suppliers</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Directory of essential oil distilleries, perfume houses, bottle importers, and wholesale vendors.
            Click any supplier to view their complete purchase history and dues.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-gold text-brand-black text-xs font-bold hover:bg-brand-gold-light transition-all shadow-md shadow-brand-gold/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              Registered Suppliers
            </div>
            <div className="text-lg font-bold text-neutral-900 dark:text-white font-mono mt-0.5">
              {suppliers.length} Vendors
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              Total Purchases Value
            </div>
            <div className="text-lg font-bold text-emerald-500 font-mono mt-0.5">
              ৳{suppliers.reduce((acc, s) => acc + (s.totalPurchasedBdt || 0), 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              Total Outstanding Due
            </div>
            <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
              ৳{suppliers.reduce((acc, s) => acc + (s.totalDueBdt || 0), 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by supplier name, contact person, or phone..."
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-xl text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-brand-gold"
        />
      </div>

      {/* Suppliers Grid / List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-neutral-400">Loading suppliers...</div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-neutral-300 dark:border-brand-border rounded-2xl bg-white/50 dark:bg-brand-surface/50">
          <Truck className="w-10 h-10 mx-auto text-neutral-400 mb-2 opacity-40" />
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            No suppliers found
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            {search ? 'Try adjusting your search keywords.' : 'Add your first supplier to begin receiving stock.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((s) => (
            <div
              key={s.id}
              onClick={() => handleViewSupplierPurchases(s)}
              className="p-4 rounded-2xl bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border hover:border-brand-gold hover:shadow-lg transition-all shadow-sm flex flex-col justify-between cursor-pointer group"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold group-hover:scale-105 transition-transform">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-neutral-900 dark:text-white leading-tight group-hover:text-brand-gold transition-colors">
                        {s.name}
                      </h4>
                      {s.contactPerson && (
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {s.contactPerson}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      s.isActive
                        ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                        : 'bg-neutral-500/15 text-neutral-400 border border-neutral-500/30'
                    }`}
                  >
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Details */}
                <div className="mt-4 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                  {s.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                      <span className="font-mono text-[11px]">{s.phone}</span>
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                      <span className="truncate">{s.email}</span>
                    </div>
                  )}
                  {s.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                      <span className="truncate">{s.address}</span>
                    </div>
                  )}
                  {s.notes && (
                    <div className="pt-2 mt-2 border-t border-neutral-100 dark:border-brand-border/60 text-[11px] text-neutral-400 italic">
                      "{s.notes}"
                    </div>
                  )}
                </div>

                {/* Orders & Dues Summary */}
                <div className="mt-3 p-2.5 rounded-xl bg-neutral-50 dark:bg-brand-black/60 border border-neutral-200 dark:border-brand-border/60 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[9px] uppercase font-bold text-neutral-400">Total Sourced</div>
                    <div className="font-mono font-bold text-neutral-900 dark:text-white text-xs mt-0.5">
                      ৳{(s.totalPurchasedBdt || 0).toFixed(2)}
                      <span className="text-[10px] text-neutral-400 font-normal ml-1">
                        ({s.totalOrders || 0} POs)
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[9px] uppercase font-bold text-neutral-400">Due Balance</div>
                    {(s.totalDueBdt || 0) > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono mt-0.5">
                        Due ৳{(s.totalDueBdt || 0).toFixed(2)}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 mt-0.5">
                        All Paid
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions & Click to View hint */}
              <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-brand-border/60 flex items-center justify-between">
                <span className="text-[11px] font-bold text-brand-gold group-hover:underline flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Purchases & Ledger &rarr;</span>
                </span>

                <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(s);
                    }}
                    className="p-1.5 rounded-lg border border-neutral-200 dark:border-brand-border text-neutral-500 hover:text-brand-gold hover:border-brand-gold transition-colors"
                    title="Edit supplier details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s.id, s.name);
                    }}
                    className="p-1.5 rounded-lg border border-neutral-200 dark:border-brand-border text-neutral-500 hover:text-red-400 hover:border-red-400/50 transition-colors"
                    title="Delete supplier"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================================================== */}
      {/* SUPPLIER PURCHASES & PROFILE MODAL                   */}
      {/* ==================================================== */}
      {viewingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-2xl shadow-2xl p-6 space-y-4 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-3 border-b border-neutral-200 dark:border-brand-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                      {viewingSupplier.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        viewingSupplier.isActive
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-neutral-500/15 text-neutral-400 border border-neutral-500/30'
                      }`}
                    >
                      {viewingSupplier.isActive ? 'Active Supplier' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                    {viewingSupplier.contactPerson && (
                      <span>Contact: <strong>{viewingSupplier.contactPerson}</strong></span>
                    )}
                    {viewingSupplier.phone && (
                      <span className="font-mono">Phone: {viewingSupplier.phone}</span>
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
                className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 text-xs">
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-brand-black/60 border border-neutral-200 dark:border-brand-border">
                <div className="text-[10px] uppercase font-bold text-neutral-400">Total Sourced</div>
                <div className="text-base font-bold font-mono text-neutral-900 dark:text-white mt-0.5">
                  ৳{(viewingSupplier.totalPurchasedBdt || 0).toFixed(2)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-brand-black/60 border border-neutral-200 dark:border-brand-border">
                <div className="text-[10px] uppercase font-bold text-neutral-400">Total Paid</div>
                <div className="text-base font-bold font-mono text-emerald-500 mt-0.5">
                  ৳{(viewingSupplier.totalPaidBdt || 0).toFixed(2)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-brand-black/60 border border-neutral-200 dark:border-brand-border">
                <div className="text-[10px] uppercase font-bold text-neutral-400">Due Balance</div>
                <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
                  ৳{(viewingSupplier.totalDueBdt || 0).toFixed(2)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-brand-black/60 border border-neutral-200 dark:border-brand-border">
                <div className="text-[10px] uppercase font-bold text-neutral-400">Purchase Orders</div>
                <div className="text-base font-bold font-mono text-brand-gold mt-0.5">
                  {viewingSupplier.totalOrders || 0} POs
                </div>
              </div>
            </div>

            {/* Purchases History Table */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-brand-gold" />
                  <span>Purchases & Shipment History ({supplierPurchases.length})</span>
                </h4>
              </div>

              {loadingPurchases ? (
                <div className="py-12 text-center text-xs text-neutral-400">
                  Loading purchase records...
                </div>
              ) : supplierPurchases.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-500 border border-dashed border-neutral-300 dark:border-brand-border rounded-xl">
                  <ShoppingBag className="w-8 h-8 mx-auto text-neutral-400 mb-2 opacity-50" />
                  <p className="font-semibold text-neutral-300">No purchase records found</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    No shipments have been recorded from {viewingSupplier.name} yet.
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
                        className="border border-neutral-200 dark:border-brand-border rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-brand-black/40 transition-all"
                      >
                        {/* PO Header Row */}
                        <div
                          onClick={() => handleToggleExpandPurchase(po.id)}
                          className="p-3 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              className="text-neutral-400 group-hover:text-white"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-brand-gold" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                            <div>
                              <div className="font-mono font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                                <span>{po.purchaseNumber}</span>
                                {po.referenceNumber && (
                                  <span className="text-[10px] font-normal text-neutral-400 font-mono">
                                    Ref: {po.referenceNumber}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                                <Calendar className="w-3 h-3 text-brand-gold" />
                                <span>{new Date(po.receivedAt).toLocaleDateString()}</span>
                                <span>&bull;</span>
                                <Clock className="w-3 h-3 text-neutral-500" />
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
                              <div className="text-[10px] uppercase font-bold text-neutral-400">
                                Total Cost
                              </div>
                              <div className="font-mono font-bold text-brand-gold text-sm">
                                ৳{po.totalAmountBdt.toFixed(2)}
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] uppercase font-bold text-neutral-400">
                                Payment ({po.paymentMethod})
                              </div>
                              {dueAmount > 0 ? (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono">
                                  Due ৳{dueAmount.toFixed(2)}
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                                  Paid (৳{po.paidAmountBdt.toFixed(2)})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Line Items */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-neutral-200 dark:border-brand-border/60 bg-white/40 dark:bg-brand-surface/40 animate-in fade-in duration-100">
                            <div className="text-[10px] uppercase font-bold text-neutral-400 pb-1.5">
                              Line Items Received:
                            </div>

                            {loadingPoId === po.id ? (
                              <div className="py-3 text-center text-[11px] text-neutral-400">
                                Loading item details...
                              </div>
                            ) : cachedPo?.items && cachedPo.items.length > 0 ? (
                              <div className="border border-neutral-200 dark:border-brand-border/40 rounded-lg overflow-hidden">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-neutral-100 dark:bg-brand-black/80 text-neutral-500 text-[10px] uppercase font-bold">
                                    <tr>
                                      <th className="py-1.5 px-3">Product / SKU</th>
                                      <th className="py-1.5 px-3">Purchased Qty</th>
                                      <th className="py-1.5 px-3">Purchased Rate</th>
                                      <th className="py-1.5 px-3">Stock Added</th>
                                      <th className="py-1.5 px-3 text-right">Line Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-neutral-200 dark:divide-brand-border/40 text-neutral-700 dark:text-neutral-200 text-[11px]">
                                    {cachedPo.items.map((it) => (
                                      <tr key={it.id}>
                                        <td className="py-1.5 px-3">
                                          <div className="font-semibold text-neutral-900 dark:text-white">
                                            {it.productName}
                                          </div>
                                          <div className="text-[10px] text-neutral-400 font-mono">
                                            {it.sku}
                                          </div>
                                        </td>
                                        <td className="py-1.5 px-3 font-mono font-medium">
                                          {it.purchasedQuantity} {it.purchasedUnit}
                                        </td>
                                        <td className="py-1.5 px-3 font-mono text-neutral-400">
                                          ৳{it.unitRateBdt.toFixed(2)}/{it.purchasedUnit}
                                        </td>
                                        <td className="py-1.5 px-3 font-mono text-emerald-400">
                                          +{it.convertedQuantityBase.toFixed(2)} {it.baseUnitCode}
                                        </td>
                                        <td className="py-1.5 px-3 text-right font-mono font-bold text-brand-gold">
                                          ৳{it.totalCostBdt.toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-[11px] text-neutral-400 italic">
                                No individual line items recorded.
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
            <div className="pt-3 border-t border-neutral-200 dark:border-brand-border flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  const s = viewingSupplier;
                  setViewingSupplier(null);
                  openEditModal(s);
                }}
                className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-brand-border text-xs text-neutral-600 dark:text-neutral-400 hover:text-white font-medium flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5 text-brand-gold" />
                <span>Edit Supplier Info</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingSupplier(null)}
                className="px-5 py-2 rounded-xl bg-brand-gold text-brand-black font-extrabold text-xs hover:bg-brand-gold-light transition-all shadow-md shadow-brand-gold/20 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ADD / EDIT SUPPLIER MODAL                            */}
      {/* ==================================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-200 dark:border-brand-border">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-brand-gold" />
                <span>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                  Supplier / Company Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Surrati Perfumes Makkah"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Haji Rafiq"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017... / +966..."
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="orders@supplier.com"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                  Address / Origin
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Chawkbazar, Dhaka / Makkah, KSA"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[10px] mb-1">
                  Notes & Specialities
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Supplies crystal 12ml bottles, delivery within 48h"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs"
                />
              </div>

              {editingSupplier && (
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-brand-gold focus:ring-brand-gold"
                  />
                  <span className="text-xs text-neutral-700 dark:text-neutral-300">
                    Active Supplier
                  </span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-brand-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-brand-border text-xs text-neutral-600 dark:text-neutral-400 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-brand-gold text-brand-black font-bold text-xs hover:bg-brand-gold-light transition-all shadow-md shadow-brand-gold/20 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
