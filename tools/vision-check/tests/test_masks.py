"""Asset crops, silhouettes, exclusions and uncertain roof abstention."""

from pathlib import Path

import numpy as np
from PIL import Image

from vision_check.masks import alpha_mask, build_masks, roof_mask, sprite_key, sprite_rgba
from vision_check.models import Box, Draw, Frame, Scene


def test_exact_crop_and_hash_key(tmp_path: Path) -> None:
    pixels = np.zeros((20, 40, 4), dtype=np.uint8)
    pixels[:, 20:] = (120, 80, 40, 255)
    Image.fromarray(pixels).save(tmp_path / "atlas.png")
    draw = Draw(
        asset="/atlas.png", box=Box(x=0, y=0, width=20, height=20), order=1, source=(20, 0, 20, 20)
    )
    mask = alpha_mask(draw, tmp_path)
    assert mask is not None
    assert mask.shape == (20, 20)
    assert int(mask.min()) == 255
    assert sprite_key(draw) == "/atlas.png#crop=20,0,20,20"
    tagged = draw.model_copy(update={"asset": sprite_key(draw), "source": ()})
    original = sprite_rgba(draw, tmp_path)
    tagged_pixels = sprite_rgba(tagged, tmp_path)
    assert original is not None
    assert tagged_pixels is not None
    assert np.array_equal(original, tagged_pixels)


def test_missing_and_escaping_assets_abstain(tmp_path: Path) -> None:
    draw = Draw(asset="/missing.png", box=Box(x=0, y=0, width=20, height=20), order=1)
    assert alpha_mask(draw, tmp_path) is None
    assert sprite_rgba(draw.model_copy(update={"asset": "../escape.png"}), tmp_path) is None


def test_roof_is_partial_and_grey_roof_abstains() -> None:
    rgba = np.full((100, 100, 4), (170, 170, 165, 255), dtype=np.uint8)
    rgba[10:40, 10:90] = (160, 100, 40, 255)
    mask = roof_mask(rgba)
    assert mask is not None
    assert np.count_nonzero(mask) < 3000
    assert not np.any(mask[50:])
    rgba[:, :, :3] = 160
    assert roof_mask(rgba) is None


def test_ground_retains_transparency_and_rock_but_excludes_road(tmp_path: Path) -> None:
    image = np.zeros((20, 20, 4), dtype=np.uint8)
    image[5:15, 5:15] = (90, 120, 50, 255)
    Image.fromarray(image).save(tmp_path / "tree_oak.png")
    Image.fromarray(image).save(tmp_path / "rock.png")
    draws = (
        Draw(asset="/tree_oak.png", box=Box(x=10, y=10, width=20, height=20), order=1),
        Draw(asset="/rock.png", box=Box(x=50, y=10, width=20, height=20), order=2),
    )
    scene = Scene(
        id="mask",
        terrain="forest",
        season="summer",
        seed=1,
        zoom=1,
        camera=(0, 0),
        viewport=(100, 100),
        tile_width=32,
        frames=(Frame(image="unused", index=0, elapsed_ms=0, tick=0, draws=draws),),
    )
    masks = build_masks(
        scene, tmp_path, road_polygons=(((0, 80), (30, 80), (30, 99), (0, 99)),), margin=1
    )
    assert masks.ground[20, 20] == 0
    assert masks.ground[11, 11] == 255
    assert masks.ground[20, 60] == 255
    assert masks.ground[90, 10] == 0
    assert not masks.missing_assets


def test_fractional_atlas_last_cell_stays_inside_source(tmp_path: Path) -> None:
    pixels = np.full((147, 147, 4), 255, dtype=np.uint8)
    Image.fromarray(pixels).save(tmp_path / "odd.png")
    draw = Draw(
        asset="/odd.png",
        box=Box(x=0, y=0, width=20, height=20),
        order=1,
        source=(73.5, 73.5, 73.5, 73.5),
    )
    rgba = sprite_rgba(draw, tmp_path)
    assert rgba is not None
    assert rgba.shape == (73, 73, 4)
