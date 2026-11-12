# Rauhaah Management — DECISIONS.md

*Running log of design and implementation decisions. Newest entries at the top.*

---

## 2026-11-12 — Session 2 decisions

### Splash / loading screen — LOCKED ✅
**Design:** Photoshop/Illustrator-style launch screen shown while the app initialises.
- Background: `#202020` with thin gold top bar (`#EFB810`)
- Centre: lotus icon (SVG placeholder) + "Rauhaah" in large gold italic + "Live Peaceful" tagline
- Module badges row: Inventory · POS · Reports · Blends
- Bottom status bar: cycling loading messages + gold progress bar + version number + copyright
- Reference mockup: `docs/splash-mockup.html`
- **Logo/lotus icon is a placeholder** — owner will supply the real logo asset later; swap it in without changing anything else
- Loading messages (in order): Starting → Initialising database → Verifying license → Loading products catalog → Setting up workspace → Almost ready → Welcome back.

### Distribution — LOCKED ✅
**Format:** Portable single-folder. No installer required. User creates desktop shortcut to `Rauhaah.exe`. All data, backups and import folders live inside the app folder. Database must NOT be stored in AppData or any path outside the app folder.

---

## 2026-11-12 — Session 1 decisions

### Product class system
**Decision:** Each stock item has a `product_class` field (liquid fragrance, solid fragrance, sealed bottle, raw material, packaging, accessory/lifestyle, skincare/beauty). The class filters the available unit options in the product form automatically.
**Why:** Prevents nonsensical unit choices (e.g. ml for prayer beads). Makes the form smarter and reduces data entry errors.

### Price Checker screen
**Decision:** A dedicated full-screen mode in the sidebar, accessible by all roles. Shows: product name, brand, variant sizes, selling price (large font), in/out of stock badge. Never shows: cost, stock quantity, margin, supplier info.
**Why:** Owner and staff consult customers on prices before selling. They need a clean, customer-safe lookup that can be left visible on screen. The existing product list shows too much and is not suitable for customer-facing display.

### CSV workflow (round-trip)
**Decision:** CSV is primarily a round-trip bulk editing tool — Export from app → Edit in Excel → Re-import. The app owns the format and always exports correct headers and SKUs. No column-mapping wizard needed for round-trip files. Wizard is only for files from outside systems.
**Why:** The owner has no existing CSV data to migrate. The need is fast bulk price/stock editing without clicking individual product buttons.

### Money precision
**Decision:** Unit costs stored in milli-poisha (1 BDT = 100,000 milli-poisha). Final totals and display values always rounded to whole poisha (1 BDT = 100 poisha).
**Why:** Bulk oil costs like 125 BDT ÷ 1000 ml = 0.125 BDT/ml = 12.5 poisha/ml lose precision if stored as integer poisha. Milli-poisha avoids all truncation errors.

### Weight-to-volume conversion
**Decision:** Each `stock_item` has an optional `density_g_per_ml REAL` column. When set, the app converts grams to ml on purchase. Each item also has a `tola_as_ml` boolean (default: true = 1 tola = 12 ml). The shop-level setting is the default; it can be overridden per item.
**Why:** Supplier invoices use a mix of units depending on oil type and supplier. The app must handle tola, gram, ml, and litre — all convertible to the item's base unit.

### Discount policy
**Decision:** No cap on discounts for any role (0–100% allowed). Every discount always records: user, role, amount, percent, reason (nullable), timestamp.
**Why:** Owner wants full flexibility. Audit log compensates for lack of cap.

### Negative stock policy
**Decision:** Warn + allow. Clear warning at POS; sale is not blocked. Configurable in settings (block / warn / allow).

### Customer identity
**Decision:** Phone number is the unique customer identifier. UUID `id` is the internal primary key; `phone` has a UNIQUE constraint and is the POS lookup key.
**Why:** In BD retail context, phone numbers are universally known, easy to type, and already how shops identify customers.

### Customer loyalty (v1)
**Decision:** No automatic loyalty tiers. The POS shows lifetime spend + visit count when a customer is selected. The cashier decides the loyalty discount manually.
**Why:** Keeps v1 simple. Automated tiers can be added in v2 once real usage data is available.

### Backup method
**Decision:** Use `VACUUM INTO '<path>'` instead of raw file copy.
**Why:** `VACUUM INTO` is transactionally safe in WAL mode (SQLite 3.27+). `tauri-plugin-sql` does not expose `sqlite3_backup_init`; raw file copy while WAL journal is active can produce a corrupt backup.

### Rust batch-transaction command
**Decision:** Expose a single Rust Tauri command that accepts an array of `{sql, params}` objects and executes them inside `BEGIN IMMEDIATE … COMMIT` using a Mutex-guarded connection.
**Why:** Issuing `BEGIN`/`COMMIT` as separate JS calls through `tauri-plugin-sql` can interleave with other queries from the connection pool, causing partial writes or `database is locked` errors.

### Installer branding
**Decision:** The installer is parameterised with the customer's shop name at build/install time. "Rauhaah" is not hardcoded in installer copy or window titles.
**Why:** App will be sold to other perfume shops in Bangladesh; each should see their own shop name.

### Language
**Decision:** English only in v1. No Bangla input or display. All UI strings go into `src/lib/i18n/en.ts` from day one.
**Why:** Simplifies v1 delivery. String file from day one means adding Bangla later costs almost nothing.
