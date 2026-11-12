# Rauhaah Management: Functional Requirements and Implementation Plan

*Version 1.0 · 11 November 2026 · Inventory, pricing and POS for a perfume, attar and lifestyle shop (Windows)*

## 1. Purpose and scope

Rauhaah Management is an offline-first Windows desktop application for a perfume, attar and lifestyle shop. It manages products and pricing, stock, sales, purchases, blends, costs and reports. Receipt printing is deliberately out of scope for v1 and is planned for a later phase.

**Decisions so far**

- Launch: 1 shop, 1 PC. Later: sold commercially to other shops, including multi-branch shops, with online sync so stock stays correct across branches.
- Selling modes: sealed bottles, loose/decant by ml, and custom blends.
- Users: owner plus staff with roles. Staff must never see cost price or profit.
- Assumed unless changed: currency BDT, English UI, no VAT handling in v1.
- No server cost: all data lives in a local SQLite file.

**Core design principle:** build for one shop now, but make every table sync-ready from day one (section 4) so multi-branch sync later does not require a rewrite.

## 2. Technology stack

- Shell: Tauri 2 (Rust kept thin)
- UI: React + TypeScript + Vite, Tailwind CSS, shadcn/ui, TanStack Table, React Hook Form + Zod, Zustand, Recharts
- Database: SQLite through tauri-plugin-sql with plain SQL migration files (Drizzle ORM is an acceptable alternative; choose one in Phase 0 and stay with it)
- CSV: PapaParse
- Rust is used only for: password hashing (Argon2), license key verification, import-folder watching, backup/restore file operations, and later printing
- Tests: Vitest
- Installer: Tauri NSIS installer for Windows 10/11 64-bit

**Rule:** all business logic (costing, stock, pricing, blends) lives in a plain TypeScript `domain` layer with no UI imports, so it can be tested and later reused by the sync engine.

## 3. Users and permissions

**Roles**

- Owner: everything, including users, settings, cost, profit, backup, license, void and delete.
- Manager (optional role): products, prices, stock, purchases, sales and all reports including cost and profit. Cannot manage users, license or backup restore.
- Staff: create sales, view products with selling price and stock, view own sales and own daily totals. Cannot see cost price, purchase price, margin or profit, cannot edit prices, cannot import, and discounts are capped by a maximum percentage set by the owner.

**Implementation**

- Permission keys such as `cost.view`, `profit.view`, `price.edit`, `stock.adjust`, `sale.void`, `report.view`, `user.manage`, `import.run`.
- Staff screens use queries that never select cost columns, not just hidden UI fields.
- Honest limitation: data is a local file, so a technical user with file access could read it. Optional database encryption (SQLCipher) can be added later for commercial customers.
- Login with username and PIN/password (Argon2 hash). An owner recovery code is generated at first setup. Auto-lock after idle time (configurable).
- Audit log of sensitive actions: logins, price changes, voids, stock adjustments, imports, role changes.

## 4. Sync-ready data rules (apply from day one)

1. All IDs are UUID v7 text. No auto-increment IDs.
2. Every table has `id`, `created_at`, `updated_at`, `deleted_at` (soft delete), and `device_id`. Transactional tables also have `branch_id`.
3. A default branch named Main is created at first run. Every sale, purchase, stock movement and expense stores its branch.
4. Stock movements are append-only. Current stock equals the sum of movements per item per branch. Corrections are new movements, never edits. This makes merging data from several devices safe.
5. Money is stored as integers in poisha (1 BDT = 100). Quantities are stored as integers in thousandths (2.5 ml = 2500) to avoid floating-point errors.
6. Document numbers carry a branch/device prefix (for example `MAIN-S-000123`) so numbers never clash after sync.
7. A `change_log` table (table, row id, operation, timestamp, synced flag) is filled by the data layer for the future sync engine.
8. Future conflict rules: master data (products, prices) uses last-write-wins by `updated_at`; transactional records are new rows and do not conflict.
9. The sync backend (for example hosted Postgres) is a later decision. It will have a running cost, which can be built into the commercial subscription.

