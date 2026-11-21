# Rauhaah Management &bull; Luxury Fragrance ERP &amp; POS

[![Tauri v2](https://img.shields.io/badge/Tauri-v2.0-24C8D8?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![SQLite](https://img.shields.io/badge/Database-SQLite_WAL-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org)
[![Platform](https://img.shields.io/badge/Platform-Windows_x64-0078D6?style=flat-square&logo=windows&logoColor=white)](https://microsoft.com)

A high-performance, 100% offline-first retail management system and point-of-sale (POS) terminal engineered specifically for luxury perfume houses, attar houses, decanters, and retail boutiques.

---

## ⚡ Quick Start: Running for the First Time

You can run **Rauhaah Management** immediately on any modern 64-bit Windows computer (Windows 10 / 11) with **zero installation, zero cloud accounts, and zero database configuration**.

### 1. Download
- Download the single portable executable file: **[`Rauhaah.exe`](./Rauhaah.exe)** (or from the repository root).
- Place `Rauhaah.exe` in any folder of your choice (e.g., `C:\Rauhaah`, your Desktop, or a portable USB drive).

### 2. Launch
- Double-click **`Rauhaah.exe`** to open the app.
- **Windows SmartScreen Prompt:** Because this is a portable standalone binary built without an expensive commercial code-signing certificate, Windows may display a blue dialog:
  > *"Windows protected your PC"*
  1. Click **"More info"**
  2. Click **"Run anyway"**

### 3. First-Time Setup Wizard (Takes 30 Seconds)
On your very first run, Rauhaah automatically initializes a local SQLite database (`data/rauhaah.db`) and guides you through the initial setup wizard:
1. **Store Name:** Enter your shop / brand name (e.g. *Rauhaah Perfumes & Attar*).
2. **Owner Account:** Set your initial owner username (e.g. `owner` or `admin`) and password.
3. **Quick Cashier PIN:** Set a 4-to-6 digit PIN for fast terminal unlocking during cashier handoffs.
4. **Emergency Recovery Code:** Save your generated emergency recovery key in a safe place.
5. Click **Complete Setup** &mdash; you're live!

---

## 💎 Key Features

### 1. High-Speed Point-of-Sale (POS)
- Sub-second barcode scanning and instant touch grid checkout.
- Mixed payment methods in a single receipt (Cash, bKash, Nagad, Card, Bank transfer).
- Customer credit and partial payment tracking with real-time due balances.
- Negative stock policy controls: choose between *Warn &amp; Allow*, *Strict Block*, or *Allow Silently*.

### 2. Proprietary Attar &amp; Decant Unit Engine
- Seamlessly handles both sealed perfume boxes and loose attar decants from master vessels.
- Built-in multi-unit conversion matrix: **1 Tola = 12 ml** (South Asian retail standard) or **11.664 g** (traditional mass standard).
- Specific gravity density configuration per oil (e.g. `0.985 g/ml`) automatically recalculates stock quantities and weighted cost history simultaneously.

### 3. Direct Hardware ESC/POS Thermal Printing
- Bypasses the Windows system print dialog for **1-click silent thermal receipt printing**.
- Native support for standard **80mm (3")** and compact **58mm (2")** thermal paper rolls.
- Automatic paper cutting (`GS V`) and cash drawer kick pulse (`ESC p`) upon cash payment completion.
- Customizable receipt subtitle, policy footer note, brand emblem, and live visual preview.

### 4. Stock Receiving &amp; Supplier Management
- Multi-item Purchase Orders (PO) for incoming raw oils, bottles, caps, packaging, and accessories.
- Real-time cost updates and supplier accounts payable (A/P) balance tracking.
- Fast inline product creation directly from the stock receiving screen.

### 5. Daily Cash Drawer &amp; Financial Intelligence
- End-of-day drawer reconciliation: opening float + cash sales + due collections &minus; expense vouchers = expected cash in drawer.
- Executive Profit &amp; Loss (P&amp;L) calculations based on true inventory cost rather than crude estimates.
- One-click RFC 4180 CSV report exports with UTF-8 BOM encoding for seamless opening in Microsoft Excel.

### 6. Bulletproof Offline Architecture
- Powered by local SQLite configured with Write-Ahead Logging (`PRAGMA journal_mode = WAL`), memory temp storage, and a 64 MB page cache.
- **Instant Online Backups (`VACUUM INTO`):** Create non-blocking, defragmented snapshots of your active database with zero downtime, even during active POS sales.
- Pre-restore safety snapshots protect against accidental data loss.

---

## 🛠️ Building from Source

If you want to modify the source code or build the binary yourself:

### Prerequisites
- [Node.js](https://nodejs.org) (v18 or higher)
- [Rust &amp; Cargo](https://rustup.rs) (latest stable)
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (for Windows compilation)

### Development Setup
```bash
# Clone the repository
git clone https://github.com/Adelbinsayed/Rauhaah-Management.git
cd Rauhaah-Management

# Install frontend dependencies
npm install

# Run Vite + Tauri in development mode (with hot reloading)
npm run tauri dev
```

### Production Release Build
```bash
# Build optimized standalone release executable
npm run tauri -- build --no-bundle
```
The compiled binary will be generated at `src-tauri/target/release/rauhaah-management.exe`.

---

## 🎬 SaaS Presentation Video

A 60 FPS interactive motion-graphics demo video player is included in this repository!
To experience the animated presentation:
- Open [`public/presentation.html`](./public/presentation.html) in any modern web browser.
- Or click the built-in **"Record &amp; Download MP4"** button in the player to capture a 1080p demo video.

---

## 🔒 Security &amp; Privacy

- **100% Offline-First:** Rauhaah operates entirely locally. No sales, customer details, or revenue data are ever transmitted to any external cloud server.
- **Audit Logging:** Administrative setting changes, user creations, logins, and backup restorations are recorded in a tamper-resistant local audit log.
- **Terminal Auto-Lock:** Configurable idle timeout automatically locks the terminal to protect store data when unattended.

---

## 📄 License

Proprietary &copy; 2026 Sooktec. Developed for Rauhaah Perfumes &amp; Lifestyle. All rights reserved.
