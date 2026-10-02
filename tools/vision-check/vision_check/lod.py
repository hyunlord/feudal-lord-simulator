"""Supplemental far-zoom flat-facade warning, separate from the six core detectors."""

from __future__ import annotations

from typing import ClassVar

import cv2
import numpy as np
from pydantic import BaseModel, ConfigDict, Field

from .models import Box

Pixels = np.ndarray[tuple[int, ...], np.dtype[np.uint8]]
Integers = np.ndarray[tuple[int, ...], np.dtype[np.int32]]
WHITE_MIN = (175, 165, 135)
WHITE_CHROMA = 55
BROWN_MIN = (55, 40, 20)
BROWN_MAX = (170, 140, 105)
MAX_ZOOM = 0.8
MIN_AREA = 35
MAX_AREA = 2200
MIN_HEIGHT = 8
MIN_WIDTH = 4
MAX_ASPECT = 4.0
MIN_ASPECT = 0.15
MAX_TEXTURE = 6.0
MIN_SOLIDITY = 0.82
MIN_REPEATS = 3
MIN_ROOF_PIXELS = 12
MAX_VERTICES = 6


class LodFinding(BaseModel):
    """A white polygon candidate; human review must confirm a missing hand-drawn LOD."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    box: Box
    score: float = Field(ge=0, le=1)
    reason: str
    texture_std: float
    companion_count: int


def flat_facades(  # noqa: C901 -- sequential conservative image rejection gates.
    image: np.ndarray[tuple[int, ...], np.dtype[np.uint8]],
    zoom: float,
    *,
    exclude_boxes: tuple[Box, ...] = (),
) -> list[LodFinding]:
    """Find repeated warm-white low-texture polygons with adjacent brown roofs.

    RGB screenshot only. Far zoom is required; this is not a six-detector positive.
    Snow, canvas UI, or legitimately plain plaster can still cause false positives.
    """
    if zoom > MAX_ZOOM:
        return []
    rgb = image.astype(np.int16)
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    white = (
        (red >= WHITE_MIN[0])
        & (green >= WHITE_MIN[1])
        & (blue >= WHITE_MIN[2])
        & (red - blue >= 0)
        & (red - blue <= WHITE_CHROMA)
        & (np.max(rgb, axis=2) - np.min(rgb, axis=2) <= WHITE_CHROMA)
    ).astype(np.uint8)
    brown = (
        (red >= BROWN_MIN[0])
        & (red <= BROWN_MAX[0])
        & (green >= BROWN_MIN[1])
        & (green <= BROWN_MAX[1])
        & (blue >= BROWN_MIN[2])
        & (blue <= BROWN_MAX[2])
        & (red > green)
        & (green > blue)
    )
    gray: Pixels = np.asarray(cv2.cvtColor(image, cv2.COLOR_RGB2GRAY), dtype=np.uint8)
    for box in exclude_boxes:
        white[max(0, box.y) : box.y + box.height, max(0, box.x) : box.x + box.width] = 0
    count, labels, stats, _centroids = cv2.connectedComponentsWithStats(white)
    labels_values: Integers = np.asarray(labels, dtype=np.int32)
    stats_values: Integers = np.asarray(stats, dtype=np.int32)
    candidates: list[tuple[Box, float]] = []
    for index in range(1, count):
        row = stats_values[index : index + 1].reshape(-1)
        x, y, width, height, area = (int(row.flat[i]) for i in range(5))
        if not (
            MIN_AREA <= area <= MAX_AREA
            and width >= MIN_WIDTH
            and height >= MIN_HEIGHT
            and MIN_ASPECT <= width / height <= MAX_ASPECT
        ):
            continue
        component: Pixels = np.asarray(
            np.equal(labels_values[y : y + height, x : x + width], index), dtype=np.uint8
        )
        contours, _hierarchy = cv2.findContours(
            component, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if not contours:
            continue
        contour = max(contours, key=cv2.contourArea)
        hull_area = cv2.contourArea(cv2.convexHull(contour))
        if not hull_area or cv2.contourArea(contour) / hull_area < MIN_SOLIDITY:
            continue
        vertices = cv2.approxPolyDP(
            contour, 0.035 * cv2.arcLength(contour, closed=True), closed=True
        )
        if len(vertices) > MAX_VERTICES:
            continue
        interior = cv2.erode(component, np.ones((3, 3), dtype=np.uint8)).astype(bool)
        if not np.any(interior):
            continue
        texture = float(np.std(gray[y : y + height, x : x + width][interior]).item())
        if texture > MAX_TEXTURE:
            continue
        roof = brown[
            max(0, y - max(6, height // 2)) : y + max(2, height // 5), max(0, x - 3) : x + width + 3
        ]
        if int(np.count_nonzero(roof)) < MIN_ROOF_PIXELS:
            continue
        candidates.append((Box(x=x, y=y, width=width, height=height), texture))
    if len(candidates) < MIN_REPEATS:
        return []
    return [
        LodFinding(
            box=box,
            score=min(0.95, 0.7 + (MAX_TEXTURE - texture) / 30),
            texture_std=texture,
            companion_count=len(candidates),
            reason="Far-zoom flat white facades with brown roofs; review LOD mismatch",
        )
        for box, texture in candidates
    ]
