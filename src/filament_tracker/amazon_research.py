from __future__ import annotations

import csv
import json
import os
import re
import statistics
from collections import defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import urlencode, urljoin

import requests
from bs4 import BeautifulSoup

MATERIALS = {
    "PLA": "pla filament 1.75mm",
    "PETG": "petg filament 1.75mm",
    "TPU": "tpu filament 1.75mm",
}

COLOR_HEX = {
    "BLACK": "#111111",
    "WHITE": "#f5f5f5",
    "GRAY": "#8b8d91",
    "GREY": "#8b8d91",
    "RED": "#d63333",
    "BLUE": "#2563eb",
    "GREEN": "#059669",
    "YELLOW": "#eab308",
    "ORANGE": "#ea580c",
    "PURPLE": "#7c3aed",
    "PINK": "#db2777",
    "BROWN": "#8b5a2b",
    "BEIGE": "#d6c5a4",
    "GOLD": "#c9a227",
    "SILVER": "#a8a29e",
    "COPPER": "#b87333",
    "CLEAR": "#9ca3af",
    "TRANSPARENT": "#9ca3af",
    "TRANSLUCENT": "#9ca3af",
    "MULTICOLOR": "#7e22ce",
    "RAINBOW": "#ec4899",
    "UNKNOWN": "#475569",
}

COLOR_KEYWORDS = [
    "multicolor",
    "multi-color",
    "rainbow",
    "rose gold",
    "dark gray",
    "light gray",
    "transparent",
    "translucent",
    "clear",
    "black",
    "white",
    "gray",
    "grey",
    "red",
    "blue",
    "green",
    "yellow",
    "orange",
    "purple",
    "pink",
    "brown",
    "beige",
    "gold",
    "silver",
    "copper",
]

MATERIAL_RE = re.compile(r"\b(PLA|PETG|TPU)\b", re.IGNORECASE)
PRICE_RE = re.compile(r"([0-9]+(?:\.[0-9]{1,2})?)")
KG_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:kg|kilograms?|kgs?)\b", re.IGNORECASE)
GRAM_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:g|grams?)\b", re.IGNORECASE)
LBS_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b", re.IGNORECASE)
PACK_RE = re.compile(r"\b(\d+)\s*(?:pack|pk|count|spools?)\b", re.IGNORECASE)
EACH_WEIGHT_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(kg|kilograms?|kgs?|g|grams?|lb|lbs|pounds?)\b.{0,16}\b(each|ea)\b",
    re.IGNORECASE,
)


@dataclass
class AmazonFilamentRecord:
    asin: str
    material: str
    query_material: str
    brand: str
    source: str
    title: str
    color: str
    color_options: str
    spec_tags: str
    price: float
    currency: str
    weight_kg: float | None
    price_per_kg: float | None
    product_url: str
    source_url: str


class AmazonResearchError(Exception):
    pass


BRAND_HINTS = [
    "AMOLEN",
    "ANYCUBIC",
    "CC3D",
    "CREALITY",
    "DEEPLEE",
    "DURAMIC",
    "ELEGOO",
    "ESUN",
    "FLASHFORGE",
    "GEEETECH",
    "GIANTARM",
    "GRATKIT",
    "HATCHBOX",
    "JAYO",
    "KINGROON",
    "OVERTURE",
    "POLYMAKER",
    "R3D",
    "SOVOL",
    "SUNLU",
    "TECBEARS",
]

