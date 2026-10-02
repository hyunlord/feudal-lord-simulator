"""A specialized rock patch must not double count its generic edge candidate."""

import numpy as np

from vision_check.analyze import consolidate_rock_boundaries
from vision_check.models import Box, Finding


def finding(identifier: str, box: Box) -> Finding:
    return Finding(
        id=identifier, scene="test", detector="straight_boundary", box=box, score=0.8, reason="test"
    )


def test_contained_stone_edge_yields_one_specialized_candidate() -> None:
    image = np.full((100, 100, 3), (130, 125, 115), np.uint8)
    edge = finding("edge", Box(x=20, y=20, width=60, height=20))
    rock = finding("rock", Box(x=10, y=10, width=80, height=80))
    assert consolidate_rock_boundaries(image, [edge], [rock]) == [rock]


def test_other_ground_inside_rectangle_is_not_suppressed() -> None:
    image = np.full((100, 100, 3), (100, 130, 50), np.uint8)
    edge = finding("edge", Box(x=20, y=20, width=60, height=20))
    rock = finding("rock", Box(x=10, y=10, width=80, height=80))
    assert consolidate_rock_boundaries(image, [edge], [rock]) == [edge, rock]


def test_partial_overlap_and_other_detectors_survive() -> None:
    image = np.full((100, 100, 3), (130, 125, 115), np.uint8)
    edge = finding("edge", Box(x=0, y=0, width=50, height=20))
    rock = finding("rock", Box(x=10, y=10, width=80, height=80))
    seam = edge.model_copy(update={"id": "seam", "detector": "tile_seam"})
    assert consolidate_rock_boundaries(image, [edge, seam], [rock]) == [edge, seam, rock]
