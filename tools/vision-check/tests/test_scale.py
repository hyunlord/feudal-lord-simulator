"""Raw atlas actors remain valid silhouette references without NPC identity joins."""

import numpy as np
import pytest

from vision_check.models import Box, Draw, Frame, Scene
from vision_check.scale import detect_scale


def test_raw_walker_atlas_uses_cropped_alpha_height() -> None:
    # Given three unjoined atlas sprites with ten opaque pixels inside 20px crops.
    humans = tuple(
        Draw(
            asset=f"/assets/walkers-v2/adult.png#crop={i},0,8,20",
            box=Box(x=10 + i * 15, y=10, width=8, height=20),
            order=i,
        )
        for i in range(3)
    )
    barrel = Draw(asset="barrel:part", box=Box(x=65, y=10, width=10, height=15), order=4)
    image = np.indices((100, 100)).sum(axis=0) % 2 * 180 + 30
    rgb = np.repeat(image[:, :, None], 3, axis=2).astype(np.uint8)
    masks: dict[str, np.ndarray[tuple[int, ...], np.dtype[np.uint8]]] = {
        draw.asset: np.pad(np.full((10, 8), 255, dtype=np.uint8), ((5, 5), (0, 0)))
        for draw in humans
    }
    masks[barrel.asset] = np.full((15, 10), 255, dtype=np.uint8)
    scene = Scene(
        id="atlas",
        terrain="river",
        season="summer",
        seed=1,
        zoom=1,
        camera=(0, 0),
        viewport=(100, 100),
        tile_width=32,
        frames=(Frame(image="00.png", index=0, elapsed_ms=0, tick=1, draws=(*humans, barrel)),),
    )
    # When measuring the isolated object.
    findings = detect_scale(rgb, scene, masks)
    # Then the human reference is opaque height, never full atlas/crop height.
    assert len(findings) == 1
    assert next(m.value for m in findings[0].metrics if m.name == "person_height") == 10
    assert next(m.value for m in findings[0].metrics if m.name == "object_person_height") == 1.5


def test_semantic_component_replaces_whole_composite_measurement() -> None:
    # Given a gutter-and-cask sprite plus its independently visible semantic cask.
    people = tuple(
        Draw(asset=f"person:{i}", box=Box(x=10 + i * 15, y=10, width=8, height=20), order=i)
        for i in range(3)
    )
    parent = Draw(
        asset="/yard_rain_barrel.png#crop=0,0,50,40",
        box=Box(x=60, y=40, width=35, height=40),
        order=5,
    )
    part = Draw(
        asset="barrel:/yard_rain_barrel.png#component=body:original",
        box=Box(x=72, y=42, width=20, height=30),
        order=5,
    )
    pattern = np.indices((100, 100)).sum(axis=0) % 2 * 180 + 30
    rgb = np.repeat(pattern[:, :, None], 3, axis=2).astype(np.uint8)
    draws = (*people, parent, part)
    masks = {d.asset: np.full((d.box.height, d.box.width), 255, dtype=np.uint8) for d in draws}
    scene = Scene(
        id="parts",
        terrain="river",
        season="summer",
        seed=1,
        zoom=1,
        camera=(0, 0),
        viewport=(100, 100),
        tile_width=32,
        frames=(Frame(image="00.png", index=0, elapsed_ms=0, tick=1, draws=draws),),
    )
    # When measuring a decomposed composite.
    findings = detect_scale(rgb, scene, masks)
    # Then only the body is reported, without its gutter or duplicate parent.
    assert len(findings) == 1
    assert findings[0].box == part.box


@pytest.mark.parametrize("isolated", [False, True])
def test_semantic_sack_inside_cart_pile_is_not_suppressed(isolated: bool) -> None:
    # Given an explicit measured sack inside a normally unmeasurable cargo pile.
    people = tuple(
        Draw(asset=f"person:{i}", box=Box(x=10 + i * 15, y=10, width=8, height=20), order=i)
        for i in range(3)
    )
    whole = Draw(
        asset="/props/cart_sack_cargo_pile_2.png", box=Box(x=60, y=40, width=30, height=40), order=5
    )
    part = Draw(
        asset="sack:/props/cart_sack_cargo_pile_2.png#component=grain:original",
        box=Box(x=65, y=45, width=15, height=30),
        order=5,
    )
    pattern = np.indices((100, 100)).sum(axis=0) % 2 * 180 + 30
    rgb = np.repeat(pattern[:, :, None], 3, axis=2).astype(np.uint8)
    draws = (*people, whole, part) if isolated else (*people, whole)
    masks = {d.asset: np.full((d.box.height, d.box.width), 255, dtype=np.uint8) for d in draws}
    scene = Scene(
        id="cargo",
        terrain="river",
        season="summer",
        seed=1,
        zoom=1,
        camera=(0, 0),
        viewport=(100, 100),
        tile_width=32,
        frames=(Frame(image="00.png", index=0, elapsed_ms=0, tick=1, draws=draws),),
    )
    # When inspecting trusted semantic parts alongside their unsplit cargo parent.
    findings = detect_scale(rgb, scene, masks)
    # Then only the isolated sack is measurable; the full cart pile is not.
    assert [finding.box for finding in findings] == ([part.box] if isolated else [])
