"""Synthetic image/metadata boundaries; these are not real-scene precision labels."""

import numpy as np
from numpy.typing import NDArray

from vision_check.models import Box, Draw, Frame, Scene, Thresholds
from vision_check.objects import detect_objects, rain_scale, stationary_metrics

Pixels = NDArray[np.uint8]


def patterned(image: Pixels, box: Box) -> None:
    for row in range(box.height):
        for column in range(box.width):
            image[box.y + row, box.x + column] = 220 if (row + column) % 2 == 0 else 30


def scene(draws: tuple[Draw, ...], count: int = 1) -> Scene:
    return Scene(
        id="synthetic",
        terrain="forest",
        season="summer",
        seed=1,
        zoom=1,
        camera=(0, 0),
        viewport=(128, 128),
        tile_width=32,
        valid_motion=True,
        frames=tuple(
            Frame(
                image=f"{index}.png",
                index=index,
                elapsed_ms=index * 100,
                tick=index * 2,
                draws=draws,
            )
            for index in range(count)
        ),
    )


def test_idle_is_measured_but_not_reported_as_broken() -> None:
    person = Draw(asset="person:1", box=Box(x=10, y=10, width=8, height=20), order=1)
    image = np.zeros((128, 128, 3), dtype=np.uint8)
    patterned(image, person.box)
    data = scene((person,), 20)
    assert stationary_metrics([image] * 20, data, Thresholds()).ratio == 1.0
    assert detect_objects([image] * 20, data, Thresholds()) == []
    findings = detect_objects(
        [image] * 20, data, Thresholds(), expected_walking=frozenset({"person:1"})
    )
    assert [finding.detector for finding in findings] == ["stationary_person"]


def test_paused_or_short_capture_abstains() -> None:
    person = Draw(asset="person:1", box=Box(x=10, y=10, width=8, height=20), order=1)
    image = np.zeros((128, 128, 3), dtype=np.uint8)
    patterned(image, person.box)
    data = scene((person,), 20).model_copy(update={"valid_motion": False})
    assert stationary_metrics([image] * 20, data, Thresholds()).ratio is None
    assert (
        detect_objects([image] * 20, data, Thresholds(), expected_walking=frozenset({"person:1"}))
        == []
    )


def test_roof_requires_changed_pixels_and_roof_not_facade() -> None:
    building = Draw(
        asset="/assets/buildings/house.png", box=Box(x=10, y=10, width=60, height=60), order=1
    )
    person = Draw(asset="person:1", box=Box(x=30, y=20, width=8, height=18), order=2)
    first = np.zeros((128, 128, 3), dtype=np.uint8)
    last = first.copy()
    patterned(last, person.box)
    roof = np.zeros((60, 60), dtype=np.uint8)
    roof[:32] = 255
    data = scene((building, person), 2)
    masks = {building.asset: roof}
    assert len(detect_objects([first, last], data, Thresholds(), roof_masks=masks)) == 1
    assert detect_objects([last, last], data, Thresholds(), roof_masks=masks) == []
    facade = person.model_copy(update={"box": Box(x=30, y=44, width=8, height=18)})
    facade_image = first.copy()
    patterned(facade_image, facade.box)
    assert (
        detect_objects(
            [first, facade_image], scene((building, facade), 2), Thresholds(), roof_masks=masks
        )
        == []
    )
    assert detect_objects([first, last], data, Thresholds()) == []


