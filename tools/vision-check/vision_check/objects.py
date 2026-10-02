"""Conservative sprite diagnostics, validated against captured RGB pixels.

Canvas provenance identifies regions; it never by itself proves a visual defect.
Masks must describe the cropped sprite (not its atlas). Roof masks describe roof
pixels only. Missing masks cause abstention rather than fabricated precision.
"""

import re
from collections import defaultdict
from collections.abc import Mapping, Sequence
from math import hypot
from typing import ClassVar

import cv2
import numpy as np
from numpy.typing import NDArray
from pydantic import BaseModel, ConfigDict

from .geometry import clipped, iou, union_box
from .models import Box, Draw, Finding, Metric, Scene, Thresholds
from .visibility import visible_part

Pixels = NDArray[np.uint8]
MIN_ALPHA = 0.5
MIN_PATCH_VALUES = 12
MIN_PATCH_STD = 4.0
MIN_MOTION_FRAMES = 20
MIN_PATCH_SIMILARITY = 0.85
MIN_DIFFERENCE_FRAMES = 2
RGB_CHANGE_THRESHOLD = 18
MASK_DIMENSIONS = 2
ALPHA_SOLID_THRESHOLD = 127
REPEAT_OPAQUE_ALPHA = 200
MIN_HUMAN_REFERENCES = 3
DUPLICATE_DRAW_IOU = 0.7
REPEAT_SIZE_TOLERANCE = 0.2
MAX_RAIN_PERSON_RATIO = 1.2


