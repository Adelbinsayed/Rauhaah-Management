-- Migration 0004: CSV Import Logs
CREATE TABLE IF NOT EXISTS import_logs (
    id TEXT PRIMARY KEY NOT NULL,
    file_name TEXT NOT NULL,
    file_hash TEXT,
    import_type TEXT NOT NULL CHECK (import_type IN ('prices', 'products', 'stock')),
    total_rows INTEGER NOT NULL DEFAULT 0,
    success_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    error_details TEXT,
    created_at TEXT NOT NULL,
    device_id TEXT NOT NULL,
    user_id TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_import_logs_created ON import_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_logs_hash ON import_logs(file_hash);
