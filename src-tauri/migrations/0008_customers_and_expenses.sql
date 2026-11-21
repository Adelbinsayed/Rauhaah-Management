-- Migration 0008: Customers Extended, Customer Payments, Expense Categories, Expenses, and Cash Drawer Sessions

-- 1. Extend Customers table if missing columns
ALTER TABLE customers ADD COLUMN email TEXT;
ALTER TABLE customers ADD COLUMN address TEXT;

-- 2. Customer Payments (for settling due balances)
CREATE TABLE IF NOT EXISTS customer_payments (
    id TEXT PRIMARY KEY NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    amount_bdt REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    reference_number TEXT,
    notes TEXT,
    received_by_user_id TEXT,
    received_by_username TEXT,
    created_at TEXT NOT NULL,
    device_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_created ON customer_payments(created_at DESC);

-- 3. Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO expense_categories (id, name, description, is_system, created_at) VALUES
('exp-cat-rent', 'Rent & Shop Lease', 'Store premises monthly rent and maintenance fee', 1, datetime('now')),
('exp-cat-util', 'Utilities & Electricity', 'Electricity bill, generator fuel, water, and AC servicing', 1, datetime('now')),
('exp-cat-tea', 'Tea, Snacks & Entertainment', 'Daily refreshment for shop, guests, and customers', 1, datetime('now')),
('exp-cat-bags', 'Packaging, Bags & Ribbon', 'Shopping bags, luxury boxes, wrapping and ribbon supplies', 1, datetime('now')),
('exp-cat-sal', 'Staff Salary & Daily Allowance', 'Staff daily lunch allowance, conveyance, and advance salary', 1, datetime('now')),
('exp-cat-trans', 'Transportation & Courier', 'Parcel delivery, courier charges, and transport fares', 1, datetime('now')),
('exp-cat-maint', 'Shop Maintenance & Cleaning', 'Cleaning supplies, tissue, lighting, and store fixtures', 1, datetime('now')),
('exp-cat-misc', 'Miscellaneous / Other', 'Other incidental and daily store expenses', 1, datetime('now'));

-- 4. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    category_id TEXT REFERENCES expense_categories(id),
    category_name TEXT NOT NULL,
    amount_bdt REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    reference_number TEXT,
    notes TEXT,
    expense_date TEXT NOT NULL,
    created_by_user_id TEXT,
    created_by_username TEXT,
    branch_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    device_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);

-- 5. Cash Drawer Sessions
CREATE TABLE IF NOT EXISTS cash_drawer_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    branch_id TEXT NOT NULL,
    opened_by_user_id TEXT NOT NULL,
    opened_by_username TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    opening_cash_bdt REAL NOT NULL DEFAULT 0.0,
    closed_by_user_id TEXT,
    closed_by_username TEXT,
    closed_at TEXT,
    expected_cash_bdt REAL,
    actual_cash_bdt REAL,
    discrepancy_bdt REAL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    device_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_opened_at ON cash_drawer_sessions(opened_at DESC);