class StationaryMetrics(BaseModel):
    """Measured stillness, distinct from an assertion that an NPC is broken."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    eligible: int = 0
    stationary: int = 0
    ratio: float | None = None
    tick_span: int = 0
    reason: str = ""


def _patch(image: Pixels, box: Box) -> Pixels:
    return image[box.y : box.y + box.height, box.x : box.x + box.width]


def _visible(image: Pixels, draw: Draw) -> bool:
    height, width = np.size(image, axis=0), np.size(image, axis=1)
    bounded = clipped(draw.box, width, height)
    if bounded != draw.box or draw.alpha < MIN_ALPHA:
        return False
    patch = _patch(image, draw.box).astype(np.float32)
    return (
        patch.size > MIN_PATCH_VALUES and float(np.std(patch, axis=(0, 1)).mean()) >= MIN_PATCH_STD
    )


def _person(asset: str) -> bool:
    return asset.startswith("person:") or "/villagers/" in asset or "/people/" in asset


def _scale_person(asset: str) -> bool:
    return _person(asset) or any(kind in asset for kind in ("/walker/wk_", "/workers/wk_"))


def _similar(first: Pixels, second: Pixels) -> float:
    left = cv2.resize(first, (24, 24)).astype(np.float32)
    right = cv2.resize(second, (24, 24)).astype(np.float32)
    return max(0.0, 1.0 - float(np.mean(np.abs(left - right))) / 64.0)


def _tracks(scene: Scene, images: Sequence[Pixels]) -> dict[str, list[Draw]]:
    if len(images) != len(scene.frames) or not images:
        return {}
    tracks: dict[str, list[Draw]] = defaultdict(list)
    for frame, image in zip(scene.frames, images, strict=True):
        grouped: dict[str, list[Draw]] = defaultdict(list)
        for draw in frame.draws:
            if draw.asset.startswith("person:") and _visible(image, draw):
                grouped[draw.asset].append(draw)
        for asset, draws in grouped.items():
            if len(draws) == 1:
                tracks[asset].append(draws[0])
    return {asset: draws for asset, draws in tracks.items() if len(draws) == len(images)}


def _still(draws: Sequence[Draw], distance: float) -> bool:
    x = [draw.box.x + draw.box.width / 2 for draw in draws]
    y = [draw.box.y + draw.box.height for draw in draws]
    return hypot(max(x) - min(x), max(y) - min(y)) <= distance


def stationary_metrics(
    images: Sequence[Pixels], scene: Scene, thresholds: Thresholds
) -> StationaryMetrics:
    """Report the observed still-person fraction only with enough game progress."""
    span = scene.frames[-1].tick - scene.frames[0].tick if scene.frames else 0
    if (
        not scene.valid_motion
        or len(images) < MIN_MOTION_FRAMES
        or span < thresholds.still_min_tick_span
    ):
        return StationaryMetrics(tick_span=span, reason="insufficient advancing 20-frame capture")
    tracks = _tracks(scene, images)
    still = sum(_still(draws, thresholds.still_distance_px) for draws in tracks.values())
    return StationaryMetrics(
        eligible=len(tracks),
        stationary=still,
        ratio=still / len(tracks) if tracks else None,
        tick_span=span,
        reason="observed stillness; idle is not a defect",
    )


def _finding(  # noqa: PLR0913, PLR0917 -- diagnostic record fields.
    scene: Scene, detector: str, box: Box, reason: str, metrics: tuple[Metric, ...], number: int
) -> Finding:
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


def _stationary(
    images: Sequence[Pixels], scene: Scene, thresholds: Thresholds, expected_walking: frozenset[str]
) -> list[Finding]:
    measurements = stationary_metrics(images, scene, thresholds)
    if measurements.ratio is None:
        return []
    findings: list[Finding] = []
    for asset, draws in _tracks(scene, images).items():
        if asset not in expected_walking or not _still(draws, thresholds.still_distance_px):
            continue
        similarity = _similar(_patch(images[0], draws[0].box), _patch(images[-1], draws[-1].box))
        if similarity < MIN_PATCH_SIMILARITY:
            continue
        findings.append(
            _finding(
                scene,
                "stationary_person",
                draws[0].box,
                "Expected walking, unchanged feet and RGB patch; review route/queue.",
                (
                    Metric(name="patch_similarity", value=similarity),
                    Metric(name="observed_still_ratio", value=measurements.ratio),
                    Metric(name="tick_span", value=measurements.tick_span, unit="ticks"),
                ),
                len(findings),
            )
        )
    return findings


def _mask(mask: Pixels, box: Box) -> Pixels:
    return np.asarray(
        cv2.resize(mask, (box.width, box.height), interpolation=cv2.INTER_NEAREST), dtype=np.uint8
    )


def _roof(
    images: Sequence[Pixels], scene: Scene, thresholds: Thresholds, roof_masks: Mapping[str, Pixels]
) -> list[Finding]:
    if len(images) < MIN_DIFFERENCE_FRAMES:
        return []
    findings: list[Finding] = []
    difference = (
        np.max(np.abs(images[-1].astype(np.int16) - images[0].astype(np.int16)), axis=2)
        > RGB_CHANGE_THRESHOLD
    )
    draws = scene.frames[-1].draws
    for person in (draw for draw in draws if _person(draw.asset) and _visible(images[-1], draw)):
        for building in (draw for draw in draws if draw.asset in roof_masks):
            if person.order <= building.order or iou(person.box, building.box) == 0:
                continue
            roof = _mask(roof_masks[building.asset], building.box) > 0
            foot_x = person.box.x + person.box.width // 2 - building.box.x
            foot_y = person.box.y + person.box.height - 2 - building.box.y
            if not (
                0 <= foot_x < building.box.width
                and 0 <= foot_y < building.box.height
                and roof[foot_y, foot_x]
            ):
                continue
            left, top = max(person.box.x, building.box.x), max(person.box.y, building.box.y)
            right = min(person.box.x + person.box.width, building.box.x + building.box.width)
            bottom = min(person.box.y + person.box.height, building.box.y + building.box.height)
            roof_part = roof[
                top - building.box.y : bottom - building.box.y,
                left - building.box.x : right - building.box.x,
            ]
            fraction = float(np.count_nonzero(difference[top:bottom, left:right] & roof_part)) / (
                person.box.width * person.box.height
            )
            if fraction < thresholds.overlap_fraction:
                continue
            findings.append(
                _finding(
                    scene,
                    "roof_overlap",
                    person.box,
                    "Later-drawn person feet inside supplied roof mask, with changed RGB pixels.",
                    (Metric(name="changed_roof_fraction", value=fraction),),
                    len(findings),
                )
            )
    return findings


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
    mask = _mask(alpha, draw.box)
    ys, xs = np.nonzero(mask > ALPHA_SOLID_THRESHOLD)
    if not xs.size:
        return draw.box
    return Box(
        x=draw.box.x + int(xs.min()),
        y=draw.box.y + int(ys.min()),
        width=int(xs.max() - xs.min() + 1),
        height=int(ys.max() - ys.min() + 1),
    )


def _scale(image: Pixels, scene: Scene, silhouettes: Mapping[str, Pixels]) -> list[Finding]:
    draws = [draw for draw in scene.frames[0].draws if _visible(image, draw)]
    humans = [
        height
        for draw in draws
        if _scale_person(draw.asset)
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
    for draw in draws:
        if (
            re.search(r"(?:_2|_3|stack|pile|cart|payload|cargo)", draw.asset.lower())
            and "cart-wheel" not in draw.asset
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
            _finding(
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


def _repeat_similarity(first: Pixels, second: Pixels, alpha: Pixels | None) -> float:
    if alpha is None:
        return _similar(first, second)
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


def _repeats(
    image: Pixels,
    scene: Scene,
    thresholds: Thresholds,
    silhouettes: Mapping[str, Pixels],
    rgba_templates: Mapping[str, Pixels],
) -> list[Finding]:
    grouped: dict[str, list[Draw]] = defaultdict(list)
    for draw in scene.frames[0].draws:
        if (
            not any(
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
            or not _visible(image, draw)
            or (
                draw.asset in rgba_templates
                and not visible_part(image, draw, rgba_templates[draw.asset], draw)
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
        if len(draws) < thresholds.repeat_min_count:
            continue
        used: set[int] = set()
        for anchor in draws:
            if anchor.order in used:
                continue
            matches = [
                draw
                for draw in draws
                if draw.order not in used
                and np.hypot(draw.box.x - anchor.box.x, draw.box.y - anchor.box.y) <= radius
                and abs(draw.box.height / anchor.box.height - 1) < REPEAT_SIZE_TOLERANCE
                and (
                    draw.asset in rgba_templates
                    or _repeat_similarity(
                        _patch(image, draw.box),
                        _patch(image, anchor.box),
                        silhouettes.get(draw.asset),
                    )
                    >= thresholds.repeat_similarity
                )
            ]
            if len(matches) < thresholds.repeat_min_count:
                continue
            box = union_box([draw.box for draw in matches])
            findings.append(
                _finding(
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


def detect_objects(  # noqa: PLR0913 -- independent optional evidence channels.
    images: Sequence[Pixels],
    scene: Scene,
    thresholds: Thresholds,
    *,
    silhouettes: Mapping[str, Pixels] | None = None,
    roof_masks: Mapping[str, Pixels] | None = None,
    expected_walking: frozenset[str] | None = None,
    rgba_templates: Mapping[str, Pixels] | None = None,
) -> list[Finding]:
    """Detect four candidate classes; absent semantic evidence safely abstains.

    Silhouettes and roof masks are sprite-local single-channel masks, with the
    same crop as Draw.source. Walking tags must denote expected continuous travel,
    excluding idling, working, queues and scheduled waits. Doors and wheels require
    explicit semantic assets; full carts/buildings are never used as substitutes.
    """
    if not images or not scene.frames or len(images) != len(scene.frames):
        return []
    findings = [
        *_stationary(images, scene, thresholds, expected_walking or frozenset()),
        *_roof(images, scene, thresholds, roof_masks or {}),
        *_scale(images[0], scene, silhouettes or {}),
        *_repeats(images[0], scene, thresholds, silhouettes or {}, rgba_templates or {}),
    ]
    counts: dict[str, int] = defaultdict(int)
    selected: list[Finding] = []
    for finding in findings:
        if counts[finding.detector] < thresholds.max_per_detector:
            selected.append(finding)
            counts[finding.detector] += 1
    return selected


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
        patch = _patch(image, box)
        if float(np.std(patch.astype(np.float32))) < MIN_PATCH_STD:
            continue
        length = hypot(max(0, width - 1), max(0, height - 1))
        ratio = length / human_height
        if ratio <= MAX_RAIN_PERSON_RATIO:
            continue
        findings.append(
            _finding(
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