## 5. Functional requirements

### 5.1 Catalog: stock items, products and variants

The app separates what you store from what you sell.

- **Stock item:** a physical thing tracked in stock. Types: finished good (sealed bottle), bulk liquid (attar or oil counted in ml), raw material (oils, alcohol, base), packaging (empty bottles, boxes), lifestyle/accessory item.
- **Sellable:** what appears at the POS, for example Oud Royale 100 ml bottle or Oud Royale decant 10 ml. A sellable lists components: which stock item it consumes and how much. A sealed bottle consumes 1 pc of its own item. A 10 ml decant consumes 10 ml of the bulk item plus optionally 1 small empty bottle.
- For simple products, one form creates both the stock item and the sellable, so the owner never has to think about the split.

**Fields:** name, brand, category, type, base unit (pcs, ml, g, tola), SKU (auto-generated if empty), barcode, size, optional image, description, reorder level, active flag, notes.

**Requirements**

- Create, edit and archive. Items used in any transaction cannot be hard-deleted.
- Brand, category and unit management. Units are configurable with a conversion factor to the base unit (for example 1 tola = 11.664 g).
- Search by name, SKU, barcode and brand, with filters.

### 5.2 Pricing and cost

- Each sellable has a selling price, optional wholesale price and optional minimum price.
- Each stock item has a current cost (weighted average) and a last purchase price. Bulk items show cost per ml.
- **Price list screen:** spreadsheet-style grid with cost, selling price and margin %, inline editing, and bulk edit (raise or lower by percent or fixed amount for a selection, category or brand, with a rounding rule).
- **Price history:** every change to cost or selling price writes a record (old value, new value, date, user, source: manual, CSV or purchase). Sales snapshot price and cost at sale time, so history never alters old sales.
- Warning when selling price is below cost (owner and manager only).

### 5.3 CSV import (priority feature)

Two ways to import, one shared engine.

**A. Import wizard:** Import screen, choose a file, map columns, preview, confirm.

**B. Import folder:** the owner drops CSV files into `Documents/Rauhaah/Import/`. The app scans the folder on startup and when Scan Folder is clicked (live watching is added later). Successfully imported files move to `Processed/` with a timestamp; failed files move to `Failed/` together with an error report CSV.

**Import types and columns**

1. Price list (`prices_*.csv`): `sku` or `barcode` (one required), then any of `selling_price`, `cost_price`, `wholesale_price`, `effective_date`. Only the columns present are updated.
2. Products (`products_*.csv`): `sku`, `barcode`, `name`, `brand`, `category`, `type`, `unit`, `size`, `cost_price`, `selling_price`, `wholesale_price`, `reorder_level`, `opening_stock`.
3. Opening stock or stock count (`stock_*.csv`): `sku`, `quantity`, `cost_price`, `branch`.
4. Purchases (later): `supplier`, `date`, `sku`, `quantity`, `unit_cost`.

**Rules**

- Match rows by SKU first, then barcode. In price-list mode an unknown SKU is an error and is never created automatically. In products mode, unknown SKUs are created.
- `cost_price` applies to the stock item behind the SKU. Loose or decant variants derive their cost from the bulk item cost per ml and cannot be given a cost directly.
- Accept UTF-8 and UTF-8 with BOM (Excel), quoted fields, Bangla text, case-insensitive headers, and numbers like 1,200 or with a currency symbol (stripped safely).
- **Preview before writing:** a table showing new, updated, unchanged and error rows, with old and new values side by side. Nothing is saved until Confirm. In folder mode, files wait for review by default; auto-apply is an owner setting.
- Each import runs in one database transaction. Row-level errors can be skipped or the whole import cancelled, by user choice.
- The file hash is recorded, and re-importing the same file shows a warning.
- Import log screen (who, when, file, counts) and downloadable error report.
- Downloadable template CSV for each import type.
- Duplicate SKUs inside a file are flagged. Negative or non-numeric prices are errors.
- Only users with `price.edit` and `import.run` can import.

