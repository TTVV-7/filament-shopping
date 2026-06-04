# Filament Dashboard Redesign

**Date:** 2026-06-02
**Status:** Approved for implementation

---

## Overview

Rebuild the existing vanilla HTML/JS/CSS filament shopping dashboard as a React + Vite application using shadcn/ui and Tailwind CSS. Add a metrics bar, AMS chip badges, and a new Print Requests tab with an auto-populated cost calculator powered by a Vercel serverless function.

---

## Architecture

### Frontend

Vite + React (JavaScript) at the project root. Build output goes to `dist/`. Tailwind CSS + shadcn/ui for all components and styling.

```
/ (project root)
├── src/
│   ├── components/
│   │   ├── MetricsBar.jsx          — price stats per material
│   │   ├── DealsTable.jsx          — filter input + sortable table
│   │   ├── PrintRequests.jsx       — URL form, calculator, log
│   │   ├── StoreLinks.jsx          — store link cards
│   │   └── FilamentManagement.jsx  — inventory + usage forms
│   ├── lib/
│   │   └── storage.js              — localStorage helpers (shared)
│   ├── App.jsx
│   └── main.jsx
├── public/
│   └── data/
│       └── amazon_filament_research.json   (moved from web/data/)
├── api/
│   └── print-request.js            — Vercel Function
├── web/                            — Python pipeline output, untouched
└── vercel.json                     — updated for Vite build
```

### Backend

Two Vercel serverless functions:

**`api/fetch-model.js`** — called when the user hits the Fetch button
1. Receive `{ url }` POST body
2. Fetch the MakerWorld page HTML
3. Extract title, author, thumbnail URL, filament weight (g), and print time (hrs) from the page — MakerWorld is a Next.js app so structured data is available in `__NEXT_DATA__` JSON embedded in the page
4. Return `{ title, author, thumbnailUrl, weightG, printTimeHrs }` — any unextracted field is `null`

**`api/print-request.js`** — called when the user hits Send
1. Receive `{ url, title, thumbnailUrl, weightG, printTimeHrs, filamentCost, timeCost, totalCost }` POST body
2. Send an email via the Resend API with model name, thumbnail, URL, and full cost breakdown
3. Return `{ ok: true }` on success

Fallback: if `fetch-model` cannot extract weight or time, those fields return `null` — the frontend leaves those calculator inputs blank for manual entry.

Environment variables required:
- `RESEND_API_KEY` — Resend API key
- `RESEND_TO_EMAIL` — recipient address (the user's email)
- `RESEND_FROM_EMAIL` — verified sender address

---

## Components

### MetricsBar

Displayed above the deals table. Computed from the loaded JSON data.

Shows three cards (one per material: PLA, PETG, TPU):
- Cheapest $/kg
- Average $/kg
- Count of listings

Highlights the best-value listing per material with a "Best Deal" badge linking directly to that product.

### DealsTable

Replaces the current query-box + table. Keeps the freeform query string as the primary filter (the token syntax `brand:`, `material:`, etc. is preserved). Adds quick-filter pill buttons for material (PLA / PETG / TPU) that prepend `material:X` to the query string.

Table columns (10 total):
1. Material
2. Brand
3. Source
4. Colors — swatch circle + color option chips (already implemented)
5. Specs — spec tag chips
6. AMS chip — badge: ✅ chip / ⚠️ manual / (blank for unknown brands)
7. Price
8. Weight (kg)
9. CAD/kg
10. Title + link

**AMS chip compatibility** is hardcoded per brand (no scraper change needed):
- `BAMBU`: ✅ has chip
- `BAMBU LAB`: ✅ has chip
- All others in the current dataset: ⚠️ manual setup (no chip)

This list is a constant in `DealsTable.jsx` and is easy to extend.

### PrintRequests

Two sections:

**Submit form:**
- URL input — paste a MakerWorld URL
- A "Fetch" button calls `POST /api/fetch-model` with the URL (not auto-triggered on paste to avoid firing on partial URLs)
- Loading state shown during fetch
- On success, auto-fills: model name (read-only), thumbnail preview, filament weight (g), print time (hrs)
- Fields that failed to extract are left blank and editable

**Cost calculator** (live, updates on every keystroke):
- Filament used (g) — auto-filled from fetch, editable
- Price per kg ($/kg) — default $20.00, saved to localStorage
- Print time (hrs) — auto-filled from fetch, editable
- Hourly rate ($/hr) — default from localStorage, user sets once
- Displays: `Filament: $X.XX + Time: $X.XX = Total: $X.XX`
- Formula:
  - `filament_cost = weight_g × (price_per_kg / 1000)`
  - `time_cost = hours × hourly_rate`

**Send button:** calls `POST /api/print-request` with the model info (already fetched) plus the computed cost figures. Triggers the Resend email. Email contains: model name, thumbnail, MakerWorld URL, cost breakdown. On success, appends to the log and resets the form.

**Request log** (below the form):
- Stored in localStorage under `filament.print_requests`
- Table columns: Thumbnail, Model name, URL, Weight (g), Time (hrs), Cost, Date
- "Clear log" ghost button

### StoreLinks

No logic changes — content migrated to React JSX.

### FilamentManagement

Exact feature parity with the current implementation. State management and localStorage keys unchanged. Migrated to React controlled components.

---

## Styling

**Background:** Tailwind's `bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-100` — similar feel to the current radial gradient but cleaner.

**Header card:** `backdrop-blur-sm bg-white/75 border border-white/60 rounded-2xl shadow-sm` — glassmorphism, polished version of the current style.

**Buttons:** shadcn `Button` component. Primary = `variant="default"` (teal/emerald), ghost = `variant="outline"`, destructive actions = `variant="ghost"` with red text.

**Table:** shadcn `Table` with `TableHeader`, `TableRow`, `TableCell`. Alternating row backgrounds via Tailwind.

**Chips/badges:** shadcn `Badge` component — replaces the hand-rolled `.chip` class.

---

## Data Pipeline

No changes to the Python scraper or the JSON export. `web/data/amazon_filament_research.json` is copied/moved to `public/data/` so Vite serves it as a static asset at `/data/amazon_filament_research.json` — the same relative path the frontend already uses.

---

## Vercel Config

`vercel.json` updated:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

The existing rewrite rules are removed (Vite's build handles routing). The `api/` directory is auto-detected by Vercel as serverless functions.

---

## Error Handling

- `fetch-model` fails (network, bot detection, changed markup): returns `{ error: "Could not fetch model info" }` — frontend shows a toast and leaves all calculator fields editable for manual entry
- `fetch-model` partially succeeds (some fields null): frontend fills what it can, leaves the rest blank and editable
- `print-request` Resend failure: returns 500 with message — frontend shows an error toast, request is NOT added to the log
- localStorage quota exceeded: caught silently, app continues in-memory (same pattern as current code)

---

## Out of Scope

- Amazon star ratings (requires scraper changes — separate task)
- Multi-device log sync (localStorage is device-local by design)
- MakerWorld authentication / private models
- Sorting controls on the deals table (freeform filter covers the primary use case)
