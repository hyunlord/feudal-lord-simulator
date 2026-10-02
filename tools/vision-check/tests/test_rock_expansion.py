"""Frozen expansion real-capture regressions; local captures are optional artifacts."""

from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from vision_check.contracts import Capture
from vision_check.models import Thresholds
from vision_check.normalize import normalized
from vision_check.rock import detect_rock_cuts, detect_rock_seams


@pytest.mark.parametrize(
    "name",
    [
        "exp-main-coast",
        "exp-main-forest",
        pytest.param(
            "exp-main-fen",
            marks=pytest.mark.xfail(
                strict=True,
                reason="known occluded rock FN in frozen expansion truth",
            ),
        ),
    ],
)
def test_partly_hidden_small_rock_cut(name: str) -> None:
    root = Path(__file__).resolve().parents[3]
    base = root / "report/expansion"
    source = base / "raw" / name / "capture.json"
    if not source.exists():
        pytest.skip("optional real-capture calibration artifact absent")
    scene, masks, _ = normalized(Capture.model_validate_json(source.read_text()), root / "public")
    image = np.asarray(Image.open(base / scene.frames[0].image).convert("RGB"))
    assert detect_rock_cuts(image, scene, Thresholds(), masks.ground)
    assert detect_rock_seams(image, scene, Thresholds(), masks.ground)
