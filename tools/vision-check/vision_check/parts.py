"""Conservative baked-in door/wheel hypotheses for subsequent scale checks.

These are pixel-derived semantic candidates, not proof of correct classification.
Doors require isolated dark facade components touching the ground threshold.
Closed wooden doors and disconnected/obscured openings deliberately abstain.
Wheels require a fitted outer elliptical rim
and brighter interior. Occluded, fragmented, snowy or ambiguous parts
abstain; no geometry is injected into the captured game frames.
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING, Literal

import cv2
import numpy as np

from .models import Box, Draw

if TYPE_CHECKING:
    from collections.abc import Sequence

Pixels = np.ndarray[tuple[int, ...], np.dtype[np.uint8]]
Integers = np.ndarray[tuple[int, ...], np.dtype[np.int32]]
BUILDINGS = (
    "house",
    "cottage",
    "church",
    "chapel",
    "manor",
    "tavern",
    "bakery",
    "granary",
    "warehouse",
    "storehouse",
    "smithy",
    "/buildings/",
)
DOOR_ASPECT_MIN = 1.4
DOOR_ASPECT_MAX = 2.8
DOOR_MIN_FILL = 0.65
DOOR_GROUND_FRACTION = 0.91
DOOR_MAX_FOOT_GAP = 0.045
DOOR_MAX_PARTS = 3
WHEEL_MAX_PARTS = 4
MAX_EXTERIOR_DARK = 0.35
MAX_RADIAL_ERROR = 0.18
MIN_CONTOUR_POINTS = 20
MIN_WHEEL_MINOR = 5
MAX_WHEEL_ASPECT = 2.8
MIN_ELLIPSE_FIT = 0.85
RIM_DARK_MAX = 100
RIM_MIN_SUPPORT = 0.75
RIM_MIN_CONTRAST = 12
ALPHA_MIN = 127
PART_MIN_DIMENSION = 3


def _part(
    draw: Draw,
    mask: Pixels,
    source: Box,
    kind: Literal["door-opening", "cart-wheel"],
    size: tuple[int, int],
) -> tuple[Draw, Pixels]:
    width, height = size
    sx, sy = draw.box.width / width, draw.box.height / height
    left = draw.box.x + round(source.x * sx)
    top = draw.box.y + round(source.y * sy)
    right = draw.box.x + round((source.x + source.width) * sx)
    bottom = draw.box.y + round((source.y + source.height) * sy)
    box = Box(x=left, y=top, width=max(1, right - left), height=max(1, bottom - top))
    key = f"{kind}:{draw.asset}#part={source.x},{source.y},{source.width},{source.height}"
    return Draw(asset=key, box=box, order=draw.order, alpha=draw.alpha), mask


def _doors(draw: Draw, rgba: Pixels) -> list[tuple[Draw, Pixels]]:
    height, width = rgba.shape[:2]
    gray: Pixels = np.asarray(cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2GRAY), dtype=np.uint8)
    alpha = rgba[:, :, 3]
    occupied_y, occupied_x = np.nonzero(alpha > ALPHA_MIN)
    if not occupied_y.size:
        return []
    top, bottom = int(occupied_y.min()), int(occupied_y.max())
    left, right = int(occupied_x.min()), int(occupied_x.max())
    opaque_height, opaque_width = bottom - top + 1, right - left + 1
    # Components are computed before the lower-facade filter: cutting at a scanline
    # would turn a long structural beam into a plausible isolated door rectangle.
    dark: Pixels = np.asarray(cv2.inRange(gray, 0, 72), dtype=np.uint8)
    dark[alpha <= ALPHA_MIN] = 0
    labels_count, labels, stats, _centres = cv2.connectedComponentsWithStats(dark)
    stats_values: Integers = np.asarray(stats, dtype=np.int32)
    labels_values: Integers = np.asarray(labels, dtype=np.int32)
    result: list[tuple[Draw, Pixels]] = []
    for component in range(1, labels_count):
        row = stats_values[component : component + 1].reshape(-1)
        x, y, w, h, area = (int(row.flat[index]) for index in range(5))
        if (
            w < max(PART_MIN_DIMENSION, opaque_width * 0.035)
            or w > opaque_width * 0.2
            or h < opaque_height * 0.12
            or h > opaque_height * 0.4
            or y < top + opaque_height * 0.48
            or y + h < top + opaque_height * DOOR_GROUND_FRACTION
            or not DOOR_ASPECT_MIN <= h / w <= DOOR_ASPECT_MAX
            or area / (w * h) < DOOR_MIN_FILL
        ):
            continue
        # Require a threshold close to the local ground silhouette as well as
        # the whole building foot. Shelving voids and storey windows fail this.
        local_rows = np.nonzero(alpha[:, x : x + w] > ALPHA_MIN)[0]
        foot_gap = int(local_rows.max()) + 1 - (y + h)
        if foot_gap > opaque_height * DOOR_MAX_FOOT_GAP:
            continue
        region = labels_values[y : y + h, x : x + w]
        mask: Pixels = np.asarray(
            cv2.compare(region, np.full_like(region, component), cv2.CMP_EQ), dtype=np.uint8
        )
        result.append(
            _part(draw, mask, Box(x=x, y=y, width=w, height=h), "door-opening", (width, height))
        )
        if len(result) >= DOOR_MAX_PARTS:
            break
    return result


def _ellipse_points(
    ellipse: tuple[float, float, float, float, float], scale: float = 1.0
) -> list[tuple[float, float]]:
    x, y, a, b, degrees = ellipse
    rotation = math.radians(degrees)
    points: list[tuple[float, float]] = []
    for index in range(32):
        u = math.cos(index * math.tau / 32) * a * scale / 2
        v = math.sin(index * math.tau / 32) * b * scale / 2
        points.append(
            (
                x + u * math.cos(rotation) - v * math.sin(rotation),
                y + u * math.sin(rotation) + v * math.cos(rotation),
            )
        )
    return points


def _rim_supported(
    gray: Pixels, alpha: Pixels, ellipse: tuple[float, float, float, float, float]
) -> bool:
    height, width = gray.shape
    samples = _ellipse_points(ellipse)
    if any(px < 1 or py < 1 or px >= width - 1 or py >= height - 1 for px, py in samples):
        return False
    rim: list[float] = []
    opaque = 0
    for px, py in samples:
        ix, iy = round(px), round(py)
        rim.append(float(gray[iy - 1 : iy + 2, ix - 1 : ix + 2].min()))
        opaque += int(alpha.flat[iy * width + ix] > ALPHA_MIN)
    interior = [
        float(gray.flat[round(py) * width + round(px)]) for px, py in _ellipse_points(ellipse, 0.5)
    ]
    # A small hub is not a wheel outline: reject dark support continuing outside it.
    exterior = [
        float(gray.flat[round(py) * width + round(px)])
        for px, py in _ellipse_points(ellipse, 1.35)
        if 0 <= round(px) < width and 0 <= round(py) < height
    ]
    return (
        opaque / len(samples) >= RIM_MIN_SUPPORT
        and sum(value < RIM_DARK_MAX for value in rim) / len(rim) >= RIM_MIN_SUPPORT
        and float(np.median(interior)) - float(np.median(rim)) >= RIM_MIN_CONTRAST
        and sum(value < RIM_DARK_MAX for value in exterior) / max(1, len(exterior))
        < MAX_EXTERIOR_DARK
    )


def _ellipse_fit(contour: Integers, ellipse: tuple[float, float, float, float, float]) -> float:
    x, y, a, b, degrees = ellipse
    angle = math.radians(degrees)
    values = contour.reshape(-1, 2)
    supported = 0
    for index in range(values.shape[0]):
        dx, dy = float(values.flat[index * 2]) - x, float(values.flat[index * 2 + 1]) - y
        u = dx * math.cos(angle) + dy * math.sin(angle)
        v = -dx * math.sin(angle) + dy * math.cos(angle)
        radial = math.hypot(u / (a / 2), v / (b / 2))
        supported += int(abs(radial - 1) < MAX_RADIAL_ERROR)
    return supported / values.shape[0]


def _wheels(draw: Draw, rgba: Pixels) -> list[tuple[Draw, Pixels]]:
    height, width = rgba.shape[:2]
    gray: Pixels = np.asarray(cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2GRAY), dtype=np.uint8)
    contours, _hierarchy = cv2.findContours(
        cv2.Canny(gray, 25, 65), cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE
    )
    candidates: list[tuple[float, float, float, float, float]] = []
    for contour in contours:
        if len(contour) < MIN_CONTOUR_POINTS:
            continue
        (x, y), (a, b), angle = cv2.fitEllipse(contour)
        major, minor = max(a, b), min(a, b)
        # The whole outside rim, not an internal hub, must occupy plausible sprite height.
        if (
            minor < MIN_WHEEL_MINOR
            or major / minor > MAX_WHEEL_ASPECT
            or major < height * 0.28
            or major > height * 0.7
            or y < height * 0.5
        ):
            continue
        ellipse = (x, y, a, b, angle)
        typed: Integers = np.asarray(contour, dtype=np.int32)
        if _ellipse_fit(typed, ellipse) < MIN_ELLIPSE_FIT or not _rim_supported(
            gray, rgba[:, :, 3], ellipse
        ):
            continue
        candidates.append(ellipse)
    result: list[tuple[Draw, Pixels]] = []
    selected: list[tuple[float, float, float, float, float]] = []
    for ellipse in sorted(candidates, key=lambda value: value[2] * value[3], reverse=True):
        x, y, a, b, _angle = ellipse
        if any(math.hypot(x - old[0], y - old[1]) < max(old[2], old[3]) / 2 for old in selected):
            continue
        points = _ellipse_points(ellipse)
        left, top = (
            math.floor(min(px for px, _py in points)),
            math.floor(min(py for _px, py in points)),
        )
        right = math.ceil(max(px for px, _py in points)) + 1
        bottom = math.ceil(max(py for _px, py in points)) + 1
        mask: Pixels = np.zeros((bottom - top, right - left), dtype=np.uint8)
        polygon = np.asarray(
            [(round(px) - left, round(py) - top) for px, py in points], dtype=np.int32
        )
        cv2.fillPoly(mask, [polygon], 255)
        mask[rgba[top:bottom, left:right, 3] <= ALPHA_MIN] = 0
        result.append(
            _part(
                draw,
                mask,
                Box(x=left, y=top, width=right - left, height=bottom - top),
                "cart-wheel",
                (width, height),
            )
        )
        selected.append(ellipse)
        if len(result) >= WHEEL_MAX_PARTS:
            break
    return result


def part_draws(draw: Draw, rgba: Pixels) -> list[tuple[Draw, Pixels]]:
    """Return semantic draw hypotheses and cropped alpha masks keyed by draw.asset.

    ``rgba`` must already be the exact source crop for ``draw``. Each returned mask
    is in that part's source-pixel dimensions; resize to its screen Box if needed.
    Original draw/frame objects remain immutable and are never changed.
    """
    name = draw.asset.lower()
    if "cart" in name:
        return _wheels(draw, rgba)
    if any(token in name for token in BUILDINGS):
        return _doors(draw, rgba)
    return []


def part_masks(parts: Sequence[tuple[Draw, Pixels]]) -> dict[str, Pixels]:
    """Adapt candidate parts to the exact asset-keyed detector mask interface."""
    return {draw.asset: mask for draw, mask in parts}
