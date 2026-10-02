"""Two-dimensional tile-pitch texture repetition, complementing brightness bands."""

from __future__ import annotations

import hashlib
import math

import cv2
import numpy as np
from numpy.typing import NDArray

from .geometry import iou
from .models import Box, Finding, Metric, Scene, Thresholds

Pixels = NDArray[np.uint8]
MIN_VARIANCE_DENOMINATOR = 1e-6
MIN_ELIGIBLE_FRACTION = 0.94
MIN_DETAIL_STD = 3.0
NMS_OVERLAP = 0.25


def correlation(patch: NDArray[np.float32], dx: int, dy: int) -> float:
    """Measure normalized texture correlation for an exact spatial lag."""
    h, w = np.size(patch, axis=0), np.size(patch, axis=1)
    if abs(dx) >= w or abs(dy) >= h:
        return 0.0
    left = patch[max(0, dy) : min(h, h + dy), max(0, dx) : min(w, w + dx)].ravel()
    right = patch[max(0, -dy) : min(h, h - dy), max(0, -dx) : min(w, w - dx)].ravel()
    left = left - float(left.mean())
    right = right - float(right.mean())
    denom = math.sqrt(float(np.sum(left * left)) * float(np.sum(right * right)))
    return float(np.sum(left * right)) / denom if denom > MIN_VARIANCE_DENOMINATOR else 0.0


def texture_seams(
    image: Pixels, scene: Scene, thresholds: Thresholds, ground_mask: Pixels
) -> list[Finding]:
    """Require matching 1- and 2-tile texture lags inside eligible ground."""
    gray = np.asarray(cv2.cvtColor(image, cv2.COLOR_RGB2GRAY), dtype=np.float32)
    detail = np.asarray(gray - cv2.GaussianBlur(gray, (0, 0), 3), dtype=np.float32)
    pitch = scene.tile_width * scene.zoom
    size = max(96, round(pitch * 3.2))
    stride = max(32, size // 2)
    h, w = np.size(gray, axis=0), np.size(gray, axis=1)
    findings: list[Finding] = []
    for y in range(0, h - size + 1, stride):
        for x in range(0, w - size + 1, stride):
            if float(np.mean(ground_mask[y : y + size, x : x + size] > 0)) < MIN_ELIGIBLE_FRACTION:
                continue
            patch = detail[y : y + size, x : x + size]
            if float(np.std(patch)) < MIN_DETAIL_STD:
                continue
            best = 0.0
            shift = (0, 0)
            for sign in (-1, 1):
                for factor in (0.98, 1.0, 1.02):
                    dx, dy = round(pitch / 2 * sign * factor), round(pitch / 4 * factor)
                    value = min(correlation(patch, dx, dy), correlation(patch, dx * 2, dy * 2))
                    if value > best:
                        best, shift = value, (dx, dy)
            if best < max(0.60, thresholds.seam_correlation):
                continue
            box = Box(x=x, y=y, width=size, height=size)
            if any(iou(box, old.box) > NMS_OVERLAP for old in findings):
                continue
            identifier = hashlib.sha256(f"{scene.id}:texture:{x}:{y}".encode()).hexdigest()[:12]
            findings.append(
                Finding(
                    id=identifier,
                    scene=scene.id,
                    detector="tile_seam",
                    box=box,
                    score=best,
                    reason="Texture repeats at one and two tile offsets; review visible tiling.",
                    metrics=(
                        Metric(name="texture_correlation", value=best),
                        Metric(name="lag_x", value=shift[0], unit="px"),
                        Metric(name="lag_y", value=shift[1], unit="px"),
                    ),
                )
            )
    return sorted(findings, key=lambda f: -f.score)[: thresholds.max_per_detector]
