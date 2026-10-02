"""Opaque object and isolated rain dimensions against visible human references."""

import re
from collections.abc import Mapping, Sequence
from math import hypot

import cv2
import numpy as np
from numpy.typing import NDArray

from .models import Box, Draw, Finding, Metric, Scene
from .repetition import make_finding, resize_mask, sprite_patch, visible_sprite

Pixels = NDArray[np.uint8]
MASK_DIMENSIONS = 2
ALPHA_SOLID_THRESHOLD = 127
MIN_HUMAN_REFERENCES = 3
MIN_PATCH_STD = 4.0
MAX_RAIN_PERSON_RATIO = 1.2


def _height(draw: Draw, silhouettes: Mapping[str, Pixels]) -> float | None:
    mask = silhouettes.get(draw.asset)
    if mask is None or mask.ndim != MASK_DIMENSIONS:
        return None
    ys = np.flatnonzero(np.any(mask > ALPHA_SOLID_THRESHOLD, axis=1))
    return (
        float((np.max(ys) - np.min(ys) + 1) / np.size(mask, axis=0) * draw.box.height)
        if ys.size
        else None
    )


def _opaque_box(draw: Draw, silhouettes: Mapping[str, Pixels]) -> Box:
    alpha = silhouettes.get(draw.asset)
    if alpha is None:
        return draw.box
    mask = resize_mask(alpha, draw.box)
    ys, xs = np.nonzero(mask > ALPHA_SOLID_THRESHOLD)
    if not xs.size:
        return draw.box
    return Box(
        x=draw.box.x + int(xs.min()),
        y=draw.box.y + int(ys.min()),
        width=int(xs.max() - xs.min() + 1),
        height=int(ys.max() - ys.min() + 1),
    )


def detect_scale(image: Pixels, scene: Scene, silhouettes: Mapping[str, Pixels]) -> list[Finding]:
    """Compare isolated opaque object heights with a median human reference."""
    draws = [draw for draw in scene.frames[0].draws if visible_sprite(image, draw)]
    humans = [
        height
        for draw in draws
        if (
            draw.asset.startswith("person:")
            or any(
                kind in draw.asset
                for kind in (
                    "/villagers/",
                    "/people/",
                    "/walker/wk_",
                    "/workers/wk_",
                    "/walkers-v2/",
                )
            )
        )
        if (height := _height(draw, silhouettes)) is not None
    ]
    if len(humans) < MIN_HUMAN_REFERENCES:
        return []
    person_height = float(np.median(humans))
    findings: list[Finding] = []
    limits = {
        "barrel": (0.45, 0.65),
        "sack": (0.3, 0.5),
        "door-opening": (1.15, 1.4),
        "cart-wheel": (0.45, 0.7),
    }
    decomposed = {
        (draw.order, draw.asset.split(":", 1)[1].split("#", 1)[0])
        for draw in draws
        if "#component=" in draw.asset and ":" in draw.asset
    }
    for draw in draws:
        if (draw.order, draw.asset.split("#", 1)[0]) in decomposed:
            continue
        if (
            re.search(r"(?:_2|_3|stack|pile|cart|payload|cargo)", draw.asset.lower())
            and "cart-wheel" not in draw.asset
            and "#component=" not in draw.asset
        ):
            continue
        height = _height(draw, silhouettes)
        bounds = next(
            (bounds for kind, bounds in limits.items() if kind in draw.asset.lower()), None
        )
        if height is None or bounds is None:
            continue
        ratio = height / person_height
        if bounds[0] * 0.8 <= ratio <= bounds[1] * 1.2:
            continue
        findings.append(
            make_finding(
                scene,
                "scale_ratio",
                _opaque_box(draw, silhouettes),
                f"Alpha height outside bible range plus 20% tolerance: {draw.asset}",
                (
                    Metric(name="object_person_height", value=ratio),
                    Metric(name="person_height", value=person_height, unit="px"),
                    Metric(name="reference_min", value=bounds[0]),
                    Metric(name="reference_max", value=bounds[1]),
                ),
                len(findings),
            )
        )
    return findings


def rain_scale(
    image: Pixels, scene: Scene, rain_mask: Pixels, human_heights: Sequence[float]
) -> list[Finding]:
    """Measure isolated rain streaks with a supplied screen-space semantic mask.

    A rain-only mask is required: arbitrary bright edges cannot distinguish rain
    from fences or roof highlights. Human heights must exclude hats and shadows.
    Components touching screenshot edges or merging streaks are not measurable.
    """
    if len(human_heights) < MIN_HUMAN_REFERENCES or rain_mask.shape != image.shape[:2]:
        return []
    human_height = float(np.median(human_heights))
    if human_height <= 0:
        return []
    contours, _hierarchy = cv2.findContours(rain_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    findings: list[Finding] = []
    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        if (
            x <= 0
            or y <= 0
            or x + width >= np.size(image, axis=1)
            or y + height >= np.size(image, axis=0)
        ):
            continue
        box = Box(x=x, y=y, width=width, height=height)
        minimum, maximum = min(width, height), max(width, height)
        if maximum / minimum < MIN_HUMAN_REFERENCES:
            continue
        patch = sprite_patch(image, box)
        if float(np.std(patch.astype(np.float32))) < MIN_PATCH_STD:
            continue
        length = hypot(max(0, width - 1), max(0, height - 1))
        ratio = length / human_height
        if ratio <= MAX_RAIN_PERSON_RATIO:
            continue
        findings.append(
            make_finding(
                scene,
                "scale_ratio",
                box,
                "Isolated rain-mask streak exceeds person height plus 20% tolerance.",
                (
                    Metric(name="rain_person_length", value=ratio),
                    Metric(name="rain_length", value=length, unit="px"),
                ),
                len(findings),
            )
        )
    return findings
