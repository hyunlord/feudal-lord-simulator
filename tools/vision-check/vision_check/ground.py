"""Conservative pixel candidates for isometric ground cuts and periodic seams.

Masks must identify *eligible ground*: roads, walls, field rows and UI are legitimate
straight/repeating structures and cannot be classified from an edge alone.
"""

from __future__ import annotations

import hashlib
import math

import cv2
import numpy as np

from .geometry import iou, line_contrast, union_box
from .models import Box, Finding, Metric, Scene, Thresholds

Image = np.ndarray[tuple[int, ...], np.dtype[np.uint8]]
FloatImage = np.ndarray[tuple[int, ...], np.dtype[np.float32]]
NMS_IOU = 0.3
AXIS_MERGE_CROSS_PX = 3
MIN_COVERAGE = 0.97
MIN_SEAM_COVERAGE = 0.99
MIN_SIGNAL_SAMPLES = 8
MIN_SIGNAL_STD = 0.5
ISO_ANGLE = math.degrees(math.atan(0.5))


def _mask(image: Image, ground_mask: Image | None) -> Image:
    if ground_mask is None:
        return np.full(image.shape[:2], 255, dtype=np.uint8)
    if ground_mask.shape != image.shape[:2]:
        message = "Ground mask dimensions must match RGB image"
        raise ValueError(message)
    return np.where(ground_mask > 0, 255, 0).astype(np.uint8)


def _candidate(  # noqa: PLR0913, PLR0917 - immutable finding fields
    scene: Scene, detector: str, box: Box, score: float, reason: str, metrics: tuple[Metric, ...]
) -> Finding:
    key = f"{scene.id}:{detector}:{box.x}:{box.y}:{box.width}:{box.height}"
    identifier = hashlib.sha256(key.encode()).hexdigest()[:12]
    return Finding.model_validate(
        {
            "id": identifier,
            "scene": scene.id,
            "detector": detector,
            "box": box,
            "score": min(1.0, max(0.0, score)),
            "reason": reason,
            "metrics": metrics,
        }
    )


def _deduplicate(findings: list[Finding], maximum: int) -> list[Finding]:
    selected: list[Finding] = []
    for candidate in sorted(findings, key=lambda item: (-item.score, item.id)):
        if all(iou(candidate.box, old.box) < NMS_IOU for old in selected):
            selected.append(candidate)
        if len(selected) >= maximum:
            break
    return selected


def _merge_axis_fragments(findings: list[Finding], eligible: Image, pitch: float) -> list[Finding]:
    """Join nearby collinear detections only across still-eligible ground pixels."""
    merged: list[Finding] = []
    for finding in findings:
        axis = next((m.value for m in finding.metrics if m.name == "screen_axis"), 0)
        if not axis:
            merged.append(finding)
            continue
        box = finding.box
        horizontal = box.width > box.height
        for index, previous in enumerate(merged):
            old = previous.box
            old_axis = next((m.value for m in previous.metrics if m.name == "screen_axis"), 0)
            if not old_axis or horizontal != (old.width > old.height):
                continue
            cross = (
                abs(box.y + box.height / 2 - old.y - old.height / 2)
                if horizontal
                else abs(box.x + box.width / 2 - old.x - old.width / 2)
            )
            gap = (
                max(box.x, old.x) - min(box.x + box.width, old.x + old.width)
                if horizontal
                else max(box.y, old.y) - min(box.y + box.height, old.y + old.height)
            )
            if cross > AXIS_MERGE_CROSS_PX or gap > pitch * 0.5:
                continue
            combined = union_box([box, old])
            if horizontal:
                xs = np.arange(combined.x + 6, combined.x + combined.width - 6)
                ys = np.full(xs.shape, round(combined.y + combined.height / 2), dtype=int)
            else:
                ys = np.arange(combined.y + 6, combined.y + combined.height - 6)
                xs = np.full(ys.shape, round(combined.x + combined.width / 2), dtype=int)
            if not xs.size or float(np.mean(eligible[ys, xs] > 0)) < MIN_COVERAGE:
                continue
            key = f"{finding.scene}:merged-axis:{combined.model_dump_json()}"
            metrics = (
                *(m for m in finding.metrics if m.name != "length_tiles"),
                Metric(
                    name="length_tiles", value=(max(combined.width, combined.height) - 12) / pitch
                ),
            )
            merged[index] = finding.model_copy(
                update={
                    "box": combined,
                    "id": hashlib.sha256(key.encode()).hexdigest()[:12],
                    "metrics": metrics,
                    "score": max(finding.score, previous.score),
                }
            )
            break
        else:
            merged.append(finding)
    return merged


