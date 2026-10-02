"""Temporal rain output must reach scale diagnostics with unique first-frame IDs."""

from typing import TYPE_CHECKING

import numpy as np

from tests.test_rain import falling_frames
from vision_check.analyze import rain_findings
from vision_check.masks import SceneMasks
from vision_check.models import Box, Draw, Frame, Scene

if TYPE_CHECKING:
    from vision_check.rain import Pixels


def test_rain_scale_wiring_and_abstention_without_person_references() -> None:
    images = falling_frames()
    people = tuple(
        Draw(
            asset=f"person:{index}",
            box=Box(x=5 + index * 10, y=150, width=4, height=8),
            order=index,
        )
        for index in range(3)
    )
    frames = tuple(
        Frame(image=f"{index}.png", index=index, elapsed_ms=index * 100, tick=index, draws=people)
        for index in range(20)
    )
    scene = Scene(
        id="rain-positive",
        terrain="forest",
        season="summer",
        seed=1,
        zoom=1,
        camera=(0, 0),
        viewport=(180, 180),
        tile_width=64,
        frames=frames,
    )
    ground: Pixels = np.full((180, 180), 255, dtype=np.uint8)
    alpha: dict[str, Pixels] = {
        person.asset: np.full((8, 4), 255, dtype=np.uint8) for person in people
    }
    masks = SceneMasks(alpha, {}, ground, (), ())
    findings, coverage = rain_findings(images, scene, masks)
    assert len(findings) == 3
    assert all(finding.detector == "scale_ratio" for finding in findings)
    assert all(finding.id.startswith("rain:") for finding in findings)
    assert len({finding.id for finding in findings}) == 3
    assert coverage["measurement_frame"] == 0
    assert coverage["falling_tracks"] == 3
    assert coverage["human_height_references"] == 3
    no_people = SceneMasks({}, {}, ground, (), ())
    abstained, insufficient = rain_findings(images, scene, no_people)
    assert not abstained
    assert insufficient["human_height_references"] == 0
