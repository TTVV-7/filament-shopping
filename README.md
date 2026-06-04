# Filament Shopping Tracker

Track filament prices and material types across multiple stores (including Amazon and Bambu Lab), then run updates daily.

## What This Starter Does

- Scrapes multiple storefront collection/search pages using CSS selectors from `config/sites.yaml`
- Normalizes filament type from title text (PLA, PETG, ABS, ASA, TPU, NYLON, PC)
- Stores historical snapshots in SQLite (`data/filament_prices.db`)
- Exports current run to `exports/latest_prices.csv`
- Detects price changes versus last run
- Optionally sends change summary to a Zapier Catch Hook
- Includes GitHub Actions workflow for once-daily runs

## Current Strategy

We are running scraper-first for now across vendors, then reassessing API/feed options later.

Reason:

- Most filament vendors do not provide stable public retail pricing APIs.
- Scraping gets broad coverage quickly with one pipeline.

Tradeoff:

- Selectors can break and need maintenance.

## Quick Start

1. Create and activate a virtual environment.
2. Install dependencies:

   pip install -r requirements.txt

3. Copy `.env.example` to `.env` and set values if needed.
4. Update selectors in `config/sites.yaml` to match each target page.
5. Run locally:

   PYTHONPATH=src python -m filament_tracker.main

6. Try Scrapy engine (optional):

   SCRAPE_ENGINE=scrapy PYTHONPATH=src python -m filament_tracker.main

   Note: Scrapy currently works best on Python 3.11/3.12. If your local runtime is newer,
   use the default engine locally and run Scrapy in CI with Python 3.11.

## Amazon Deep Research Export

Generate a dashboard-ready Amazon data set for PLA, PETG, and TPU with color, price,
inferred spool weight, and price per kg:

AMAZON_RESEARCH_PAGES=2 PYTHONPATH=src python -m filament_tracker.amazon_research

Outputs:

- `exports/amazon_filament_research_raw.csv`
- `exports/amazon_filament_research_summary.csv`
- `exports/amazon_filament_dashboard.html`

The command also writes web UI data:

- `web/data/amazon_filament_research.json`

## Vercel UI

This repository includes a static Vercel-ready dashboard:

- `web/index.html`
- `web/styles.css`
- `web/app.js`

Deploy flow:

1. Regenerate data:

   AMAZON_RESEARCH_PAGES=2 PYTHONPATH=src python -m filament_tracker.amazon_research

2. Preview locally:

   python -m http.server 4173

   Then open `http://localhost:4173/web/`.

3. Deploy to Vercel from the repo root:

   vercel --prod

`vercel.json` rewrites `/` to the dashboard entry at `web/index.html`.

## Daily Updates

GitHub Actions workflow is in `.github/workflows/daily-scrape.yml` and runs daily at 08:00 UTC.

If you want Zapier alerts:

1. Create a Zap with trigger: Webhooks by Zapier -> Catch Hook.
2. Paste the generated hook URL into GitHub secret `ZAPIER_WEBHOOK_URL`.
3. Add action steps like Slack, email, Google Sheets append row, or Airtable update.

## Is Zapier Good For This?

Yes, for workflow orchestration after scrape results exist. It is not ideal as the scraper itself for anti-bot-heavy sites.

Best split:

- Scraping and parsing: Python job (this repo)
- Scheduling: GitHub Actions cron (or Cloud Run / AWS Lambda)
- Notifications and downstream automation: Zapier

## Amazon Notes

Amazon pages are high-friction for scraping and selectors can break frequently.

Practical alternatives:

- Use Amazon Product Advertising API when possible.
- Use a specialized price API provider for stability.
- If scraping directly, expect periodic selector/header adjustments and occasional blocking.

## Configuration Format

Example site entry in `config/sites.yaml`:

sites:
  - name: bambu_lab_us
    url: https://us.store.bambulab.com/collections/filament
    currency: USD
    selectors:
      product: div.card-wrapper
      title: .card__heading
      price: .price-item
      link: a[href]

## Next Enhancements

- Add retry/backoff and proxy support
- Add per-site custom parser functions for difficult pages
- Add delta export (only changed items)
- Add tests for selectors and price parsing

## Reassess Checklist (Later)

Reassess API/feed options for each source when any of these happen:

- More than 2 selector breakages for the same source in 30 days
- Repeated anti-bot blocks or unstable scrape success rate
- Source offers partner feed or official API access

When reassessing, evaluate in this order:

1. Official API
2. Partner/affiliate feed (CSV/XML/JSON)
3. Public JSON endpoint
4. HTML scraping fallback