SPEC_PATTERNS = [
    (re.compile(r"\b1\.75\s*mm\b", re.IGNORECASE), "1.75mm"),
    (re.compile(r"\b2\.85\s*mm\b", re.IGNORECASE), "2.85mm"),
    (re.compile(r"(?:\+/-|±)\s*0\.02\s*mm|\b0\.02\s*mm\b", re.IGNORECASE), "tol-0.02mm"),
    (re.compile(r"(?:\+/-|±)\s*0\.03\s*mm|\b0\.03\s*mm\b", re.IGNORECASE), "tol-0.03mm"),
    (re.compile(r"\bhigh\s*-?\s*speed\b|\brapid\b", re.IGNORECASE), "high-speed"),
    (re.compile(r"\bmatte\b", re.IGNORECASE), "matte"),
    (re.compile(r"\bsilk\b", re.IGNORECASE), "silk"),
    (re.compile(r"\bcarbon\s*fiber\b|\b[a-z]+-cf\b", re.IGNORECASE), "carbon-fiber"),
    (re.compile(r"\bglow\b", re.IGNORECASE), "glow"),
    (re.compile(r"\bwood\b", re.IGNORECASE), "wood"),
    (re.compile(r"\btransparent\b|\btranslucent\b|\bclear\b", re.IGNORECASE), "translucent"),
]


def headers() -> dict[str, str]:
    return {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/126.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-CA,en-US;q=0.9,en;q=0.8",
    }


def run() -> int:
    pages_per_material = int(os.getenv("AMAZON_RESEARCH_PAGES", "2"))
    output_dir = Path(os.getenv("AMAZON_RESEARCH_OUTPUT_DIR", "exports"))
    output_dir.mkdir(parents=True, exist_ok=True)

    records = collect_amazon_filament_research(pages_per_material=pages_per_material)
    if not records:
        raise AmazonResearchError("No Amazon records collected. Check connectivity or anti-bot responses.")

    raw_csv = output_dir / "amazon_filament_research_raw.csv"
    summary_csv = output_dir / "amazon_filament_research_summary.csv"
    dashboard_html = output_dir / "amazon_filament_dashboard.html"
    web_data_json = Path("web/data/amazon_filament_research.json")
    web_data_json.parent.mkdir(parents=True, exist_ok=True)

    write_raw_csv(raw_csv, records)
    write_summary_csv(summary_csv, records)
    write_dashboard_html(dashboard_html, records)
    write_web_dashboard_json(web_data_json, records)

    by_material = summarize_material(records)
    print(f"Collected {len(records)} unique Amazon items")
    for material, row in sorted(by_material.items()):
        print(
            f"[{material}] items={row['item_count']} with_price_per_kg={row['with_price_per_kg']} "
            f"median_price_per_kg={row['median_price_per_kg']}"
        )

    print(f"Raw data: {raw_csv}")
    print(f"Summary:  {summary_csv}")
    print(f"Dashboard:{dashboard_html}")
    print(f"Web data: {web_data_json}")
    return 0


def collect_amazon_filament_research(pages_per_material: int = 2) -> list[AmazonFilamentRecord]:
    session = requests.Session()
    session.headers.update(headers())

    merged: dict[str, AmazonFilamentRecord] = {}

    for material, query in MATERIALS.items():
        for page in range(1, pages_per_material + 1):
            source_url = f"https://www.amazon.ca/s?{urlencode({'k': query, 'page': page})}"
            response = session.get("https://www.amazon.ca/s", params={"k": query, "page": page}, timeout=30)
            if response.status_code >= 400:
                continue

            body_lower = response.text.lower()
            if "captcha" in body_lower and "enter the characters" in body_lower:
                continue

            for row in parse_search_page(response.text, source_url, material):
                current = merged.get(row.asin)
                if current is None:
                    merged[row.asin] = row
                    continue

                # Prefer rows with known weight and lower price when duplicate ASINs appear.
                if current.weight_kg is None and row.weight_kg is not None:
                    merged[row.asin] = row
                elif current.price > row.price:
                    merged[row.asin] = row

    return sorted(merged.values(), key=lambda x: (x.material, x.price_per_kg or 1e9, x.price, x.title.lower()))


