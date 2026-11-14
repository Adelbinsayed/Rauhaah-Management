-- Phase 2: Catalog, Variants, Units, and Pricing

CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    country_of_origin TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unit_type TEXT NOT NULL CHECK (unit_type IN ('volume', 'weight', 'count')),
    base_unit_code TEXT NOT NULL,
    conversion_factor REAL NOT NULL DEFAULT 1.0,
    is_system INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_items (
    id TEXT PRIMARY KEY NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    brand_id TEXT REFERENCES brands(id),
    category_id TEXT REFERENCES categories(id),
    item_type TEXT NOT NULL CHECK (item_type IN ('raw_oil', 'empty_bottle', 'packaging', 'sealed_product', 'accessory', 'raw_material')),
    unit_id TEXT NOT NULL REFERENCES units(id),
    density_g_per_ml REAL,
    current_quantity REAL NOT NULL DEFAULT 0.0,
    min_alert_quantity REAL NOT NULL DEFAULT 0.0,
    cost_price_bdt REAL NOT NULL DEFAULT 0.0,
    reorder_quantity REAL DEFAULT 0.0,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sellables (
    id TEXT PRIMARY KEY NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    brand_id TEXT REFERENCES brands(id),
    category_id TEXT REFERENCES categories(id),
    sellable_type TEXT NOT NULL CHECK (sellable_type IN ('sealed_product', 'loose_decant', 'custom_blend', 'accessory')),
    retail_price_bdt REAL NOT NULL DEFAULT 0.0,
    wholesale_price_bdt REAL NOT NULL DEFAULT 0.0,
    min_price_bdt REAL NOT NULL DEFAULT 0.0,
    is_taxable INTEGER NOT NULL DEFAULT 0,
    tax_rate_percent REAL DEFAULT 0.0,
    track_inventory INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sellable_components (
    id TEXT PRIMARY KEY NOT NULL,
    sellable_id TEXT NOT NULL REFERENCES sellables(id) ON DELETE CASCADE,
    stock_item_id TEXT NOT NULL REFERENCES stock_items(id),
    quantity REAL NOT NULL,
    unit_id TEXT NOT NULL REFERENCES units(id),
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    device_id TEXT NOT NULL,
    UNIQUE(sellable_id, stock_item_id)
);

CREATE TABLE IF NOT EXISTS price_history (
    id TEXT PRIMARY KEY NOT NULL,
    sellable_id TEXT NOT NULL REFERENCES sellables(id) ON DELETE CASCADE,
    price_type TEXT NOT NULL CHECK (price_type IN ('retail', 'wholesale', 'min')),
    old_price REAL NOT NULL,
    new_price REAL NOT NULL,
    change_reason TEXT,
    changed_by_user_id TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    device_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_items_sku ON stock_items(sku);
CREATE INDEX IF NOT EXISTS idx_stock_items_category ON stock_items(category_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_item_type ON stock_items(item_type);
CREATE INDEX IF NOT EXISTS idx_sellables_sku ON sellables(sku);
CREATE INDEX IF NOT EXISTS idx_sellables_barcode ON sellables(barcode);
CREATE INDEX IF NOT EXISTS idx_sellables_type ON sellables(sellable_type);
CREATE INDEX IF NOT EXISTS idx_sellables_category ON sellables(category_id);
CREATE INDEX IF NOT EXISTS idx_sellable_components_sellable ON sellable_components(sellable_id);
CREATE INDEX IF NOT EXISTS idx_price_history_sellable ON price_history(sellable_id, created_at DESC);

-- Seed standard units
INSERT OR IGNORE INTO units (id, code, name, unit_type, base_unit_code, conversion_factor, is_system, created_at, device_id)
VALUES
    ('unit-vol-ml', 'ml', 'Millilitre', 'volume', 'ml', 1.0, 1, datetime('now'), 'seed'),
    ('unit-vol-l', 'l', 'Litre', 'volume', 'ml', 1000.0, 1, datetime('now'), 'seed'),
    ('unit-vol-tola', 'tola', 'Tola (12 ml)', 'volume', 'ml', 12.0, 1, datetime('now'), 'seed'),
    ('unit-wt-g', 'g', 'Gram', 'weight', 'g', 1.0, 1, datetime('now'), 'seed'),
    ('unit-wt-kg', 'kg', 'Kilogram', 'weight', 'g', 1000.0, 1, datetime('now'), 'seed'),
    ('unit-wt-tola', 'tola_g', 'Tola Weight (11.664 g)', 'weight', 'g', 11.664, 1, datetime('now'), 'seed'),
    ('unit-cnt-pcs', 'pcs', 'Pieces', 'count', 'pcs', 1.0, 1, datetime('now'), 'seed'),
    ('unit-cnt-btl', 'bottle', 'Bottle', 'count', 'pcs', 1.0, 1, datetime('now'), 'seed'),
    ('unit-cnt-box', 'box', 'Box', 'count', 'pcs', 1.0, 1, datetime('now'), 'seed');

-- Seed initial categories for Rauhaah
INSERT OR IGNORE INTO categories (id, name, slug, sort_order, is_active, created_at, updated_at, device_id)
VALUES
    ('cat-attar', 'Attar & Concentrated Oils', 'attar-oils', 1, 1, datetime('now'), datetime('now'), 'seed'),
    ('cat-perfume', 'Sealed Perfumes & EDP', 'sealed-perfumes', 2, 1, datetime('now'), datetime('now'), 'seed'),
    ('cat-bottles', 'Bottles, Vials & Roll-ons', 'bottles-vials', 3, 1, datetime('now'), datetime('now'), 'seed'),
    ('cat-essential', 'Essential & Carrier Oils', 'essential-carrier-oils', 4, 1, datetime('now'), datetime('now'), 'seed'),
    ('cat-accessories', 'Lifestyle & Accessories', 'accessories', 5, 1, datetime('now'), datetime('now'), 'seed'),
    ('cat-packaging', 'Packaging & Gift Boxes', 'packaging-gift-boxes', 6, 1, datetime('now'), datetime('now'), 'seed');

-- Seed initial popular brands
INSERT OR IGNORE INTO brands (id, name, description, country_of_origin, is_active, created_at, updated_at, device_id)
VALUES
    ('brand-rauhaah', 'Rauhaah Signature', 'House perfumes and custom blends', 'Bangladesh', 1, datetime('now'), datetime('now'), 'seed'),
    ('brand-ajmal', 'Ajmal', 'Luxury oriental perfumes and oud', 'UAE', 1, datetime('now'), datetime('now'), 'seed'),
    ('brand-alharamain', 'Al Haramain', 'Traditional attar and spray perfumes', 'UAE', 1, datetime('now'), datetime('now'), 'seed'),
    ('brand-surrati', 'Surrati', 'Concentrated perfume oils', 'Saudi Arabia', 1, datetime('now'), datetime('now'), 'seed'),
    ('brand-lattafa', 'Lattafa', 'Modern oriental fragrances', 'UAE', 1, datetime('now'), datetime('now'), 'seed'),
    ('brand-swissarabian', 'Swiss Arabian', 'Exquisite attar and sprays', 'UAE', 1, datetime('now'), datetime('now'), 'seed'),
    ('brand-generic', 'Generic / House Supply', 'Bottles, accessories, and supplies', 'Bangladesh', 1, datetime('now'), datetime('now'), 'seed');
