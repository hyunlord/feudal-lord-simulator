"""Visible decorative humans absent from simulation walker lists.

Ten seconds of observed stillness is a review candidate, never proof of a broken
route. Known work/petition callsites are excluded. Missing callsite provenance
cannot establish whether an otherwise stationary figure has a legitimate purpose.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from math import hypot
from typing import Final

import cv2
import numpy as np
from numpy.typing import NDArray

from .masks import sprite_key
from .models import Draw, Finding, Metric, Scene
from .visibility import visible_part

Pixels = NDArray[np.uint8]
MIN_FRAMES: Final = 20
MIN_SPAN_MS: Final = 10000
STILL_TILES: Final = 0.15
MIN_ALPHA: Final = 0.8
HUMAN_PATHS: Final = ("/walkers-v2/", "/walker/", "/people/", "/villagers/")
WORK_NAMES: Final = ("wk_builder", "wk_construction", "wk_hammer", "wk_sawyer")
EXCLUDED_SOURCES: Final = ("drawStoryProps", "drawConstruction", "drawBuilder", "drawWorkMoment")


@dataclass(frozen=True, slots=True)
class FigureEvidence:
    """Exact cropped RGBA, roof-only masks, optional frame/order render callsites."""

    rgba: Mapping[str, Pixels]
    roofs: Mapping[str, Pixels]
    sources: Mapping[tuple[int, int], str] = field(default_factory=dict[tuple[int, int], str])


def _human(draw: Draw) -> bool:
    name = draw.asset.lower()
    return any(token in name for token in HUMAN_PATHS) and not any(
        token in name for token in (*WORK_NAMES, "cart", "cargo", "shadow", "overlay")
    )


def _foot(draw: Draw) -> tuple[float, float]:
    return draw.box.x + draw.box.width / 2, draw.box.y + draw.box.height


def _distance(first: Draw, second: Draw) -> float:
    left, right = _foot(first), _foot(second)
    return hypot(left[0] - right[0], left[1] - right[1])


def _visible_frames(
    images: Sequence[Pixels], scene: Scene, evidence: FigureEvidence
) -> list[list[Draw]]:
    frames: list[list[Draw]] = []
    for image, frame in zip(images, scene.frames, strict=True):
        draws: list[Draw] = []
        for draw in frame.draws:
            source = evidence.sources.get((frame.index, draw.order), draw.callsite)
            rgba = evidence.rgba.get(sprite_key(draw))
            if (
                _human(draw)
                and draw.alpha >= MIN_ALPHA
                and not any(token in source for token in EXCLUDED_SOURCES)
                and rgba is not None
                and visible_part(image, draw, rgba, draw)
            ):
                draws.append(draw)
        frames.append(draws)
    return frames


def _stationary(frames: list[list[Draw]], scene: Scene) -> list[Finding]:
    elapsed = scene.frames[-1].elapsed_ms - scene.frames[0].elapsed_ms
    if (
        len(frames) < MIN_FRAMES
        or elapsed < MIN_SPAN_MS
        or scene.frames[-1].tick <= scene.frames[0].tick
        or not scene.valid_motion
    ):
        return []
    tolerance = STILL_TILES * scene.tile_width * scene.zoom
    tracks = [[draw] for draw in frames[0]]
    for draws in frames[1:]:
        edges = sorted(
            (_distance(track[0], draw), index, other)
            for index, track in enumerate(tracks)
            for other, draw in enumerate(draws)
            if track[0].asset.split("#", 1)[0] == draw.asset.split("#", 1)[0]
            and _distance(track[0], draw) <= tolerance
        )
        used_tracks: set[int] = set()
        used_draws: set[int] = set()
        survivors: list[list[Draw]] = []
        for _distance_px, index, other in edges:
            if index not in used_tracks and other not in used_draws:
                survivors.append([*tracks[index], draws[other]])
                used_tracks.add(index)
                used_draws.add(other)
        tracks = survivors
    return [
        Finding(
            id=f"{scene.id}:stationary_person:figure:{index}",
            scene=scene.id,
            detector="stationary_person",
            box=track[0].box,
            score=0.75,
            reason="Visible figure stays within 0.15 tile for 10s; review intended idle role.",
            metrics=(
                Metric(name="elapsed_ms", value=elapsed, unit="ms"),
                Metric(
                    name="maximum_displacement",
                    value=max(_distance(track[0], draw) for draw in track),
                    unit="px",
                ),
                Metric(name="stationary_tolerance", value=tolerance, unit="px"),
            ),
        )
        for index, track in enumerate(tracks)
    ]


def _roof_person(person: Draw, building: Draw, mask: Pixels) -> bool:
    if person.order <= building.order:
        return False
    foot_x = person.box.x + person.box.width // 2 - building.box.x
    foot_y = person.box.y + person.box.height - 2 - building.box.y
    if not (0 <= foot_x < building.box.width and 0 <= foot_y < building.box.height):
        return False
    roof = np.asarray(
        cv2.resize(
            mask, (building.box.width, building.box.height), interpolation=cv2.INTER_NEAREST
        ),
        dtype=np.uint8,
    )
    return int(np.count_nonzero(roof[foot_y : foot_y + 1, foot_x : foot_x + 1])) > 0


def detect_figures(
    images: Sequence[Pixels], scene: Scene, evidence: FigureEvidence
) -> list[Finding]:
    """Detect standing decorative figures and static roof overlap from visible RGB.

    Supply every crop used in all frames under sprite_key(draw). Roof masks are
    sprite-local single-channel regions. Missing templates cause abstention.
    First-frame boxes are emitted so standard first-frame annotation stays exact.
    """
    if not images or len(images) != len(scene.frames):
        return []
    frames = _visible_frames(images, scene, evidence)
    findings = _stationary(frames, scene)
    for person in frames[0]:
        for building in scene.frames[0].draws:
            roof = evidence.roofs.get(sprite_key(building))
            if roof is None or not _roof_person(person, building, roof):
                continue
            findings.append(
                Finding(
                    id=f"{scene.id}:roof_overlap:figure:{len(findings)}",
                    scene=scene.id,
                    detector="roof_overlap",
                    box=person.box,
                    score=0.8,
                    reason="RGB-visible human drawn after building, feet inside roof mask.",
                )
            )
            break
    return findings
