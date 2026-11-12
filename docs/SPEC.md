# Rauhaah Management: Functional Requirements and Implementation Plan

*Version 1.1 · 12 November 2026 · Inventory, pricing and POS for a perfume, attar and lifestyle shop (Windows)*

> **Changelog from v1.0**
> - Added `density_g_per_ml` to `stock_items` for weight-to-volume conversion (supplier units vary)
> - Added all purchase units: tola, gram, ml, litre — per item, not global
> - Discount cap removed: all roles (staff, manager, owner) may give 0–100% discount; every discount is recorded with user + reason
> - Customer section expanded: phone number is the unique customer ID; loyalty metrics and total spend shown at POS
> - Barcode scanner: design for both — POS works with or without scanner
> - 1-tola definition: 11.664 g (by weight) OR 12 ml (by volume convention) — stored per item

---

## 1. Purpose and scope

Rauhaah Management is an offline-first Windows desktop application for a perfume, attar and lifestyle shop. It manages products and pricing, stock, sales, purchases, blends, costs and reports. Receipt printing is deliberately out of scope for v1 and is planned for a later phase.

**Decisions confirmed**

- Launch: 1 shop, 1 PC. Later: sold commercially to other shops, including multi-branch shops, with online sync so stock stays correct across branches.
- Selling modes: sealed bottles, loose/decant by ml, and custom blends.
- Users: owner plus staff with roles. Staff must never see cost price or profit.
- Currency BDT, English UI, no VAT handling in v1, no Bangla text in v1.
- No server cost: all data lives in a local SQLite file.
- **Discount policy:** any role may give up to 100% discount (no cap). Every discount — line level or cart level — is recorded with the user, timestamp and an optional reason.
- **Negative-stock policy:** warn but allow. The cashier sees a clear warning; the sale proceeds unless the owner disables it in settings.
- **Barcode scanner:** POS is designed to work both with and without a scanner. SKU/name search is always available.

**Core design principle:** build for one shop now, but make every table sync-ready from day one (section 4) so multi-branch sync later does not require a rewrite.

---

## 2. Technology stack

