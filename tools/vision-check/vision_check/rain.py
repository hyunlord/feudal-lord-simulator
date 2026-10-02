"""Temporal rain-streak hypotheses; stationary highlights and round flakes abstain.

No current game rain has been visually validated. Bright falling debris can still
mimic rain, so this mask is evidence for review, not a weather semantic guarantee.
The caller must exclude moving sprites and use frames from a stationary camera.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import TYPE_CHECKING

import cv2
import numpy as np

from .models import Box

if TYPE_CHECKING:
    from collections.abc import Sequence

Pixels = np.ndarray[tuple[int, ...], np.dtype[np.uint8]]
MIN_FRAMES = 20
MIN_LENGTH = 4
MIN_ASPECT = 3.0
MIN_BRIGHTNESS = 115
MIN_RESIDUAL = 22
MIN_MATCHES = 3
MIN_TRACKS = 3
MAX_CHANGED_FRACTION = 0.15
MAX_ANGLE_DEGREES = 30.0
MAX_SIZE_CHANGE = 0.35


@dataclass(frozen=True)
class RainEvidence:
    """First-frame screen-space mask and explicit abstention context."""

    mask: Pixels
    first_frame_candidates: int
    falling_tracks: int
    reason: str


@dataclass(frozen=True)
class _Streak:
    box: Box
    mask: Pixels
    angle: float


def _components(binary: Pixels) -> list[_Streak]:
    contours, _hierarchy = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    result: list[_Streak] = []
    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        if height < MIN_LENGTH or height / max(1, width) < MIN_ASPECT:
            continue
        # minAreaRect accepts short narrow contours where fitEllipse cannot.
        (_cx, _cy), (side_a, side_b), degrees = cv2.minAreaRect(contour)
        orientation = degrees if side_a >= side_b else degrees + 90
        angle = abs((orientation % 180) - 90)
        if angle > MAX_ANGLE_DEGREES:
            continue
        mask = binary[y : y + height, x : x + width].copy()
        result.append(_Streak(Box(x=x, y=y, width=width, height=height), mask, angle))
    return result


def _next(current: _Streak, candidates: Sequence[_Streak]) -> _Streak | None:
    box = current.box
    options: list[tuple[float, _Streak]] = []
    for candidate in candidates:
        target = candidate.box
        dx = target.x + target.width / 2 - box.x - box.width / 2
        dy = target.y + target.height / 2 - box.y - box.height / 2
        if (
            dy < 1
            or dy > max(32, box.height * 2)
            or abs(dx) > max(4, dy * 0.6)
            or abs(target.height / box.height - 1) > MAX_SIZE_CHANGE
            or abs(candidate.angle - current.angle) > MAX_ANGLE_DEGREES / 2
        ):
            continue
        options.append((math.hypot(dx, dy), candidate))
    return min(options, key=lambda value: value[0])[1] if options else None


def _falling_tracks(components: Sequence[Sequence[_Streak]]) -> list[_Streak]:
    supported: list[_Streak] = []
    claimed: set[tuple[int, int]] = set()
    for first in components[0]:
        current = first
        matches = 0
        for following in components[1 : MIN_MATCHES + 1]:
            candidate = _next(current, following)
            if candidate is None:
                break
            current = candidate
            matches += 1
        endpoint = (current.box.x, current.box.y)
        if matches >= MIN_MATCHES and endpoint not in claimed:
            supported.append(first)
            claimed.add(endpoint)
    return supported


def detect_rain(images: Sequence[Pixels], exclusion_mask: Pixels | None = None) -> RainEvidence:
    """Return first-frame streaks supported by multiple downward temporal matches.

    Requires >=20 RGB frames. Exclusion pixels >0 suppress ineligible regions.
    At least three independent first-frame streaks must each match three successive
    frames; the returned mask contains original first-frame component pixels only.
    The motion window assumes roughly 100 ms spacing and downward screen motion.
    """
    if not images:
        message = "Rain analysis requires at least one image for viewport dimensions"
        raise ValueError(message)
    height, width = images[0].shape[:2]
    empty: Pixels = np.zeros((height, width), dtype=np.uint8)
    if len(images) < MIN_FRAMES:
        return RainEvidence(empty, 0, 0, "fewer than 20 frames; no temporal rain inference")
    if any(image.shape != images[0].shape for image in images):
        message = "Rain frames must have identical dimensions"
        raise ValueError(message)
    if exclusion_mask is not None and exclusion_mask.shape != (height, width):
        message = "Rain exclusion mask dimensions must match the viewport"
        raise ValueError(message)
    grays: list[Pixels] = [
        np.asarray(cv2.cvtColor(image, cv2.COLOR_RGB2GRAY), dtype=np.uint8) for image in images
    ]
    middle = len(grays) // 2
    stack: Pixels = np.stack(grays, axis=0)
    stack.partition(middle, axis=0)
    background: Pixels = stack[middle : middle + 1].reshape(height, width)
    components: list[list[_Streak]] = []
    changed: list[float] = []
    for gray in grays:
        residual: Pixels = np.asarray(cv2.subtract(gray, background), dtype=np.uint8)
        binary: Pixels = np.asarray(cv2.inRange(residual, MIN_RESIDUAL, 255), dtype=np.uint8)
        binary[gray < MIN_BRIGHTNESS] = 0
        if exclusion_mask is not None:
            binary[exclusion_mask > 0] = 0
        changed.append(float(np.count_nonzero(binary)) / binary.size)
        components.append(_components(binary))
    if max(changed) > MAX_CHANGED_FRACTION:
        return RainEvidence(
            empty,
            len(components[0]),
            0,
            "broad temporal change; camera/weather transition is ambiguous",
        )
    supported = _falling_tracks(components)
    if len(supported) < MIN_TRACKS:
        return RainEvidence(
            empty,
            len(components[0]),
            len(supported),
            "insufficient independent falling streaks; abstained",
        )
    result = empty.copy()
    for streak in supported:
        box = streak.box
        result[box.y : box.y + box.height, box.x : box.x + box.width] = streak.mask
    return RainEvidence(
        result,
        len(components[0]),
        len(supported),
        "temporal bright falling streak hypotheses; weather semantics unverified",
    )


def rain_mask(images: Sequence[Pixels], exclusion_mask: Pixels | None = None) -> Pixels:
    """Return the screen-space mask accepted by objects.rain_scale."""
    return detect_rain(images, exclusion_mask).mask