def detect_straight_boundaries(
    image: Image, scene: Scene, thresholds: Thresholds, ground_mask: Image | None = None
) -> list[Finding]:
    """Find long isometric or screen-axis colour cuts inside eligible ground.

    ``tile_width`` is world-space tile width; screen pitch multiplies by zoom.
    Returned candidates require visual review, particularly beside roads/fields.
    """
    eligible: Image = np.asarray(
        cv2.erode(_mask(image, ground_mask), np.ones((9, 9), np.uint8)), dtype=np.uint8
    )
    blurred: Image = np.asarray(cv2.GaussianBlur(image, (5, 5), 1.2), dtype=np.uint8)
    channels = cv2.split(cv2.cvtColor(blurred, cv2.COLOR_RGB2LAB))
    edges: Image = np.zeros(image.shape[:2], dtype=np.uint8)
    for channel in channels:
        edges = np.asarray(cv2.bitwise_or(edges, cv2.Canny(channel, 18, 45)), dtype=np.uint8)
    edges = np.asarray(cv2.bitwise_and(edges, eligible), dtype=np.uint8)
    pitch = scene.tile_width * scene.zoom
    minimum = max(30.0, pitch * thresholds.boundary_length_tiles)
    axis_minimum = (
        minimum
        if thresholds.axis_boundary_length_tiles is None
        else max(30.0, pitch * thresholds.axis_boundary_length_tiles)
    )
    search_minimum = min(minimum, axis_minimum)
    lines = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 720,
        max(20, int(search_minimum * 0.5)),
        minLineLength=search_minimum,
        maxLineGap=max(3, pitch * 0.08),
    )
    if lines is None:
        return []
    findings: list[Finding] = []
    height, width = image.shape[:2]
    line_values: np.ndarray[tuple[int, ...], np.dtype[np.int32]] = np.asarray(lines, dtype=np.int32)
    line_values = line_values.reshape(-1, 4)
    for index in range(line_values.shape[0]):
        x1, y1 = int(line_values.flat[index * 4]), int(line_values.flat[index * 4 + 1])
        x2, y2 = int(line_values.flat[index * 4 + 2]), int(line_values.flat[index * 4 + 3])
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        angle = (angle + 90) % 180 - 90
        iso_error = abs(abs(angle) - ISO_ANGLE)
        axis_error = min(abs(angle), abs(abs(angle) - 90))
        error = min(iso_error, axis_error)
        orientation = "화면 수평·수직" if axis_error < iso_error else "등각 칸"
        length = math.hypot(x2 - x1, y2 - y1)
        required_length = axis_minimum if axis_error < iso_error else minimum
        if error > thresholds.boundary_angle_degrees or length < required_length:
            continue
        xs = np.rint(np.linspace(x1, x2, 100)).astype(int)
        ys = np.rint(np.linspace(y1, y2, 100)).astype(int)
        coverage = float(np.mean(eligible[ys, xs] > 0))
        contrast = min(
            line_contrast(blurred, (x1, y1, x2, y2)),
            line_contrast(blurred, (x1, y1, x2, y2), offset=12),
        )
        if coverage < MIN_COVERAGE or contrast < thresholds.boundary_contrast:
            continue
        left, top = max(0, min(x1, x2) - 6), max(0, min(y1, y2) - 6)
        box = Box(
            x=left,
            y=top,
            width=min(width, max(x1, x2) + 7) - left,
            height=min(height, max(y1, y2) + 7) - top,
        )
        findings.append(
            _candidate(
                scene,
                "straight_boundary",
                box,
                0.5 + min(0.25, length / required_length * 0.08) + min(0.25, contrast / 160),
                f"{orientation} 방향의 긴 직선 색 경계; 도로·밭두렁 여부를 검토해야 함",
                (
                    Metric(name="length_tiles", value=length / pitch),
                    Metric(name="contrast_rgb", value=contrast, unit="rgb_distance"),
                    Metric(name="angle_error", value=error, unit="degrees"),
                    Metric(name="angle", value=angle, unit="degrees"),
                    Metric(name="screen_axis", value=float(axis_error < iso_error)),
                    Metric(name="eligible_fraction", value=coverage),
                ),
            )
        )
    if thresholds.axis_boundary_length_tiles is not None:
        findings = _merge_axis_fragments(findings, eligible, pitch)
    return _deduplicate(findings, thresholds.max_per_detector)


