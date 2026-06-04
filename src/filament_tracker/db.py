import sqlite3
from pathlib import Path
from typing import Dict, Tuple

from filament_tracker.models import PriceRecord


class PriceDatabase:
    def __init__(self, db_path: str) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS price_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scraped_at TEXT NOT NULL,
                site TEXT NOT NULL,
                product_key TEXT NOT NULL,
                title TEXT NOT NULL,
                filament_type TEXT NOT NULL,
                price REAL NOT NULL,
                currency TEXT NOT NULL,
                product_url TEXT NOT NULL
            )
            """
        )
        self.conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_price_lookup
            ON price_snapshots(site, product_key, scraped_at)
            """
        )
        self.conn.commit()

    def get_latest_by_product(self) -> Dict[Tuple[str, str], PriceRecord]:
        query = """
            SELECT p1.*
            FROM price_snapshots p1
            JOIN (
                SELECT site, product_key, MAX(scraped_at) AS max_scraped_at
                FROM price_snapshots
                GROUP BY site, product_key
            ) p2
              ON p1.site = p2.site
             AND p1.product_key = p2.product_key
             AND p1.scraped_at = p2.max_scraped_at
        """
        rows = self.conn.execute(query).fetchall()

        latest: Dict[Tuple[str, str], PriceRecord] = {}
        for row in rows:
            latest[(row["site"], row["product_key"])] = PriceRecord(
                scraped_at=datetime_from_iso(row["scraped_at"]),
                site=row["site"],
                product_key=row["product_key"],
                title=row["title"],
                filament_type=row["filament_type"],
                price=float(row["price"]),
                currency=row["currency"],
                product_url=row["product_url"],
            )
        return latest

    def insert_records(self, records: list[PriceRecord]) -> None:
        self.conn.executemany(
            """
            INSERT INTO price_snapshots (
                scraped_at, site, product_key, title, filament_type, price, currency, product_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    r.scraped_at.isoformat(),
                    r.site,
                    r.product_key,
                    r.title,
                    r.filament_type,
                    r.price,
                    r.currency,
                    r.product_url,
                )
                for r in records
            ],
        )
        self.conn.commit()


def datetime_from_iso(value: str):
    from datetime import datetime

    return datetime.fromisoformat(value)
