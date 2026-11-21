-- Migration 0007: Purchases table structure refinement
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS purchases_temp (
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
    received_by_user_id TEXT,
    received_by_username TEXT,
    received_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    device_id TEXT NOT NULL
);

INSERT OR IGNORE INTO purchases_temp (
    id, purchase_number, supplier_id, supplier_name, branch_id, status,
    total_amount_bdt, paid_amount_bdt, payment_method, reference_number, notes,
    received_by_user_id, received_by_username, received_at, created_at, updated_at,
    deleted_at, device_id
)
SELECT
    id, purchase_number, supplier_id, supplier_name, branch_id, status,
    total_amount_bdt, paid_amount_bdt, payment_method, reference_number, notes,
    received_by_user_id, received_by_username, received_at, created_at, updated_at,
    deleted_at, device_id
FROM purchases;

DROP TABLE IF EXISTS purchases;

ALTER TABLE purchases_temp RENAME TO purchases;

CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(received_at);

PRAGMA foreign_keys = ON;