### 5.4 Stock management

- **Stock ledger:** every change is a movement of type opening, purchase, sale, sale return, purchase return, adjustment (damage, loss, found, count correction), production in or out, repack, or transfer (future).
- **Stock screen:** quantity, unit, cost value and retail value (owner and manager only), low-stock flag, and full movement history per item.
- **Adjustments** require a reason and note. **Stocktake:** enter counted quantities and the app creates the difference as adjustments.
- Low-stock list driven by reorder level.
- Negative-stock policy as a setting: block, warn, or allow.
- **Repack:** convert bulk ml into pre-filled small bottles (for example 20 bottles of 10 ml). This consumes bulk ml and empty bottles and creates finished stock at the calculated cost.

### 5.5 Blends and production

- **Formula:** name, output item, list of components (stock item, quantity or percentage), notes.
- **Production batch:** choose a formula and an output quantity (for example 500 ml); components scale automatically and the app checks stock for each. On confirm it creates movements (components out, output in). Batch cost is the sum of component costs plus optional labour or other cost. The output cost per ml is blended into the weighted average cost.
- **Custom blend at the POS:** the cashier picks components and ml for each, or selects a saved formula, sets total volume, and prices it by a per-ml rule or a manual price override (permission required). Component stock is consumed at sale time and cost is calculated from the actual components. The sale line stores the component breakdown.
- Cost per ml and margin per formula (owner and manager only).

### 5.6 Sales (POS)

Keyboard-first screen with product search and categories on the left and the cart on the right. A barcode scanner works as keyboard input.

- Add items by barcode, SKU or name. Favourites and category tabs for fast access.
- Line fields: sellable, quantity (decimal allowed for ml), unit price (editable only with permission), line discount (percent or amount, capped by role), note.
- Loose lines: choose a preset size (5, 10, 20 ml) or enter custom ml.
- Cart-level discount and optional extra charge.
- Customer optional (walk-in by default), quick-add name and phone.
- Payments: cash, bKash, Nagad, card, bank (configurable list), split payments, amount received and change, partial payment with customer due.
- Hold and resume carts.
- Completed sales cannot be edited. Use **void** (owner or manager, reason required, restores stock through reversing movements) or **return/exchange** linked to the original sale.
- Each sale line stores unit price, cost snapshot and discount, so profit is exact.
- Automatic invoice number per branch, sale detail view, and a disabled Print button reserved for the printing phase.
- Staff see only their own sales unless the owner allows more.

### 5.7 Purchases and suppliers

- Supplier records: name, phone, address, opening balance, notes.
- Purchase entry: supplier, date, supplier invoice number, lines (stock item, quantity, unit cost), extra costs such as shipping or customs spread across lines in proportion to cost (landed cost), discount, amount paid, remaining due.
- On receiving: stock-in movements, weighted average cost recalculated, last purchase price updated, price history written, and an optional prompt to revisit the selling price when cost changed.
- Purchase returns, supplier payments and a supplier due ledger.

### 5.8 Customers (light, v1)

Name, phone, notes, due balance, purchase history, and receivable payments.

### 5.9 Costs and expenses

- Expense categories (rent, salary, electricity, transport, packaging, marketing, other) and expense entries with date, amount, payment method and note. Optional monthly recurring reminders.
- Daily cash register: opening cash, cash in and out, closing count and difference.
- Gross profit = sales minus cost of goods sold (from cost snapshots). Net profit = gross profit minus expenses.

### 5.10 Reports

Owner and manager unless stated.