def test_scale_requires_silhouettes_and_does_not_measure_full_cart() -> None:
    people = tuple(
        Draw(
            asset=f"person:{index}",
            box=Box(x=10 + index * 20, y=10, width=8, height=20),
            order=index,
        )
        for index in range(3)
    )
    barrel = Draw(
        asset="/assets/props/barrel.png", box=Box(x=90, y=10, width=15, height=30), order=4
    )
    image = np.zeros((128, 128, 3), dtype=np.uint8)
    for draw in (*people, barrel):
        patterned(image, draw.box)
    data = scene((*people, barrel))
    masks = {
        draw.asset: np.full((draw.box.height, draw.box.width), 255, dtype=np.uint8)
        for draw in (*people, barrel)
    }
    findings = detect_objects([image], data, Thresholds(), silhouettes=masks)
    assert [finding.detector for finding in findings] == ["scale_ratio"]
    assert detect_objects([image], data, Thresholds()) == []
    cart = barrel.model_copy(update={"asset": "/assets/props/cart.png"})
    masks[cart.asset] = masks[barrel.asset]
    assert detect_objects([image], scene((*people, cart)), Thresholds(), silhouettes=masks) == []
    pile = barrel.model_copy(update={"asset": "/assets/props/barrels_3.png"})
    masks[pile.asset] = masks[barrel.asset]
    assert detect_objects([image], scene((*people, pile)), Thresholds(), silhouettes=masks) == []


def test_repetition_requires_pixel_similarity_and_ignores_tree_density() -> None:
    draws = tuple(
        Draw(
            asset="/assets/props/crate.png",
            box=Box(x=5 + index * 18, y=20, width=12, height=12),
            order=index,
        )
        for index in range(6)
    )
    image = np.zeros((128, 128, 3), dtype=np.uint8)
    for draw in draws:
        patterned(image, draw.box)
    findings = detect_objects([image], scene(draws), Thresholds())
    assert [finding.detector for finding in findings] == ["repeat_density"]
    trees = tuple(draw.model_copy(update={"asset": "/assets/trees/oak.png"}) for draw in draws)
    assert detect_objects([image], scene(trees), Thresholds()) == []
    distinct = image.copy()
    for index, draw in enumerate(draws):
        patch = distinct[
            draw.box.y : draw.box.y + draw.box.height, draw.box.x : draw.box.x + draw.box.width
        ]
        patch[:, :, index % 3] = index * 40
    assert detect_objects([distinct], scene(draws), Thresholds()) == []


def test_walking_track_does_not_count_as_stationary() -> None:
    images: list[Pixels] = []
    frames: list[Frame] = []
    for index in range(20):
        person = Draw(asset="person:1", box=Box(x=10 + index, y=10, width=8, height=20), order=1)
        image = np.zeros((128, 128, 3), dtype=np.uint8)
        patterned(image, person.box)
        images.append(image)
        frames.append(
            Frame(
                image=f"{index}.png",
                index=index,
                elapsed_ms=index * 100,
                tick=index * 2,
                draws=(person,),
            )
        )
    data = scene((), 20).model_copy(update={"frames": tuple(frames)})
    assert stationary_metrics(images, data, Thresholds()).ratio == 0.0
    assert (
        detect_objects(images, data, Thresholds(), expected_walking=frozenset({"person:1"})) == []
    )


def test_rain_scale_needs_isolated_long_streak() -> None:
    image = np.zeros((128, 128, 3), dtype=np.uint8)
    mask = np.zeros((128, 128), dtype=np.uint8)
    image[20:60, 40:42] = 200
    image[20:60:2, 40] = 140
    mask[20:60, 40:42] = 255
    assert len(rain_scale(image, scene(()), mask, [20, 20, 20])) == 1
    assert rain_scale(image, scene(()), mask, [40, 40, 40]) == []


def test_runtime_house_paths_and_barrel_piles() -> None:
    draws = tuple(
        Draw(
            asset="/assets/wave26/house/house_a.png",
            box=Box(x=5 + index * 18, y=20, width=12, height=12),
            order=index,
        )
        for index in range(6)
    )
    image = np.zeros((128, 128, 3), dtype=np.uint8)
    for draw in draws:
        patterned(image, draw.box)
    assert len(detect_objects([image], scene(draws), Thresholds())) == 1
    overlays = tuple(
        draw.model_copy(update={"asset": "/assets/wave26/house/house_roof.png"}) for draw in draws
    )
    assert detect_objects([image], scene(overlays), Thresholds()) == []


