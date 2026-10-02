"""User-scoped stock exclusions must not silence ordinary props or trade markers."""

import numpy as np
import pytest

from vision_check.inventory import inventory_category, inventory_skip_counts
from vision_check.models import Box, Draw, Frame, Scene, Thresholds
from vision_check.objects import detect_objects


@pytest.mark.parametrize(
    "asset",
    [
        "/assets/wave3/pile/ale_barrels_3.png",
        "/assets/wave7/pile/crates_3-v1.png",
    ],
)
def test_normal_stock_repetition_is_out_of_scope(asset: str) -> None:
    assert repeated(asset) == []


@pytest.mark.parametrize(
    "asset",
    [
        "/assets/props/barrel.png",
        "/assets/wave3/pile/yarn_skeins_3.png",
        "/assets/wave26/house/house_a.png",
        "/assets/pile/material.png",
    ],
)
def test_other_repetition_is_retained(asset: str) -> None:
    assert repeated(asset) == ["repeat_density"]


def repeated(asset: str) -> list[str]:
    image = np.zeros((128, 128, 3), dtype=np.uint8)
    draws: list[Draw] = []
    for index in range(6):
        box = Box(x=5 + index * 18, y=20, width=12, height=12)
        image[20:32, box.x : box.x + 12] = (
            np.indices((12, 12)).sum(axis=0)[:, :, None] % 2 * 190 + 30
        )
        draws.append(Draw(asset=asset, box=box, order=index))
    data = Scene(
        id="synthetic",
        terrain="forest",
        season="summer",
        seed=1,
        zoom=1,
        camera=(0, 0),
        viewport=(128, 128),
        tile_width=32,
        frames=(Frame(image="0.png", index=0, elapsed_ms=0, tick=0, draws=tuple(draws)),),
    )
    return [finding.detector for finding in detect_objects([image], data, Thresholds())]


def test_exact_semantic_inventory_and_audit_counts() -> None:
    wood = "https://game.test/assets/visibility-v1/construction/pile_wood_3-v1.png?v=2"
    assert inventory_category(wood) == "wood_stock"
    assert inventory_category("/assets/buildings/logging_camp.png") is None
    assert inventory_category("/assets/props/barrel.png") is None
    assert inventory_category("/assets/wave3/pile/yarn_skeins_3.png") is None
    draws = tuple(
        Draw(asset=asset, box=Box(x=0, y=0, width=10, height=10), order=i)
        for i, asset in enumerate((wood, wood, "/assets/props/barrel.png"))
    )
    assert inventory_skip_counts(draws) == {"wood_stock": 2}
