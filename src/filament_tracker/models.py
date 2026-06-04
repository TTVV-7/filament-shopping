from dataclasses import dataclass
from datetime import datetime


@dataclass
class PriceRecord:
    scraped_at: datetime
    site: str
    product_key: str
    title: str
    filament_type: str
    price: float
    currency: str
    product_url: str
