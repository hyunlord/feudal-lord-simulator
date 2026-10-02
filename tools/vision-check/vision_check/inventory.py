"""Explicit normal-stock exclusions; unknown props remain repetition candidates.

Sources: stockPiles.ts, aleWorldArt.ts, constructionPlaque.ts and their manifests.
Yarn remains eligible because it also marks spinning-house trades. A composite
workshop containing logs is not itself a wood pile and is never blanket-excluded.
"""

from collections import Counter
from collections.abc import Sequence
from typing import Literal
from urllib.parse import urlsplit

from .models import Draw

InventoryCategory = Literal["ale_stock", "crate_stock", "wood_stock"]
_STOCK: dict[str, InventoryCategory] = {
    **{f"assets/wave3/pile/ale_barrels_{i}.png": "ale_stock" for i in (1, 2, 3)},
    **{f"assets/wave7/pile/crates_{i}-v1.png": "crate_stock" for i in (1, 2, 3)},
    **{f"assets/visibility-v1/construction/pile_wood_{i}-v1.png": "wood_stock" for i in (1, 2, 3)},
    "assets/wave11/site/timber_beam_stack-v1.png": "wood_stock",
}


def inventory_category(asset: str) -> InventoryCategory | None:
    """Classify exact manifest paths, independent of scene names or coordinates."""
    return _STOCK.get(urlsplit(asset).path.lstrip("/"))


def inventory_skip_counts(draws: Sequence[Draw]) -> dict[str, int]:
    """Count recorded draw calls by exclusion category, not visible distinct stock."""
    return dict(Counter(category for draw in draws if (category := inventory_category(draw.asset))))
