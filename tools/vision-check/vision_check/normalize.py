"""Match native NPC IDs to captured actor draws without claiming visibility from state."""

from __future__ import annotations

from math import hypot
from typing import TYPE_CHECKING

import cv2
import numpy as np

if TYPE_CHECKING:
    from pathlib import Path

    from numpy.typing import NDArray

    from .contracts import Capture, Reading
from .masks import SceneMasks, build_masks, sprite_key
from .models import Draw, Frame, Scene

MIN_ADVANCING_TICKS = 18


def person_draws(reading: Reading) -> tuple[tuple[Draw, ...], dict[str, str]]:
    """Nearest-foot assignment, bounded to actor-sheet draws and one-to-one matches."""
    draws = [draw.model_copy(update={"asset": sprite_key(draw)}) for draw in reading.draws]
    actors = [
        i for i, d in enumerate(draws) if "/walkers-v2/" in d.asset or "/workers/wk_" in d.asset
    ]
    aliases: dict[str, str] = {}
    for person in reading.people:
        if not actors:
            break

        def distance(i: int, foot_x: float = person.foot.x, foot_y: float = person.foot.y) -> float:
            box = draws[i].box
            return hypot(box.x + box.width / 2 - foot_x, box.y + box.height - foot_y)

        nearest = min(actors, key=distance)
        if distance(nearest) > max(8, 12 * reading.camera.zoom):
            continue
        asset = "person:" + person.id
        aliases[asset] = draws[nearest].asset
        draws[nearest] = draws[nearest].model_copy(update={"asset": asset})
        actors.remove(nearest)
    return tuple(draws), aliases


def normalized(capture: Capture, public: Path) -> tuple[Scene, SceneMasks, frozenset[str]]:
    """Build reproducible mask and tracking inputs from the raw observation."""
    first = capture.frames[0]
    frames: list[Frame] = []
    aliases: dict[str, str] = {}
    for reading in capture.frames:
        draws, matches = person_draws(reading)
        if reading.index == 0:
            aliases = matches
        frames.append(
            Frame(
                image=reading.image,
                index=reading.index,
                elapsed_ms=reading.elapsed_ms,
                tick=reading.tick,
                draws=draws,
            )
        )
    scene = Scene(
        id=capture.id,
        terrain=capture.terrain,
        season=capture.season,
        seed=capture.seed,
        zoom=first.camera.zoom,
        camera=(first.camera.panX, first.camera.panY),
        viewport=(first.viewport.width, first.viewport.height),
        tile_width=64,
        frames=tuple(frames),
        cohort="holdout" if capture.cohort == "holdout" else "calibration",
        qa_text=capture.qa_text,
        valid_motion=capture.frames[-1].tick - first.tick >= MIN_ADVANCING_TICKS,
        capture_notes=capture.capture_notes,
    )
    raw_scene = scene.model_copy(
        update={
            "frames": (
                frames[0].model_copy(
                    update={
                        "draws": tuple(
                            d.model_copy(update={"asset": sprite_key(d)}) for d in first.draws
                        )
                    }
                ),
            )
        }
    )

    def screen(tx: float, ty: float) -> tuple[int, int]:
        return (
            round((tx - ty) * 32 * scene.zoom + scene.camera[0]),
            round((tx + ty) * 16 * scene.zoom + scene.camera[1]),
        )

    roads = [
        tuple(
            screen(t.tx + dx, t.ty + dy)
            for dx, dy in ((0, -0.75), (0.75, 0), (0, 0.75), (-0.75, 0))
        )
        for t in first.tiles
        if t.road
    ]
    masks = build_masks(raw_scene, public, roads)
    for alias, original in aliases.items():
        if original in masks.alpha:
            masks.alpha[alias] = masks.alpha[original]
    world: NDArray[np.uint8] = np.zeros_like(masks.ground)
    cv2.fillPoly(
        world,
        [np.asarray([screen(0, 0), screen(64, 0), screen(64, 64), screen(0, 64)], dtype=np.int32)],
        255,
    )
    world = np.asarray(cv2.erode(world, np.ones((31, 31), np.uint8)), dtype=np.uint8)
    masks.ground[world == 0] = 0
    eligible = {"person:" + p.id for p in first.people if p.pathRemaining > 1 and not p.cancelled}
    for reading in capture.frames[1:]:
        eligible.intersection_update(
            "person:" + p.id for p in reading.people if p.pathRemaining > 1 and not p.cancelled
        )
    return scene, masks, frozenset(eligible)