- Daily sales summary: total, count, discounts, by payment method. Staff can see their own totals without profit.
- Monthly and custom date range sales with a daily chart.
- Sales by product, brand, category and staff member.
- Profit report: revenue, cost of goods, gross profit, margin, expenses, net profit.
- Stock valuation (at cost and at retail), low stock, dead stock (no sales in N days), movement history per item.
- Purchases by supplier, supplier dues, customer dues.
- Price change history.
- Every report exports to CSV (PDF later).

### 5.11 Settings, backup and licensing

- Settings: shop info, currency and rounding, payment methods, units, negative-stock policy, invoice prefix, maximum discount per role, idle lock time.
- **Backup:** automatic daily backup using the SQLite backup API (not a raw file copy while writing) to a folder the user chooses (USB, OneDrive or Google Drive folder), keeping the last N copies, plus backup on app close. Manual backup and restore with confirmation.
- Versioned database migrations run automatically on update, with a backup taken first.
- **Licensing (commercial phase):** offline signed license key (Ed25519 public key embedded in the app, verified in Rust), tied to shop name, with a trial period. No server needed.

## 6. Data model (main tables)

- System: `branches`, `users`, `roles`, `role_permissions`, `settings`, `audit_log`, `change_log`, `backup_log`
- Catalog: `brands`, `categories`, `units`, `stock_items`, `sellables`, `sellable_components`, `price_history`
- Stock: `stock_movements` (branch, item, type, quantity delta, unit cost, reference type and id, note, user, time)
- Sales: `customers`, `sales`, `sale_lines`, `sale_line_components`, `payments`
- Purchasing: `suppliers`, `purchases`, `purchase_lines`, `supplier_payments`
- Production: `formulas`, `formula_lines`, `production_batches`
- Finance: `expense_categories`, `expenses`, `cash_sessions`
- Import: `import_jobs`, `import_job_rows`

Barcode and selling price belong to `sellables`. Cost and reorder level belong to `stock_items`.

## 7. Key business rules

- **Weighted average cost:** new cost = (old quantity × old cost + incoming quantity × incoming cost) ÷ (old quantity + incoming quantity). If old quantity is zero or negative, use the incoming cost.
- **Cost of goods at sale** = quantity consumed × average cost at that moment, stored on the sale line components.
- **Decant cost** = ml × bulk cost per ml + packaging cost.
- A void restores stock with reversing movements at the original cost.
- One consistent rounding rule, applied at line total level and configured in settings.
- Optional setting to block sales below cost.
- Dates stored in UTC and shown in Asia/Dhaka time. The business-day boundary is configurable.
- A sale, purchase or production batch is always one database transaction.

## 8. Main screens

Login, Dashboard (today sales, low stock, quick actions), POS, Sales list, Products, Price list, Stock, Stocktake and adjustments, Purchases, Suppliers, Customers, Blends and production, Expenses and cash, Reports, Import, Users and roles, Settings and backup.

**UI guidelines:** clean and spacious, light and dark mode, keyboard-friendly POS, sticky table headers with instant search, confirmation for destructive actions, helpful empty states, and a Bangla-capable font (Noto Sans Bengali) as fallback.

## 9. Non-functional requirements

- Startup under 3 seconds and POS search under 100 ms with 10,000 sellables on a 4 GB RAM PC (indexes on SKU, barcode and name).
- SQLite in WAL mode, with a transaction around every multi-row operation.
- Parameterised queries only, Argon2 password hashing, no secrets in source code.
- All user-facing text in translation files so a Bangla UI can be added later.
- Automated tests cover all money, stock, costing and import logic.

## 10. Project structure

```
rauhaah-management/
  src-tauri/     Rust: auth hashing, license, folder watcher, backup
  src/
    app/         routes, layout, providers
    domain/      pure TypeScript business logic + tests
    data/        SQL migrations and repositories (only place that runs SQL)
    features/    products, pricing, import, stock, pos, purchases,
                 blends, expenses, reports, users, settings
    components/  shared UI
    lib/         money, quantity, dates, csv, ids
  docs/          SPEC.md, schema notes, decisions
```

