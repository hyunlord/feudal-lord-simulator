"""Project SHA-bound source polygons into visible, possibly mirrored sprite parts."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from functools import lru_cache
from typing import TYPE_CHECKING, Final
from urllib.parse import unquote, urlsplit

import cv2
import numpy as np

from .models import Box, Draw
from .visibility import visible_part

if TYPE_CHECKING:
    from pathlib import Path

    from .component_catalog import ComponentAsset, ComponentCatalog

Pixels = np.ndarray[tuple[int, ...], np.dtype[np.uint8]]
SOLID_ALPHA: Final = 200
MIN_PIXELS: Final = 12
CROP_FIELDS: Final = 4


@dataclass(frozen=True, slots=True)
class ComponentEvidence:
    """Actual frame pixels and independently annotated local source assets."""

    image: Pixels
    catalog: ComponentCatalog
    public_root: Path


@lru_cache(maxsize=128)
def _digest(path: Path, mtime_ns: int, size: int) -> str:
    """Cache only an unchanged local file revision."""
    del mtime_ns, size
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _asset(draw: Draw, evidence: ComponentEvidence) -> ComponentAsset | None:
    name = unquote(urlsplit(draw.asset).path)
    entry = next((item for item in evidence.catalog.assets if item.path == name), None)
    if entry is None:
        return None
    root = evidence.public_root.resolve()
    path = (root / name.lstrip("/")).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        return None
    stat = path.stat()
    return entry if _digest(path, stat.st_mtime_ns, stat.st_size) == entry.sha256 else None


def _source(draw: Draw, entry: ComponentAsset) -> tuple[int, int, int, int] | None:
    source = draw.source
    if not source and "#crop=" in draw.asset:
        try:
            source = tuple(float(value) for value in draw.asset.split("#crop=", 1)[1].split(","))
        except ValueError:
            return None
    if not source:
        return 0, 0, entry.width, entry.height
    if len(source) != CROP_FIELDS:
        return None
    left, top, width, height = source
    x, y = round(left), round(top)
    w, h = round(left + width) - x, round(top + height) - y
    if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > entry.width or y + h > entry.height:
        return None
    return x, y, w, h


def _score(image: Pixels, draw: Draw, rgba: Pixels) -> float:
    box = draw.box
    height, width = image.shape[:2]
    left, top = max(0, box.x), max(0, box.y)
    right, bottom = min(width, box.x + box.width), min(height, box.y + box.height)
    if right <= left or bottom <= top:
        return -1.0
    projected = np.asarray(cv2.resize(rgba, (box.width, box.height)), dtype=np.uint8)
    patch = projected[top - box.y : bottom - box.y, left - box.x : right - box.x]
    opaque = patch[:, :, 3] > SOLID_ALPHA
    if np.count_nonzero(opaque) < MIN_PIXELS:
        return -1.0
    distance = np.mean(
        np.abs(patch[:, :, :3].astype(np.float32) - image[top:bottom, left:right]), axis=2
    )
    return -float(np.mean(distance[opaque]))


def _project(draw: Draw, mask: Pixels, kind: str, component_id: str) -> tuple[Draw, Pixels] | None:
    ys, xs = np.nonzero(mask > SOLID_ALPHA)
    if not xs.size:
        return None
    left, top, right, bottom = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    height, width = mask.shape
    sx, sy = draw.box.width / width, draw.box.height / height
    x, y = draw.box.x + round(left * sx), draw.box.y + round(top * sy)
    box = Box(
        x=x,
        y=y,
        width=max(1, round(right * sx) - round(left * sx)),
        height=max(1, round(bottom * sy) - round(top * sy)),
    )
    part = Draw(
        asset=f"{kind}:{draw.asset}#component={component_id}",
        box=box,
        order=draw.order,
        alpha=draw.alpha,
    )
    return part, mask[top:bottom, left:right]


def component_draws(
    draw: Draw, rgba: Pixels, evidence: ComponentEvidence
) -> list[tuple[Draw, Pixels]]:
    """Return measurable components only after source revision and RGB visibility checks.

    ``rgba`` is the exact source crop. Old captures omit mirror metadata, so the
    whole-parent RGB error selects original or horizontal reflection before any
    part is tested. Fully source-cropped, occluded or tiny parts safely abstain.
    """
    entry = _asset(draw, evidence)
    if entry is None or (crop := _source(draw, entry)) is None:
        return []
    x, y, width, height = crop
    if rgba.shape[:2] != (height, width):
        return []
    reflected = np.ascontiguousarray(np.flip(rgba, axis=1))
    mirror = _score(evidence.image, draw, reflected) > _score(evidence.image, draw, rgba)
    oriented = reflected if mirror else rgba
    result: list[tuple[Draw, Pixels]] = []
    for component in entry.parts:
        points = np.asarray(component.polygon, dtype=np.int32)
        if (
            np.any(points[:, 0] < x)
            or np.any(points[:, 1] < y)
            or np.any(points[:, 0] >= x + width)
            or np.any(points[:, 1] >= y + height)
        ):
            continue
        mask = np.zeros((height, width), dtype=np.uint8)
        cv2.fillPoly(mask, [points - np.asarray((x, y), dtype=np.int32)], 255)
        mask[rgba[:, :, 3] <= SOLID_ALPHA] = 0
        if mirror:
            mask = np.ascontiguousarray(np.flip(mask, axis=1))
        orientation = "mirror-x" if mirror else "original"
        projected = _project(draw, mask, component.kind, f"{component.id}:{orientation}")
        if projected is None:
            continue
        part, cropped_mask = projected
        # Restrict alpha to this polygon so nearby visible pixels cannot certify
        # a barrel whose own pixels are hidden behind a foreground building.
        isolated = oriented.copy()
        isolated[:, :, 3] = mask
        if visible_part(evidence.image, draw, isolated, part):
            result.append((part, cropped_mask))
    return result