- Shell: Tauri 2 (Rust kept thin)
- UI: React + TypeScript + Vite, Tailwind CSS, shadcn/ui, TanStack Table, React Hook Form + Zod, Zustand, Recharts
- Database: SQLite through tauri-plugin-sql with plain SQL migration files (Drizzle ORM is an acceptable alternative; choose one in Phase 0 and stay with it)
- CSV: PapaParse
- Rust is used only for: password hashing (Argon2), license key verification, import-folder watching, backup/restore file operations, and later printing
- Tests: Vitest
- Distribution: **Portable single-folder** build (primary). No installer, no registry, no `Program Files`. The user extracts a folder, creates a desktop shortcut to `Rauhaah.exe`, and runs it. All app files, the SQLite database (`data/rauhaah.db`), and backups live inside that one folder. The folder can be placed anywhere except `C:\Program Files\`. Moving to another PC = copy the folder.
- Installer: Optional NSIS installer build for commercial customers who prefer a traditional setup experience. Both portable and installer are built from the same codebase.
- **Do not store the database in AppData or any path outside the app folder.** The app resolves all data paths relative to the executable location using Tauri's `resource_dir` or a sibling `data/` folder.

**Rule:** all business logic (costing, stock, pricing, blends) lives in a plain TypeScript `domain` layer with no UI imports, so it can be tested and later reused by the sync engine.

**Rust transaction rule:** expose a single Rust command (backed by `rusqlite` or `sqlx` behind a mutex) that accepts a batch of parameterized statements and executes them inside one `BEGIN IMMEDIATE … COMMIT` transaction. Use this for all multi-row writes: sales, purchases, production batches, CSV imports. Do NOT rely on issuing `BEGIN`/`COMMIT` as separate JS calls through `tauri-plugin-sql`.

---

## 3. Users and permissions

**Roles**

- Owner: everything, including users, settings, cost, profit, backup, license, void and delete.
- Manager (optional role): products, prices, stock, purchases, sales and all reports including cost and profit. Cannot manage users, license or backup restore.
- Staff / Cashier: create sales, view products with selling price and stock, view own sales and own daily totals. Cannot see cost price, purchase price, margin or profit. Cannot edit prices. Cannot import.

**Discount policy (all roles)**

Any user — staff, manager, or owner — may apply a discount of 0–100% at the line level or cart level. There is no system-enforced cap in v1. Every discount entry records: user, role, discount amount/percent, timestamp, and an optional reason field. The owner can review all discounted sales in the reports screen.

**Implementation**

- Permission keys such as `cost.view`, `profit.view`, `price.edit`, `stock.adjust`, `sale.void`, `report.view`, `user.manage`, `import.run`.
- Staff screens use queries that never select cost columns, not just hidden UI fields.
- Honest limitation: data is a local file, so a technical user with file access could read it. Optional database encryption (SQLCipher) can be added later for commercial customers.
- Login with username and PIN/password (Argon2 hash). An owner recovery code is generated at first setup. Auto-lock after idle time (configurable).
- Audit log of sensitive actions: logins, price changes, voids, stock adjustments, imports, role changes, discounts ≥ 50%.

---

## 4. Sync-ready data rules (apply from day one)

1. All IDs are UUID v7 text. No auto-increment IDs.
2. Every table has `id`, `created_at`, `updated_at`, `deleted_at` (soft delete), and `device_id`. Transactional tables also have `branch_id`.
3. A default branch named Main is created at first run. Every sale, purchase, stock movement and expense stores its branch.
4. Stock movements are append-only. Current stock equals the sum of movements per item per branch. Corrections are new movements, never edits. This makes merging data from several devices safe.
5. Money is stored as integers in poisha (1 BDT = 100 poisha). Unit costs stored in 1/1000 poisha (1 BDT = 100,000 milli-poisha) to prevent truncation errors when dividing bulk liquid costs (e.g. 125 BDT ÷ 1000 ml = 12.5 poisha/ml). Final totals always rounded to whole poisha.
6. Quantities are stored as integers in thousandths (2.5 ml = 2500) to avoid floating-point errors.
7. Document numbers carry a branch/device prefix (for example `MAIN-S-000123`) so numbers never clash after sync.
8. A `change_log` table (table, row id, operation, timestamp, synced flag) is filled by the data layer for the future sync engine. Consider SQLite `AFTER INSERT/UPDATE` triggers on key tables as a safety net.
9. Future conflict rules: master data (products, prices) uses last-write-wins by `updated_at`; transactional records are new rows and do not conflict.
10. The sync backend (for example hosted Postgres) is a later decision. It will have a running cost, which can be built into the commercial subscription.

---

## 5. Functional requirements

### 5.1 Catalog: stock items, products and variants

The app separates what you store from what you sell.

- **Stock item:** a physical thing tracked in stock. Types: finished good (sealed bottle), bulk liquid (attar or oil counted in ml), raw material (oils, alcohol, base), packaging (empty bottles, boxes), lifestyle/accessory item.
- **Sellable:** what appears at the POS, for example Oud Royale 100 ml bottle or Oud Royale decant 10 ml. A sellable lists components: which stock item it consumes and how much. A sealed bottle consumes 1 pc of its own item. A 10 ml decant consumes 10 ml of the bulk item plus optionally 1 small empty bottle.
- For simple products, one form creates both the stock item and the sellable, so the owner never has to think about the split.

**Fields:** name, brand, category, type, product class, base unit (auto-suggested from product class), SKU (auto-generated if empty), barcode, size, optional image, description, reorder level, active flag, notes.

**Product class and unit system:**

Every stock item belongs to a product class. The class determines which units are valid and how the product is measured, sold, and displayed:

| Product Class | Valid Units | Typical Items |
|---|---|---|
| Liquid fragrance | ml, litre, g, tola | Attar, oud, musk, perfume oil, alcohol base |
| Solid fragrance | g, tola, pcs | Solid bakhoor, wax melts |
| Sealed bottle / finished good | pcs | Branded perfume bottles, pre-filled bottles |
| Raw material | ml, litre, g, tola | Carrier oils, fixatives |
| Packaging | pcs | Empty bottles, caps, boxes, bags |
| Accessory / Lifestyle | pcs | Prayer beads, incense holders, diffusers |
| Skincare / Beauty | ml, g, pcs | Creams, serums |

When the owner selects a product class in the product form, the unit dropdown automatically filters to only the valid units for that class. This prevents nonsensical combinations like measuring prayer beads in ml.

**Unit and density fields:**

The shop buys from suppliers using different units depending on the oil and supplier. Each `stock_item` stores:

- `product_class`: one of the classes above (stored as a string enum)
- `base_unit`: the unit used to track stock internally (e.g. `ml` for bulk liquids, `pcs` for bottles)
- `density_g_per_ml` (optional, nullable): allows the app to convert between grams and ml for the same liquid. Example: if a supplier invoices in grams, the app divides by density to get ml added to stock. If not set, the item can only be purchased in its base unit.
- `tola_as_ml` flag (default true): when checked, 1 tola = 12 ml (volume convention). When unchecked, 1 tola = 11.664 g (weight convention). This is per-item and defaults to the shop-level setting.

Supported purchase units: **ml, litre, gram, tola, pcs**. Any unit can be used at purchase entry; the app converts to the item's base unit on receipt.

**Requirements**

- Create, edit and archive. Items used in any transaction cannot be hard-deleted.
- Brand, category and unit management. Units are configurable with a conversion factor to the base unit.
- Search by name, SKU, barcode and brand, with filters.

### 5.2 Pricing and cost

- Each sellable has a selling price, optional wholesale price and optional minimum price.
- Each stock item has a current cost (weighted average) and a last purchase price. Bulk items show cost per ml.
- **Price list screen:** spreadsheet-style grid with cost, selling price and margin %, inline editing, and bulk edit (raise or lower by percent or fixed amount for a selection, category or brand, with a rounding rule).
- **Price history:** every change to cost or selling price writes a record (old value, new value, date, user, source: manual, CSV or purchase). Sales snapshot price and cost at sale time, so history never alters old sales.
- Warning when selling price is below cost (owner and manager only).
- Unit cost precision: costs are stored in 1/1000 poisha to avoid truncation on per-ml costs. Rounded to whole poisha only on final totals and reports.

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
- Accept UTF-8 and UTF-8 with BOM (Excel), quoted fields, case-insensitive headers, and numbers like 1,200 or with a currency symbol (stripped safely).
- **Preview before writing:** a table showing new, updated, unchanged and error rows, with old and new values side by side. Nothing is saved until Confirm.
- Each import runs in one database transaction (via the Rust batch command). Row-level errors can be skipped or the whole import cancelled.
- The file hash is recorded; re-importing the same file shows a warning.
- Import log screen (who, when, file, counts) and downloadable error report.
- Downloadable template CSV for each import type.
- Duplicate SKUs inside a file are flagged. Negative or non-numeric prices are errors.
- Only users with `price.edit` and `import.run` can import.

### 5.4 Stock management

- **Stock ledger:** every change is a movement of type opening, purchase, sale, sale return, purchase return, adjustment (damage, loss, found, count correction), production in or out, repack, or transfer (future).
- **Stock screen:** quantity, unit, cost value and retail value (owner and manager only), low-stock flag, and full movement history per item.
- **Adjustments** require a reason and note. **Stocktake:** enter counted quantities and the app creates the difference as adjustments.
- Low-stock list driven by reorder level.
- **Negative-stock policy:** warn but allow. The cashier sees a prominent warning badge at the POS. The sale is not blocked. The owner can change this to Block or Allow Silently in settings.
- **Repack:** convert bulk ml into pre-filled small bottles (for example 20 bottles of 10 ml). This consumes bulk ml and empty bottles and creates finished stock at the calculated cost.

### 5.5 Blends and production

- **Formula:** name, output item, list of components (stock item, quantity or percentage), notes.
- **Production batch:** choose a formula and an output quantity (for example 500 ml); components scale automatically and the app checks stock for each. On confirm it creates movements (components out, output in). Batch cost is the sum of component costs plus optional labour or other cost. The output cost per ml is blended into the weighted average cost.
- **Custom blend at the POS:** the cashier picks components and ml for each, or selects a saved formula, sets total volume, and prices it by a per-ml rule or a manual price override. Component stock is consumed at sale time and cost is calculated from the actual components. The sale line stores the component breakdown.
- Cost per ml and margin per formula (owner and manager only).

### 5.6 Price Checker

A dedicated, always-available screen for looking up selling prices during customer consultations — before any sale is made.

**Purpose:** the owner or staff member opens this screen while talking to a customer and searches for a product. The customer can see the screen. No sensitive data is ever visible.

**Who can use it:** all roles — owner, manager, and staff. No special permission required.

**What it shows:**

- Product name and brand
- Variant sizes available (e.g. 3 ml / 6 ml / 12 ml / 100 ml bottle)
- **Selling price** for each variant (large, clearly readable font)
- Wholesale price (only if the current user has `price.view` and the customer is marked as a wholesale buyer — hidden otherwise)
- **"In Stock" / "Out of Stock"** badge — availability only, never the quantity number
- Product image (if set)

**What it never shows (regardless of role):**

- Cost / buying price
- Stock quantity numbers
- Margin or profit
- Supplier information

**UI behaviour:**

- Full-screen search bar at the top — search by name, SKU, or barcode scan
- Results appear instantly as the user types (debounced, under 100 ms)
- Selecting a result shows a clean product card, suitable for a customer to read
- **Counter mode (optional future):** a simplified layout with an even larger price display, designed for a second monitor or a tablet facing the customer. Planned for Phase 10.
- Accessible from the sidebar at all times, including while the POS cart is on hold

**Relationship to POS:** after looking up a price in Price Checker, the staff can switch directly to POS and add the item — the two screens are independent but the navigation between them is fast.

---

### 5.7 Sales (POS)

Keyboard-first screen with product search and categories on the left and the cart on the right. A barcode scanner works as keyboard input when connected; the app works identically without one.

- Add items by barcode, SKU or name. Favourites and category tabs for fast access.
- Line fields: sellable, quantity (decimal allowed for ml), unit price (editable only with permission), line discount (percent or amount, 0–100%, always recorded), note.
- Loose lines: choose a preset size (5, 10, 20 ml) or enter custom ml.
- Cart-level discount (0–100%) and optional extra charge.
- **Customer lookup at POS:**
  - Search by phone number (the unique customer ID) or name.
  - If found: show name, total lifetime spend (in BDT), and number of previous visits. This information helps the cashier decide on a loyalty discount.
  - Quick-add: if phone number is not found, the cashier can enter name + phone to create the customer record in one step without leaving the POS.
  - Walk-in sales with no customer attached are allowed.
- Payments: cash, bKash, Nagad, card, bank (configurable list), split payments, amount received and change, partial payment with customer due.
- Hold and resume carts.
- Completed sales cannot be edited. Use **void** (owner or manager, reason required, restores stock through reversing movements) or **return/exchange** linked to the original sale.
- Each sale line stores unit price, cost snapshot, discount amount, discount percent, and discount reason so profit is exact and all discounts are auditable.
- Automatic invoice number per branch, sale detail view, and a disabled Print button reserved for the printing phase.
- Staff see only their own sales unless the owner allows more.

### 5.7 Purchases and suppliers

- Supplier records: name, phone, address, opening balance, notes.
- Purchase entry: supplier, date, supplier invoice number, lines (stock item, quantity, **purchase unit** — which may differ from base unit — unit cost), extra costs such as shipping or customs spread across lines in proportion to cost (landed cost), discount, amount paid, remaining due.
- On receiving: the app converts the purchase quantity to the item's base unit using the unit conversion and optional density, creates stock-in movements, recalculates weighted average cost, updates last purchase price, writes price history, and optionally prompts to revisit the selling price.
- Purchase returns, supplier payments and a supplier due ledger.

### 5.8 Customers

**Customer record**

| Field | Notes |
|---|---|
| `phone` | **Primary unique key** — entered at POS for lookup. Format-normalised (strip spaces, dashes). |
| `name` | Required at creation. |
| `notes` | Free text. |
| `due_balance` | Running receivable in poisha. |
| `created_at`, `updated_at` | Standard sync fields. |

**Customer features**

- **POS lookup:** search by phone number or name. Instant match as the cashier types.
- **Loyalty panel at POS (shown when a customer is selected):**
  - Lifetime total spend (sum of all completed sales linked to this customer)
  - Number of visits (count of distinct sales)
  - Last visit date
  - Current due balance (if any)
  - These figures let the cashier decide on a loyalty discount — no automatic loyalty tier in v1, it is a manual decision.
- Customer list screen: search, filter by activity, sort by total spend or visits.
- Customer detail screen: profile, full purchase history (each sale with date, items, total), due balance and payment history.
- **Export:** owner can export the customer list (phone, name, total spend, visit count, last visit) to CSV at any time.
- Due balance tracking and customer payment recording (reduces due balance).
- Items used in any sale cannot be hard-deleted; customer records with sales are soft-deleted only.

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
- **Discount audit report:** all discounted sales filtered by user, date range, discount threshold. Useful for reviewing staff discount patterns.
- **Customer report:** top customers by spend, top customers by visits, customers with dues. Exportable to CSV.
- Every report exports to CSV (PDF later).

### 5.11 Settings, backup and licensing

- Settings: shop info, currency and rounding, payment methods, units, negative-stock policy (block / warn / allow), invoice prefix, idle lock time, tola convention (weight 11.664 g or volume 12 ml, overridable per item).
- **Backup:** automatic daily backup using `VACUUM INTO '<path>'` (safe in WAL mode, no raw file copy) to a folder the user chooses (USB, OneDrive or Google Drive folder), keeping the last N copies, plus backup on app close. Manual backup and restore with confirmation.
- Versioned database migrations run automatically on update, with a backup taken first.
- **Licensing (commercial phase):** offline signed license key (Ed25519 public key embedded in the app, verified in Rust), tied to shop name, with a trial period. The installer is branded with the customer's shop name at install time, not hardcoded. No server needed for license verification.

---

## 6. Data model (main tables)

- System: `branches`, `users`, `roles`, `role_permissions`, `settings`, `audit_log`, `change_log`, `backup_log`
- Catalog: `brands`, `categories`, `units`, `stock_items`, `sellables`, `sellable_components`, `price_history`
- Stock: `stock_movements` (branch, item, type, quantity delta, unit cost, reference type and id, note, user, time)
- Sales: `customers`, `sales`, `sale_lines`, `sale_line_components`, `payments`
- Purchasing: `suppliers`, `purchases`, `purchase_lines`, `supplier_payments`
- Production: `formulas`, `formula_lines`, `production_batches`
- Finance: `expense_categories`, `expenses`, `cash_sessions`
- Import: `import_jobs`, `import_job_rows`

**Notable additions vs v1.0:**
- `stock_items`: added `density_g_per_ml REAL NULL`, `tola_as_ml INTEGER NOT NULL DEFAULT 1`
- `sale_lines`: added `discount_reason TEXT NULL`
- `customers`: `phone TEXT UNIQUE NOT NULL` is the primary lookup key (in addition to UUID `id`)

Barcode and selling price belong to `sellables`. Cost and reorder level belong to `stock_items`.

---

## 7. Key business rules

- **Weighted average cost:** new cost = (old quantity × old cost + incoming quantity × incoming cost) ÷ (old quantity + incoming quantity). If old quantity is zero or negative, use the incoming cost.
- **Cost of goods at sale** = quantity consumed × average cost at that moment, stored on the sale line components.
- **Decant cost** = ml × bulk cost per ml + packaging cost.
- A void restores stock with reversing movements at the original cost.
- One consistent rounding rule, applied at line total level and configured in settings.
- Optional setting to block sales below cost.
- Dates stored in UTC and shown in Asia/Dhaka time. The business-day boundary is configurable.
- A sale, purchase or production batch is always one database transaction (via the Rust batch command).
- **Cost precision:** unit costs stored in 1/1000 poisha (milli-poisha). All arithmetic uses integer milli-poisha; round to whole poisha only when displaying or storing final totals.
- **Discount audit rule:** every discount > 0 always stores `discount_amount`, `discount_percent`, `discounted_by` (user id), and `discount_reason` (nullable). No discount is ever silently applied.

---

## 8. Main screens

Login, Dashboard (today sales, low stock, quick actions), **Price Checker**, POS, Sales list, Products, Price list, Stock, Stocktake and adjustments, Purchases, Suppliers, Customers, Blends and production, Expenses and cash, Reports, Import, Users and roles, Settings and backup.

**UI guidelines:** clean and spacious, light and dark mode, keyboard-friendly POS, sticky table headers with instant search, confirmation for destructive actions, helpful empty states.

---

## 9. Non-functional requirements

- Startup under 3 seconds and POS search under 100 ms with 10,000 sellables on a 4 GB RAM PC (indexes on SKU, barcode, name, and customer phone).
- SQLite in WAL mode, with a transaction around every multi-row operation (via Rust batch command).
- Parameterised queries only, Argon2 password hashing, no secrets in source code.
- All user-facing text in translation files (`src/lib/i18n/en.ts`) so a Bangla UI can be added later without touching components.
- Automated tests cover all money, stock, costing and import logic.

---

## 10. Project structure

```
rauhaah-management/
  src-tauri/     Rust: auth hashing, license, folder watcher, backup, batch-tx command
  src/
    app/         routes, layout, providers
    domain/      pure TypeScript business logic + tests
    data/        SQL migrations and repositories (only place that runs SQL)
    features/    products, pricing, import, stock, pos, purchases,
                 blends, expenses, reports, users, settings, customers
    components/  shared UI
    lib/         money, quantity, dates, csv, ids, i18n
  docs/          SPEC.md, DECISIONS.md, schema notes
