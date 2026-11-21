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
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-accent/12 text-accent-ink border border-accent/25">
            <Droplets className="w-3 h-3" strokeWidth={1.5} /> Oil / Decant
          </span>
        );
      case 'empty_bottle':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-raised text-ink-secondary border border-hairline">
            <Package className="w-3 h-3" strokeWidth={1.5} /> Bottle
          </span>
        );
      case 'sealed_product':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-raised text-ink-secondary border border-hairline">
            <Tag className="w-3 h-3" strokeWidth={1.5} /> Sealed Perfume
          </span>
        );
      case 'accessory':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-positive/10 text-positive border border-positive/25">
            <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} /> Accessory
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-raised text-ink-muted border border-hairline">
            {type}
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
        <div className="w-full max-w-4xl bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-4 max-h-[94vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex justify-between items-center pb-3 border-b border-hairline shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/12 border border-accent/25 flex items-center justify-center text-accent-ink">
                <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-base font-medium text-ink">
                  Receive stock shipment · {purchaseNumber}
                </h3>
                <p className="text-xs text-ink-muted">
                  Record delivered raw oils, bottles, and accessories to update live inventory
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised cursor-pointer"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          {formError && (
            <div className="p-2.5 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs flex items-center gap-2 shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span>{formError}</span>
            </div>
          )}

          {newProductSuccessToast && (
            <div className="p-2.5 rounded-lg bg-positive/10 border border-positive/25 text-positive text-xs flex items-center gap-2 shrink-0">
              <Check className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span>{newProductSuccessToast}</span>
            </div>
          )}

          {/* Modal Body: Scrollable */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Supplier & Header Info Card */}
            <div className="p-3.5 rounded-xl bg-raised/60 border border-hairline grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Supplier Picker */}
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-ink-secondary mb-1 flex justify-between items-center">
                  <span>
                    Supplier / vendor <span className="text-negative">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQuickSupplier(!showQuickSupplier)}
                    className="text-accent-ink text-xs font-medium hover:underline cursor-pointer"
                  >
                    + Quick add supplier
                  </button>
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => {
                    setSelectedSupplierId(e.target.value);
                    const s = suppliers.find((x) => x.id === e.target.value);
                    if (s) setSupplierNameInput(s.name);
                  }}
                  className="w-full px-2.5 py-1.5 bg-surface border border-hairline rounded-lg text-ink font-medium focus:outline-none focus:border-accent text-xs"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ''}
                    </option>
                  ))}
                </select>

                {/* Inline quick supplier add */}
                {showQuickSupplier && (
                  <div className="mt-2 p-2 rounded-lg bg-surface border border-accent/30 flex items-center gap-2">
                    <input
                      type="text"
                      value={quickSupplierName}
                      onChange={(e) => setQuickSupplierName(e.target.value)}
                      placeholder="Supplier name"
                      className="flex-1 px-2 py-1 bg-raised border border-hairline rounded text-xs text-ink"
                    />
                    <input
                      type="text"
                      value={quickSupplierPhone}
                      onChange={(e) => setQuickSupplierPhone(e.target.value)}
                      placeholder="Phone (optional)"
                      className="w-28 px-2 py-1 bg-raised border border-hairline rounded text-xs text-ink font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleQuickAddSupplier}
                      className="px-2.5 py-1 rounded bg-accent text-accent-fg font-semibold text-xs cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* Reference Number */}
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Bill / challan ref
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="INV-9842"
                  className="w-full px-2.5 py-1.5 bg-surface border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs font-mono"
                />
              </div>
            </div>

            {/* ADD LINE ITEM BOX */}
            <div className="p-4 rounded-xl border border-accent/30 bg-accent/5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.75} />
                  <span>Select &amp; add stock item</span>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setQuickProductInitialName(itemSearchQuery || '');
                    setIsNewProductModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface hover:bg-accent hover:text-accent-fg text-accent-ink border border-accent/30 font-medium text-xs transition-colors duration-150 ease-unslop cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>+ New Product to Catalog</span>
                </button>
              </div>

              {/* Item Search Combobox & Selected Item Display */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                {/* Combobox Search Input (6 cols) */}
                <div className="md:col-span-6 relative" ref={searchContainerRef}>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Search stock item (name, SKU, or type)
                  </label>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" strokeWidth={1.5} />
                    <input
                      type="text"
                      value={itemSearchQuery}
                      onFocus={() => setIsItemSearchOpen(true)}
                      onChange={(e) => {
                        setItemSearchQuery(e.target.value);
                        setIsItemSearchOpen(true);
                      }}
                      placeholder="Amber, Oudh, STK-044, Bottle"
                      className="w-full pl-8 pr-8 py-1.5 bg-surface border border-hairline rounded-lg text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-xs"
                    />
                    {itemSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setItemSearchQuery('')}
                        className="absolute right-2.5 top-2 text-ink-muted hover:text-ink cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>

                  {/* Combobox Dropdown Results */}
                  {isItemSearchOpen && (
                    <div className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-surface border border-hairline-strong rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)] py-1 text-xs">
                      {filteredStockItems.length === 0 ? (
                        <div className="p-3 text-center text-ink-muted">
                          <p className="text-xs">No matching products found</p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsItemSearchOpen(false);
                              setQuickProductInitialName(itemSearchQuery);
                              setIsNewProductModalOpen(true);
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-accent text-accent-fg rounded-lg font-semibold text-xs cursor-pointer"
                          >
                            <Plus className="w-3 h-3" strokeWidth={1.75} />
                            <span>Create &ldquo;{itemSearchQuery}&rdquo; as New Product</span>
                          </button>
                        </div>
                      ) : (
                        filteredStockItems.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => selectStockItem(s)}
                            className={`p-2.5 hover:bg-raised cursor-pointer border-b border-hairline last:border-0 transition-colors duration-150 ease-unslop flex items-center justify-between ${
                              s.id === rowStockItemId ? 'bg-accent/10 font-medium' : ''
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="text-ink flex items-center gap-1.5 font-medium">
                                <span>{s.name}</span>
                                <span className="font-mono text-[11px] text-ink-muted">
                                  ({s.sku})
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {renderItemTypeBadge(s.itemType)}
                                <span className="text-[11px] text-ink-muted font-mono">
                                  Base unit <strong className="text-ink-secondary">{s.unitCode}</strong>
                                </span>
                              </div>
                            </div>

                            <div className="text-right font-mono tabular-nums text-[11px]">
                              <div className="text-ink-secondary">
                                Stock <strong className="text-ink">{s.currentQuantity}</strong> {s.unitCode}
                              </div>
                              <div className="text-accent-ink">
                                Cost ৳{s.costPriceBdt.toFixed(2)}/{s.unitCode}
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
                    <div className="p-2.5 rounded-lg bg-surface border border-accent/30 flex items-center justify-between">
                      <div className="truncate pr-2">
                        <div className="text-[11px] font-medium text-ink-muted flex items-center gap-1.5">
                          <span>Selected item</span>
                          {renderItemTypeBadge(selectedRowStockItem.itemType)}
                        </div>
                        <div className="text-xs font-medium text-ink truncate mt-0.5">
                          {selectedRowStockItem.name}
                        </div>
                        <div className="text-[11px] text-ink-muted font-mono tabular-nums">
                          SKU {selectedRowStockItem.sku} · In stock{' '}
                          <strong className="text-positive font-medium">
                            {selectedRowStockItem.currentQuantity} {selectedRowStockItem.unitCode}
                          </strong>{' '}
                          · Avg cost{' '}
                          <strong className="text-accent-ink font-medium">
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
                        className="shrink-0 px-2.5 py-1 rounded-md bg-raised hover:border-hairline-strong text-ink-secondary hover:text-ink text-[11px] font-medium border border-hairline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="p-2.5 text-center text-ink-muted border border-dashed border-hairline rounded-lg text-xs">
                      Search and pick a stock item above
                    </div>
                  )}
                </div>
              </div>

              {/* Row Quantity & Unit inputs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs pt-2 border-t border-hairline">
                <div>
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">
                    Received unit
                  </label>
                  <select
                    value={rowUnit}
                    onChange={(e) => setRowUnit(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface border border-hairline rounded-lg text-ink font-medium focus:outline-none focus:border-accent text-xs"
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
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={rowQuantity || ''}
                    onChange={(e) => setRowQuantity(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-surface border border-hairline rounded-lg text-ink font-mono tabular-nums font-medium focus:outline-none focus:border-accent text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">
                    Rate / {rowUnit} (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={rowRate || ''}
                    onChange={(e) => setRowRate(Number(e.target.value))}
                    placeholder="Cost rate"
                    className="w-full px-2.5 py-1.5 bg-surface border border-hairline rounded-lg text-accent-ink font-mono tabular-nums font-medium focus:outline-none focus:border-accent text-xs"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full py-1.5 px-3 rounded-lg bg-accent text-accent-fg font-semibold text-xs hover:bg-accent-hover transition-colors duration-150 ease-unslop cursor-pointer flex items-center justify-center gap-1.5 tabular-nums"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>Add Item (৳{rowCalculation.totalCost.toFixed(2)})</span>
                  </button>
                </div>
              </div>

              {/* Conversion Preview */}
              <div className="pt-2 border-t border-hairline flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary font-mono tabular-nums">
                <div className="flex items-center gap-2">
                  <span className="text-accent-ink font-medium">Conversion</span>
                  <span>
                    {rowQuantity} {rowUnit} ={' '}
                    <strong className="text-ink font-medium">
                      {rowCalculation.convertedQty.toFixed(2)}{' '}
                      {selectedRowStockItem?.unitCode || 'unit'}
                    </strong>
                  </span>
                  <span className="text-ink-muted">·</span>
                  <span>
                    Base cost{' '}
                    <strong className="text-positive font-medium">
                      ৳{rowCalculation.baseCostPerUnit.toFixed(2)}/
                      {selectedRowStockItem?.unitCode || 'unit'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Added Line Items Table */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-ink-secondary">
                Received line items ({items.length})
              </div>

              {items.length === 0 ? (
                <div className="py-6 text-center text-xs text-ink-muted border border-dashed border-hairline rounded-xl">
                  No items added yet. Search and add received oils, bottles, or supplies above.
                </div>
              ) : (
                <div className="border border-hairline rounded-xl overflow-hidden bg-surface">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-raised/70 border-b border-hairline text-ink-muted font-medium">
                      <tr>
                        <th className="py-2 px-3">Product / SKU</th>
                        <th className="py-2 px-3">Received qty</th>
                        <th className="py-2 px-3">Purchased rate</th>
                        <th className="py-2 px-3">Converted stock</th>
                        <th className="py-2 px-3">New base cost</th>
                        <th className="py-2 px-3 text-right">Line total (৳)</th>
                        <th className="py-2 px-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-raised/40">
                          <td className="py-2 px-3">
                            <div className="font-medium text-ink">
                              {it.productName}
                            </div>
                            <div className="text-[11px] text-ink-muted font-mono">
                              {it.sku}
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums font-medium text-ink">
                            {it.purchasedQuantity} {it.purchasedUnit}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-ink-secondary">
                            ৳{it.unitRateBdt.toFixed(2)}/{it.purchasedUnit}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-positive">
                            +{it.convertedQuantityBase.toFixed(2)} {it.baseUnitCode}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-ink-secondary">
                            ৳{it.baseCostPerUnitBdt.toFixed(2)}/{it.baseUnitCode}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-accent-ink">
                            ৳{it.totalCostBdt.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-ink-muted hover:text-negative p-1 cursor-pointer font-medium"
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
            <div className="p-4 rounded-xl bg-raised border border-hairline space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-hairline">
                <div>
                  <div className="text-xs text-ink-muted">
                    Grand total payable
                  </div>
                  <div className="text-2xl font-medium font-mono tabular-nums text-accent-ink">
                    ৳{totalOrderAmount.toFixed(2)}
                  </div>
                </div>

                {/* Payment Mode Pills */}
                <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-hairline">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('full')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors duration-150 ease-unslop cursor-pointer ${
                      paymentMode === 'full'
                        ? 'bg-positive text-white font-semibold'
                        : 'text-ink-muted hover:text-ink'
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
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors duration-150 ease-unslop cursor-pointer ${
                      paymentMode === 'partial'
                        ? 'bg-accent text-accent-fg font-semibold'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    Partial Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('due')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors duration-150 ease-unslop cursor-pointer ${
                      paymentMode === 'due'
                        ? 'bg-negative text-white font-semibold'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    Full Credit / Due
                  </button>
                </div>
              </div>

              {/* Payment Detail Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs items-center">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Amount paid now (৳)
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
                      className="w-full px-3 py-1.5 bg-surface border border-hairline rounded-lg text-ink font-mono tabular-nums font-medium focus:outline-none focus:border-accent text-xs"
                    />
                  </div>

                  {paymentMode === 'partial' && totalOrderAmount > 0 && (
                    <div className="flex gap-1 mt-1.5 text-[11px]">
                      {[0.25, 0.5, 0.75].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setPaidAmountBdt(Math.round(totalOrderAmount * pct))}
                          className="px-2 py-0.5 rounded bg-surface border border-hairline hover:border-hairline-strong text-ink-secondary cursor-pointer tabular-nums"
                        >
                          {pct * 100}% (৳{Math.round(totalOrderAmount * pct)})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Payment method {paidAmountBdt > 0 ? '(paid portion)' : ''}
                  </label>
                  <select
                    disabled={paymentMode === 'due'}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface border border-hairline rounded-lg text-ink font-medium text-xs focus:outline-none focus:border-accent disabled:opacity-50"
                  >
                    <option value="cash">Cash in Hand</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="bkash">bKash Merchant/Personal</option>
                    <option value="nagad">Nagad</option>
                  </select>
                </div>

                <div className="p-2.5 rounded-lg bg-surface border border-hairline">
                  <div className="text-[11px] text-ink-muted">
                    Remaining supplier due
                  </div>
                  <div className="text-lg font-medium font-mono tabular-nums text-warning mt-0.5">
                    ৳{Math.max(0, totalOrderAmount - paidAmountBdt).toFixed(2)}
                  </div>
                  {totalOrderAmount > paidAmountBdt && (
                    <div className="text-[11px] text-ink-muted mt-0.5">
                      Tracked in {supplierNameInput || 'Supplier'}&apos;s balance
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-hairline flex justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-hairline bg-raised text-xs text-ink-secondary hover:text-ink font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || items.length === 0}
              onClick={handleExecutePurchase}
              className="px-5 py-2 rounded-lg bg-accent text-accent-fg font-semibold text-xs hover:bg-accent-hover transition-colors duration-150 ease-unslop disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              <span>{submitting ? 'Updating Inventory…' : 'Confirm & Stock In'}</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
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
