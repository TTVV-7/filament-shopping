import csv
import os
from pathlib import Path

import requests

from filament_tracker.db import PriceDatabase
from filament_tracker.models import PriceRecord
from filament_tracker.scraper import SiteScrapeError, load_sites, scrape_site


def run() -> int:
    config_path = os.getenv("SITES_CONFIG_PATH", "config/sites.yaml")
    db_path = os.getenv("DB_PATH", "data/filament_prices.db")
    zapier_webhook_url = os.getenv("ZAPIER_WEBHOOK_URL", "").strip()
    scrape_engine = os.getenv("SCRAPE_ENGINE", "requests").strip().lower()

    sites = load_sites(config_path)
    db = PriceDatabase(db_path)

    previous = db.get_latest_by_product()

    all_records: list[PriceRecord] = []
    errors: list[str] = []

    if scrape_engine == "scrapy":
        try:
            from filament_tracker.scrapy_engine import scrape_sites_with_scrapy

            records_by_site, errors_by_site = scrape_sites_with_scrapy(sites)
            for site in sites:
                name = site.get("name", "unknown")
                records = records_by_site.get(name, [])
                all_records.extend(records)
                if name in errors_by_site:
                    message = errors_by_site[name]
                    errors.append(message)
                    print(f"[{name}] scrape failed: {message}")
                else:
                    print(f"[{name}] scraped {len(records)} items")
        except SiteScrapeError as exc:
            message = str(exc)
            errors.append(message)
            print(f"[scrapy] setup failed: {message}")
    else:
        for site in sites:
            name = site.get("name", "unknown")
            try:
                records = scrape_site(site)
                all_records.extend(records)
                print(f"[{name}] scraped {len(records)} items")
            except SiteScrapeError as exc:
                message = str(exc)
                errors.append(message)
                print(f"[{name}] scrape failed: {message}")
            except Exception as exc:  # noqa: BLE001
                message = f"{name}: unexpected error: {exc}"
                errors.append(message)
                print(f"[{name}] scrape failed: {message}")

    if not all_records:
        print("No records scraped. Check selectors, network access, or anti-bot blocks.")
        if errors:
            print("Errors:")
            for err in errors:
                print(f"- {err}")
        return 1

    db.insert_records(all_records)
    changes = detect_price_changes(all_records, previous)

    export_latest(all_records, "exports/latest_prices.csv")

    if zapier_webhook_url:
        send_zapier(zapier_webhook_url, all_records, changes, errors)

    print(f"Stored {len(all_records)} records")
    print(f"Detected {len(changes)} price changes")
    return 0


def detect_price_changes(
    current: list[PriceRecord],
    previous: dict[tuple[str, str], PriceRecord],
    tolerance: float = 1e-6,
) -> list[dict]:
    changes: list[dict] = []

    for row in current:
        old = previous.get((row.site, row.product_key))
        if old is None:
            changes.append(
                {
                    "kind": "new",
                    "site": row.site,
                    "title": row.title,
                    "price": row.price,
                    "old_price": None,
                    "currency": row.currency,
                    "url": row.product_url,
                }
            )
            continue

        if abs(old.price - row.price) > tolerance:
            changes.append(
                {
                    "kind": "price_change",
                    "site": row.site,
                    "title": row.title,
                    "price": row.price,
                    "old_price": old.price,
                    "currency": row.currency,
                    "url": row.product_url,
                }
            )

    return changes


def export_latest(records: list[PriceRecord], output_path: str) -> None:
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    sorted_rows = sorted(
        records,
        key=lambda x: (x.site, x.filament_type, x.price, x.title.lower()),
    )

    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "scraped_at",
                "site",
                "title",
                "filament_type",
                "price",
                "currency",
                "product_url",
            ]
        )
        for row in sorted_rows:
            writer.writerow(
                [
                    row.scraped_at.isoformat(),
                    row.site,
                    row.title,
                    row.filament_type,
                    row.price,
                    row.currency,
                    row.product_url,
                ]
            )


def send_zapier(
    webhook_url: str,
    records: list[PriceRecord],
    changes: list[dict],
    errors: list[str],
) -> None:
    payload = {
        "record_count": len(records),
        "change_count": len(changes),
        "changes": changes[:25],
        "errors": errors,
    }

    response = requests.post(webhook_url, json=payload, timeout=20)
    response.raise_for_status()


if __name__ == "__main__":
    raise SystemExit(run())