def test_legacy_actor_sprites_supply_scale_references() -> None:
    people = tuple(
        Draw(
            asset=f"/assets/walker/wk_citizen_{i}.png",
            box=Box(x=10 + 20 * i, y=10, width=8, height=20),
            order=i,
        )
        for i in range(3)
    )
    barrel = Draw(
        asset="/assets/props/barrel.png", box=Box(x=90, y=10, width=15, height=30), order=4
    )
    image = np.zeros((128, 128, 3), dtype=np.uint8)
    masks: dict[str, Pixels] = {}
    for draw in (*people, barrel):
        patterned(image, draw.box)
        masks[draw.asset] = np.full((draw.box.height, draw.box.width), 255, dtype=np.uint8)
    findings = detect_objects([image], scene((*people, barrel)), Thresholds(), silhouettes=masks)
    assert len([f for f in findings if f.detector == "scale_ratio"]) == 1


def test_repeat_alpha_excludes_unrelated_background_and_supports_pile_directory() -> None:
    image = np.zeros((128, 128, 3), dtype=np.uint8)
    mask = np.zeros((20, 20), dtype=np.uint8)
    mask[5:15, 5:15] = 255
    draws: list[Draw] = []
    for i in range(6):
        box = Box(x=5 + (i % 3) * 35, y=5 + (i // 3) * 40, width=20, height=20)
        draw = Draw(asset="/assets/pile/material.png", box=box, order=i)
        draws.append(draw)
        image[box.y : box.y + 20, box.x : box.x + 20] = i * 45
        patterned(image, Box(x=box.x + 5, y=box.y + 5, width=10, height=10))
    findings = detect_objects(
        [image], scene(tuple(draws)), Thresholds(), silhouettes={draws[0].asset: mask}
    )
    assert len([f for f in findings if f.detector == "repeat_density"]) == 1
    assert not [
        f
        for f in detect_objects([image], scene(tuple(draws)), Thresholds())
        if f.detector == "repeat_density"
    ]


def test_source_template_repetition_excludes_occluded_copies() -> None:
    image = np.zeros((128, 128, 3), dtype=np.uint8)
    template = np.zeros((20, 20, 4), dtype=np.uint8)
    template[5:15, 5:15, 3] = 255
    sprite = np.zeros((20, 20, 3), dtype=np.uint8)
    patterned(sprite, Box(x=5, y=5, width=10, height=10))
    template[:, :, :3] = sprite
    draws: list[Draw] = []
    for i in range(6):
        box = Box(x=5 + i % 3 * 35, y=5 + i // 3 * 40, width=20, height=20)
        draws.append(Draw(asset="/assets/pile/material.png", box=box, order=i))
        image[box.y : box.y + 20, box.x : box.x + 20] = sprite
    templates = {draws[0].asset: template}
    before = detect_objects([image], scene(tuple(draws)), Thresholds(), rgba_templates=templates)
    assert len([f for f in before if f.detector == "repeat_density"]) == 1
    image[5:25, 5:25] = 80
    after = detect_objects([image], scene(tuple(draws)), Thresholds(), rgba_templates=templates)
    assert not [f for f in after if f.detector == "repeat_density"]


def test_scale_box_uses_opaque_extent_instead_of_transparent_padding() -> None:
    people = tuple(
        Draw(asset=f"person:{i}", box=Box(x=10 + i * 20, y=10, width=8, height=20), order=i)
        for i in range(3)
    )
    barrel = Draw(
        asset="/assets/props/barrel.png", box=Box(x=85, y=30, width=30, height=45), order=4
    )
    image = np.zeros((128, 128, 3), dtype=np.uint8)
    masks: dict[str, Pixels] = {}
    for draw in people:
        patterned(image, draw.box)
        masks[draw.asset] = np.full((20, 8), 255, dtype=np.uint8)
    mask = np.zeros((45, 30), dtype=np.uint8)
    mask[8:38, 8:23] = 255
    masks[barrel.asset] = mask
    patterned(image, Box(x=93, y=38, width=15, height=30))
    findings = detect_objects([image], scene((*people, barrel)), Thresholds(), silhouettes=masks)
    assert [f.box for f in findings if f.detector == "scale_ratio"] == [
        Box(x=93, y=38, width=15, height=30)
    ]
