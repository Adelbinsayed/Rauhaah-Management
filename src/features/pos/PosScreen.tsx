import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  User,
  PauseCircle,
  PlayCircle,
  Percent,
  ArrowRight,
  X,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useAppStore } from '../../app/store';
import { canViewCost } from '../../domain/auth/permissions';
import { catalogRepo } from '../../data/repositories/catalogRepo';
import { posRepo } from '../../data/repositories/posRepo';
import { calculateCartTotals, calculateLineTotal } from '../../domain/pos/posCalculations';
import type { CartItem, Customer, HeldCart, SalePayment } from '../../domain/pos/types';
import type { Category, Sellable } from '../../domain/catalog/types';
import { DecantPourModal } from './DecantPourModal';
import { QuickCustomerModal } from './QuickCustomerModal';
import { CheckoutModal } from './CheckoutModal';
import { SaleReceiptModal } from './SaleReceiptModal';

interface PosScreenProps {
  deviceId: string;
}

export const PosScreen: React.FC<PosScreenProps> = ({ deviceId }) => {
  const { currentUser, permissions, shopSettings, heldCarts, holdCart, removeHeldCart } = useAppStore();
  const allowCost = canViewCost(permissions);
  const negativeStockPolicy = shopSettings?.negativeStockPolicy ?? 'warn_allow';
  const isStrictBlock = negativeStockPolicy === 'block';
  const isWarnAllow = negativeStockPolicy === 'warn_allow';

  // Catalog State
  const [products, setProducts] = useState<Sellable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [stockError, setStockError] = useState<string | null>(null);
  const [cartDiscountPercent, setCartDiscountPercent] = useState<number>(0);
  const [cartDiscountAmount, setCartDiscountAmount] = useState<number>(0);
  const [cartDiscountReason, setCartDiscountReason] = useState<string>('');
  const [showCartDiscountInput, setShowCartDiscountInput] = useState(false);

  // Customer State
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerNameError, setCustomerNameError] = useState(false);
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const customerNameInputRef = useRef<HTMLInputElement>(null);
  const phoneSearchSeqRef = useRef(0);
  const phoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Held Carts
  const [showHeldDrawer, setShowHeldDrawer] = useState(false);

  // Modals
  const [decantProduct, setDecantProduct] = useState<Sellable | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<{
    invoiceNumber: string;
    customer: Customer | null;
    items: CartItem[];
    payments: SalePayment[];
    totals: ReturnType<typeof calculateCartTotals>;
  } | null>(null);

  // Load Products & Categories
  const loadCatalog = async () => {
    try {
      setLoading(true);
      const [p, c] = await Promise.all([
        catalogRepo.getSellables(undefined, allowCost),
        catalogRepo.getCategories(),
      ]);
      setProducts(p);
      setCategories(c);
    } catch (err) {
      console.error('Failed to load POS catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [allowCost]);

  // Close customer dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(e.target as Node)
      ) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup phone debounce timer on unmount
  useEffect(() => {
    return () => {
      if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
    };
  }, []);

  // Close held carts drawer on Escape
  useEffect(() => {
    if (!showHeldDrawer) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowHeldDrawer(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHeldDrawer]);

  // Handle phone input changes with 200ms debounce, race guard, and auto-population
  const handlePhoneChange = (val: string) => {
    setCustomerPhone(val);
    const clean = val.trim();
    const seq = ++phoneSearchSeqRef.current;

    if (phoneDebounceRef.current) {
      clearTimeout(phoneDebounceRef.current);
    }

    if (!clean) {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
      setCustomerNameError(false);
      if (selectedCustomer) {
        setSelectedCustomer(null);
        setCustomerName('');
      }
      return;
    }

    phoneDebounceRef.current = setTimeout(async () => {
      try {
        const results = await posRepo.searchCustomers(clean);
        if (seq !== phoneSearchSeqRef.current) return;

        setCustomerResults(results);
        setShowCustomerDropdown(results.length > 0);

        // Check if there is an exact or normalized phone match
        const cleanDigits = clean.replace(/\D/g, '');
        const exactMatch = results.find(
          (c) =>
            c.phone.replace(/\D/g, '') === cleanDigits ||
            c.phone === clean
        );

        if (exactMatch) {
          setSelectedCustomer(exactMatch);
          setCustomerName(exactMatch.name);
          setCustomerNameError(false);
        } else {
          // If current input does not match existing customer, detach selectedCustomer
          setSelectedCustomer((prev) => (prev && prev.phone !== clean ? null : prev));
        }
      } catch (err) {
        if (seq === phoneSearchSeqRef.current) {
          console.error('Customer phone search error:', err);
        }
      }
    }, 200);
  };

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerPhone(c.phone);
    setCustomerName(c.name);
    setCustomerNameError(false);
    setShowCustomerDropdown(false);
    setCustomerResults([]);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerPhone('');
    setCustomerName('');
    setCustomerNameError(false);
    setCustomerResults([]);
    setShowCustomerDropdown(false);
  };

  const getItemStockConsumption = (item: CartItem) =>
    item.sellableType === 'loose_decant' && item.unitCode === 'bottle' && item.bottleSizeMl
      ? item.quantity * item.bottleSizeMl
      : item.quantity;

  const getSellableConsumptionInCart = (sellableId: string, items: CartItem[] = cartItems) =>
    items
      .filter((i) => i.sellableId === sellableId)
      .reduce((sum, i) => sum + getItemStockConsumption(i), 0);

  const hasOverstockInCart = (items: CartItem[] = cartItems) => {
    const bySellable = new Map<string, { consumed: number; stockInHand: number; name: string }>();
    for (const item of items) {
      const prev = bySellable.get(item.sellableId);
      const consumed = getItemStockConsumption(item);
      if (prev) {
        prev.consumed += consumed;
      } else {
        bySellable.set(item.sellableId, {
          consumed,
          stockInHand: item.stockInHand,
          name: item.productName,
        });
      }
    }
    for (const entry of bySellable.values()) {
      if (entry.consumed > entry.stockInHand) return entry.name;
    }
    return null;
  };

  const handleProceedToCheckout = () => {
    if (cartItems.length === 0) return;

    if (isStrictBlock) {
      const blockedItem = hasOverstockInCart(cartItems);
      if (blockedItem) {
        setStockError(`Insufficient stock for ${blockedItem} (strict block policy enabled).`);
        return;
      }
    }

    // Customer Name is mandatory if a phone number has been entered
    if (customerPhone.trim() && !customerName.trim() && !selectedCustomer) {
      setCustomerNameError(true);
      customerNameInputRef.current?.focus();
      return;
    }

    setStockError(null);
    setCustomerNameError(false);
    setIsCheckoutOpen(true);
  };

  // Active customer helper (either selected or typed)
  const activeCustomer: Customer | null = useMemo(() => {
    if (selectedCustomer) return selectedCustomer;
    if (customerPhone.trim() || customerName.trim()) {
      return {
        id: '',
        phone: customerPhone.trim(),
        name: customerName.trim() || 'Customer',
        notes: null,
        dueBalanceBdt: 0,
        visitCount: 0,
        totalSpendBdt: 0,
        lastVisitAt: null,
        createdAt: '',
      };
    }
    return null;
  }, [selectedCustomer, customerPhone, customerName]);

  // Cart Calculations
  const cartTotals = useMemo(() => {
    return calculateCartTotals(cartItems, cartDiscountPercent, cartDiscountAmount, 0);
  }, [cartItems, cartDiscountPercent, cartDiscountAmount]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, search]);

  // Adding product to cart
  const handleProductClick = (product: Sellable) => {
    const primaryComp =
      product.components?.find((c) => c.isPrimary) ?? product.components?.[0];
    const isPreSizedDecant =
      product.sellableType === 'loose_decant' &&
      Boolean(primaryComp && primaryComp.quantity > 1);

    if (product.sellableType === 'loose_decant' && !isPreSizedDecant) {
      // Per-1ml bulk pour: Open Decant / Pouring Modal to select bottle size (3ml, 6ml, 12ml) and price
      setStockError(null);
      setDecantProduct(product);
    } else {
      // Packaged product, accessory, or pre-sized decant bottle: Add 1 unit directly
      const unitConsumption = isPreSizedDecant && primaryComp ? primaryComp.quantity : 1;
      const currentConsumption = getSellableConsumptionInCart(product.id);
      const stockAvailable = product.primaryStockQuantity ?? 0;

      if (isStrictBlock && currentConsumption + unitConsumption > stockAvailable) {
        setStockError(
          `Insufficient stock for ${product.name} (strict block policy enabled: ${stockAvailable} ${product.primaryUnitCode || 'pcs'} available).`
        );
        return;
      }

      setStockError(null);
      const existingIdx = cartItems.findIndex(
        (item) =>
          item.sellableId === product.id &&
          (isPreSizedDecant ? item.unitCode === 'bottle' : !item.bottleSizeMl)
      );

      if (existingIdx >= 0) {
        // Increment quantity
        setCartItems((prev) =>
          prev.map((item, idx) => {
            if (idx === existingIdx) {
              const newQty = item.quantity + 1;
              const { lineTotalBdt } = calculateLineTotal({
                quantity: newQty,
                unitPriceBdt: item.unitPriceBdt,
                discountPercent: item.discountPercent,
                discountAmountBdt: item.discountAmountBdt,
              });
              return { ...item, quantity: newQty, lineTotalBdt };
            }
            return item;
          })
        );
      } else {
        // Add new item
        const unitPrice = product.retailPriceBdt;
        const { lineTotalBdt } = calculateLineTotal({
          quantity: 1,
          unitPriceBdt: unitPrice,
        });

        const newItem: CartItem = {
          id: `${product.id}-${Date.now()}`,
          sellableId: product.id,
          productName: product.name,
          sku: product.sku,
          barcode: product.barcode,
          sellableType: product.sellableType,
          unitCode: isPreSizedDecant ? 'bottle' : product.primaryUnitCode || 'pcs',
          bottleSizeMl: isPreSizedDecant ? primaryComp!.quantity : undefined,
          quantity: 1,
          unitPriceBdt: unitPrice,
          idealRetailPriceBdt: product.retailPriceBdt,
          costPriceBdt: product.calculatedCostBdt || 0,
          discountPercent: 0,
          discountAmountBdt: 0,
          lineTotalBdt,
          stockInHand: product.primaryStockQuantity ?? 0,
        };

        setCartItems((prev) => [newItem, ...prev]);
      }
    }
  };

  // Add Decant to Cart from Modal
  const handleConfirmDecant = (params: {
    bottleSizeMl: number;
    unitPriceBdt: number;
    customLineTotalBdt?: number;
  }) => {
    if (!decantProduct) return;

    const currentConsumption = getSellableConsumptionInCart(decantProduct.id);
    const stockAvailable = decantProduct.primaryStockQuantity ?? 0;
    if (isStrictBlock && currentConsumption + params.bottleSizeMl > stockAvailable) {
      setStockError(
        `Insufficient stock for ${decantProduct.name} (strict block policy enabled: ${stockAvailable} ${decantProduct.primaryUnitCode || 'ml'} available).`
      );
      return;
    }

    setStockError(null);
    const finalTotal =
      params.customLineTotalBdt ?? Math.round(params.bottleSizeMl * params.unitPriceBdt);

    const newItem: CartItem = {
      id: `${decantProduct.id}-${params.bottleSizeMl}-${Date.now()}`,
      sellableId: decantProduct.id,
      productName: decantProduct.name,
      sku: decantProduct.sku,
      barcode: decantProduct.barcode,
      sellableType: 'loose_decant',
      unitCode: decantProduct.primaryUnitCode || 'ml',
      bottleSizeMl: params.bottleSizeMl,
      quantity: params.bottleSizeMl,
      unitPriceBdt: params.unitPriceBdt,
      idealRetailPriceBdt: decantProduct.retailPriceBdt,
      costPriceBdt: decantProduct.calculatedCostBdt || 0,
      discountPercent: 0,
      discountAmountBdt: 0,
      lineTotalBdt: finalTotal,
      stockInHand: stockAvailable,
    };

    setCartItems((prev) => [newItem, ...prev]);
  };

  // Update Item Quantity
  const handleUpdateQuantity = (itemId: string, delta: number) => {
    const targetItem = cartItems.find((item) => item.id === itemId);
    if (!targetItem) return;

    const step =
      targetItem.sellableType === 'loose_decant' && targetItem.unitCode !== 'bottle'
        ? targetItem.bottleSizeMl || 1
        : 1;
    const newQty = targetItem.quantity + delta * step;

    if (delta > 0 && isStrictBlock) {
      const otherConsumption = cartItems
        .filter((i) => i.sellableId === targetItem.sellableId && i.id !== itemId)
        .reduce((sum, i) => sum + getItemStockConsumption(i), 0);
      const updatedConsumption =
        targetItem.sellableType === 'loose_decant' &&
        targetItem.unitCode === 'bottle' &&
        targetItem.bottleSizeMl
          ? newQty * targetItem.bottleSizeMl
          : newQty;
      if (otherConsumption + updatedConsumption > targetItem.stockInHand) {
        setStockError(
          `Insufficient stock for ${targetItem.productName} (strict block policy enabled).`
        );
        return;
      }
    }

    setStockError(null);
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            if (newQty <= 0) return null;

            const { lineTotalBdt } = calculateLineTotal({
              quantity: newQty,
              unitPriceBdt: item.unitPriceBdt,
              discountPercent: item.discountPercent,
              discountAmountBdt: item.discountAmountBdt,
            });
            return { ...item, quantity: newQty, lineTotalBdt };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Remove Item
  const handleRemoveItem = (itemId: string) => {
    setStockError(null);
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Hold Current Cart
  const handleHoldCart = () => {
    if (cartItems.length === 0) return;
    const newHold: HeldCart = {
      id: `HOLD-${Date.now()}`,
      heldAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customer: selectedCustomer || activeCustomer,
      items: cartItems,
      note: customerName.trim() || customerPhone.trim() || (selectedCustomer ? selectedCustomer.name : 'Walk-in'),
    };
    holdCart(newHold);
    // Clear current cart
    setCartItems([]);
    setStockError(null);
    setSelectedCustomer(null);
    setCustomerPhone('');
    setCustomerName('');
    setCustomerResults([]);
    setShowCustomerDropdown(false);
    setCartDiscountPercent(0);
    setCartDiscountAmount(0);
  };

  // Resume Held Cart
  const handleResumeCart = (hold: HeldCart) => {
    setCartItems(hold.items);
    setStockError(null);
    setSelectedCustomer(hold.customer);
    setCustomerPhone(hold.customer ? hold.customer.phone : '');
    setCustomerName(
      hold.customer
        ? hold.customer.name
        : hold.note && hold.note !== 'Walk-in'
        ? hold.note
        : ''
    );
    setCustomerResults([]);
    setShowCustomerDropdown(false);
    removeHeldCart(hold.id);
    setShowHeldDrawer(false);
  };

  // Complete Sale
  const handleExecuteSale = async (payments: SalePayment[], paidAmount: number) => {
    if (!currentUser) {
      throw new Error('No active cashier session found. Please log in again.');
    }
    if (cartItems.length === 0) {
      throw new Error('Your cart is empty.');
    }
    if (isStrictBlock) {
      const blockedItem = hasOverstockInCart(cartItems);
      if (blockedItem) {
        throw new Error(`Insufficient stock for ${blockedItem} (strict block policy enabled).`);
      }
    }

    // Customer name is mandatory if phone is entered
    if (customerPhone.trim() && !customerName.trim() && !selectedCustomer) {
      setCustomerNameError(true);
      customerNameInputRef.current?.focus();
      throw new Error('Customer Name is mandatory when a phone number is entered.');
    }

    // Determine customer to link: selected or auto-created from entered phone/name
    let finalCustomer: Customer | null = selectedCustomer;
    const cleanPhone = customerPhone.trim().replace(/[\s-]/g, '');
    const cleanName = customerName.trim();

    if (!finalCustomer && cleanPhone) {
      try {
        const existing = await posRepo.getCustomerByPhone(cleanPhone);
        if (existing) {
          finalCustomer = existing;
        } else {
          finalCustomer = await posRepo.quickCreateCustomer(
            cleanPhone,
            cleanName || `Customer ${cleanPhone.slice(-4)}`,
            deviceId
          );
        }
      } catch (err) {
        console.warn('Customer auto-create/lookup during sale execution:', err);
      }
    }

    const invoiceNumber = await posRepo.getNextInvoiceNumber(shopSettings?.invoicePrefix || 'INV');
    const finalTotals = calculateCartTotals(
      cartItems,
      cartDiscountPercent,
      cartDiscountAmount,
      paidAmount
    );

    await posRepo.completeSale({
      invoiceNumber,
      customer: finalCustomer,
      cashierId: currentUser.id,
      items: cartItems,
      totals: finalTotals,
      payments,
      branchId: 'default-branch',
      deviceId,
    });

    // Refresh products catalog to show updated stock
    await loadCatalog();

    // Trigger Receipt modal
    setCompletedSale({
      invoiceNumber,
      customer: finalCustomer,
      items: cartItems,
      payments,
      totals: finalTotals,
    });

    setIsCheckoutOpen(false);

    // Reset register for next sale
    setCartItems([]);
    setStockError(null);
    setSelectedCustomer(null);
    setCustomerPhone('');
    setCustomerName('');
    setCustomerResults([]);
    setShowCustomerDropdown(false);
    setCartDiscountPercent(0);
    setCartDiscountAmount(0);
    setCartDiscountReason('');
  };

  return (
    <div className="flex h-full gap-4 select-none">
      {/* LEFT: PRODUCTS BROWSER */}
      <div className="flex-1 flex flex-col bg-surface rounded-xl border border-hairline overflow-hidden">
        {/* Top Search & Scan Bar */}
        <div className="p-4 border-b border-hairline bg-surface flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" strokeWidth={1.5} />
            <input
              ref={searchInputRef}
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = search.trim().toLowerCase();
                  if (!q) return;
                  const exactMatch = products.find(
                    (p) =>
                      p.sku.toLowerCase() === q ||
                      (p.barcode && p.barcode.toLowerCase() === q)
                  );
                  if (exactMatch) {
                    e.preventDefault();
                    handleProductClick(exactMatch);
                    setSearch('');
                  }
                }
              }}
              placeholder="Search perfumes, attars, SKU or barcode"
              className="w-full pl-9 pr-12 py-2 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-xs text-ink-muted hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>

          {heldCarts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHeldDrawer(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-warning/10 border border-warning/25 text-warning text-xs font-medium hover:bg-warning/20 transition-colors duration-150 ease-unslop tabular-nums"
            >
              <PlayCircle className="w-4 h-4" strokeWidth={1.5} />
              <span>Held Carts ({heldCarts.length})</span>
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="px-4 py-2 border-b border-hairline bg-subtle flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors duration-150 ease-unslop ${
              selectedCategory === 'all'
                ? 'bg-accent text-accent-fg font-semibold'
                : 'bg-surface border border-hairline text-ink-secondary hover:text-ink'
            }`}
          >
            All Products
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors duration-150 ease-unslop ${
                selectedCategory === c.id
                  ? 'bg-accent text-accent-fg font-semibold'
                  : 'bg-surface border border-hairline text-ink-secondary hover:text-ink'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start auto-rows-max">
          {loading ? (
            <div className="col-span-full py-16 text-center text-ink-muted text-xs">
              Loading shop products…
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full py-16 text-center text-ink-muted text-xs">
              No products match &ldquo;{search}&rdquo;
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isOil = p.sellableType === 'loose_decant';
              const stock = p.primaryStockQuantity ?? 0;
              const unit = p.primaryUnitCode || (isOil ? 'ml' : 'pcs');
              const primaryComp =
                p.components?.find((c) => c.isPrimary) ?? p.components?.[0];
              const isPreSized = isOil && Boolean(primaryComp && primaryComp.quantity > 1);
              const priceUnitLabel = isPreSized ? `${primaryComp!.quantity}ml` : unit;
              const isLow = stock <= 5;

              return (
                <div
                  key={p.id}
                  onClick={() => handleProductClick(p)}
                  className="group relative h-36 p-3 rounded-xl bg-raised/60 hover:bg-raised border border-hairline hover:border-accent/50 transition-colors duration-150 ease-unslop cursor-pointer flex flex-col justify-between self-start w-full"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-medium border ${
                          isOil
                            ? 'bg-accent/12 text-accent-ink border-accent/25'
                            : 'bg-surface text-ink-muted border-hairline'
                        }`}
                      >
                        {isOil ? 'Attar / Oil' : 'Packaged'}
                      </span>
                      <span
                        className={`text-[11px] font-mono tabular-nums font-medium ${
                          isLow ? 'text-negative' : 'text-ink-muted'
                        }`}
                      >
                        {stock} {unit}
                      </span>
                    </div>

                    <h4 className="text-xs font-medium text-ink group-hover:text-accent-ink transition-colors duration-150 ease-unslop line-clamp-2">
                      {p.name}
                    </h4>
                    <div className="text-[11px] text-ink-muted font-mono mt-0.5">{p.sku}</div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-hairline">
                    <span className="text-xs font-medium font-mono tabular-nums text-accent-ink">
                      ৳{p.retailPriceBdt.toFixed(2)}
                      <span className="text-[11px] text-ink-muted font-normal"> / {priceUnitLabel}</span>
                    </span>

                    <button
                      type="button"
                      className="p-1 rounded-md bg-surface border border-hairline text-ink-secondary group-hover:bg-accent group-hover:text-accent-fg group-hover:border-accent transition-colors duration-150 ease-unslop"
                    >
                      <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: CART & CHECKOUT TERMINAL */}
      <div className="w-96 flex flex-col bg-surface rounded-xl border border-hairline overflow-hidden">
        {/* Customer Lookup & Loyalty Bar */}
        <div className="p-3 border-b border-hairline bg-subtle space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-secondary flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
              <span>Customer information</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsQuickCustomerOpen(true)}
                className="text-xs font-medium text-accent-ink hover:text-accent transition-colors duration-150 ease-unslop cursor-pointer"
              >
                + New
              </button>
              {(customerPhone || customerName || selectedCustomer) ? (
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  className="text-xs text-ink-muted hover:text-negative flex items-center gap-1 transition-colors duration-150 ease-unslop"
                  title="Reset to walk-in"
                >
                  <X className="w-3 h-3" strokeWidth={1.5} />
                  <span>Clear (walk-in)</span>
                </button>
              ) : (
                <span className="text-xs text-ink-muted">Walk-in</span>
              )}
            </div>
          </div>

          {/* Dual Inputs: Customer Phone & Customer Name */}
          <div className="grid grid-cols-2 gap-2 relative">
            {/* Phone Input with live autocomplete */}
            <div className="relative">
              <label className="text-[11px] font-medium text-ink-muted block mb-1">
                Phone number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onFocus={() => {
                    if (customerResults.length > 0) setShowCustomerDropdown(true);
                  }}
                  placeholder="017... / 019..."
                  className="w-full px-2.5 py-1.5 bg-surface border border-hairline rounded-lg text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent font-mono tabular-nums"
                />
              </div>

              {/* Autocomplete Suggestions Live Dropdown */}
              {showCustomerDropdown && customerResults.length > 0 && (
                <div
                  ref={customerDropdownRef}
                  className="absolute left-0 w-80 top-full mt-1.5 z-30 bg-surface border border-hairline-strong rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)] overflow-hidden max-h-52 overflow-y-auto"
                >
                  <div className="px-3 py-1.5 bg-raised border-b border-hairline text-[11px] font-medium text-accent-ink flex justify-between items-center">
                    <span>Existing customers ({customerResults.length})</span>
                    <span className="text-[11px] text-ink-muted font-normal">Click to fill</span>
                  </div>
                  {customerResults.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className="p-2.5 hover:bg-raised cursor-pointer text-xs border-b border-hairline last:border-0 flex justify-between items-center transition-colors duration-150 ease-unslop"
                    >
                      <div>
                        <div className="font-medium text-ink flex items-center gap-1.5">
                          <span>{c.name}</span>
                          {c.dueBalanceBdt > 0 && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/25 font-mono tabular-nums">
                              Due ৳{c.dueBalanceBdt}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-accent-ink font-mono tabular-nums">{c.phone}</div>
                      </div>
                      <div className="text-right tabular-nums">
                        <div className="text-[11px] text-ink-secondary font-mono font-medium">
                          ৳{c.totalSpendBdt || 0}
                        </div>
                        <div className="text-[11px] text-ink-muted">
                          {c.visitCount ?? 0} visit{(c.visitCount ?? 0) === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Name Input */}
            <div>
              <label className="text-[11px] font-medium text-ink-muted mb-1 flex items-center justify-between">
                <span>
                  Customer name
                  {customerPhone.trim() && (
                    <span className="text-negative font-medium ml-1">*</span>
                  )}
                </span>
                {customerNameError && (
                  <span className="text-[11px] text-negative font-medium">required</span>
                )}
              </label>
              <input
                ref={customerNameInputRef}
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (e.target.value.trim()) setCustomerNameError(false);
                }}
                placeholder={customerPhone.trim() ? 'Required name' : 'Customer name'}
                className={`w-full px-2.5 py-1.5 bg-surface border rounded-lg text-xs text-ink placeholder-ink-muted focus:outline-none transition-colors duration-150 ease-unslop ${
                  customerNameError
                    ? 'border-negative bg-negative/10'
                    : 'border-hairline focus:border-accent'
                }`}
              />
              {customerNameError && (
                <p className="text-[11px] text-negative mt-1 leading-tight">
                  Please enter customer name
                </p>
              )}
            </div>
          </div>

          {/* Selected / Recognized Customer Loyalty Badge */}
          {selectedCustomer && (
            <div className="p-2 rounded-lg bg-surface border border-accent/25 flex items-center justify-between text-xs tabular-nums">
              <div className="flex items-center gap-2">
                <span className="text-accent-ink font-medium">Loyalty</span>
                <span className="text-ink-secondary">
                  Visits <strong className="text-ink font-medium">{selectedCustomer.visitCount ?? 0}</strong>
                </span>
                <span className="text-ink-muted">·</span>
                <span className="text-ink-secondary">
                  Spend <strong className="text-accent-ink font-mono font-medium">৳{selectedCustomer.totalSpendBdt || 0}</strong>
                </span>
              </div>
              {selectedCustomer.dueBalanceBdt > 0 && (
                <span className="text-warning font-medium bg-warning/10 px-1.5 py-0.5 rounded border border-warning/25 font-mono">
                  Due ৳{selectedCustomer.dueBalanceBdt}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Active Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {stockError && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
              <span className="flex-1">{stockError}</span>
              <button
                type="button"
                onClick={() => setStockError(null)}
                className="text-negative/70 hover:text-negative"
                aria-label="Dismiss stock error"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          )}

          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-ink-muted">
              <ShoppingCart className="w-7 h-7 mb-2 opacity-40" strokeWidth={1.5} />
              <p className="text-xs font-medium text-ink-secondary">Cart is empty</p>
              <p className="text-xs text-ink-muted mt-0.5">Select products on the left to add items</p>
            </div>
          ) : (
            cartItems.map((item) => {
              const totalConsumed = getSellableConsumptionInCart(item.sellableId);
              const isOverStock = totalConsumed > item.stockInHand;
              const step =
                item.sellableType === 'loose_decant' && item.unitCode !== 'bottle'
                  ? item.bottleSizeMl || 1
                  : 1;
              const stepConsumption =
                item.sellableType === 'loose_decant' &&
                item.unitCode === 'bottle' &&
                item.bottleSizeMl
                  ? step * item.bottleSizeMl
                  : step;
              const wouldIncrementExceed =
                isStrictBlock && totalConsumed + stepConsumption > item.stockInHand;

              return (
              <div
                key={item.id}
                className="p-2.5 rounded-lg bg-raised/70 border border-hairline space-y-1.5"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h5 className="text-xs font-medium text-ink leading-tight">
                      {item.productName}
                    </h5>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-ink-muted">
                      {item.bottleSizeMl ? (
                        <span className="px-1.5 py-0.5 rounded bg-accent/12 text-accent-ink border border-accent/25 font-medium font-mono tabular-nums">
                          {item.bottleSizeMl} ml
                        </span>
                      ) : null}
                      <span className="font-mono tabular-nums">
                        ৳{item.unitPriceBdt} / {item.unitCode}
                      </span>
                      {isWarnAllow && isOverStock && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/30 text-[10px] font-medium">
                          <AlertTriangle className="w-3 h-3" strokeWidth={1.5} />
                          <span>Exceeds stock ({item.stockInHand})</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-medium text-accent-ink font-mono tabular-nums">
                      ৳{item.lineTotalBdt.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Quantity Controls & Line Discount */}
                <div className="flex items-center justify-between pt-1.5 border-t border-hairline">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="w-6 h-6 rounded-md bg-surface border border-hairline hover:border-hairline-strong text-ink-secondary flex items-center justify-center"
                    >
                      <Minus className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                    <span className="w-8 text-center font-mono tabular-nums font-medium text-xs text-ink">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={wouldIncrementExceed}
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="w-6 h-6 rounded-md bg-surface border border-hairline hover:border-hairline-strong text-ink-secondary flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1 rounded-md text-ink-muted hover:text-negative transition-colors duration-150 ease-unslop"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
              );
            })
          )}
        </div>

        {/* Cart Bottom Summary & Checkout */}
        <div className="p-3.5 border-t border-hairline bg-subtle space-y-3">
          {/* Cart Discount Toggle / Bar */}
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowCartDiscountInput(!showCartDiscountInput)}
              className="text-xs text-accent-ink hover:underline font-medium flex items-center gap-1"
            >
              <Percent className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>
                {cartDiscountAmount > 0 || cartDiscountPercent > 0
                  ? `Cart discount: ৳${cartTotals.cartDiscountBdt}`
                  : '+ Add cart discount'}
              </span>
            </button>

            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={handleHoldCart}
                className="text-xs text-ink-muted hover:text-warning flex items-center gap-1"
              >
                <PauseCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Hold cart</span>
              </button>
            )}
          </div>

          {showCartDiscountInput && (
            <div className="p-2.5 rounded-lg bg-surface border border-hairline space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-ink-muted block mb-0.5">Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={cartDiscountPercent || ''}
                    onChange={(e) => {
                      const raw = parseFloat(e.target.value);
                      const clamped = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
                      setCartDiscountPercent(clamped);
                      setCartDiscountAmount(0);
                    }}
                    placeholder="0%"
                    className="w-full px-2 py-1 bg-raised border border-hairline rounded text-xs text-ink font-mono tabular-nums focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-ink-muted block mb-0.5">Fixed ৳ off</label>
                  <input
                    type="number"
                    min="0"
                    value={cartDiscountAmount || ''}
                    onChange={(e) => {
                      const raw = parseFloat(e.target.value);
                      const clamped = Number.isFinite(raw) ? Math.max(0, raw) : 0;
                      setCartDiscountAmount(clamped);
                      setCartDiscountPercent(0);
                    }}
                    placeholder="৳ 0"
                    className="w-full px-2 py-1 bg-raised border border-hairline rounded text-xs text-ink font-mono tabular-nums focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
              <input
                type="text"
                value={cartDiscountReason}
                onChange={(e) => setCartDiscountReason(e.target.value)}
                placeholder="Discount reason (optional)"
                className="w-full px-2 py-1 bg-raised border border-hairline rounded text-xs text-ink-secondary placeholder-ink-muted focus:outline-none focus:border-accent"
              />
            </div>
          )}

          {/* Totals */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-ink-muted">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums text-ink-secondary">
                ৳{cartTotals.subtotalBdt.toFixed(2)}
              </span>
            </div>

            {(cartTotals.itemDiscountBdt > 0 || cartTotals.cartDiscountBdt > 0) && (
              <div className="flex justify-between text-positive font-medium">
                <span>Total discount</span>
                <span className="font-mono tabular-nums">
                  -৳{(cartTotals.itemDiscountBdt + cartTotals.cartDiscountBdt).toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-base font-medium text-ink pt-1.5 border-t border-hairline">
              <span>Total payable</span>
              <span className="font-mono tabular-nums text-accent-ink">
                ৳{cartTotals.totalAmountBdt.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Checkout Button */}
          <button
            type="button"
            disabled={cartItems.length === 0}
            onClick={handleProceedToCheckout}
            className="w-full py-3 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-sm font-semibold transition-colors duration-150 ease-unslop disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer tabular-nums"
          >
            <span>Charge ৳{cartTotals.totalAmountBdt.toFixed(2)}</span>
            <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Held Carts Modal / Drawer */}
      {showHeldDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-hairline">
              <h3 className="text-base font-medium text-ink flex items-center gap-2">
                <PauseCircle className="w-4 h-4 text-warning" strokeWidth={1.5} />
                <span>Held carts ({heldCarts.length})</span>
              </h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setShowHeldDrawer(false)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-raised"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {heldCarts.map((h) => (
                <div
                  key={h.id}
                  className="p-3 rounded-lg bg-raised border border-hairline flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-medium text-ink">{h.note}</div>
                    <div className="text-xs text-ink-muted tabular-nums">
                      {h.items.length} item(s) · Held at {h.heldAt}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleResumeCart(h)}
                    className="px-3 py-1.5 rounded-lg bg-positive hover:opacity-90 text-white font-semibold text-xs"
                  >
                    Resume
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <DecantPourModal
        isOpen={Boolean(decantProduct)}
        onClose={() => setDecantProduct(null)}
        product={decantProduct}
        onConfirm={handleConfirmDecant}
      />

      <QuickCustomerModal
        isOpen={isQuickCustomerOpen}
        onClose={() => setIsQuickCustomerOpen(false)}
        initialPhone={customerPhone}
        deviceId={deviceId}
        onCustomerCreated={(c) => {
          setSelectedCustomer(c);
          setCustomerPhone(c.phone);
          setCustomerName(c.name);
          setShowCustomerDropdown(false);
        }}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        totals={cartTotals}
        customer={activeCustomer}
        onCompleteSale={handleExecuteSale}
      />

      <SaleReceiptModal
        isOpen={Boolean(completedSale)}
        onClose={() => setCompletedSale(null)}
        invoiceNumber={completedSale?.invoiceNumber || ''}
        customer={completedSale?.customer || null}
        items={completedSale?.items || []}
        totals={completedSale?.totals || cartTotals}
        payments={completedSale?.payments || []}
        cashierName={currentUser?.displayName || currentUser?.username}
      />
    </div>
  );
};
