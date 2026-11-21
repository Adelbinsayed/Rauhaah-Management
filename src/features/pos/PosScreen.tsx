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
} from 'lucide-react';
import { useAppStore } from '../../app/store';
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
  const { currentUser } = useAppStore();

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

  // Held Carts
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
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
        catalogRepo.getSellables(undefined, true),
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
  }, []);

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

  // Handle phone input changes with live suggestion and auto-population
  const handlePhoneChange = async (val: string) => {
    setCustomerPhone(val);
    const clean = val.trim();

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

    try {
      const results = await posRepo.searchCustomers(clean);
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
        if (selectedCustomer && selectedCustomer.phone !== clean) {
          setSelectedCustomer(null);
        }
      }
    } catch (err) {
      console.error('Customer phone search error:', err);
    }
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

  const handleProceedToCheckout = () => {
    if (cartItems.length === 0) return;

    // Customer Name is mandatory if a phone number has been entered
    if (customerPhone.trim() && !customerName.trim() && !selectedCustomer) {
      setCustomerNameError(true);
      customerNameInputRef.current?.focus();
      return;
    }

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
    if (product.sellableType === 'loose_decant') {
      // Open Decant / Pouring Modal to select bottle size (3ml, 6ml, 12ml) and price
      setDecantProduct(product);
    } else {
      // Packaged product or accessory: Add 1 unit directly
      const existingIdx = cartItems.findIndex(
        (item) => item.sellableId === product.id && !item.bottleSizeMl
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
          unitCode: product.primaryUnitCode || 'pcs',
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

    const finalTotal =
      params.customLineTotalBdt ?? Math.round(params.bottleSizeMl * params.unitPriceBdt);

    const newItem: CartItem = {
      id: `${decantProduct.id}-${params.bottleSizeMl}-${Date.now()}`,
      sellableId: decantProduct.id,
      productName: decantProduct.name,
      sku: decantProduct.sku,
      barcode: decantProduct.barcode,
      sellableType: 'loose_decant',
      unitCode: 'ml',
      bottleSizeMl: params.bottleSizeMl,
      quantity: params.bottleSizeMl,
      unitPriceBdt: params.unitPriceBdt,
      idealRetailPriceBdt: decantProduct.retailPriceBdt,
      costPriceBdt: decantProduct.calculatedCostBdt || 0,
      discountPercent: 0,
      discountAmountBdt: 0,
      lineTotalBdt: finalTotal,
      stockInHand: decantProduct.primaryStockQuantity ?? 0,
    };

    setCartItems((prev) => [newItem, ...prev]);
  };

  // Update Item Quantity
  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const step = item.sellableType === 'loose_decant' ? (item.bottleSizeMl || 1) : 1;
            const newQty = item.quantity + delta * step;
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
    setHeldCarts((prev) => [newHold, ...prev]);
    // Clear current cart
    setCartItems([]);
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
    setHeldCarts((prev) => prev.filter((h) => h.id !== hold.id));
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

    const invoiceNumber = await posRepo.getNextInvoiceNumber('INV');
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
    <div className="flex h-[calc(100vh-2rem)] gap-4 select-none">
      {/* LEFT: PRODUCTS BROWSER (65%) */}
      <div className="flex-1 flex flex-col bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
        {/* Top Search & Scan Bar */}
        <div className="p-4 border-b border-brand-border bg-brand-black/40 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search perfumes, attars, janamaz, miswak, caps by name, SKU or barcode..."
              className="w-full pl-9 pr-3 py-2 bg-brand-black border border-brand-border rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-xs text-neutral-500 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {heldCarts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHeldDrawer(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition-colors"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Held Carts ({heldCarts.length})</span>
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="px-4 py-2 border-b border-brand-border/60 bg-brand-black/20 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-brand-gold text-brand-black shadow-sm font-bold'
                : 'bg-brand-black/60 text-neutral-400 hover:text-white'
            }`}
          >
            All Products
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === c.id
                  ? 'bg-brand-gold text-brand-black shadow-sm font-bold'
                  : 'bg-brand-black/60 text-neutral-400 hover:text-white'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start auto-rows-max">
          {loading ? (
            <div className="col-span-full py-16 text-center text-neutral-500">
              Loading shop products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full py-16 text-center text-neutral-500">
              No products found matching &ldquo;{search}&rdquo;.
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isOil = p.sellableType === 'loose_decant';
              const stock = p.primaryStockQuantity ?? 0;
              const unit = p.primaryUnitCode || (isOil ? 'ml' : 'pcs');
              const isLow = stock <= 5;

              return (
                <div
                  key={p.id}
                  onClick={() => handleProductClick(p)}
                  className="group relative h-36 p-3 rounded-xl bg-brand-black/60 border border-brand-border hover:border-brand-gold/60 transition-all cursor-pointer flex flex-col justify-between hover:shadow-lg hover:shadow-brand-gold/5 self-start w-full"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          isOil
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {isOil ? 'Attar / Oil' : 'Packaged'}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold ${
                          isLow ? 'text-red-400' : 'text-neutral-400'
                        }`}
                      >
                        {stock} {unit}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white group-hover:text-brand-gold transition-colors line-clamp-2">
                      {p.name}
                    </h4>
                    <div className="text-[10px] text-neutral-500 font-mono mt-0.5">{p.sku}</div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-brand-border/40">
                    <span className="text-xs font-bold font-mono text-brand-gold">
                      ৳{p.retailPriceBdt.toFixed(2)}
                      <span className="text-[10px] text-neutral-400 font-normal"> / {unit}</span>
                    </span>

                    <button
                      type="button"
                      className="p-1 rounded-lg bg-neutral-800 text-neutral-300 group-hover:bg-brand-gold group-hover:text-brand-black transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: CART & CHECKOUT TERMINAL (35%) */}
      <div className="w-96 flex flex-col bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
        {/* Customer Lookup & Loyalty Bar */}
        <div className="p-3 border-b border-brand-border bg-brand-black/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-brand-gold" />
              <span>Customer Information</span>
            </span>

            {(customerPhone || customerName || selectedCustomer) ? (
              <button
                type="button"
                onClick={handleClearCustomer}
                className="text-[10px] text-neutral-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                title="Reset to walk-in"
              >
                <X className="w-3 h-3" />
                <span>Clear (Walk-in)</span>
              </button>
            ) : (
              <span className="text-[10px] text-neutral-500 font-medium">Walk-in</span>
            )}
          </div>

          {/* Dual Inputs: Customer Phone & Customer Name */}
          <div className="grid grid-cols-2 gap-2 relative">
            {/* Phone Input with live autocomplete */}
            <div className="relative">
              <label className="text-[9px] uppercase font-bold text-neutral-400 tracking-wider block mb-1">
                Phone Number
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
                  className="w-full px-2.5 py-1.5 bg-brand-black border border-brand-border rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold font-mono"
                />
              </div>

              {/* Autocomplete Suggestions Live Dropdown */}
              {showCustomerDropdown && customerResults.length > 0 && (
                <div
                  ref={customerDropdownRef}
                  className="absolute left-0 w-80 top-full mt-1.5 z-30 bg-neutral-900 border border-brand-gold/40 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto"
                >
                  <div className="px-3 py-1.5 bg-brand-black/90 border-b border-brand-border/40 text-[9px] font-bold uppercase tracking-wider text-brand-gold flex justify-between items-center">
                    <span>Existing Customers ({customerResults.length})</span>
                    <span className="text-[9px] text-neutral-400 font-normal">Click to auto-fill</span>
                  </div>
                  {customerResults.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className="p-2.5 hover:bg-neutral-800 cursor-pointer text-xs border-b border-brand-border/30 last:border-0 flex justify-between items-center transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <span>{c.name}</span>
                          {c.dueBalanceBdt > 0 && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Due ৳{c.dueBalanceBdt}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-brand-gold font-mono">{c.phone}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-neutral-300 font-mono font-medium">
                          ৳{c.totalSpendBdt || 0}
                        </div>
                        <div className="text-[9px] text-neutral-500">
                          {c.visitCount || 1} visit{c.visitCount === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Name Input */}
            <div>
              <label className="text-[9px] uppercase font-bold text-neutral-400 tracking-wider mb-1 flex items-center justify-between">
                <span>
                  Customer Name
                  {customerPhone.trim() && (
                    <span className="text-red-400 font-extrabold ml-1 text-[11px]">*</span>
                  )}
                </span>
                {customerNameError && (
                  <span className="text-[9px] text-red-400 font-bold lowercase tracking-normal">required</span>
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
                placeholder={customerPhone.trim() ? "Mandatory (e.g. Rahim)" : "Name (e.g. Rahim)"}
                className={`w-full px-2.5 py-1.5 bg-brand-black border rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors ${
                  customerNameError
                    ? 'border-red-500 ring-1 ring-red-500/50 bg-red-950/20'
                    : 'border-brand-border focus:border-brand-gold'
                }`}
              />
              {customerNameError && (
                <p className="text-[9px] text-red-400 mt-1 leading-tight font-medium">
                  Please enter customer name
                </p>
              )}
            </div>
          </div>

          {/* Selected / Recognized Customer Loyalty Badge */}
          {selectedCustomer && (
            <div className="p-2 rounded-lg bg-brand-black border border-brand-gold/30 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-2">
                <span className="text-brand-gold font-bold">★ Loyalty</span>
                <span className="text-neutral-300">
                  Visits: <strong className="text-white">{selectedCustomer.visitCount || 1}</strong>
                </span>
                <span className="text-neutral-500">•</span>
                <span className="text-neutral-300">
                  Spend: <strong className="text-brand-gold font-mono">৳{selectedCustomer.totalSpendBdt || 0}</strong>
                </span>
              </div>
              {selectedCustomer.dueBalanceBdt > 0 && (
                <span className="text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                  Due: ৳{selectedCustomer.dueBalanceBdt}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Active Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
              <ShoppingCart className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">Cart is empty</p>
              <p className="text-[10px] text-neutral-600 mt-0.5">Click products on the left to add items</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-brand-black/70 border border-brand-border space-y-1.5"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h5 className="text-xs font-bold text-white leading-tight">
                      {item.productName}
                    </h5>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-neutral-400">
                      {item.bottleSizeMl ? (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold font-mono">
                          {item.bottleSizeMl} ml
                        </span>
                      ) : null}
                      <span className="font-mono">
                        ৳{item.unitPriceBdt} / {item.unitCode}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-brand-gold font-mono">
                      ৳{item.lineTotalBdt.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Quantity Controls & Line Discount */}
                <div className="flex items-center justify-between pt-1 border-t border-brand-border/40">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="w-5 h-5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center font-mono font-bold text-xs text-white">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="w-5 h-5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1 rounded text-neutral-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Bottom Summary & Checkout */}
        <div className="p-3.5 border-t border-brand-border bg-brand-black space-y-3">
          {/* Cart Discount Toggle / Bar */}
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowCartDiscountInput(!showCartDiscountInput)}
              className="text-[11px] text-brand-gold hover:underline font-semibold flex items-center gap-1"
            >
              <Percent className="w-3 h-3" />
              <span>
                {cartDiscountAmount > 0 || cartDiscountPercent > 0
                  ? `Cart Discount: ৳${cartTotals.cartDiscountBdt}`
                  : '+ Add Cart Discount'}
              </span>
            </button>

            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={handleHoldCart}
                className="text-[11px] text-neutral-400 hover:text-amber-400 flex items-center gap-1"
              >
                <PauseCircle className="w-3 h-3" />
                <span>Hold Cart</span>
              </button>
            )}
          </div>

          {showCartDiscountInput && (
            <div className="p-2 rounded-lg bg-neutral-900 border border-brand-border space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-0.5">Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={cartDiscountPercent || ''}
                    onChange={(e) => {
                      setCartDiscountPercent(parseFloat(e.target.value) || 0);
                      setCartDiscountAmount(0);
                    }}
                    placeholder="0%"
                    className="w-full px-2 py-1 bg-brand-black border border-brand-border rounded text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-0.5">Fixed ৳ Off</label>
                  <input
                    type="number"
                    min="0"
                    value={cartDiscountAmount || ''}
                    onChange={(e) => {
                      setCartDiscountAmount(parseFloat(e.target.value) || 0);
                      setCartDiscountPercent(0);
                    }}
                    placeholder="৳ 0"
                    className="w-full px-2 py-1 bg-brand-black border border-brand-border rounded text-xs text-white font-mono"
                  />
                </div>
              </div>
              <input
                type="text"
                value={cartDiscountReason}
                onChange={(e) => setCartDiscountReason(e.target.value)}
                placeholder="Discount reason (e.g. regular customer loyalty)..."
                className="w-full px-2 py-1 bg-brand-black border border-brand-border rounded text-[11px] text-neutral-300 placeholder-neutral-500"
              />
            </div>
          )}

          {/* Totals */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-neutral-400">
              <span>Subtotal:</span>
              <span className="font-mono text-neutral-200">
                ৳{cartTotals.subtotalBdt.toFixed(2)}
              </span>
            </div>

            {(cartTotals.itemDiscountBdt > 0 || cartTotals.cartDiscountBdt > 0) && (
              <div className="flex justify-between text-emerald-400 font-medium">
                <span>Total Discount:</span>
                <span className="font-mono">
                  -৳{(cartTotals.itemDiscountBdt + cartTotals.cartDiscountBdt).toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-lg font-extrabold text-white pt-1 border-t border-brand-border">
              <span>Total Payable:</span>
              <span className="font-mono text-brand-gold">
                ৳{cartTotals.totalAmountBdt.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Checkout Button */}
          <button
            type="button"
            disabled={cartItems.length === 0}
            onClick={handleProceedToCheckout}
            className="w-full py-3 rounded-xl bg-brand-gold hover:bg-brand-gold-light text-brand-black text-sm font-extrabold transition-all shadow-lg shadow-brand-gold/20 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Charge ৳{cartTotals.totalAmountBdt.toFixed(2)}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Held Carts Modal / Drawer */}
      {showHeldDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-brand-surface border border-brand-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-brand-border">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PauseCircle className="w-5 h-5 text-amber-400" />
                <span>Held Carts ({heldCarts.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowHeldDrawer(false)}
                className="p-1 rounded text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {heldCarts.map((h) => (
                <div
                  key={h.id}
                  className="p-3 rounded-xl bg-brand-black border border-brand-border flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-white">{h.note}</div>
                    <div className="text-[10px] text-neutral-400">
                      {h.items.length} item(s) &bull; Held at {h.heldAt}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleResumeCart(h)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md"
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
