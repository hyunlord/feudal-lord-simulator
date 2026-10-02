"""Small screen geometry and colour measurements."""

import math

import numpy as np
from numpy.typing import NDArray

from .models import Box


def iou(first: Box, second: Box) -> float:
    """Return intersection over union for screenshot boxes."""
    left, top = max(first.x, second.x), max(first.y, second.y)
    right = min(first.x + first.width, second.x + second.width)
    bottom = min(first.y + first.height, second.y + second.height)
    intersection = max(0, right - left) * max(0, bottom - top)
    return intersection / (first.width * first.height + second.width * second.height - intersection)


def line_contrast(
    image: NDArray[np.uint8], line: tuple[int, int, int, int], offset: float = 3
) -> float:
    """Measure median cross-edge RGB distance, suppressing single noisy pixels."""
    x1, y1, x2, y2 = line
    length = math.hypot(x2 - x1, y2 - y1)
    if length == 0:
        return 0.0
    offset_x, offset_y = -(y2 - y1) / length * offset, (x2 - x1) / length * offset
    x = np.linspace(x1, x2, 60)
    y = np.linspace(y1, y2, 60)
    height, width = np.size(image, axis=0), np.size(image, axis=1)
    xa = np.clip(np.rint(x + offset_x).astype(int), 0, width - 1)
    ya = np.clip(np.rint(y + offset_y).astype(int), 0, height - 1)
    xb = np.clip(np.rint(x - offset_x).astype(int), 0, width - 1)
    yb = np.clip(np.rint(y - offset_y).astype(int), 0, height - 1)
    difference = image[ya, xa].astype(np.float32) - image[yb, xb].astype(np.float32)
    return float(np.median(np.linalg.norm(difference, axis=1)))


def union_box(boxes: list[Box]) -> Box:
    """Enclose a nonempty set of boxes."""
    x, y = min(b.x for b in boxes), min(b.y for b in boxes)
    return Box(
        x=x,
        y=y,
        width=max(b.x + b.width for b in boxes) - x,
        height=max(b.y + b.height for b in boxes) - y,
    )


def clipped(box: Box, width: int, height: int) -> Box | None:
    """Clip a box to the image; off-screen boxes have no area."""
    x, y = max(0, box.x), max(0, box.y)
    right, bottom = min(width, box.x + box.width), min(height, box.y + box.height)
    if right <= x or bottom <= y:
        return None
    return Box(x=x, y=y, width=right - x, height=bottom - y)
