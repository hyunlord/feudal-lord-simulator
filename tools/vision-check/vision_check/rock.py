"""Pixel segmentation of textured stone with multiple tile-aligned polygon cuts.

Unlike general colour-edge Hough detection, this follows the outer stone region;
internal rock texture cannot drown out the abrupt silhouette. Low saturation alone
is insufficient: texture, area, opposing slopes and a supplied ground mask gate it.
"""

from __future__ import annotations

import hashlib
import math

import cv2
import numpy as np

from .models import Box, Finding, Metric, Scene, Thresholds

Image = np.ndarray[tuple[int, ...], np.dtype[np.uint8]]
Contour = np.ndarray[tuple[int, ...], np.dtype[np.int32]]
MAX_SATURATION = 65
MAX_WARM_HUE = 30
MIN_VALUE = 60
MAX_VALUE = 215
MIN_TEXTURE = 8
MIN_MASK_COVERAGE = 0.9
MIN_EDGE_COUNT = 3
MIN_ALIGNED_PERIMETER = 0.10
MAX_ANGLE_ERROR = 6
MAX_ROUNDNESS = 0.75
ISO_ANGLE = math.degrees(math.atan(0.5))


def _segments(contour: Contour, pitch: float) -> list[tuple[float, float]]:
    polygon = np.asarray(cv2.approxPolyDP(contour, max(2, pitch / 16), closed=True), dtype=np.int32)
    polygon = polygon.reshape(-1, 2)
    result: list[tuple[float, float]] = []
    for index in range(len(polygon)):
        end = (index + 1) % len(polygon)
        dx = int(polygon.flat[end * 2]) - int(polygon.flat[index * 2])
        dy = int(polygon.flat[end * 2 + 1]) - int(polygon.flat[index * 2 + 1])
        length = math.hypot(dx, dy)
        angle = (math.degrees(math.atan2(dy, dx)) + 90) % 180 - 90
        if length >= max(12, pitch * 0.3) and abs(abs(angle) - ISO_ANGLE) <= MAX_ANGLE_ERROR:
            result.append((length, angle))
    return result


