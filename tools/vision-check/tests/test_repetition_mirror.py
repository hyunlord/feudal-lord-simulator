"""Mirrored inventory drawings remain subject to actual-pixel evidence."""

import numpy as np

from vision_check.models import Box, Draw, Frame, Scene, Thresholds
from vision_check.repetition import detect_repetition


def test_reflected_copies_are_visible_but_occluded_copy_is_not() -> None:
    template = np.zeros((18, 14, 4), dtype=np.uint8)
    template[:, :7] = (210, 30, 50, 255)
    template[:, 7:] = (20, 100, 190, 255)
    image = np.zeros((100, 140, 3), dtype=np.uint8)
    draws = tuple(
        Draw(
            asset="/assets/props/ornament.png",
            box=Box(x=5 + i * 22, y=25, width=14, height=18),
            order=i,
        )
        for i in range(6)
    )
    for draw in draws:
        image[25:43, draw.box.x : draw.box.x + 14] = np.flip(template, axis=1)[:, :, :3]
    scene = Scene(
        id="mirror",
        terrain="forest",
        season="summer",
        seed=1,
        zoom=1,
        camera=(0, 0),
        viewport=(140, 100),
        tile_width=32,
        frames=(Frame(index=0, image="0.png", elapsed_ms=0, tick=0, draws=draws),),
    )
    templates = {draws[0].asset: template}
    assert len(detect_repetition(image, scene, Thresholds(), {}, templates)) == 1
    image[25:43, 5:19] = 0
    assert detect_repetition(image, scene, Thresholds(), {}, templates) == []