```

---

## 11. Implementation plan

**Timeline target:** trial in ~1 week, fully live in shop in ~1 month.

**Phase 0: Foundation (2–3 days).** Scaffold Tauri 2 + React + TypeScript + Tailwind + shadcn/ui. Set up SQLite, migration runner, WAL mode, Rust batch-transaction command, repository pattern, helpers (money in milli-poisha, quantity, UUID v7), app shell with sidebar, Vitest and Git. Build an installer. *Done when:* the installed app runs, writes to SQLite via the Rust batch command, and a Vitest test passes.

**Phase 1: Users, roles and settings (1–2 days).** First-run setup (shop name, owner account, recovery code, default branch), login, permissions, idle lock, audit log, settings screen. *Done when:* a staff login cannot see any cost field anywhere.

**Phase 2: Catalog and pricing (2–3 days).** Brands, categories, units (with density and tola convention), stock items and sellables (simple, loose and decant), product list and editor, price list grid, bulk price edit, price history. *Done when:* 20 products of mixed types can be added, repriced, and history viewed.

**Phase 3: CSV import (2 days).** Parser, template downloads, wizard with column mapping and preview, price-list, products and opening-stock imports, import-folder scan, logs and error reports. *Done when:* a 500-row price file updates correctly and bad rows report exact errors without corrupting data.

**Phase 4: Stock (1–2 days).** Movements ledger, opening stock, adjustments, stocktake, low-stock list, stock screen, item history, negative-stock warning. *Done when:* tests prove stock always equals the sum of movements.

**Phase 5: Sales, POS and Customers (3–4 days).** POS screen, cart, loose ml sales, discounts (0–100%, always recorded), split payments (cash/bKash/Nagad/card), customer lookup with loyalty panel, quick-add customer, hold and resume, void, returns, sales list, customer list and detail, customer CSV export. *Done when:* a sale reduces stock and stores cost snapshots, a void restores everything, customer spend totals update, and tests pass.

**Phase 6: Purchases and suppliers (2 days).** Purchase entry with multi-unit support and density conversion, landed cost, weighted average cost update, supplier dues and payments, purchase returns. *Done when:* a purchase in grams converts to ml correctly, changes cost and stock, and appears in price history.

**Phase 7: Blends and production (2–3 days).** Formulas, production batches, repack, custom blend sales at the POS. *Done when:* a 500 ml batch produces correct stock and cost per ml, and a custom blend sale consumes the right components.

**Phase 8: Expenses, cash and reports (2 days).** Expenses, daily cash register, dashboard, all reports with CSV export (including discount audit and customer report). *Done when:* daily and monthly profit matches a hand calculation on sample data.

**Phase 9: Hardening and pilot (3–4 days).** Automatic backup (VACUUM INTO), restore, migrations safety, license key scaffold, polished installer with configurable shop name branding, performance testing with 10,000 products, then a two-week pilot in the real shop.

**Phase 10 (later):** receipt printing (ESC/POS 58mm/80mm thermal), barcode label printing, multi-branch online sync, Bangla UI, batch and expiry tracking, PDF reports, cloud backup, auto-update, SQLCipher encryption for commercial customers.

---

## 12. Testing

- Unit tests for weighted average cost, decant cost, blend cost, sale totals, discount recording, rounding (milli-poisha), void and return stock effects, CSV parsing and import validation, unit conversions (g→ml via density, tola conventions).
- Scenario tests against an in-memory SQLite database (purchase in grams, convert to ml, sell decant, check stock and profit; apply 50% discount, check audit log entry).
- A manual checklist at the end of each phase, and a pilot with the real price list.

---

## 13. Working with AI (vibe coding)

- Save this document as `docs/SPEC.md`. Read it at the start of every session.
- Work on one phase at a time: short plan → code → tests → commit.
- Prompt template: *Read docs/SPEC.md. We are on Phase N. Implement only [specific task]. Follow the sync-ready rules in section 4. Write Vitest tests for any domain logic. Do not change the database schema without telling me first.*
- Keep `docs/DECISIONS.md` for choices made along the way.
- Never change money or stock math without a matching test.

---

## 14. Confirmed decisions (all open items from v1.0 resolved)

| Item | Decision |
|---|---|
| Currency, language, VAT | BDT, English only, no VAT in v1 |
| Tola/gram units | Yes — all units (tola, g, ml, litre, pcs); per-item density conversion |
| Staff discounts | 0–100% allowed for all roles; always recorded with user + reason |
| Negative stock | Warn + allow (cashier sees warning; not blocked) |
| Barcode scanner | Optional — POS works with or without |
| Customer loyalty | Phone = unique ID; lifetime spend + visits shown at POS; CSV export |
| Receipt printing | ESC/POS thermal (58mm/80mm) — Phase 10 |
| Commercial plan | Yes — sold to other BD perfume shops; installer is shop-name branded |
| Cost precision | Milli-poisha (1 BDT = 100,000) for unit costs; whole poisha for totals |
| Backup method | SQLite `VACUUM INTO` (safe in WAL mode) |
| Rust transactions | Single Rust batch-tx command for all multi-row writes |
| Product class system | Liquid fragrance / Solid fragrance / Sealed bottle / Raw material / Packaging / Accessory / Skincare — class controls valid units |
| Price Checker screen | All roles; shows selling price + in/out of stock only; never shows cost, quantity, or margin |
