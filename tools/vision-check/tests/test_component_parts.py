"""Semantic components survive atlas cropping and mirroring without scene labels."""

import hashlib
from pathlib import Path

import numpy as np
from PIL import Image

from vision_check.component_catalog import Component, ComponentAsset, ComponentCatalog
from vision_check.component_parts import ComponentEvidence, component_draws
from vision_check.models import Box, Draw


def _fixture(
    tmp_path: Path,
) -> tuple[np.ndarray[tuple[int, ...], np.dtype[np.uint8]], ComponentAsset]:
    rgba = np.full((30, 50, 4), (180, 170, 100, 255), dtype=np.uint8)
    rgba[5:26, 5:16, :3] = (60, 100, 170)
    path = tmp_path / "composite.png"
    Image.fromarray(rgba).save(path)
    asset = ComponentAsset(
        path="/composite.png",
        sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        width=50,
        height=30,
        parts=(
            Component(
                id="upright",
                kind="barrel",
                polygon=((5, 5), (15, 5), (15, 25), (5, 25)),
                note="Full upright barrel.",
            ),
        ),
    )
    return rgba, asset


def test_component_measures_only_polygon(tmp_path: Path) -> None:
    # Given a composite with a separately annotated barrel.
    rgba, asset = _fixture(tmp_path)
    evidence = ComponentEvidence(
        rgba[:, :, :3],
        ComponentCatalog(annotation_basis="source", exclusions=(), assets=(asset,)),
        tmp_path,
    )
    draw = Draw(asset="/composite.png", box=Box(x=0, y=0, width=50, height=30), order=2)
    # When projecting and checking actual pixels.
    parts = component_draws(draw, rgba, evidence)
    # Then only the barrel height is measured, not the whole composite.
    assert len(parts) == 1
    assert parts[0][0].box == Box(x=5, y=5, width=11, height=21)
    assert parts[0][1].shape == (21, 11)


def test_mirrored_composite_uses_actual_screen_orientation(tmp_path: Path) -> None:
    # Given an old capture with omitted mirror metadata.
    rgba, asset = _fixture(tmp_path)
    evidence = ComponentEvidence(
        np.flip(rgba[:, :, :3], axis=1),
        ComponentCatalog(annotation_basis="source", exclusions=(), assets=(asset,)),
        tmp_path,
    )
    draw = Draw(asset="/composite.png", box=Box(x=0, y=0, width=50, height=30), order=2)
    # When orientation is inferred from the complete parent pixels.
    parts = component_draws(draw, rgba, evidence)
    # Then the source polygon follows the mirrored sprite.
    assert len(parts) == 1
    assert parts[0][0].box.x == 34


def test_revised_asset_abstains(tmp_path: Path) -> None:
    # Given a stale catalogue revision.
    rgba, asset = _fixture(tmp_path)
    asset = asset.model_copy(update={"sha256": "0" * 64})
    evidence = ComponentEvidence(
        rgba[:, :, :3],
        ComponentCatalog(annotation_basis="source", exclusions=(), assets=(asset,)),
        tmp_path,
    )
    draw = Draw(asset="/composite.png", box=Box(x=0, y=0, width=50, height=30), order=2)
    # When the actual PNG SHA does not match.
    parts = component_draws(draw, rgba, evidence)
    # Then semantic coordinates are never reused blindly.
    assert not parts


def test_hidden_component_abstains(tmp_path: Path) -> None:
    # Given a foreground occluder over the complete component.
    rgba, asset = _fixture(tmp_path)
    image = rgba[:, :, :3].copy()
    image[5:26, 5:16] = 0
    evidence = ComponentEvidence(
        image, ComponentCatalog(annotation_basis="source", exclusions=(), assets=(asset,)), tmp_path
    )
    draw = Draw(asset="/composite.png", box=Box(x=0, y=0, width=50, height=30), order=2)
    # When checking component visibility against actual RGB.
    parts = component_draws(draw, rgba, evidence)
    # Then source provenance alone cannot produce a measurement.
    assert not parts


def test_atlas_crop_maps_part_coordinates_and_rejects_cut_parts(tmp_path: Path) -> None:
    # Given an atlas crop containing the complete component.
    rgba, asset = _fixture(tmp_path)
    crop = rgba[:, 2:25]
    evidence = ComponentEvidence(
        crop[:, :, :3],
        ComponentCatalog(annotation_basis="source", exclusions=(), assets=(asset,)),
        tmp_path,
    )
    draw = Draw(
        asset="/composite.png",
        box=Box(x=0, y=0, width=23, height=30),
        order=2,
        source=(2, 0, 23, 30),
    )
    # When source coordinates are translated into the cropped sprite.
    parts = component_draws(draw, crop, evidence)
    # Then the component follows the crop offset.
    assert len(parts) == 1
    assert parts[0][0].box.x == 3


def test_truncated_atlas_component_abstains(tmp_path: Path) -> None:
    # Given a crop cutting the object's left side.
    rgba, asset = _fixture(tmp_path)
    crop = rgba[:, 10:25]
    evidence = ComponentEvidence(
        crop[:, :, :3],
        ComponentCatalog(annotation_basis="source", exclusions=(), assets=(asset,)),
        tmp_path,
    )
    draw = Draw(
        asset="/composite.png",
        box=Box(x=0, y=0, width=15, height=30),
        order=2,
        source=(10, 0, 15, 30),
    )
    # When projecting a partial annotated object.
    parts = component_draws(draw, crop, evidence)
    # Then no truncated height is used as a measurement.
    assert not parts


def test_unknown_asset_abstains(tmp_path: Path) -> None:
    # Given an unannotated source asset.
    rgba, asset = _fixture(tmp_path)
    evidence = ComponentEvidence(
        rgba[:, :, :3],
        ComponentCatalog(annotation_basis="source", exclusions=(), assets=(asset,)),
        tmp_path,
    )
    draw = Draw(asset="/unknown.png", box=Box(x=0, y=0, width=50, height=30), order=2)
    # When no semantic annotation exists.
    parts = component_draws(draw, rgba, evidence)
    # Then appearance alone never invents a component identity.
    assert not parts
