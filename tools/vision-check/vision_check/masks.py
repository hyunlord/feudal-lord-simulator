"""Asset silhouettes and deliberately partial, colour-based roof eligibility.

An alpha silhouette establishes occupancy, not visibility or roof semantics.
Warm upper connected components are only roof hypotheses. Grey/slate/snow roofs,
rotated draws and unknown sprites require abstention or explicit caller masks.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from functools import lru_cache
from typing import TYPE_CHECKING
from urllib.parse import unquote, urlsplit

import cv2
import numpy as np
from PIL import Image as PILImage

if TYPE_CHECKING:
    from pathlib import Path

    from .models import Draw, Scene

Pixels = np.ndarray[tuple[int, ...], np.dtype[np.uint8]]
Polygon = Sequence[tuple[int, int]]
GROUND_NAMES = ("forest_floor", "forest-floor", "/rock", "chalk", "/ground/", "/terrain/")
BUILDING_NAMES = (
    "house",
    "church",
    "chapel",
    "manor",
    "tavern",
    "bakery",
    "workshop",
    "warehouse",
    "granary",
    "smithy",
    "mill_",
    "/buildings/",
    "cottage",
)
EXCLUDE_NAMES = (
    "/foliage/",
    "/villagers/",
    "/people/",
    "/props/",
    "/road/",
    "person:",
    "tree_",
    "cart",
    "barrel",
    "stall",
    "packed_earth_road",
    "/yard",
    "/garden",
    "fence",
    "field_furrow",
    "hedge",
    "wall",
    "boundary_stone",
    "bridge",
)
HUE_OCHRE_MAX = 35
HUE_RED_MIN = 172
SATURATION_MIN = 55
VALUE_MIN = 45
POLYGON_MIN_POINTS = 3
CROP_LENGTH = 4
ALPHA_CUTOFF = 96
MIN_ROOF_PIXELS = 24
MIN_ROOF_FRACTION = 0.04
MAX_ROOF_FRACTION = 0.7
MIN_DRAW_ALPHA = 0.2


@dataclass(frozen=True)
class SceneMasks:
    """Sprite-sized dictionaries and viewport-sized ground eligibility."""

    alpha: dict[str, Pixels]
    roofs: dict[str, Pixels]
    ground: Pixels
    missing_assets: tuple[str, ...]
    notes: tuple[str, ...]


def sprite_key(draw: Draw) -> str:
    """Disambiguate frames cut from the same atlas; preserve existing crop tags."""
    if "#crop=" in draw.asset or len(draw.source) != CROP_LENGTH:
        return draw.asset
    return draw.asset + "#crop=" + ",".join(f"{value:g}" for value in draw.source)


def _crop(draw: Draw) -> tuple[float, ...]:
    if len(draw.source) == CROP_LENGTH:
        return draw.source
    if "#crop=" not in draw.asset:
        return ()
    try:
        values = tuple(float(value) for value in draw.asset.split("#crop=", 1)[1].split(","))
    except ValueError:
        return ()
    return values if len(values) == CROP_LENGTH else ()


@lru_cache(maxsize=256)
def _load(path: Path) -> Pixels | None:
    try:
        with PILImage.open(path) as image:
            return np.asarray(image.convert("RGBA"), dtype=np.uint8)
    except (OSError, ValueError):
        return None


def sprite_rgba(draw: Draw, public_root: Path) -> Pixels | None:
    """Load a local asset and its exact source rectangle, without network access."""
    path_part = unquote(urlsplit(draw.asset).path).lstrip("/")
    root = public_root.resolve()
    path = (root / path_part).resolve()
    if not path.is_relative_to(root):
        return None
    pixels = _load(path)
    if pixels is None:
        return None
    crop = _crop(draw)
    if not crop:
        return pixels
    left, top, crop_width, crop_height = crop
    x, y = round(left), round(top)
    width, height = round(left + crop_width) - x, round(top + crop_height) - y
    if x < 0 or y < 0 or width <= 0 or height <= 0:
        return None
    if x + width > pixels.shape[1] or y + height > pixels.shape[0]:
        return None
    return pixels[y : y + height, x : x + width]


def alpha_mask(draw: Draw, public_root: Path) -> Pixels | None:
    """Return cropped sprite alpha, or None for unavailable/invalid image data."""
    rgba = sprite_rgba(draw, public_root)
    return None if rgba is None else rgba[:, :, 3]


def roof_mask(rgba: Pixels) -> Pixels | None:
    """Conservative warm connected region in the upper opaque sprite extent.

    This is a hypothesis, never a semantic guarantee: brown upper walls can pass.
    Unknown/grey roofs intentionally return None instead of whole-box fallback.
    """
    alpha = rgba[:, :, 3]
    yy, xx = np.nonzero(alpha >= ALPHA_CUTOFF)
    if not yy.size:
        return None
    top, bottom = int(yy.min()), int(yy.max())
    left, right = int(xx.min()), int(xx.max())
    hsv = np.asarray(cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2HSV), dtype=np.uint8)
    warm = (
        ((hsv[:, :, 0] <= HUE_OCHRE_MAX) | (hsv[:, :, 0] >= HUE_RED_MIN))
        & (hsv[:, :, 1] >= SATURATION_MIN)
        & (hsv[:, :, 2] >= VALUE_MIN)
        & (alpha >= ALPHA_CUTOFF)
    )
    warm[top + round((bottom - top + 1) * 0.57) :] = False
    candidate = warm.astype(np.uint8) * 255
    candidate = np.asarray(
        cv2.morphologyEx(candidate, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)), dtype=np.uint8
    )
    count, labels, stats, _centres = cv2.connectedComponentsWithStats(candidate)
    if count <= 1:
        return None
    areas = np.asarray(stats, dtype=np.int32)[1:, cv2.CC_STAT_AREA]
    component = int(np.argmax(areas)) + 1
    label_values: np.ndarray[tuple[int, ...], np.dtype[np.int32]] = np.asarray(
        labels, dtype=np.int32
    )
    selected: Pixels = np.asarray(
        cv2.compare(label_values, np.full_like(label_values, component), cv2.CMP_EQ), dtype=np.uint8
    )
    area = int(np.count_nonzero(selected))
    fraction = area / int(np.count_nonzero(alpha >= ALPHA_CUTOFF))
    selected_y, selected_x = np.nonzero(selected)
    if (
        area < MIN_ROOF_PIXELS
        or not MIN_ROOF_FRACTION <= fraction <= MAX_ROOF_FRACTION
        or int(selected_x.max()) - int(selected_x.min()) < (right - left) * 0.3
        or float(selected_y.mean()) > top + (bottom - top) * 0.45
    ):
        return None
    return np.asarray(cv2.erode(selected, np.ones((3, 3), np.uint8)), dtype=np.uint8)


def _exclude(asset: str) -> bool:
    name = asset.lower().split("#", 1)[0]
    if any(token in name for token in BUILDING_NAMES + EXCLUDE_NAMES):
        return True
    if any(token in name for token in GROUND_NAMES):
        return False
    return False


def _stamp(ground: Pixels, mask: Pixels, draw: Draw, margin: int) -> None:
    box = draw.box
    screen: Pixels = np.asarray(
        cv2.resize(mask, (box.width, box.height), interpolation=cv2.INTER_NEAREST), dtype=np.uint8
    )
    screen = np.asarray(
        cv2.compare(screen, np.full_like(screen, ALPHA_CUTOFF), cv2.CMP_GE), dtype=np.uint8
    )
    # Padding lets dilation reach beyond opaque sprites touching their source edge.
    screen = np.asarray(np.pad(screen, margin), dtype=np.uint8)
    if margin:
        screen = np.asarray(
            cv2.dilate(screen, np.ones((margin * 2 + 1,) * 2, np.uint8)), dtype=np.uint8
        )
    x, y = box.x - margin, box.y - margin
    left, top = max(0, x), max(0, y)
    right, bottom = (
        min(ground.shape[1], x + screen.shape[1]),
        min(ground.shape[0], y + screen.shape[0]),
    )
    if right > left and bottom > top:
        crop = screen[top - y : bottom - y, left - x : right - x]
        region = ground[top:bottom, left:right]
        region[crop > 0] = 0


def build_masks(
    scene: Scene, public_root: Path, road_polygons: Sequence[Polygon] = (), margin: int = 2
) -> SceneMasks:
    """Build first-frame masks; dictionaries use sprite_key(draw), not URL alone.

    Unknown assets are reported. Known non-ground with missing alpha is excluded
    by its bbox conservatively; unknown semantic classes remain ground-eligible.
    """
    if margin < 0:
        message = "Mask margin must be nonnegative"
        raise ValueError(message)
    width, height = scene.viewport
    ground: Pixels = np.full((height, width), 255, dtype=np.uint8)
    alpha: dict[str, Pixels] = {}
    roofs: dict[str, Pixels] = {}
    missing: set[str] = set()
    for draw in scene.frames[0].draws if scene.frames else ():
        if draw.alpha < MIN_DRAW_ALPHA:
            continue
        rgba = sprite_rgba(draw, public_root)
        key = sprite_key(draw)
        silhouette = None if rgba is None else rgba[:, :, 3]
        if silhouette is None:
            missing.add(key)
        else:
            alpha[key] = silhouette
            if rgba is not None and any(token in draw.asset.lower() for token in BUILDING_NAMES):
                roof = roof_mask(rgba)
                if roof is not None:
                    roofs[key] = roof
        if _exclude(draw.asset):
            fallback = np.full((1, 1), 255, dtype=np.uint8)
            _stamp(ground, fallback if silhouette is None else silhouette, draw, margin)
    for polygon in road_polygons:
        if len(polygon) >= POLYGON_MIN_POINTS:
            points = np.asarray(polygon, dtype=np.int32)
            cv2.fillPoly(ground, [points], 0)
    return SceneMasks(
        alpha,
        roofs,
        ground,
        tuple(sorted(missing)),
        (
            "Roof masks use warm upper-sprite hypotheses; grey/snow/ambiguous roofs abstain.",
            "Unknown asset semantics remain eligible; callers must mask UI and field rows.",
            "Axis-aligned cropped sprites supported; rotated/sheared draws require abstention.",
        ),
    )
