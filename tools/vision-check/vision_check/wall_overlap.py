"""Moving coloured human pixels visibly composited over stone-wall silhouettes.

Simulation feet propose search areas only. Actual time-varying, coloured image
components must overlap a wall whose background pixels match the captured sprite.
Grey clothing, static figures and complex occlusion may require abstention.
"""

from __future__ import annotations

import hashlib
import math
from typing import TYPE_CHECKING

import cv2
import numpy as np

from .masks import Pixels, sprite_rgba
from .models import Box, Finding, Metric

if TYPE_CHECKING:
    from collections.abc import Sequence
    from pathlib import Path

    from .contracts import Capture

MIN_FRAMES = 3
MIN_WALL_ALPHA = 220
MAX_TEMPLATE_DISTANCE = 45
MIN_CHANGED_VALUE = 25
MIN_COLOUR_SATURATION = 120
MIN_WALL_PIXELS = 12
MIN_VISIBLE_WALL_FRACTION = 0.4


def _wall_mask(capture: Capture, public_root: Path, background: Pixels) -> Pixels:
    mask = np.zeros(background.shape[:2], np.uint8)
    height, width = mask.shape
    for draw in capture.frames[0].draws:
        if not ("stone_wall" in draw.asset or "/wall/stone_" in draw.asset):
            continue
        rgba = sprite_rgba(draw, public_root)
        if rgba is None:
            continue
        box = draw.box
        resized: Pixels = np.asarray(cv2.resize(rgba, (box.width, box.height)), dtype=np.uint8)
        left, top = max(0, box.x), max(0, box.y)
        right, bottom = min(width, box.x + box.width), min(height, box.y + box.height)
        if right <= left or bottom <= top:
            continue
        part = resized[top - box.y : bottom - box.y, left - box.x : right - box.x]
        actual = background[top:bottom, left:right]
        distance = np.mean(
            np.abs(part[:, :, :3].astype(np.int16) - actual.astype(np.int16)), axis=2
        )
        visible = (part[:, :, 3] > MIN_WALL_ALPHA) & (distance < MAX_TEMPLATE_DISTANCE)
        mask[top:bottom, left:right][visible] = 255
    return mask


def _visible_components(
    image: Pixels, background: Pixels, wall: Pixels, human_height: float
) -> list[tuple[Box, int, int]]:
    result: list[tuple[Box, int, int]] = []
    hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)
    difference = np.max(np.abs(image.astype(np.int16) - background.astype(np.int16)), axis=2)
    changed = (difference > MIN_CHANGED_VALUE) & (hsv[:, :, 1] > MIN_COLOUR_SATURATION)
    changed = np.asarray(changed, dtype=np.uint8) * 255
    changed = np.asarray(
        cv2.morphologyEx(changed, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)), dtype=np.uint8
    )
    contours, _ = cv2.findContours(changed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        if x <= 0 or y <= 0 or x + width >= image.shape[1] or y + height >= image.shape[0]:
            continue
        if not (
            human_height * 0.35 <= height <= human_height * 1.6
            and max(3, human_height * 0.12) <= width <= human_height * 0.9
            and height > width
        ):
            continue
        region = changed[y : y + height, x : x + width] > 0
        count = int(np.count_nonzero(region))
        overlap = int(np.count_nonzero(region & (wall[y : y + height, x : x + width] > 0)))
        if overlap < MIN_WALL_PIXELS or overlap / max(1, count) < MIN_VISIBLE_WALL_FRACTION:
            continue
        bottom = region[-3:]
        bottom_wall = wall[y + height - 3 : y + height, x : x + width] > 0
        if (
            int(np.count_nonzero(bottom & bottom_wall)) / max(1, int(np.count_nonzero(bottom)))
            < MIN_VISIBLE_WALL_FRACTION
        ):
            continue
        result.append((Box(x=x, y=y, width=width, height=height), count, overlap))
    return result


def detect_wall_overlap(
    images: Sequence[Pixels], capture: Capture, public_root: Path
) -> list[Finding]:
    """Measure moving humans on visible stone walls; report actual event frame."""
    if len(images) < MIN_FRAMES or len(images) != len(capture.frames):
        return []
    background: Pixels = np.asarray(np.mean(np.stack(images), axis=0), dtype=np.uint8)
    wall = _wall_mask(capture, public_root, background)
    if np.count_nonzero(wall) < MIN_WALL_PIXELS:
        return []
    selected: dict[str, Finding] = {}
    human_height = max(14, 17.6 * capture.zoom)
    for index, (image, frame) in enumerate(zip(images, capture.frames, strict=True)):
        for box, count, overlap in _visible_components(image, background, wall, human_height):
            x, y, width, height = box.x, box.y, box.width, box.height
            walkers = [p for p in frame.people if p.pathRemaining > 0 and not p.cancelled]
            if not walkers:
                continue
            nearest = min(
                walkers,
                key=lambda p: math.hypot(p.foot.x - (x + width / 2), p.foot.y - (y + height)),
            )
            distance = math.hypot(nearest.foot.x - (x + width / 2), nearest.foot.y - (y + height))
            if distance > human_height * 1.3:
                continue
            key = f"{capture.id}:wall-overlap:{nearest.id}"
            finding = Finding(
                id=hashlib.sha256(key.encode()).hexdigest()[:12],
                scene=capture.id,
                detector="roof_overlap",
                box=Box(x=x, y=y, width=width, height=height),
                score=min(0.99, 0.6 + overlap / max(1, count) * 0.3),
                reason="이동 인물 위치 근처의 실제 변화하는 유색 실루엣이 돌담 그림 위에 겹침",
                metrics=(
                    Metric(name="measurement_frame", value=index, unit="frame"),
                    Metric(name="wall_changed_pixels", value=overlap, unit="px"),
                    Metric(name="wall_overlap_fraction", value=overlap / max(1, count)),
                    Metric(name="person_foot_distance", value=distance, unit="px"),
                ),
            )
            old = selected.get(nearest.id)
            old_pixels = (
                0
                if old is None
                else next(m.value for m in old.metrics if m.name == "wall_changed_pixels")
            )
            if overlap > old_pixels:
                selected[nearest.id] = finding
    return list(selected.values())
