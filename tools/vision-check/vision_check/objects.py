"""Conservative sprite diagnostics, validated against captured RGB pixels.

Canvas provenance identifies regions; it never by itself proves a visual defect.
Masks must describe the cropped sprite (not its atlas). Roof masks describe roof
pixels only. Missing masks cause abstention rather than fabricated precision.
"""

from collections import defaultdict
from collections.abc import Mapping, Sequence
from math import hypot
from typing import ClassVar

import numpy as np
from numpy.typing import NDArray
from pydantic import BaseModel, ConfigDict

from .geometry import iou
from .models import Draw, Finding, Metric, Scene, Thresholds
from .repetition import (
    detect_repetition as _repeats,
)
from .repetition import (
    make_finding as _finding,
)
from .repetition import (
    patch_similarity as _similar,
)
from .repetition import (
    resize_mask as _mask,
)
from .repetition import (
    sprite_patch as _patch,
)
from .repetition import (
    visible_sprite as _visible,
)
from .scale import detect_scale as _scale
from .scale import rain_scale

__all__ = ["StationaryMetrics", "detect_objects", "rain_scale", "stationary_metrics"]

Pixels = NDArray[np.uint8]
MIN_MOTION_FRAMES = 20
MIN_PATCH_SIMILARITY = 0.85
MIN_DIFFERENCE_FRAMES = 2
RGB_CHANGE_THRESHOLD = 18


class StationaryMetrics(BaseModel):
    """Measured stillness, distinct from an assertion that an NPC is broken."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    eligible: int = 0
    stationary: int = 0
    ratio: float | None = None
    tick_span: int = 0
    reason: str = ""


def _person(asset: str) -> bool:
    return asset.startswith("person:") or "/villagers/" in asset or "/people/" in asset


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
