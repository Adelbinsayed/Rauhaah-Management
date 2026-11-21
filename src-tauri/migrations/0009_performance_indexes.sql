-- Migration 0009: Composite performance indexes for offline-first SQLite reporting & dashboard lookups
CREATE INDEX IF NOT EXISTS idx_sales_status_created ON sales(status, created_at);
CREATE INDEX IF NOT EXISTS idx_sale_payments_method_created ON sale_payments(payment_method, created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_active_date ON expenses(deleted_at, expense_date, created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_created ON expenses(payment_method, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_payments_method_created ON customer_payments(payment_method, created_at);
CREATE INDEX IF NOT EXISTS idx_customers_dues_active ON customers(deleted_at, due_balance_bdt);
