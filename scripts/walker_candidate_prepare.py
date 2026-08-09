from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Final

from PIL import Image

from walker_candidate_comfy import DEFAULT_OUTPUT_ROOT
from walker_candidate_contract import (
    JOBS,
    SPRITE_SIZE,
    JsonValue,
    dry_run_manifest,
    job_record,
    source_path,
)

DEFAULT_PREPARED_ROOT: Final = Path(os.environ.get("WALKER_PREPARED_OUTPUT_ROOT", "/tmp/feudal-phase13-walker-prepared"))


def rgba_with_background_key(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    keyed = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    keyed_pixels = []
    for red, green, blue, alpha in rgba.get_flattened_data():
        is_key = alpha == 0 or (red <= 8 and green >= 247 and blue >= 247)
        keyed_pixels.append((red, green, blue, 0 if is_key else alpha))
    keyed.putdata(keyed_pixels)
    return keyed


def prepare_candidate(source: Path, destination: Path) -> dict[str, JsonValue]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        keyed = rgba_with_background_key(image)
        bbox = keyed.getbbox()
        canvas = Image.new("RGBA", SPRITE_SIZE, (0, 0, 0, 0))
        if bbox is not None:
            sprite = keyed.crop(bbox)
            sprite.thumbnail(SPRITE_SIZE, Image.Resampling.LANCZOS)
            x = (SPRITE_SIZE[0] - sprite.width) // 2
            y = SPRITE_SIZE[1] - sprite.height
            canvas.alpha_composite(sprite, (x, y))
        canvas.save(destination)
    return {"size": [SPRITE_SIZE[0], SPRITE_SIZE[1]], "backgroundPolicy": "alpha-or-cyan-key"}


def prepare(source_root: Path = DEFAULT_OUTPUT_ROOT, output_root: Path = DEFAULT_PREPARED_ROOT) -> dict[str, JsonValue]:
    output_root.mkdir(parents=True, exist_ok=True)
    sprites: list[dict[str, JsonValue]] = []
    for job in JOBS:
        relative = source_path(job)
        source = source_root / relative
        if not source.is_file():
            continue
        destination = output_root / relative
        record = job_record(job)
        record.update(prepare_candidate(source, destination))
        record["sourcePath"] = relative.as_posix()
        record["preparedPath"] = relative.as_posix()
        sprites.append(record)
    manifest: dict[str, JsonValue] = {
        "summary": {"catalogJobs": len(JOBS), "preparedJobs": len(sprites)},
        "settings": dry_run_manifest()["settings"],
        "sprites": sprites,
    }
    (output_root / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest
