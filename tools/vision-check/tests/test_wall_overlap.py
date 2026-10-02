"""Moving pixels, visible wall texture and on-wall feet are all required."""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np
from PIL import Image

from vision_check.contracts import Camera, Capture, Person, Point, Reading, Viewport
from vision_check.models import Box, Draw
from vision_check.wall_overlap import detect_wall_overlap

if TYPE_CHECKING:
    from pathlib import Path

    from vision_check.masks import Pixels


def setup_capture(root: Path, foot_y: int, visible: bool) -> tuple[list[Pixels], Capture]:
    sprite = root / "assets/wall/stone_test.png"
    sprite.parent.mkdir(parents=True)
    Image.new("RGBA", (100, 45), (125, 125, 125, 255)).save(sprite)
    frames: list[Reading] = []
    images: list[Pixels] = []
    for index in range(20):
        x = 15 + index * 4
        image = np.full((100, 120, 3), (80, 120, 50), np.uint8)
        image[10:55, 10:110] = (125, 125, 125)
        if visible:
            image[foot_y - 20 : foot_y, x : x + 8] = (200, 25, 20)
        images.append(image)
        frames.append(
            Reading(
                tick=index,
                speed=1,
                camera=Camera(zoom=1, panX=0, panY=0),
                viewport=Viewport(width=120, height=100),
                draws=(
                    Draw(
                        asset="/assets/wall/stone_test.png",
                        box=Box(x=10, y=10, width=100, height=45),
                        order=1,
                    ),
                ),
                people=(
                    Person(
                        id="moving-person",
                        kind="walker",
                        foot=Point(x=x + 4, y=foot_y),
                        pathRemaining=5,
                        cancelled=False,
                    ),
                ),
                tiles=(),
                url="http://localhost",
                proof=False,
                index=index,
                image=f"{index}.png",
            )
        )
    capture = Capture(
        id="wall-control",
        terrain="any",
        season="summer",
        seed=1,
        zoom=1,
        cohort="calibration",
        qa_text="",
        frames=tuple(frames),
        capture_notes=(),
    )
    return images, capture


def test_visible_moving_human_on_wall_is_detected(tmp_path: Path) -> None:
    images, capture = setup_capture(tmp_path, 40, visible=True)
    found = detect_wall_overlap(images, capture, tmp_path)
    assert len(found) == 1
    assert found[0].detector == "roof_overlap"
    assert any(m.name == "measurement_frame" for m in found[0].metrics)


def test_hidden_person_state_alone_is_not_a_defect(tmp_path: Path) -> None:
    images, capture = setup_capture(tmp_path, 40, visible=False)
    assert not detect_wall_overlap(images, capture, tmp_path)


def test_person_walking_on_ground_in_front_of_wall_is_not_defect(tmp_path: Path) -> None:
    images, capture = setup_capture(tmp_path, 65, visible=True)
    assert not detect_wall_overlap(images, capture, tmp_path)


def test_unavailable_wall_sprite_abstains(tmp_path: Path) -> None:
    images, capture = setup_capture(tmp_path, 40, visible=True)
    assert not detect_wall_overlap(images, capture, tmp_path / "missing")