def detect_rock_cuts(
    image: Image, scene: Scene, thresholds: Thresholds, ground_mask: Image | None = None
) -> list[Finding]:
    """Return stone-region candidates with at least three opposing isometric cuts.

    Ground masks exclude roofs, UI and world exterior. No asset identity, terrain
    name, scene ID, pixel coordinate or reference image is used by this detector.
    One connected rock region is one finding, rather than inflating edge counts.
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)
    gray: Image = np.asarray(cv2.cvtColor(image, cv2.COLOR_RGB2GRAY), dtype=np.uint8)
    selected = (hsv[:, :, 1] < MAX_SATURATION) & (hsv[:, :, 0] < MAX_WARM_HUE)
    selected &= (hsv[:, :, 2] > MIN_VALUE) & (hsv[:, :, 2] < MAX_VALUE)
    segmentation = np.asarray(selected, dtype=np.uint8) * 255
    pitch = scene.tile_width * scene.zoom
    kernel = max(3, round(pitch / 13)) | 1
    segmentation = np.asarray(
        cv2.morphologyEx(segmentation, cv2.MORPH_CLOSE, np.ones((kernel, kernel), np.uint8)),
        dtype=np.uint8,
    )
    contours, _ = cv2.findContours(segmentation, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    findings: list[Finding] = []
    for raw in contours:
        contour = np.asarray(raw, dtype=np.int32)
        area = cv2.contourArea(contour)
        perimeter = cv2.arcLength(contour, closed=True)
        roundness = 4 * math.pi * area / max(1, perimeter * perimeter)
        if area < pitch * pitch * 0.25 or roundness > MAX_ROUNDNESS:
            continue
        region = np.zeros(image.shape[:2], dtype=np.uint8)
        cv2.drawContours(region, [contour], -1, 255, cv2.FILLED)
        inside = region > 0
        coverage = 1.0 if ground_mask is None else float(np.mean(ground_mask[inside] > 0))
        texture = float(np.std(gray[inside]))
        if coverage < MIN_MASK_COVERAGE or texture < MIN_TEXTURE:
            continue
        segments = _segments(contour, pitch)
        aligned = sum(length for length, _ in segments) / max(
            1, cv2.arcLength(contour, closed=True)
        )
        if aligned < MIN_ALIGNED_PERIMETER:
            continue
        if len(segments) < MIN_EDGE_COUNT or not (
            any(angle < 0 for _, angle in segments) and any(angle > 0 for _, angle in segments)
        ):
            continue
        x, y, width, height = cv2.boundingRect(contour)
        key = f"{scene.id}:rock-cut:{x}:{y}:{width}:{height}"
        findings.append(
            Finding(
                id=hashlib.sha256(key.encode()).hexdigest()[:12],
                scene=scene.id,
                detector="straight_boundary",
                box=Box(x=x, y=y, width=width, height=height),
                score=min(0.98, 0.65 + len(segments) * 0.025),
                reason="회색 바위 영역의 외곽이 서로 반대인 등각 칸 방향으로 세 번 이상 잘림",
                metrics=(
                    Metric(name="aligned_perimeter", value=aligned),
                    Metric(name="rock_cut_edges", value=len(segments), unit="count"),
                    Metric(name="rock_texture_std", value=texture, unit="gray"),
                    Metric(name="rock_area", value=area, unit="px2"),
                    Metric(name="eligible_fraction", value=coverage),
                ),
            )
        )
    return sorted(findings, key=lambda item: (-item.score, item.id))[: thresholds.max_per_detector]


DARK_STAMP_VALUE = 70
MIN_STAMP_PAIRS = 3
MIN_STAMP_SUPPORT = 0.3


def detect_rock_seams(
    image: Image, scene: Scene, thresholds: Thresholds, ground_mask: Image | None = None
) -> list[Finding]:
    """Detect dark small stamps repeating at tile vectors beside cut stone.

    This is a tile-border stamp subdetector, not a relabelled contour alert: at
    least three independent pixel component pairs must repeat at (W/2, W/4).
    A cut with no such repeated dark pixel components yields no seam candidate.
    """
    gray: Image = np.asarray(cv2.cvtColor(image, cv2.COLOR_RGB2GRAY), dtype=np.uint8)
    binary = np.asarray(gray < DARK_STAMP_VALUE, dtype=np.uint8) * 255
    kernel = max(1, round(scene.zoom * 2)) | 1
    binary = np.asarray(
        cv2.morphologyEx(binary, cv2.MORPH_CLOSE, np.ones((kernel, kernel), dtype=np.uint8)),
        dtype=np.uint8,
    )
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)
    selected = (hsv[:, :, 1] < MAX_SATURATION) & (hsv[:, :, 0] < MAX_WARM_HUE)
    selected &= (hsv[:, :, 2] > MIN_VALUE) & (hsv[:, :, 2] < MAX_VALUE)
    stone = np.asarray(selected, dtype=np.uint8) * 255
    stone_kernel = max(3, round(scene.tile_width * scene.zoom / 13)) | 1
    stone = cv2.morphologyEx(
        stone, cv2.MORPH_CLOSE, np.ones((stone_kernel, stone_kernel), np.uint8)
    )
    band_kernel = max(3, round(scene.zoom * 6)) | 1
    band: Image = np.asarray(
        cv2.morphologyEx(stone, cv2.MORPH_GRADIENT, np.ones((band_kernel, band_kernel), np.uint8)),
        dtype=np.uint8,
    )
    points: list[tuple[float, float]] = []
    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        area = cv2.contourArea(contour)
        if (
            max(1, scene.zoom) <= width <= scene.zoom * 10
            and max(1, scene.zoom) <= height <= scene.zoom * 8
            and scene.zoom**2 * 0.2 < area < scene.zoom**2 * 50
            and band[int(y + height / 2), int(x + width / 2)] > 0
        ):
            points.append((x + width / 2, y + height / 2))
    findings: list[Finding] = []
    for rock in detect_rock_cuts(image, scene, thresholds, ground_mask):
        box = rock.box
        local = [
            (x, y)
            for x, y in points
            if box.x - 8 <= x <= box.x + box.width + 8 and box.y - 8 <= y <= box.y + box.height + 8
        ]
        if len(local) < MIN_STAMP_PAIRS:
            continue
        centers = np.asarray(local, dtype=np.float64)
        delta = np.abs(centers[:, None, :] - centers[None, :, :])
        pitch = scene.tile_width * scene.zoom
        tolerance = max(2, scene.zoom * 3)
        matches = (np.abs(delta[:, :, 0] - pitch / 2) < tolerance) & (
            np.abs(delta[:, :, 1] - pitch / 4) < tolerance
        )
        pairs = int(np.count_nonzero(matches)) // 2
        support = float(np.mean(np.any(matches, axis=0)))
        if pairs < MIN_STAMP_PAIRS or support < MIN_STAMP_SUPPORT:
            continue
        findings.append(
            Finding(
                id=hashlib.sha256(f"{rock.id}:stamp-seam".encode()).hexdigest()[:12],
                scene=scene.id,
                detector="tile_seam",
                box=box,
                score=min(0.98, 0.6 + support * 0.35),
                reason="잘린 바위 외곽의 작은 검은 도형이 등각 칸 간격으로 반복됨",
                metrics=(
                    Metric(name="stamp_pairs", value=pairs, unit="count"),
                    Metric(name="stamp_support", value=support),
                    Metric(name="stamp_period_x", value=pitch / 2, unit="px"),
                    Metric(name="stamp_period_y", value=pitch / 4, unit="px"),
                ),
            )
        )
    return findings
