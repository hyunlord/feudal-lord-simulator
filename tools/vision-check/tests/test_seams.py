"""Tile repetition must survive two lags and reject nonperiodic texture."""

import numpy as np

from vision_check.seams import correlation


def test_two_dimensional_tile_matches() -> None:
    rng = np.random.default_rng(41)
    tile = rng.normal(size=(16, 32)).astype(np.float32)
    image = np.tile(tile, (12, 6))
    assert correlation(image, 32, 16) > 0.99
    assert correlation(image, 64, 32) > 0.99


def test_random_texture_is_not_repetition() -> None:
    image = np.random.default_rng(44).normal(size=(192, 192)).astype(np.float32)
    assert abs(correlation(image, 32, 16)) < 0.05


def test_flat_surface_has_no_correlation_claim() -> None:
    image = np.full((192, 192), 42, dtype=np.float32)
    assert correlation(image, 32, 16) == 0