def _profile(gray: FloatImage, angle: float) -> FloatImage:
    """Average along diagonal bands, keeping only well-supported centre bins."""
    height, width = gray.shape
    yy: FloatImage = np.repeat(np.arange(height, dtype=np.float32)[:, None], width, axis=1)
    xx: FloatImage = np.repeat(np.arange(width, dtype=np.float32)[None, :], height, axis=0)
    normal = -math.sin(angle) * xx + math.cos(angle) * yy
    bins: np.ndarray[tuple[int, ...], np.dtype[np.int64]] = (
        (normal - float(normal.min())).round().astype(np.int64)
    )
    counts = np.bincount(bins.ravel())
    sums = np.bincount(bins.ravel(), weights=gray.ravel())
    valid = counts > min(width, height) * 0.65
    values = sums[valid] / counts[valid]
    return values.astype(np.float32)


def _correlation(signal: FloatImage, lag: int) -> float:
    first, second = signal[:-lag], signal[lag:]
    if (
        first.size < MIN_SIGNAL_SAMPLES
        or float(np.std(first)) < MIN_SIGNAL_STD
        or float(np.std(second)) < MIN_SIGNAL_STD
    ):
        return 0.0
    first = first - float(first.mean())
    second = second - float(second.mean())
    return float(np.sum(first * second)) / math.sqrt(
        float(np.sum(first * first)) * float(np.sum(second * second))
    )


def detect_tile_seams(
    image: Image, scene: Scene, thresholds: Thresholds, ground_mask: Image | None = None
) -> list[Finding]:
    """Detect diagonal brightness bands repeating at the known tile pitch.

    Two independent lags and minimum cycle support reject isolated cuts and slow
    gradients. This cannot decide whether a periodic field row is intentional;
    callers should exclude such ground from the eligibility mask.
    """
    eligible = _mask(image, ground_mask)
    gray: FloatImage = np.asarray(cv2.cvtColor(image, cv2.COLOR_RGB2GRAY), dtype=np.float32)
    pitch = scene.tile_width * scene.zoom
    period = pitch / math.sqrt(5)
    window = max(96, math.ceil(pitch * 4.5))
    height, width = gray.shape
    window = min(window, height, width)
    stride = max(32, window // 2)
    findings: list[Finding] = []
    ys = sorted({*range(0, height - window + 1, stride), height - window})
    xs = sorted({*range(0, width - window + 1, stride), width - window})
    for top in ys:
        for left in xs:
            roi_mask = eligible[top : top + window, left : left + window]
            if float(np.mean(roi_mask > 0)) < MIN_SEAM_COVERAGE:
                continue
            patch = gray[top : top + window, left : left + window]
            for sign in (-1, 1):
                profile = _profile(patch, sign * math.atan(0.5))
                if profile.size < period * (thresholds.seam_min_periods + 1):
                    continue
                # Remove only a linear lighting gradient, retaining periodic bands.
                positions = np.arange(profile.size)
                centred = positions - float(positions.mean())
                slope = float(np.sum(centred * profile)) / float(np.sum(centred * centred))
                intercept = float(profile.mean()) - slope * float(positions.mean())
                signal: FloatImage = (profile - slope * positions - intercept).astype(np.float32)
                amplitude = float(np.std(signal))
                if amplitude < max(2.5, thresholds.boundary_contrast * 0.3):
                    continue
                lags = range(max(3, round(period * 0.88)), round(period * 1.12) + 1)
                lag = max(lags, key=lambda value: _correlation(signal, value))
                correlation = _correlation(signal, lag)
                second = _correlation(signal, lag * 2)
                if min(correlation, second) < thresholds.seam_correlation:
                    continue
                # Require multiple alternating bright/dark lobes, not one broad band.
                crossings = int(np.count_nonzero(np.diff(np.signbit(signal))))
                cycles = crossings / 2
                if cycles < thresholds.seam_min_periods:
                    continue
                box = Box(x=left, y=top, width=window, height=window)
                findings.append(
                    _candidate(
                        scene,
                        "tile_seam",
                        box,
                        min(correlation, second),
                        "칸 간격과 맞는 등각 밝기 띠 반복; 의도된 경작 줄무늬와 구별 필요",
                        (
                            Metric(name="autocorrelation", value=correlation),
                            Metric(name="second_lag_correlation", value=second),
                            Metric(name="period_px", value=lag, unit="px"),
                            Metric(name="expected_period_px", value=period, unit="px"),
                            Metric(name="brightness_std", value=amplitude, unit="gray"),
                            Metric(name="cycles", value=cycles, unit="count"),
                        ),
                    )
                )
    return _deduplicate(findings, thresholds.max_per_detector)


def detect_ground(
    image: Image, scene: Scene, thresholds: Thresholds, ground_mask: Image | None = None
) -> list[Finding]:
    """Run both detectors with a shared world-ground eligibility mask."""
    return detect_straight_boundaries(image, scene, thresholds, ground_mask) + detect_tile_seams(
        image, scene, thresholds, ground_mask
    )