def parse_search_page(html: str, source_url: str, query_material: str) -> Iterable[AmazonFilamentRecord]:
    soup = BeautifulSoup(html, "lxml")
    nodes = soup.select("div[data-component-type='s-search-result']")

    for node in nodes:
        asin = (node.get("data-asin") or "").strip()
        if not asin:
            continue

        title_node = node.select_one("h2 span")
        price_node = node.select_one(".a-price .a-offscreen")
        link_node = (
            node.select_one("h2 a[href]")
            or node.select_one("a[href*='/dp/']")
            or node.select_one("a.a-link-normal[href]")
        )

        if not title_node or not price_node:
            continue

        title = normalize_space(title_node.get_text(" "))
        if not title:
            continue

        price = parse_price(price_node.get_text(" "))
        if price is None:
            continue

        href = link_node.get("href") if link_node else ""
        product_url = urljoin("https://www.amazon.ca", href) if isinstance(href, str) and href.strip() else source_url
        material = infer_material(title, default=query_material)
        color_options = infer_color_options(title)
        color = color_options[0] if color_options else "UNKNOWN"
        weight_kg = infer_weight_kg(title)
        price_per_kg = round(price / weight_kg, 2) if weight_kg and weight_kg > 0 else None
        spec_tags = infer_spec_tags(title)

        yield AmazonFilamentRecord(
            asin=asin,
            material=material,
            query_material=query_material,
            brand=infer_brand(title),
            source="amazon.ca",
            title=title,
            color=color,
            color_options=" | ".join(color_options),
            spec_tags=" | ".join(spec_tags),
            price=round(price, 2),
            currency="CAD",
            weight_kg=round(weight_kg, 3) if weight_kg else None,
            price_per_kg=price_per_kg,
            product_url=product_url,
            source_url=source_url,
        )


def infer_material(title: str, default: str) -> str:
    match = MATERIAL_RE.search(title)
    return match.group(1).upper() if match else default


def infer_color(title: str) -> str:
    lowered = title.lower()
    for token in COLOR_KEYWORDS:
        if token in lowered:
            if token in {"multicolor", "multi-color"}:
                return "MULTICOLOR"
            return token.upper()
    return "UNKNOWN"


def infer_color_options(title: str) -> list[str]:
    lowered = title.lower()
    options: list[str] = []

    for token in sorted(COLOR_KEYWORDS, key=len, reverse=True):
        if token in lowered:
            if token in {"multicolor", "multi-color"}:
                canonical = "MULTICOLOR"
            else:
                canonical = token.upper()
            if canonical not in options:
                options.append(canonical)

    return options


def infer_spec_tags(title: str) -> list[str]:
    tags: list[str] = []
    for pattern, label in SPEC_PATTERNS:
        if pattern.search(title):
            tags.append(label)
    return tags


def infer_brand(title: str) -> str:
    upper = title.upper()
    for brand in BRAND_HINTS:
        if re.search(rf"\b{re.escape(brand)}\b", upper):
            return brand

    first = re.match(r"[A-Za-z0-9][A-Za-z0-9+\-]{1,24}", title)
    return first.group(0).upper() if first else "UNKNOWN"


def infer_weight_kg(title: str) -> float | None:
    text = title.lower().replace(",", "")

    kg_matches = [float(m.group(1)) for m in KG_RE.finditer(text)]
    gram_matches = [float(m.group(1)) / 1000.0 for m in GRAM_RE.finditer(text)]
    lbs_matches = [float(m.group(1)) * 0.453592 for m in LBS_RE.finditer(text)]

    each_match = EACH_WEIGHT_RE.search(text)
    each_weight_kg: float | None = None
    if each_match:
        value = float(each_match.group(1))
        unit = each_match.group(2).lower()
        if unit.startswith("kg"):
            each_weight_kg = value
        elif unit.startswith("g"):
            each_weight_kg = value / 1000.0
        elif unit.startswith("lb") or unit.startswith("pound"):
            each_weight_kg = value * 0.453592

    pack_match = PACK_RE.search(text)
    if each_weight_kg is not None and pack_match:
        pack_count = int(pack_match.group(1))
        if 1 < pack_count <= 8:
            total = each_weight_kg * pack_count
            if 0 < total <= 20:
                return total

    primary = None
    if kg_matches:
        primary = kg_matches[0]
    elif gram_matches:
        primary = gram_matches[0]
    elif lbs_matches:
        primary = lbs_matches[0]

    if primary is None:
        return None

    if primary <= 0 or primary > 20:
        return None
    return primary


