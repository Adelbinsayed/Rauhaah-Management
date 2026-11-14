-- Migration 0005: Customers, Sales, Sale Items, and Sale Payments

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    notes TEXT,
    due_balance_bdt REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    device_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- 2. Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id TEXT REFERENCES customers(id),
    customer_name TEXT,
    customer_phone TEXT,
    cashier_id TEXT NOT NULL REFERENCES users(id),
    subtotal_bdt REAL NOT NULL,
    discount_amount_bdt REAL NOT NULL DEFAULT 0.0,
    discount_percent REAL NOT NULL DEFAULT 0.0,
    discount_reason TEXT,
    discounted_by TEXT REFERENCES users(id),
    total_amount_bdt REAL NOT NULL,
    paid_amount_bdt REAL NOT NULL,
    change_amount_bdt REAL NOT NULL DEFAULT 0.0,
    due_amount_bdt REAL NOT NULL DEFAULT 0.0,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    void_reason TEXT,
    voided_at TEXT,
    voided_by TEXT REFERENCES users(id),
    branch_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    device_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);

-- 3. Sale Items Table
CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY NOT NULL,
    sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    sellable_id TEXT NOT NULL REFERENCES sellables(id),
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    sellable_type TEXT NOT NULL,
    unit_code TEXT NOT NULL,
    quantity REAL NOT NULL,
    bottle_size_ml REAL,
    unit_price_bdt REAL NOT NULL,
    ideal_retail_price_bdt REAL NOT NULL,
    cost_price_bdt REAL NOT NULL,
    discount_amount_bdt REAL NOT NULL DEFAULT 0.0,
    discount_percent REAL NOT NULL DEFAULT 0.0,
    discount_reason TEXT,
    line_total_bdt REAL NOT NULL,
    created_at TEXT NOT NULL,
    device_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sellable ON sale_items(sellable_id);

-- 4. Sale Payments Table
CREATE TABLE IF NOT EXISTS sale_payments (
    id TEXT PRIMARY KEY NOT NULL,
    sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL,
    amount_bdt REAL NOT NULL,
    transaction_ref TEXT,
    created_at TEXT NOT NULL,
    device_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
