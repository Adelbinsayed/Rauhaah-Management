-- Migration 0006: Purchases, Suppliers, and Stock Receiving

CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY NOT NULL,
    purchase_number TEXT NOT NULL UNIQUE,
    supplier_id TEXT REFERENCES suppliers(id),
    supplier_name TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('received', 'ordered', 'cancelled')) DEFAULT 'received',
    total_amount_bdt REAL NOT NULL DEFAULT 0.0,
    paid_amount_bdt REAL NOT NULL DEFAULT 0.0,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    reference_number TEXT,
    notes TEXT,
    received_by_user_id TEXT REFERENCES users(id),
    received_by_username TEXT,
    received_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id TEXT PRIMARY KEY NOT NULL,
    purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    stock_item_id TEXT NOT NULL REFERENCES stock_items(id),
    product_name TEXT NOT NULL,
    purchased_unit TEXT NOT NULL,
    purchased_quantity REAL NOT NULL,
    unit_rate_bdt REAL NOT NULL,
    total_cost_bdt REAL NOT NULL,
    converted_quantity_base REAL NOT NULL,
    base_unit_code TEXT NOT NULL,
    base_cost_per_unit_bdt REAL NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY NOT NULL,
    stock_item_id TEXT NOT NULL REFERENCES stock_items(id),
    movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase_received', 'sale', 'adjustment', 'return', 'blend_consumed', 'blend_produced')),
    reference_id TEXT,
    quantity_delta REAL NOT NULL,
    quantity_before REAL NOT NULL,
    quantity_after REAL NOT NULL,
    cost_price_bdt REAL NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL,
    device_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(received_at);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_stock_item ON purchase_items(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(stock_item_id);

-- Seed initial reputable perfume & attar suppliers
INSERT OR IGNORE INTO suppliers (id, name, contact_person, phone, email, address, notes, is_active, created_at, updated_at, device_id)
VALUES
    ('sup-ajmal', 'Ajmal Perfumes UAE', 'Direct Export Dept', '+971-4-2821212', 'exports@ajmal.ae', 'Dubai, United Arab Emirates', 'Premium oud, dehn al oud, and luxury oriental oils', 1, datetime('now'), datetime('now'), 'seed'),
    ('sup-surrati', 'Surrati Perfumes Factory', 'Middle East Sales', '+966-12-6478900', 'info@surratiperfumes.com', 'Makkah, Saudi Arabia', 'High quality attar, white musk, and concentrated perfume oils', 1, datetime('now'), datetime('now'), 'seed'),
    ('sup-local-glass', 'Chawkbazar Glass & Bottles Syndicate', 'Haji Rafiqul Islam', '01711223344', 'rafiq.glass@gmail.com', 'Chawkbazar, Old Dhaka, Bangladesh', 'Empty attar bottles, roll-on vials, crystal decant bottles, and caps', 1, datetime('now'), datetime('now'), 'seed'),
    ('sup-alharamain', 'Al Haramain Perfumes', 'Corporate Wholesale', '+971-6-7480555', 'sales@alharamain.ae', 'Ajman, United Arab Emirates', 'Traditional pure attars, bukhoor, and luxury gift sets', 1, datetime('now'), datetime('now'), 'seed'),
    ('sup-euro-fragrance', 'Euro Fragrance & Chemical Supply', 'Kamal Hossain', '01819876543', 'eurofragrance.dhaka@gmail.com', 'Motijheel, Dhaka, Bangladesh', 'Perfume solvent, carrier oils (Jojoba, Argan), and aroma molecules', 1, datetime('now'), datetime('now'), 'seed');