def parse_price(text: str) -> float | None:
    cleaned = text.replace(",", "")
    match = PRICE_RE.search(cleaned)
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def write_raw_csv(path: Path, rows: list[AmazonFilamentRecord]) -> None:
    fieldnames = [
        "asin",
        "material",
        "query_material",
        "brand",
        "source",
        "title",
        "color",
        "color_options",
        "spec_tags",
        "price",
        "currency",
        "weight_kg",
        "price_per_kg",
        "product_url",
        "source_url",
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def summarize_material(rows: list[AmazonFilamentRecord]) -> dict[str, dict[str, str | int | float | None]]:
    grouped: dict[str, list[AmazonFilamentRecord]] = defaultdict(list)
    for row in rows:
        grouped[row.material].append(row)

    summary: dict[str, dict[str, str | int | float | None]] = {}
    for material, items in grouped.items():
        ppk = [x.price_per_kg for x in items if x.price_per_kg is not None]
        summary[material] = {
            "item_count": len(items),
            "with_price_per_kg": len(ppk),
            "min_price_per_kg": round(min(ppk), 2) if ppk else None,
            "median_price_per_kg": round(statistics.median(ppk), 2) if ppk else None,
            "max_price_per_kg": round(max(ppk), 2) if ppk else None,
        }
    return summary


def write_summary_csv(path: Path, rows: list[AmazonFilamentRecord]) -> None:
    summary = summarize_material(rows)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "material",
                "item_count",
                "with_price_per_kg",
                "min_price_per_kg",
                "median_price_per_kg",
                "max_price_per_kg",
            ]
        )
        for material in sorted(summary.keys()):
            row = summary[material]
            writer.writerow(
                [
                    material,
                    row["item_count"],
                    row["with_price_per_kg"],
                    row["min_price_per_kg"],
                    row["median_price_per_kg"],
                    row["max_price_per_kg"],
                ]
            )


