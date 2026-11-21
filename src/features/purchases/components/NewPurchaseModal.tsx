import { purchasesRepo } from '@/data/repositories/purchasesRepo';
import type { StockItemLookup, Supplier } from '@/domain/purchases/types';
import { convertToBaseQuantity } from '@/domain/purchases/types';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Droplets,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Tag,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QuickAddProductModal } from './QuickAddProductModal';

export interface NewPurchaseItemForm {
  stockItemId: string;
  productName: string;
  sku: string;
  baseUnitCode: string;
  densityGPerMl?: number | null;
  currentStockBefore: number;
  currentCostBefore: number;
  purchasedUnit: string;
  purchasedQuantity: number;
  unitRateBdt: number;
  totalCostBdt: number;
  convertedQuantityBase: number;
  baseCostPerUnitBdt: number;
  notes?: string;
}

interface NewPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  stockItems: StockItemLookup[];
  categories: Array<{ id: string; name: string }>;
  deviceId: string;
  currentUser: { id: string; username: string; displayName?: string | null } | null;
  onPurchaseCompleted: () => Promise<void>;
  onSuppliersUpdated: (suppliers: Supplier[]) => void;
  onStockItemsUpdated: (items: StockItemLookup[]) => void;
}

export const NewPurchaseModal: React.FC<NewPurchaseModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  stockItems,
  categories,
  deviceId,
  currentUser,
  onPurchaseCompleted,
  onSuppliersUpdated,
  onStockItemsUpdated,
}) => {
  // New Purchase Form state
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierNameInput, setSupplierNameInput] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial' | 'due'>('full');
  const [paidAmountBdt, setPaidAmountBdt] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<NewPurchaseItemForm[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Item row input form
  const [rowStockItemId, setRowStockItemId] = useState('');
  const [rowUnit, setRowUnit] = useState('tola');
  const [rowQuantity, setRowQuantity] = useState<number>(1);
  const [rowRate, setRowRate] = useState<number>(0);
  const [rowNotes, setRowNotes] = useState('');

  // Item Search Combobox state
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isItemSearchOpen, setIsItemSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Inline Quick Product Modal
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [quickProductInitialName, setQuickProductInitialName] = useState('');
  const [newProductSuccessToast, setNewProductSuccessToast] = useState<string | null>(null);

  // Quick Supplier Add inside modal
  const [showQuickSupplier, setShowQuickSupplier] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState('');

  // Initialize modal state on open
  useEffect(() => {
    if (isOpen) {
      purchasesRepo.getNextPurchaseNumber('PO').then((nextPo) => {
        setPurchaseNumber(nextPo);
      });
      setSelectedSupplierId(suppliers[0]?.id || '');
      setSupplierNameInput(suppliers[0]?.name || '');
      setReferenceNumber('');
      setPaymentMethod('cash');
      setPaymentMode('full');
      setPaidAmountBdt(0);
      setNotes('');
      setItems([]);
      setFormError(null);
      setNewProductSuccessToast(null);

      if (stockItems.length > 0) {
        selectStockItem(stockItems[0]);
      } else {
        setRowStockItemId('');
        setItemSearchQuery('');
      }
      setRowQuantity(1);
      setRowRate(0);
      setRowNotes('');
    }
  }, [isOpen]);

  // Click outside to close combobox dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsItemSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectStockItem = (item: StockItemLookup) => {
    setRowStockItemId(item.id);
    setItemSearchQuery('');
    setIsItemSearchOpen(false);

    if (item.unitCode === 'ml') {
      setRowUnit('tola'); // 12 ml standard
    } else {
      setRowUnit(item.unitCode);
    }
    setRowRate(item.costPriceBdt || 0);
  };

  const selectedRowStockItem = useMemo(() => {
    return stockItems.find((s) => s.id === rowStockItemId) || null;
  }, [stockItems, rowStockItemId]);

  const filteredStockItems = useMemo(() => {
    const q = itemSearchQuery.trim().toLowerCase();
    if (!q) return stockItems.slice(0, 15);
    return stockItems
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.sku.toLowerCase().includes(q) ||
          s.itemType.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [stockItems, itemSearchQuery]);

  const rowCalculation = useMemo(() => {
    if (!selectedRowStockItem) {
      return { totalCost: 0, convertedQty: 0, baseCostPerUnit: 0 };
    }
    const totalCost = rowQuantity * rowRate;
    const convertedQty = convertToBaseQuantity(
      rowUnit,
      rowQuantity,
      selectedRowStockItem.unitCode,
      selectedRowStockItem.densityGPerMl
    );
    const baseCostPerUnit = convertedQty > 0 ? totalCost / convertedQty : 0;
    return { totalCost, convertedQty, baseCostPerUnit };
  }, [selectedRowStockItem, rowUnit, rowQuantity, rowRate]);

  const totalOrderAmount = useMemo(() => {
    return items.reduce((acc, i) => acc + i.totalCostBdt, 0);
  }, [items]);

  useEffect(() => {
    if (paymentMode === 'full') {
      setPaidAmountBdt(totalOrderAmount);
    } else if (paymentMode === 'due') {
      setPaidAmountBdt(0);
      setPaymentMethod('due');
    }
  }, [totalOrderAmount, paymentMode]);

  const handleAddItem = () => {
    if (!selectedRowStockItem) {
      setFormError('Please search and select a stock item.');
      return;
    }
    if (rowQuantity <= 0) {
      setFormError('Quantity must be greater than zero.');
      return;
    }
    if (rowRate < 0) {
      setFormError('Unit rate cannot be negative.');
      return;
    }

    setFormError(null);
    const newItem: NewPurchaseItemForm = {
      stockItemId: selectedRowStockItem.id,
      productName: selectedRowStockItem.name,
      sku: selectedRowStockItem.sku,
      baseUnitCode: selectedRowStockItem.unitCode,
      densityGPerMl: selectedRowStockItem.densityGPerMl,
      currentStockBefore: selectedRowStockItem.currentQuantity,
      currentCostBefore: selectedRowStockItem.costPriceBdt,
      purchasedUnit: rowUnit,
      purchasedQuantity: rowQuantity,
      unitRateBdt: rowRate,
      totalCostBdt: rowCalculation.totalCost,
      convertedQuantityBase: rowCalculation.convertedQty,
      baseCostPerUnitBdt: rowCalculation.baseCostPerUnit,
      notes: rowNotes.trim() || undefined,
    };

    setItems((prev) => [...prev, newItem]);
    setRowQuantity(1);
    setRowNotes('');
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleQuickAddSupplier = async () => {
    if (!quickSupplierName.trim()) return;
    try {
      const s = await purchasesRepo.createSupplier(
        {
          name: quickSupplierName,
          phone: quickSupplierPhone,
        },
        deviceId
      );
      onSuppliersUpdated([s, ...suppliers]);
      setSelectedSupplierId(s.id);
      setSupplierNameInput(s.name);
      setShowQuickSupplier(false);
      setQuickSupplierName('');
      setQuickSupplierPhone('');
    } catch (err) {
      console.error('Failed to quick add supplier:', err);
    }
  };

  const handleProductCreated = async (createdItem: StockItemLookup, costPrice: number) => {
    const updatedStockList = await purchasesRepo.getStockItems();
    onStockItemsUpdated(updatedStockList);
    selectStockItem(createdItem);
    if (costPrice > 0) {
      setRowRate(costPrice);
    }
    setNewProductSuccessToast(
      `Added "${createdItem.name}" to inventory catalog and selected for this shipment!`
    );
    setTimeout(() => setNewProductSuccessToast(null), 6000);
  };

  const handleExecutePurchase = async () => {
    if (!currentUser) {
      setFormError('No active user session.');
      return;
    }
    if (items.length === 0) {
      setFormError('Please add at least one item to receive.');
      return;
    }
    const supName =
      suppliers.find((s) => s.id === selectedSupplierId)?.name || supplierNameInput.trim();
    if (!supName) {
      setFormError('Please specify the supplier.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await purchasesRepo.receivePurchaseOrder({
        purchaseNumber,
        supplierId: selectedSupplierId || null,
        supplierName: supName,
        branchId: 'default-branch',
        totalAmountBdt: totalOrderAmount,
        paidAmountBdt: Number(paidAmountBdt) || 0,
        paymentMethod: paymentMode === 'due' ? 'due' : paymentMethod,
        referenceNumber: referenceNumber || null,
        notes: notes || null,
        receivedByUserId: currentUser.id,
        receivedByUsername: currentUser.displayName || currentUser.username,
        receivedAt: new Date().toISOString(),
        deviceId,
        items,
      });

      await onPurchaseCompleted();
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const renderItemTypeBadge = (type: string) => {
    switch (type) {
      case 'raw_oil':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Droplets className="w-2.5 h-2.5" /> Oil / Decant
          </span>
        );
      case 'empty_bottle':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Package className="w-2.5 h-2.5" /> Bottle
          </span>
        );
      case 'sealed_product':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Tag className="w-2.5 h-2.5" /> Sealed Perfume
          </span>
        );
      case 'accessory':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-2.5 h-2.5" /> Accessory
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-500/15 text-neutral-400 border border-neutral-500/30">
            {type}
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="w-full max-w-4xl bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-2xl shadow-2xl p-6 space-y-4 max-h-[94vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex justify-between items-center pb-3 border-b border-neutral-200 dark:border-brand-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Receive Stock Shipment &bull; {purchaseNumber}
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Record delivered raw oils, bottles, and accessories to increase live inventory.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2 shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {newProductSuccessToast && (
            <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs flex items-center gap-2 shrink-0">
              <Check className="w-4 h-4 shrink-0" />
              <span>{newProductSuccessToast}</span>
            </div>
          )}

          {/* Modal Body: Scrollable */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Supplier & Header Info Card */}
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-brand-black/60 border border-neutral-200 dark:border-brand-border grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Supplier Picker */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1 flex justify-between items-center">
                  <span>
                    Supplier / Vendor <span className="text-red-400">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQuickSupplier(!showQuickSupplier)}
                    className="text-brand-gold text-[10px] font-semibold hover:underline cursor-pointer"
                  >
                    + Quick Add Supplier
                  </button>
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => {
                    setSelectedSupplierId(e.target.value);
                    const s = suppliers.find((x) => x.id === e.target.value);
                    if (s) setSupplierNameInput(s.name);
                  }}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white font-medium focus:outline-none focus:border-brand-gold text-xs"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ''}
                    </option>
                  ))}
                </select>

                {/* Inline quick supplier add */}
                {showQuickSupplier && (
                  <div className="mt-2 p-2 rounded-lg bg-neutral-100 dark:bg-brand-surface border border-brand-gold/40 flex items-center gap-2">
                    <input
                      type="text"
                      value={quickSupplierName}
                      onChange={(e) => setQuickSupplierName(e.target.value)}
                      placeholder="Supplier name"
                      className="flex-1 px-2 py-1 bg-white dark:bg-brand-black border border-brand-border rounded text-[11px] text-white"
                    />
                    <input
                      type="text"
                      value={quickSupplierPhone}
                      onChange={(e) => setQuickSupplierPhone(e.target.value)}
                      placeholder="Phone (optional)"
                      className="w-28 px-2 py-1 bg-white dark:bg-brand-black border border-brand-border rounded text-[11px] text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleQuickAddSupplier}
                      className="px-2.5 py-1 rounded bg-brand-gold text-brand-black font-bold text-[10px] cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* Reference Number */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                  Bill / Challan Ref #
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. INV-9842"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold text-xs font-mono"
                />
              </div>
            </div>

            {/* ADD LINE ITEM BOX */}
            <div className="p-4 rounded-xl border border-brand-gold/40 bg-brand-gold/5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Plus className="w-3.5 h-3.5 text-brand-gold" />
                  <span>Select & Add Stock Item</span>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setQuickProductInitialName(itemSearchQuery || '');
                    setIsNewProductModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-gold/20 hover:bg-brand-gold text-brand-gold hover:text-brand-black border border-brand-gold/40 font-bold text-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ New Product to Catalog</span>
                </button>
              </div>

              {/* Item Search Combobox & Selected Item Display */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                {/* Combobox Search Input (6 cols) */}
                <div className="md:col-span-6 relative" ref={searchContainerRef}>
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                    Search Stock Item (Name, SKU, or Type)
                  </label>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={itemSearchQuery}
                      onFocus={() => setIsItemSearchOpen(true)}
                      onChange={(e) => {
                        setItemSearchQuery(e.target.value);
                        setIsItemSearchOpen(true);
                      }}
                      placeholder="Type to search e.g. Amber, Oudh, STK-044, Bottle..."
                      className="w-full pl-8 pr-8 py-1.5 bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white font-medium focus:outline-none focus:border-brand-gold text-xs"
                    />
                    {itemSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setItemSearchQuery('')}
                        className="absolute right-2.5 top-2 text-neutral-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Combobox Dropdown Results */}
                  {isItemSearchOpen && (
                    <div className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-xl shadow-2xl py-1 text-xs">
                      {filteredStockItems.length === 0 ? (
                        <div className="p-3 text-center text-neutral-400">
                          <p className="text-xs">No matching products found.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsItemSearchOpen(false);
                              setQuickProductInitialName(itemSearchQuery);
                              setIsNewProductModalOpen(true);
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-brand-gold text-brand-black rounded-lg font-bold text-[11px] cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Create &ldquo;{itemSearchQuery}&rdquo; as New Product</span>
                          </button>
                        </div>
                      ) : (
                        filteredStockItems.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => selectStockItem(s)}
                            className={`p-2.5 hover:bg-brand-gold/15 cursor-pointer border-b border-neutral-100 dark:border-brand-border/40 last:border-0 transition-colors flex items-center justify-between ${
                              s.id === rowStockItemId ? 'bg-brand-gold/10 font-bold' : ''
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="text-neutral-900 dark:text-white flex items-center gap-1.5 font-medium">
                                <span>{s.name}</span>
                                <span className="font-mono text-[10px] text-neutral-400">
                                  ({s.sku})
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {renderItemTypeBadge(s.itemType)}
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  Base Unit: <strong>{s.unitCode}</strong>
                                </span>
                              </div>
                            </div>

                            <div className="text-right font-mono text-[11px]">
                              <div className="text-neutral-300">
                                Stock: <strong>{s.currentQuantity}</strong> {s.unitCode}
                              </div>
                              <div className="text-brand-gold text-[10px]">
                                Cost: ৳{s.costPriceBdt.toFixed(2)}/{s.unitCode}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Active Selected Item Card (6 cols) */}
                <div className="md:col-span-6 flex flex-col justify-end">
                  {selectedRowStockItem ? (
                    <div className="p-2 rounded-lg bg-neutral-100 dark:bg-brand-black/80 border border-brand-gold/30 flex items-center justify-between">
                      <div className="truncate pr-2">
                        <div className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1.5">
                          <span>Selected Item:</span>
                          {renderItemTypeBadge(selectedRowStockItem.itemType)}
                        </div>
                        <div className="text-xs font-bold text-white truncate mt-0.5">
                          {selectedRowStockItem.name}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          SKU: {selectedRowStockItem.sku} &bull; In Stock:{' '}
                          <strong className="text-emerald-400">
                            {selectedRowStockItem.currentQuantity} {selectedRowStockItem.unitCode}
                          </strong>{' '}
                          &bull; Avg Cost:{' '}
                          <strong className="text-brand-gold">
                            ৳{selectedRowStockItem.costPriceBdt.toFixed(2)}
                          </strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsItemSearchOpen(true);
                          setItemSearchQuery('');
                        }}
                        className="shrink-0 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[10px] font-semibold border border-neutral-700 cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="p-2 text-center text-neutral-500 border border-dashed border-neutral-700 rounded-lg text-[11px]">
                      Please search and pick a stock item above.
                    </div>
                  )}
                </div>
              </div>

              {/* Row Quantity & Unit inputs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs pt-1 border-t border-brand-gold/15">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-1">
                    Received Unit
                  </label>
                  <select
                    value={rowUnit}
                    onChange={(e) => setRowUnit(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white font-bold focus:outline-none focus:border-brand-gold text-xs"
                  >
                    {selectedRowStockItem?.unitCode === 'ml' ? (
                      <>
                        <option value="tola">Tola (12 ml - Standard)</option>
                        <option value="ml">Millilitres (ml)</option>
                        <option value="l">Litres (L - 1000ml)</option>
                        <option value="g">Grams (g)</option>
                        <option value="kg">Kilograms (kg)</option>
                        <option value="tola_g">Tola Weight (11.664 g)</option>
                      </>
                    ) : (
                      <>
                        <option value="pcs">Pieces (pcs)</option>
                        <option value="bottle">Bottle</option>
                        <option value="box">Box (12 pcs)</option>
                        <option value="gross">Gross (144 pcs)</option>
                        <option value="carton">Carton (100 pcs)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={rowQuantity || ''}
                    onChange={(e) => setRowQuantity(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-gold text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-1">
                    Rate / {rowUnit} (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={rowRate || ''}
                    onChange={(e) => setRowRate(Number(e.target.value))}
                    placeholder="Cost rate"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-brand-surface border border-neutral-200 dark:border-brand-border rounded-lg text-neutral-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-gold text-xs text-brand-gold"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full py-1.5 rounded-lg bg-brand-gold text-brand-black font-extrabold text-xs hover:bg-brand-gold-light transition-all shadow cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Item (৳{rowCalculation.totalCost.toFixed(2)})</span>
                  </button>
                </div>
              </div>

              {/* Conversion Preview */}
              <div className="pt-2 border-t border-brand-gold/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-300 font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-brand-gold font-bold">Conversion:</span>
                  <span>
                    {rowQuantity} {rowUnit} ={' '}
                    <strong className="text-white">
                      {rowCalculation.convertedQty.toFixed(2)}{' '}
                      {selectedRowStockItem?.unitCode || 'unit'}
                    </strong>
                  </span>
                  <span className="text-neutral-500">&bull;</span>
                  <span>
                    Effective Base Cost:{' '}
                    <strong className="text-emerald-400">
                      ৳{rowCalculation.baseCostPerUnit.toFixed(2)}/
                      {selectedRowStockItem?.unitCode || 'unit'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Added Line Items Table */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Received Line Items ({items.length})
              </div>

              {items.length === 0 ? (
                <div className="py-6 text-center text-xs text-neutral-500 border border-dashed border-neutral-300 dark:border-brand-border rounded-xl">
                  No items added yet. Search and add received oils, bottles, or supplies above.
                </div>
              ) : (
                <div className="border border-neutral-200 dark:border-brand-border rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-brand-black/40">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100 dark:bg-brand-black/80 border-b border-neutral-200 dark:border-brand-border text-neutral-500 text-[10px] uppercase font-bold">
                      <tr>
                        <th className="py-2 px-3">Product / SKU</th>
                        <th className="py-2 px-3">Received Qty</th>
                        <th className="py-2 px-3">Purchased Rate</th>
                        <th className="py-2 px-3">Converted Stock Qty</th>
                        <th className="py-2 px-3">New Base Cost</th>
                        <th className="py-2 px-3 text-right">Line Total (৳)</th>
                        <th className="py-2 px-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-brand-border/40">
                      {items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-neutral-100/50 dark:hover:bg-neutral-800/20">
                          <td className="py-2 px-3">
                            <div className="font-semibold text-neutral-900 dark:text-white">
                              {it.productName}
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono">
                              {it.sku}
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono font-medium">
                            {it.purchasedQuantity} {it.purchasedUnit}
                          </td>
                          <td className="py-2 px-3 font-mono text-neutral-300">
                            ৳{it.unitRateBdt.toFixed(2)}/{it.purchasedUnit}
                          </td>
                          <td className="py-2 px-3 font-mono text-emerald-400">
                            +{it.convertedQuantityBase.toFixed(2)} {it.baseUnitCode}
                          </td>
                          <td className="py-2 px-3 font-mono text-neutral-300">
                            ৳{it.baseCostPerUnitBdt.toFixed(2)}/{it.baseUnitCode}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-brand-gold">
                            ৳{it.totalCostBdt.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-neutral-500 hover:text-red-400 p-1 cursor-pointer font-bold"
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* PAYMENT & PARTIAL PAYMENT SECTION */}
            <div className="p-4 rounded-xl bg-neutral-900 text-white border border-brand-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-neutral-800">
                <div>
                  <div className="text-[10px] uppercase font-bold text-neutral-400">
                    Grand Total Payable
                  </div>
                  <div className="text-2xl font-bold font-mono text-brand-gold">
                    ৳{totalOrderAmount.toFixed(2)}
                  </div>
                </div>

                {/* Payment Mode Pills */}
                <div className="flex items-center gap-1.5 bg-brand-black p-1 rounded-xl border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('full')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      paymentMode === 'full'
                        ? 'bg-emerald-500 text-white shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Full Payment (100%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode('partial');
                      if (paidAmountBdt === 0 || paidAmountBdt === totalOrderAmount) {
                        setPaidAmountBdt(Math.round(totalOrderAmount * 0.5));
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      paymentMode === 'partial'
                        ? 'bg-amber-500 text-black shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Partial Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('due')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      paymentMode === 'due'
                        ? 'bg-red-500 text-white shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Full Credit / Due
                  </button>
                </div>
              </div>

              {/* Payment Detail Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs items-center">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                    Amount Paid Now (৳)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max={totalOrderAmount}
                      step="any"
                      disabled={paymentMode === 'due'}
                      value={paidAmountBdt}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        setPaidAmountBdt(val);
                        if (val === totalOrderAmount) setPaymentMode('full');
                        else if (val === 0) setPaymentMode('due');
                        else setPaymentMode('partial');
                      }}
                      className="w-full px-3 py-1.5 bg-brand-black border border-brand-border rounded-lg text-white font-mono font-bold focus:outline-none focus:border-brand-gold text-xs"
                    />
                  </div>

                  {paymentMode === 'partial' && totalOrderAmount > 0 && (
                    <div className="flex gap-1 mt-1 text-[10px]">
                      {[0.25, 0.5, 0.75].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setPaidAmountBdt(Math.round(totalOrderAmount * pct))}
                          className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                        >
                          {pct * 100}% (৳{Math.round(totalOrderAmount * pct)})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                    Payment Method {paidAmountBdt > 0 ? '(for Paid Portion)' : ''}
                  </label>
                  <select
                    disabled={paymentMode === 'due'}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-brand-black border border-brand-border rounded-lg text-white font-semibold uppercase text-xs focus:outline-none focus:border-brand-gold disabled:opacity-50"
                  >
                    <option value="cash">Cash in Hand</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="bkash">bKash Merchant/Personal</option>
                    <option value="nagad">Nagad</option>
                  </select>
                </div>

                <div className="p-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700">
                  <div className="text-[10px] uppercase font-bold text-neutral-400">
                    Remaining Supplier Due
                  </div>
                  <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                    ৳{Math.max(0, totalOrderAmount - paidAmountBdt).toFixed(2)}
                  </div>
                  {totalOrderAmount > paidAmountBdt && (
                    <div className="text-[10px] text-amber-300/80 mt-0.5">
                      Will be tracked in {supplierNameInput || 'Supplier'}&apos;s balance
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-neutral-200 dark:border-brand-border flex justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-brand-border text-xs text-neutral-600 dark:text-neutral-400 hover:text-white font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || items.length === 0}
              onClick={handleExecutePurchase}
              className="px-6 py-2 rounded-xl bg-brand-gold text-brand-black font-extrabold text-xs hover:bg-brand-gold-light transition-all shadow-md shadow-brand-gold/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              <span>{submitting ? 'Updating Inventory...' : 'Confirm & Stock In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Nested Quick Add Product Modal */}
      <QuickAddProductModal
        isOpen={isNewProductModalOpen}
        onClose={() => setIsNewProductModalOpen(false)}
        categories={categories}
        deviceId={deviceId}
        initialName={quickProductInitialName}
        currentUser={currentUser}
        onProductCreated={handleProductCreated}
      />
    </>
  );
};
