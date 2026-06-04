from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin

from filament_tracker.models import PriceRecord
from filament_tracker.scraper import (
    SiteScrapeError,
    build_product_key,
    infer_material,
    normalize_whitespace,
    parse_price,
)


def scrape_sites_with_scrapy(
    sites: list[dict[str, Any]],
    timeout_seconds: int = 25,
) -> tuple[dict[str, list[PriceRecord]], dict[str, str]]:
    try:
        import scrapy
        from scrapy.crawler import CrawlerProcess
    except Exception as exc:  # noqa: BLE001
        raise SiteScrapeError(
            "Scrapy is not available. Install dependencies with: pip install -r requirements.txt"
        ) from exc

    try:
        # Fail fast when Twisted/Scrapy is incompatible with the active Python runtime.
        from scrapy.core.downloader.handlers import http11 as _http11  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        raise SiteScrapeError(
            "Scrapy is installed but not compatible with this Python runtime. "
            "Use Python 3.11 or 3.12 for SCRAPE_ENGINE=scrapy."
        ) from exc

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/126.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }

    records_by_site: dict[str, list[PriceRecord]] = {}
    errors_by_site: dict[str, str] = {}

    class GenericFilamentSpider(scrapy.Spider):
        name = "generic_filament"

        custom_settings = {
            "RETRY_ENABLED": True,
            "RETRY_TIMES": 2,
            "LOG_ENABLED": False,
            "ROBOTSTXT_OBEY": False,
            "DOWNLOAD_TIMEOUT": timeout_seconds,
            "AUTOTHROTTLE_ENABLED": True,
            "AUTOTHROTTLE_START_DELAY": 1.0,
            "AUTOTHROTTLE_MAX_DELAY": 8.0,
        }

        def __init__(self, site_config: dict[str, Any], *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.site_config = site_config
            self.site_name = site_config["name"]
            self.currency = site_config.get("currency", "USD")
            self.url = site_config["url"]
            self.selectors = site_config["selectors"]

        def start_requests(self):
            yield scrapy.Request(
                self.url,
                headers=headers,
                callback=self.parse,
                errback=self.on_error,
                dont_filter=True,
            )

        def on_error(self, failure):
            errors_by_site[self.site_name] = (
                f"{self.site_name}: request failed: {failure.getErrorMessage()}"
            )
            records_by_site[self.site_name] = []

        def parse(self, response):
            product_selector = self.selectors["product"]
            nodes = response.css(product_selector)
            if not nodes:
                errors_by_site[self.site_name] = (
                    f"{self.site_name}: no products matched selector '{product_selector}'. "
                    "Site markup likely changed."
                )
                records_by_site[self.site_name] = []
                return

            scraped_at = datetime.now(timezone.utc)
            site_records: list[PriceRecord] = []

            for node in nodes:
                title = _first_css_text(node, self.selectors.get("title", ""))
                price_text = _first_css_text(node, self.selectors.get("price", ""))
                href = _first_css_attr(node, self.selectors.get("link", ""), "href")

                if not title or not price_text:
                    continue

                price = parse_price(price_text)
                if price is None:
                    continue

                absolute_url = urljoin(self.url, href) if href else self.url
                product_key = build_product_key(title, absolute_url)
                material = infer_material(title)

                site_records.append(
                    PriceRecord(
                        scraped_at=scraped_at,
                        site=self.site_name,
                        product_key=product_key,
                        title=normalize_whitespace(title),
                        filament_type=material,
                        price=price,
                        currency=self.currency,
                        product_url=absolute_url,
                    )
                )

            records_by_site[self.site_name] = site_records

    process = CrawlerProcess(settings={"LOG_ENABLED": False})
    for site in sites:
        process.crawl(GenericFilamentSpider, site_config=site)

    process.start()

    for site in sites:
        records_by_site.setdefault(site["name"], [])

    return records_by_site, errors_by_site


def _first_css_text(node, selector: str) -> str:
    if not selector:
        return ""

    text_nodes = node.css(f"{selector}::text").getall()
    if text_nodes:
        return normalize_whitespace(" ".join(text_nodes))

    # Fallback when text nodes are wrapped in nested tags.
    html = node.css(selector).get()
    if not html:
        return ""

    import re

    stripped = re.sub(r"<[^>]+>", " ", html)
    return normalize_whitespace(stripped)


def _first_css_attr(node, selector: str, attr: str) -> str:
    if not selector:
        return ""

    selected = node.css(selector)
    if not selected:
        return ""

    value = selected[0].attrib.get(attr, "")
    return value.strip() if isinstance(value, str) else ""