def write_dashboard_html(path: Path, rows: list[AmazonFilamentRecord]) -> None:
    grouped: dict[str, list[AmazonFilamentRecord]] = defaultdict(list)
    for row in rows:
        grouped[row.material].append(row)

    for material in grouped:
        grouped[material].sort(key=lambda x: (x.price_per_kg if x.price_per_kg is not None else 1e9, x.price))

    summary = summarize_material(rows)
    json_payload = json.dumps([asdict(r) for r in rows])

    html = f"""<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>Amazon Filament Dashboard</title>
  <style>
    :root {{
      --bg: #f3f6f4;
      --ink: #1f2933;
      --card: #ffffff;
      --accent: #0f766e;
      --muted: #64748b;
      --line: #d9e2ec;
    }}
    body {{ margin: 0; font-family: "Avenir Next", "Segoe UI", sans-serif; color: var(--ink); background: radial-gradient(circle at top right, #d1fae5, #f3f6f4 45%); }}
    .wrap {{ max-width: 1180px; margin: 24px auto; padding: 0 16px 40px; }}
    h1 {{ margin: 8px 0 4px; font-size: 34px; }}
    .sub {{ color: var(--muted); margin-bottom: 18px; }}
    .cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 18px; }}
    .card {{ background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; box-shadow: 0 4px 20px rgba(15, 118, 110, 0.06); }}
    .k {{ color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }}
    .v {{ font-size: 24px; font-weight: 700; margin-top: 2px; }}
    .section {{ background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px 14px; margin-top: 14px; }}
    .section h2 {{ margin: 4px 0 8px; color: var(--accent); }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ text-align: left; border-bottom: 1px solid var(--line); padding: 7px 6px; font-size: 13px; vertical-align: top; }}
    th {{ color: var(--muted); font-weight: 600; }}
    .mono {{ font-family: ui-monospace, Menlo, Monaco, monospace; }}
    a {{ color: #0b7285; text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
  </style>
</head>
<body>
  <div class=\"wrap\">
    <h1>Amazon Filament Pricing Dashboard</h1>
    <div class=\"sub\">PLA, PETG, and TPU listings with normalized CAD price-per-kg when spool weight is detectable from title text.</div>
    <div class=\"cards\">
      <div class=\"card\"><div class=\"k\">Total Items</div><div class=\"v\">{len(rows)}</div></div>
      <div class=\"card\"><div class=\"k\">Materials</div><div class=\"v\">{len(summary)}</div></div>
      <div class=\"card\"><div class=\"k\">Generated</div><div class=\"v mono\">Auto</div></div>
    </div>
"""

    for material in ["PLA", "PETG", "TPU"]:
        rows_for_material = grouped.get(material, [])
        stats = summary.get(material, {})
        html += f"""
    <div class=\"section\">
      <h2>{material}</h2>
      <div class=\"sub\">Items: {stats.get('item_count', 0)} | With price/kg: {stats.get('with_price_per_kg', 0)} | Median CAD/kg: {stats.get('median_price_per_kg')}</div>
      <table>
        <thead>
          <tr>
                        <th>Brand</th>
                        <th>Source</th>
            <th>Title</th>
            <th>Color</th>
                        <th>Color Options</th>
                        <th>Specs</th>
            <th>Price</th>
            <th>Weight (kg)</th>
            <th>Price / kg</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
"""
        for row in rows_for_material[:40]:
            html += f"""
          <tr>
                        <td>{row.brand}</td>
                        <td>{row.source}</td>
            <td>{escape_html(row.title)}</td>
            <td>{row.color}</td>
                        <td>{escape_html(row.color_options)}</td>
                        <td>{escape_html(row.spec_tags)}</td>
            <td>{row.price:.2f} {row.currency}</td>
            <td>{row.weight_kg if row.weight_kg is not None else ''}</td>
            <td>{row.price_per_kg if row.price_per_kg is not None else ''}</td>
            <td><a href=\"{row.product_url}\" target=\"_blank\" rel=\"noopener noreferrer\">Open</a></td>
          </tr>
"""

        html += """
        </tbody>
      </table>
    </div>
"""

    html += f"""
    <script id=\"raw-data\" type=\"application/json\">{escape_html(json_payload)}</script>
  </div>
</body>
</html>
"""

    path.write_text(html, encoding="utf-8")


def write_web_dashboard_json(path: Path, rows: list[AmazonFilamentRecord]) -> None:
    summary = summarize_material(rows)
    color_profiles = build_color_profiles(rows)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "currency": "CAD",
        "item_count": len(rows),
        "materials": sorted(list(summary.keys())),
        "summary": summary,
        "color_profiles": color_profiles,
        "records": [
            {
                **asdict(row),
                "color_hex": color_to_hex(row.color),
            }
            for row in rows
        ],
    }

    path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")


def build_color_profiles(rows: list[AmazonFilamentRecord]) -> dict[str, list[dict[str, str | int]]]:
    grouped: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in rows:
        grouped[row.material][row.color] += 1

    profiles: dict[str, list[dict[str, str | int]]] = {}
    for material, counts in grouped.items():
        ordered = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        profiles[material] = [
            {
                "color": color,
                "count": count,
                "hex": color_to_hex(color),
            }
            for color, count in ordered
        ]
    return profiles


def color_to_hex(color: str) -> str:
    return COLOR_HEX.get(color.upper(), "#475569")


def escape_html(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


if __name__ == "__main__":
    raise SystemExit(run())
