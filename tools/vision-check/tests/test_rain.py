"""Rain inference rejects static highlights, snow, occluded sprites and short capture."""

import cv2
import numpy as np

from vision_check.rain import Pixels, detect_rain, rain_mask


def falling_frames(*, round_flakes: bool = False, stationary: bool = False) -> list[Pixels]:
    frames: list[Pixels] = []
    for index in range(20):
        frame: Pixels = np.full((180, 180, 3), (70, 85, 60), dtype=np.uint8)
        for x, base_y in ((30, 15), (80, 30), (140, 45)):
            y = base_y + (0 if stationary else index * 4)
            if round_flakes:
                cv2.circle(frame, (x, y), 3, (220, 225, 230), -1)
            else:
                cv2.line(frame, (x, y), (x + 1, y + 12), (220, 225, 230), 1)
        frames.append(frame)
    return frames


def test_temporal_falling_streaks_are_detected_in_first_frame() -> None:
    evidence = detect_rain(falling_frames())
    assert evidence.falling_tracks == 3
    assert np.count_nonzero(evidence.mask) > 0
    assert evidence.mask[20, 30] > 0
    assert not np.any(evidence.mask[150:])


def test_stationary_highlights_and_round_snow_abstain() -> None:
    assert not np.any(rain_mask(falling_frames(stationary=True)))
    assert not np.any(rain_mask(falling_frames(round_flakes=True)))


def test_sprite_exclusion_and_insufficient_frames_abstain() -> None:
    frames = falling_frames()
    mask: Pixels = np.full((180, 180), 255, dtype=np.uint8)
    assert not np.any(rain_mask(frames, mask))
    assert not np.any(rain_mask(frames[:10]))


def test_horizontal_moving_bright_shapes_are_not_rain() -> None:
    frames: list[Pixels] = []
    for index in range(20):
        frame: Pixels = np.full((180, 180, 3), 70, dtype=np.uint8)
        for x, y in ((20, 20), (40, 70), (60, 120)):
            cv2.line(frame, (x + index * 4, y), (x + index * 4, y + 12), (220, 225, 230), 1)
        frames.append(frame)
    assert not np.any(rain_mask(frames))
