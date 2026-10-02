# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow", "pydantic>=2"]
# ///

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Literal

from PIL import Image, ImageDraw
from pydantic import BaseModel, TypeAdapter

ROOT = Path(__file__).resolve().parents[1]


class Asset(BaseModel):
    id: str
    category: Literal["yard", "front", "street", "cargo"]


def bbox(image: Image.Image) -> tuple[int, int, int, int]:
    result = image.getchannel("A").point([255 if value > 8 else 0 for value in range(256)]).getbbox()
    if result is None:
        raise ValueError("Empty generated alpha")
    return result


def normalize(path: Path, category: str) -> dict[str, object]:
    image = Image.open(path).convert("RGBA")
    bounds = bbox(image)
    pair = path.with_name(path.name.replace("summer", "winter"))
    if "winter" in path.name:
        pair = path.with_name(path.name.replace("winter", "summer"))
    if category == "yard" and pair.exists() and pair != path:
        sibling = Image.open(pair).convert("RGBA")
        if sibling.size == image.size:
            other = bbox(sibling)
            bounds = (min(bounds[0], other[0]), min(bounds[1], other[1]),
                      max(bounds[2], other[2]), max(bounds[3], other[3]))
    settings = {"yard": ((256, 128), (232, 96), 104),
                "front": ((128, 96), (116, 86), 90),
                "street": ((128, 128), (112, 112), 120),
                "cargo": ((32, 32), (28, 28), 30)}
    canvas, limit, baseline = settings[category]
    crop = image.crop(bounds)
    factor = min(limit[0] / crop.width, limit[1] / crop.height)
    size = (max(1, round(crop.width * factor)), max(1, round(crop.height * factor)))
    sprite = crop.resize(size, Image.Resampling.LANCZOS)
    output = Image.new("RGBA", canvas)
    offset = ((canvas[0] - size[0]) // 2, baseline - size[1])
    output.alpha_composite(sprite, offset)
    alpha = output.getchannel("A")
    transparent = alpha.point([255] + [0] * 255)
    output.paste((0, 0, 0, 0), (0, 0), transparent)
    destination = ROOT / "assets" / category / path.name
    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination, optimize=True)
    return {"id": path.stem, "category": category, "path": str(destination.relative_to(ROOT)),
            "raw_size": image.size, "crop": bounds, "resize": size, "offset": offset,
            "canvas": canvas, "alpha_bbox": output.getbbox(), "mirror": False,
            "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}


def boards(records: list[dict[str, object]]) -> None:
    for category in ("yard", "front", "street", "cargo"):
        selected = [record for record in records if record["category"] == category]
        for start in range(0, len(selected), 16):
            page = selected[start:start + 16]
            board = Image.new("RGB", (1200, 720), "#c7bea7")
            draw = ImageDraw.Draw(board)
            for index, record in enumerate(page):
                x, y = (index % 4) * 300, (index // 4) * 180
                sprite = Image.open(ROOT / str(record["path"])).convert("RGBA")
                if category == "cargo":
                    sprite = sprite.resize((96, 96), Image.Resampling.NEAREST)
                board.paste(sprite, (x + (300 - sprite.width) // 2, y + 20), sprite)
                draw.text((x + 4, y + 156), str(record["id"]), fill="#211b17")
            board.save(ROOT / "working" / f"{category}-board-{start // 16 + 1}.jpg", quality=92)


def main() -> None:
    expected = TypeAdapter(list[Asset]).validate_json((ROOT / "provenance/EXPECTED_ASSETS.json").read_text())
    records: list[dict[str, object]] = []
    for asset in expected:
        path = ROOT / "working/raw" / f"{asset.id}.png"
        if path.exists():
            records.append(normalize(path, asset.category))
    _ = (ROOT / "provenance/normalization.json").write_text(json.dumps(records, indent=2) + "\n")
    boards(records)
    print(f"Normalized {len(records)}/{len(expected)} expected assets")


if __name__ == "__main__":
    main()
