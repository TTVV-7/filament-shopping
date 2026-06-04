import hashlib
import re
from typing import Any
from urllib.parse import urljoin

import requests
import yaml
from bs4 import BeautifulSoup

from filament_tracker.models import PriceRecord

MATERIAL_PATTERN = re.compile(r"\b(PLA|PETG|ABS|ASA|TPU|NYLON|PA|PC)\b", re.IGNORECASE)
PRICE_PATTERN = re.compile(r"([0-9]+(?:\s*\.\s*[0-9]{1,2})?)")


class SiteScrapeError(Exception):
    pass


def load_sites(config_path: str) -> list[dict[str, Any]]:
    with open(config_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    sites = data.get("sites", [])
    if not sites:
        raise ValueError("No sites configured in sites.yaml")
    return sites


def scrape_site(site: dict[str, Any], timeout_seconds: int = 25) -> list[PriceRecord]:
    name = site["name"]
    url = site["url"]
    currency = site.get("currency", "USD")
    selectors = site["selectors"]

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/126.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }

    response = requests.get(url, headers=headers, timeout=timeout_seconds)
    if response.status_code >= 400:
        raise SiteScrapeError(f"{name}: HTTP {response.status_code}")

    soup = BeautifulSoup(response.text, "lxml")
    product_selector = selectors["product"]
    nodes = soup.select(product_selector)

    if not nodes:
        raise SiteScrapeError(
            f"{name}: no products matched selector '{product_selector}'. Site markup likely changed."
        )

    from datetime import datetime, timezone

    scraped_at = datetime.now(timezone.utc)
    records: list[PriceRecord] = []
    seen_product_keys: set[str] = set()

    for node in nodes:
        title = first_text(node, selectors.get("title", ""))
        price_text = first_text(node, selectors.get("price", ""))
        href = first_attr(node, selectors.get("link", ""), "href")

        if not title or not price_text:
            continue

        price = parse_price(price_text)
        if price is None:
            continue

        absolute_url = urljoin(url, href) if href else url
        product_key = build_product_key(title, absolute_url)
        material = infer_material(title)

        if product_key in seen_product_keys:
            continue
        seen_product_keys.add(product_key)

        records.append(
            PriceRecord(
                scraped_at=scraped_at,
                site=name,
                product_key=product_key,
                title=normalize_whitespace(title),
                filament_type=material,
                price=price,
                currency=currency,
                product_url=absolute_url,
            )
        )

    return records


def first_text(node, selector: str) -> str:
    if not selector:
        return ""
    child = node.select_one(selector)
    return normalize_whitespace(child.get_text(" ")) if child else ""


def first_attr(node, selector: str, attr: str) -> str:
    if not selector:
        return ""
    child = node.select_one(selector)
    if not child:
        return ""
    value = child.get(attr)
    return value.strip() if isinstance(value, str) else ""


def parse_price(text: str) -> float | None:
    cleaned = text.replace(",", "")
    # Some pages render currency as "$ 15 .59"; normalize the spaced decimal.
    cleaned = re.sub(r"(\d)\s*\.\s*(\d)", r"\1.\2", cleaned)
    match = PRICE_PATTERN.search(cleaned)
    if not match:
        return None
    try:
        return float(match.group(1).replace(" ", ""))
    except ValueError:
        return None


def infer_material(title: str) -> str:
    match = MATERIAL_PATTERN.search(title)
    if not match:
        return "UNKNOWN"
    material = match.group(1).upper()
    if material == "PA":
        return "NYLON"
    return material


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def build_product_key(title: str, product_url: str) -> str:
    source = f"{normalize_whitespace(title).lower()}|{product_url}"
    return hashlib.sha1(source.encode("utf-8")).hexdigest()[:16]
