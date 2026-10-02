"""Detectors must find planted geometry and reject nonperiodic or masked ground."""

import math

import numpy as np

from vision_check.ground import detect_straight_boundaries, detect_tile_seams
from vision_check.models import Scene, Thresholds


def scene() -> Scene:
    return Scene(
        id="synthetic",
        terrain="forest",
        season="summer",
        seed=1,
        zoom=1,
        camera=(0, 0),
        viewport=(384, 384),
        tile_width=64,
        frames=(),
    )


def test_long_isometric_colour_cut_is_detected() -> None:
    yy, xx = np.indices((384, 384))
    image = np.full((384, 384, 3), (90, 125, 65), dtype=np.uint8)
    image[yy > xx * 0.5 + 50] = (165, 180, 90)
    findings = detect_straight_boundaries(image, scene(), Thresholds())
    assert findings
    assert all(item.detector == "straight_boundary" for item in findings)
    assert findings == detect_straight_boundaries(image, scene(), Thresholds())


def test_uniform_ground_and_ineligible_cut_are_not_detected() -> None:
    image = np.full((384, 384, 3), 100, dtype=np.uint8)
    assert not detect_straight_boundaries(image, scene(), Thresholds())
    yy, xx = np.indices((384, 384))
    image[yy > xx * 0.5 + 50] = 200
    assert not detect_straight_boundaries(
        image, scene(), Thresholds(), np.zeros((384, 384), dtype=np.uint8)
    )


def test_tile_pitch_bands_are_detected() -> None:
    yy, xx = np.indices((384, 384))
    normal = (yy * 2 - xx) / math.sqrt(5)
    brightness = 120 + 30 * np.cos(2 * np.pi * normal / (64 / math.sqrt(5)))
    image = np.repeat(brightness[:, :, None], 3, axis=2).astype(np.uint8)
    assert detect_tile_seams(image, scene(), Thresholds())


def test_gradient_and_single_edge_are_not_periodic() -> None:
    yy, xx = np.indices((384, 384))
    gradient = 50 + (xx + yy) / 5
    image = np.repeat(gradient[:, :, None], 3, axis=2).astype(np.uint8)
    assert not detect_tile_seams(image, scene(), Thresholds())
    image = np.full((384, 384, 3), 80, dtype=np.uint8)
    image[yy > xx * 0.5 + 50] = 160
    assert not detect_tile_seams(image, scene(), Thresholds())


def test_mask_excludes_periodic_non_ground_surface() -> None:
    yy, xx = np.indices((384, 384))
    brightness = 120 + 30 * np.cos(2 * np.pi * (yy * 2 - xx) / 64)
    image = np.repeat(brightness[:, :, None], 3, axis=2).astype(np.uint8)
    assert not detect_tile_seams(image, scene(), Thresholds(), np.zeros((384, 384), dtype=np.uint8))


def test_screen_axis_forest_rectangle_is_detected() -> None:
    image = np.full((384, 384, 3), (90, 125, 65), dtype=np.uint8)
    image[80:280, 60:310] = (140, 105, 60)
    findings = detect_straight_boundaries(image, scene(), Thresholds())
    assert findings
    assert any("수평·수직" in item.reason for item in findings)
    assert all(any(metric.name == "angle" for metric in item.metrics) for item in findings)


def test_curved_natural_colour_boundary_is_not_a_long_cut() -> None:
    yy, xx = np.indices((384, 384))
    image = np.full((384, 384, 3), (90, 125, 65), dtype=np.uint8)
    image[(xx - 192) ** 2 + (yy - 192) ** 2 < 120**2] = (140, 105, 60)
    assert not detect_straight_boundaries(image, scene(), Thresholds())


def test_short_axis_cut_uses_separate_recall_threshold() -> None:
    image = np.full((384, 384, 3), (90, 125, 65), dtype=np.uint8)
    image[120:210, 120:230] = (165, 180, 90)
    assert not detect_straight_boundaries(image, scene(), Thresholds(boundary_length_tiles=2.5))
    recall = Thresholds(boundary_length_tiles=2.5, axis_boundary_length_tiles=1.0)
    assert detect_straight_boundaries(image, scene(), recall)
