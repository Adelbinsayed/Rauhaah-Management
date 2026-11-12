# Rauhaah — Brand Identity Guide

*For use in the Rauhaah Management desktop app · v1 (single shop)*
*White-label theming for commercial resale to other shops: Phase 10*

---

## Logo & Wordmark

- **Brand name:** Rauhaah
- **Tagline:** *Live Peaceful*
- **Logo mark:** Lotus / flower crown icon above the wordmark
- **Source file:** `docs/brand-identity.png`

---

## Color Palette

| Role | Hex | Usage |
|---|---|---|
| **Brand Gold** | `#EFB810` | Primary accent — buttons, active states, highlights, price display |
| **Deep Black** | `#202020` | Dark mode background, sidebar, logo background |
| **Pure White** | `#FFFFFF` | Light mode background, text on dark |

### Derived / Supporting Colors

| Role | Hex | Derivation |
|---|---|---|
| Gold hover | `#D4A30E` | 10% darker than brand gold |
| Gold muted | `#FDF3C0` | 90% lighter — warning backgrounds, badges |
| Dark surface | `#2E2E2E` | Cards/panels in dark mode |
| Dark border | `#3A3A3A` | Borders in dark mode |
| Light surface | `#F9F9F9` | Off-white card background in light mode |
| Light border | `#E5E5E5` | Borders in light mode |
| Success | `#22C55E` | Stock OK, payment confirmed |
| Warning | `#F59E0B` | Low stock, negative stock warning |
| Danger | `#EF4444` | Errors, out of stock, void actions |

---

## Typography

| Use | Font |
|---|---|
| Logo / Display | Syamsiah — Kamerik 105 Book (logo and app title only) |
| UI Body | Inter (or system-ui fallback) |
| Numbers / Prices | Inter with `font-variant-numeric: tabular-nums` |
| Monospace (SKU, barcode) | JetBrains Mono or Fira Code |

---

## UI Application

### Login & Splash
- Dark `#202020` background, gold + white logo centred, tagline in white

### Sidebar
- Dark mode: `#202020` bg, active item in `#EFB810`
- Light mode: `#F9F9F9` bg, active item in gold

### Primary Buttons
- Background: `#EFB810` | Text: `#202020` (not white — better contrast on gold) | Hover: `#D4A30E`

### Price Checker
- Selling price in large `#EFB810` gold text

### Default Mode
- **Dark mode by default** — matches brand identity. User can toggle in settings.

### App Icon
- Lotus crown mark (no wordmark) on dark circle background
- Sizes: 16, 32, 48, 256 px (.ico for Windows)

---

## Tailwind CSS Config (Phase 0)

```js
// tailwind.config.ts
colors: {
  brand: {
    gold:       '#EFB810',
    'gold-hover': '#D4A30E',
    'gold-muted': '#FDF3C0',
    black:      '#202020',
    surface:    '#2E2E2E',
    border:     '#3A3A3A',
  }
}
```

---

## White-Label Plan (Phase 10)

Brand assets loaded from a `theme.json` config file at runtime. Each commercial customer gets their own theme. Default ships as Rauhaah.
