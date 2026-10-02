# /// script
# requires-python = ">=3.12"
# dependencies = ["pydantic"]
# ///
# Run with existing tool venv and PYTHONPATH=report/holdout/frozen-tool.
"""Validate 15 primary raw sequences and preserve compressed draw metadata."""

import gzip
import hashlib
import json
from pathlib import Path
from typing import TypedDict

from vision_check.contracts import Capture

ROOT = Path("/Users/rexxa/fls-astra-vision/report/holdout/new")
NAMES = (
    *(
        f"holdout-{land}-s{seed}-summer"
        for seed in (3, 4, 5)
        for land in ("coast", "chalk", "forest", "fen")
    ),
    "holdout-river-s1-year1301",
    "holdout-city-year1407-confirm",
    "holdout-city-year1362-confirm",
)


class DatasetEntry(TypedDict):
    """Typed dataset row without detector predictions."""

    scene: str
    seed: int
    terrain: str
    first_tick: int
    last_tick: int
    calendar_year_from_campaign1300: int
    season_index: int
    camera: dict[str, float]
    frames: int
    gap_ms: int
    capture_sha256: str
    png_sha256: dict[str, str]


def main() -> None:
    """Fail closed for missing, malformed, nonmonotonic or proof sequences."""
    entries: list[DatasetEntry] = []
    metadata = ROOT / "metadata"
    metadata.mkdir(exist_ok=True)
    for name in NAMES:
        folder = ROOT / "raw" / name
        payload = (folder / "capture.json").read_bytes()
        cap = Capture.model_validate_json(payload)
        ticks = [frame.tick for frame in cap.frames]
        if (
            cap.id != name
            or any(frame.proof for frame in cap.frames)
            or ticks != sorted(ticks)
            or ticks[-1] <= ticks[0]
            or any(frame.elapsed_ms != index * 600 for index, frame in enumerate(cap.frames))
        ):
            message = f"Invalid native 600ms scene: {name}"
            raise RuntimeError(message)
        (metadata / f"{name}.capture.json.gz").write_bytes(gzip.compress(payload, mtime=0))
        for source_name in ("provenance.json", "replay.json"):
            source = folder / source_name
            if not source.exists() and name.endswith("-confirm"):
                source = ROOT / "raw" / name.removesuffix("-confirm") / source_name
            if source.exists():
                (metadata / f"{name}.{source_name}").write_bytes(source.read_bytes())
        entries.append(
            {
                "scene": name,
                "seed": cap.seed,
                "terrain": cap.terrain,
                "first_tick": ticks[0],
                "last_tick": ticks[-1],
                "calendar_year_from_campaign1300": 1300 + ticks[0] // 4000,
                "season_index": (ticks[0] % 4000) // 1000,
                "camera": cap.frames[0].camera.model_dump(),
                "frames": 20,
                "gap_ms": 600,
                "capture_sha256": hashlib.sha256(payload).hexdigest(),
                "png_sha256": {
                    Path(frame.image).name: hashlib.sha256(
                        (ROOT / frame.image).read_bytes()
                    ).hexdigest()
                    for frame in cap.frames
                },
            }
        )
    result = {
        "scenes": entries,
        "primary_count": len(entries),
        "source_commit": "d6ae15498a45c2202a10f3ce8f20a543dd305c3f",
        "calendar_source": "scenarioState.ts:67; coreScenarios.ts campaign startYear1300",
        "new_seed_coverage": "12 scenes: 3 seeds x 4 selectable nonriver lands",
        "river_limitation": "native UI locks seed1; river1301 temporal-only same map",
        "city_extra_sequences": "initial100ms context only; benchmark uses confirm600ms",
    }
    (ROOT / "capture-dataset.json").write_text(json.dumps(result, indent=2))
    print(f"VERIFIED {len(entries)} primary scenes, {len(entries) * 20} PNGs")  # noqa: T201


if __name__ == "__main__":
    main()
