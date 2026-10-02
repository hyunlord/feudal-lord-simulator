"""Occluded or tiny semantic parts must not become scale evidence."""

import numpy as np

from vision_check.models import Box, Draw
from vision_check.visibility import visible_part


def test_visible_part_and_foreground_occlusion() -> None:
    rgba = np.full((20, 20, 4), 255, dtype=np.uint8)
    rgba[:, :, :3] = 80
    parent = Draw(asset="test", box=Box(x=10, y=10, width=20, height=20), order=1)
    part = Draw(asset="part", box=Box(x=15, y=15, width=8, height=10), order=1)
    image = np.full((50, 50, 3), 80, dtype=np.uint8)
    assert visible_part(image, parent, rgba, part)
    image[15:25, 15:23] = 220
    assert not visible_part(image, parent, rgba, part)


def test_tiny_part_abstains() -> None:
    rgba = np.full((20, 20, 4), 255, dtype=np.uint8)
    image = np.full((50, 50, 3), 255, dtype=np.uint8)
    parent = Draw(asset="test", box=Box(x=10, y=10, width=20, height=20), order=1)
    part = Draw(asset="part", box=Box(x=15, y=15, width=4, height=4), order=1)
    assert not visible_part(image, parent, rgba, part)
