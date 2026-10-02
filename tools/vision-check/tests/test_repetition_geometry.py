"""Repetition neighborhoods respect foreshortened ground distance."""

import numpy as np

from vision_check.models import Box, Draw, Frame, Scene, Thresholds
from vision_check.repetition import detect_repetition


def test_distinct_ground_rows_do_not_merge_and_four_houses_are_not_dense() -> None:
    points = ((10, 20), (30, 20), (50, 20), (30, 25), (10, 70), (30, 70), (50, 70), (30, 75))
    image = np.zeros((100, 100, 3), dtype=np.uint8)
    template = np.zeros((8, 8, 4), dtype=np.uint8)
    template[:, :4] = (220, 30, 50, 255)
    template[:, 4:] = (20, 100, 190, 255)
    draws = tuple(
        Draw(asset="/assets/props/ornament.png", box=Box(x=x, y=y, width=8, height=8), order=i)
        for i, (x, y) in enumerate(points)
    )
    for draw in draws:
        image[draw.box.y : draw.box.y + 8, draw.box.x : draw.box.x + 8] = template[:, :, :3]
    scene = Scene(
        id="rows",
        terrain="forest",
        season="summer",
        seed=1,
        zoom=1,
        camera=(0, 0),
        viewport=(100, 100),
        tile_width=32,
        frames=(Frame(index=0, image="0.png", elapsed_ms=0, tick=0, draws=draws),),
    )
    thresholds = Thresholds(repeat_min_count=4, repeat_radius_tiles=2)
    found = detect_repetition(image, scene, thresholds, {}, {draws[0].asset: template})
    assert len(found) == 2
    assert all(f.box.height == 13 for f in found)
    houses = tuple(d.model_copy(update={"asset": "/assets/buildings/house.png"}) for d in draws)
    house_scene = scene.model_copy(
        update={"frames": (scene.frames[0].model_copy(update={"draws": houses}),)}
    )
    assert detect_repetition(image, house_scene, thresholds, {}, {houses[0].asset: template}) == []
