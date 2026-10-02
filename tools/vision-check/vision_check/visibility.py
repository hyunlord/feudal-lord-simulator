"""Reject semantically plausible sprite parts hidden by foreground objects."""

from __future__ import annotations

from typing import TYPE_CHECKING

import cv2
import numpy as np
from numpy.typing import NDArray

if TYPE_CHECKING:
    from .models import Draw

Pixels = NDArray[np.uint8]
MIN_MATCH_FRACTION = 0.65
MAX_RGB_DISTANCE = 35.0
MIN_SCREEN_PART_HEIGHT = 6
SOLID_ALPHA = 200


def visible_part(image: Pixels, parent: Draw, rgba: Pixels, part: Draw) -> bool:
    """Compare the actual screen with the sprite's predicted opaque part pixels."""
    b = part.box
    p = parent.box
    height, width = np.size(image, axis=0), np.size(image, axis=1)
    if (
        b.height < MIN_SCREEN_PART_HEIGHT
        or b.x < 0
        or b.y < 0
        or b.x + b.width > width
        or b.y + b.height > height
    ):
        return False
    predicted = np.asarray(
        cv2.resize(rgba, (p.width, p.height), interpolation=cv2.INTER_AREA), dtype=np.uint8
    )
    x, y = b.x - p.x, b.y - p.y
    if x < 0 or y < 0 or x + b.width > p.width or y + b.height > p.height:
        return False
    patch = predicted[y : y + b.height, x : x + b.width]
    alpha = patch[:, :, 3] > SOLID_ALPHA
    if not np.count_nonzero(alpha):
        return False
    real = image[b.y : b.y + b.height, b.x : b.x + b.width]
    delta = np.mean(np.abs(patch[:, :, :3].astype(np.float32) - real.astype(np.float32)), axis=2)
    return float(np.mean(delta[alpha] < MAX_RGB_DISTANCE)) >= MIN_MATCH_FRACTION
