"""Visible sprite repetition and shared pixel evidence primitives."""

from collections import defaultdict
from collections.abc import Mapping

import cv2
import numpy as np
from numpy.typing import NDArray

from .geometry import clipped, iou, union_box
from .inventory import inventory_category
from .models import Box, Draw, Finding, Metric, Scene, Thresholds
from .visibility import visible_part

Pixels = NDArray[np.uint8]
MIN_ALPHA = 0.5
MIN_PATCH_VALUES = 12
MIN_PATCH_STD = 4.0
REPEAT_OPAQUE_ALPHA = 200
DUPLICATE_DRAW_IOU = 0.7
REPEAT_SIZE_TOLERANCE = 0.2
BUILDING_PATHS = ("/buildings/", "/wave26/house/", "/wave30/house_pair/", "house_")


def sprite_patch(image: Pixels, box: Box) -> Pixels:
    """Slice a bounded screen-space sprite region."""
    return image[box.y : box.y + box.height, box.x : box.x + box.width]


def visible_sprite(image: Pixels, draw: Draw) -> bool:
    """Require an on-screen, nontransparent, textured region."""
    height, width = np.size(image, axis=0), np.size(image, axis=1)
    bounded = clipped(draw.box, width, height)
    if bounded != draw.box or draw.alpha < MIN_ALPHA:
        return False
    patch = sprite_patch(image, draw.box).astype(np.float32)
    return (
        patch.size > MIN_PATCH_VALUES and float(np.std(patch, axis=(0, 1)).mean()) >= MIN_PATCH_STD
    )


def patch_similarity(first: Pixels, second: Pixels) -> float:
    """Compare equally resized RGB patches."""
    left = cv2.resize(first, (24, 24)).astype(np.float32)
    right = cv2.resize(second, (24, 24)).astype(np.float32)
    return max(0.0, 1.0 - float(np.mean(np.abs(left - right))) / 64.0)


def make_finding(  # noqa: PLR0913, PLR0917 -- diagnostic record fields.
    scene: Scene, detector: str, box: Box, reason: str, metrics: tuple[Metric, ...], number: int
) -> Finding:
    """Create a typed candidate record with stable detector numbering."""
    return Finding.model_validate(
        {
            "id": f"{scene.id}:{detector}:{number}",
            "scene": scene.id,
            "detector": detector,
            "box": box,
            "score": 0.75,
            "reason": reason,
            "metrics": metrics,
        }
    )


def resize_mask(mask: Pixels, box: Box) -> Pixels:
    """Resize a sprite-local mask into its screen-space box."""
    return np.asarray(
        cv2.resize(mask, (box.width, box.height), interpolation=cv2.INTER_NEAREST), dtype=np.uint8
    )


def _repeat_similarity(first: Pixels, second: Pixels, alpha: Pixels | None) -> float:
    if alpha is None:
        return patch_similarity(first, second)
    mask = (
        np.asarray(cv2.resize(alpha, (24, 24), interpolation=cv2.INTER_NEAREST))
        > REPEAT_OPAQUE_ALPHA
    )
    if np.count_nonzero(mask) < MIN_PATCH_VALUES:
        return 0.0
    left = cv2.resize(first, (24, 24)).astype(np.float32)
    right = cv2.resize(second, (24, 24)).astype(np.float32)
    scores: list[float] = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            shifted = np.roll(right, (dy, dx), axis=(0, 1))
            interior = mask.copy()
            interior[:1] = False
            interior[-1:] = False
            interior[:, :1] = False
            interior[:, -1:] = False
            if np.count_nonzero(interior) < MIN_PATCH_VALUES:
                continue
            scores.append(1.0 - float(np.mean(np.abs(left[interior] - shifted[interior]))) / 64.0)
    return max(0.0, max(scores, default=0.0))


def detect_repetition(
    image: Pixels,
    scene: Scene,
    thresholds: Thresholds,
    silhouettes: Mapping[str, Pixels],
    rgba_templates: Mapping[str, Pixels],
) -> list[Finding]:
    """Find dense visible copies, excluding explicit normal inventory assets."""
    grouped: dict[str, list[Draw]] = defaultdict(list)
    for draw in scene.frames[0].draws:
        if (
            inventory_category(draw.asset) is not None
            or not any(
                kind in draw.asset
                for kind in (
                    "/props/",
                    "/pile/",
                    "/buildings/",
                    "/prop/",
                    "/wave26/house/",
                    "/wave30/house_pair/",
                    "house_",
                )
            )
            or any(kind in draw.asset.lower() for kind in ("roof", "facade", "overlay"))
            or not visible_sprite(image, draw)
            or (
                draw.asset in rgba_templates
                and not visible_part(image, draw, rgba_templates[draw.asset], draw)
                and not visible_part(
                    image,
                    draw,
                    np.ascontiguousarray(np.flip(rgba_templates[draw.asset], axis=1)),
                    draw,
                )
            )
        ):
            continue
        if not any(
            iou(draw.box, previous.box) > DUPLICATE_DRAW_IOU for previous in grouped[draw.asset]
        ):
            grouped[draw.asset].append(draw)
    findings: list[Finding] = []
    radius = scene.tile_width * scene.zoom * thresholds.repeat_radius_tiles
    for draws in grouped.values():
        minimum = (
            thresholds.repeat_building_min_count
            if any(token in draws[0].asset for token in BUILDING_PATHS)
            else thresholds.repeat_min_count
        )
        if len(draws) < minimum:
            continue
        used: set[int] = set()
        for anchor in draws:
            if anchor.order in used:
                continue
            matches = [
                draw
                for draw in draws
                if draw.order not in used
                and np.hypot(draw.box.x - anchor.box.x, 2 * (draw.box.y - anchor.box.y))
                <= radius
                and abs(draw.box.height / anchor.box.height - 1) < REPEAT_SIZE_TOLERANCE
                and (
                    draw.asset in rgba_templates
                    or _repeat_similarity(
                        sprite_patch(image, draw.box),
                        sprite_patch(image, anchor.box),
                        silhouettes.get(draw.asset),
                    )
                    >= thresholds.repeat_similarity
                )
            ]
            if len(matches) < minimum:
                continue
            box = union_box([draw.box for draw in matches])
            findings.append(
                make_finding(
                    scene,
                    "repeat_density",
                    box,
                    f"Dense visible copies; review intended repetition: {anchor.asset}",
                    (
                        Metric(name="matching_instances", value=len(matches), unit="count"),
                        Metric(name="radius", value=radius, unit="px"),
                    ),
                    len(findings),
                )
            )
            used.update(draw.order for draw in matches)
    return findings