## 11. Implementation plan

**Phase 0: Foundation (2-3 days).** Scaffold Tauri 2 + React + TypeScript + Tailwind + shadcn/ui. Set up SQLite, migration runner, WAL mode, repository pattern, helpers (money, quantity, UUID v7), app shell with sidebar, Vitest and Git. Build an installer and install it on a clean PC. *Done when:* the installed app runs and writes to SQLite.

**Phase 1: Users, roles and settings.** First-run setup (shop name, owner account, recovery code, default branch), login, permissions, idle lock, audit log, settings screen. *Done when:* a staff login cannot see any cost field anywhere.

**Phase 2: Catalog and pricing.** Brands, categories, units, stock items and sellables (simple, loose and decant), product list and editor, price list grid, bulk price edit, price history. *Done when:* 20 products can be added, repriced, and their history viewed.

**Phase 3: CSV import.** Parser, template downloads, wizard with column mapping and preview, price-list, products and opening-stock imports, import-folder scan with Processed and Failed folders, logs and error reports. *Done when:* a 500-row price file updates correctly, and a file with bad rows reports exact errors without corrupting data.

**Phase 4: Stock.** Movements ledger, opening stock, adjustments, stocktake, low-stock list, stock screen, item history. *Done when:* tests prove stock always equals the sum of movements.

**Phase 5: Sales and POS.** POS screen, cart, loose ml sales, discounts, split payments, customers and dues, hold and resume, void, returns, sales list. *Done when:* a sale reduces stock and stores cost snapshots, a void restores everything, and tests pass.

**Phase 6: Purchases and suppliers.** Purchase entry, landed cost, weighted average cost update, supplier dues and payments, purchase returns. *Done when:* a purchase changes cost and stock correctly and appears in price history.

**Phase 7: Blends and production.** Formulas, production batches, repack, custom blend sales at the POS. *Done when:* a 500 ml batch produces correct stock and cost per ml, and a custom blend sale consumes the right components.

**Phase 8: Expenses, cash and reports.** Expenses, daily cash register, dashboard, all reports with CSV export. *Done when:* daily and monthly profit matches a hand calculation on sample data.

**Phase 9: Hardening and pilot.** Automatic backup and restore, migrations safety, license key, polished installer, performance testing with 10,000 products, then a two-week pilot in the real shop with real data.

**Phase 10 (later):** receipt printing (Windows print dialog first, then ESC/POS thermal), barcode label printing, multi-branch online sync, Bangla UI, batch and expiry tracking, PDF reports, cloud backup, auto-update.

## 12. Testing

- Unit tests for weighted average cost, decant cost, blend cost, sale totals, discount and rounding, void and return stock effects, CSV parsing (BOM, quotes, commas in numbers, Bangla text) and import validation.
- Scenario tests against an in-memory SQLite database (purchase, sell, void, adjust, check stock and profit).
- A manual checklist at the end of each phase, and a pilot with the real price list.

## 13. Working with Claude (vibe coding)

- Save this document in the repository as `docs/SPEC.md` and tell Claude to read it at the start of every session.
- Work on one phase at a time: ask for a short plan first, then the code, then the tests. Commit to Git after every working step.
- Prompt template: *Read docs/SPEC.md. We are on Phase N. Implement only \[specific task\]. Follow the sync-ready rules in section 4. Write Vitest tests for any domain logic. Do not change the database schema without telling me first.*
- Keep a `docs/DECISIONS.md` file for choices made along the way.
- Never let Claude change money or stock math without a matching test.

## 14. Assumptions and open items to confirm

- Currency BDT, English UI, no VAT in v1.
- Whether tola and gram units are needed for loose attar sales.
- Whether staff may give discounts, and the maximum percentage.
- Negative stock policy: block, warn or allow.
- Whether the shop already uses a barcode scanner.
- Please share a sample of your current attar price list (even 5 rows) so the CSV templates can match your real column names.
