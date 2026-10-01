#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow>=12", "pydantic>=2"]
# ///
# How to run: python3 records/export_assets.py (existing Pillow/Pydantic environment)
# Or: uv run records/export_assets.py
"""Normalize generated art without redrawing it; emit reproducible review evidence."""
from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path
from typing import Final

from PIL import Image, ImageDraw, ImageOps
from pydantic import BaseModel, ConfigDict, TypeAdapter

ROOT: Final = Path(__file__).resolve().parent.parent
THRESHOLD: Final = 16
BBox = tuple[int, int, int, int]


class Generation(BaseModel):
    """Parse only the generation fields consumed by this exporter."""
    model_config = ConfigDict(frozen=True, extra="ignore")
    id: str
    label: str
    raw_path: Path


class Metric(BaseModel):
    """One output file's structural and provenance evidence."""
    model_config = ConfigDict(frozen=True)
    id: str
    label: str
    status: str = "candidate"
    output: str
    width: int
    height: int
    mode: str
    raw_path: str
    raw_sha256: str
    output_sha256: str
    source_bbox_alpha_gt16: BBox
    output_bbox_alpha_gt16: BBox
    alpha_zero_pixels: int
    alpha_partial_pixels: int
    alpha_opaque_pixels: int
    minimum_clear_margin_px: int
    pivot_x: int
    pivot_y: int
    transform: str


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bbox(image: Image.Image) -> BBox:
    """Find visible content, ignoring nearly transparent generation flecks."""
    result = image.getchannel("A").point([0] * 17 + [255] * 239).getbbox()
    if result is None:
        raise RuntimeError(f"Empty visible image: {image.size}")
    return result


def sizes(asset_id: str) -> list[tuple[int, int]]:
    """Return the requested native export dimensions."""
    prefix = asset_id.split("_", 1)[0]
    options = {"trait": [(48, 48), (24, 24)], "map": [(96, 96)],
               "flag": [(64, 96)], "office": [(40, 40)],
               "alert": [(32, 32)], "health": [(32, 32)], "nav": [(40, 40)]}
    if asset_id == "map_region":
        return [(1600, 1000)]
    return options[prefix]


def normalize(source: Image.Image, asset_id: str, size: tuple[int, int]) -> Image.Image:
    """Trim, uniformly scale and pad only; no generated art is drawn here."""
    if asset_id == "map_region":
        return ImageOps.fit(source.convert("RGB"), size, Image.Resampling.LANCZOS)
    content = source.crop(bbox(source))
    width, height = size
    margin = max(3, round(min(size) * 0.07))
    scale = min((width - 2 * margin) / content.width,
                (height - 2 * margin) / content.height)
    if asset_id.startswith("map_"):
        scale = min(80 / content.width, 72 / content.height)
    if asset_id.startswith("flag_"):
        scale = min(48 / content.width, 86 / content.height)
    resized = content.resize((max(1, round(content.width * scale)),
                              max(1, round(content.height * scale))), Image.Resampling.LANCZOS)
    x, y = (width - resized.width) // 2, (height - resized.height) // 2
    if asset_id.startswith("map_"):
        y = 88 - resized.height
    if asset_id.startswith("flag_"):
        # Align the pole's bottom contact point; the cloth keeps its original aspect.
        alpha = resized.getchannel("A")
        bottom = alpha.crop((0, max(0, resized.height - 4), resized.width, resized.height))
        weights = [sum(value * count for value, count in enumerate(
            bottom.crop((i, 0, i + 1, bottom.height)).histogram()))
                   for i in range(bottom.width)]
        pole_x = round(sum(i * weight for i, weight in enumerate(weights)) / sum(weights))
        x, y = 14 - pole_x, 91 - resized.height
        if x < 2 or x + resized.width > width - 2:
            raise RuntimeError(f"Flag content cannot fit common pivot: {asset_id}")
    result = Image.new("RGBA", size)
    result.alpha_composite(resized, (x, y))
    return result


def export(generation: Generation) -> list[Metric]:
    """Export all requested native sizes for one generation."""
    with Image.open(generation.raw_path) as raw:
        source = raw.convert("RGBA")
    rows: list[Metric] = []
    for size in sizes(generation.id):
        result = normalize(source, generation.id, size)
        filename = f"{generation.id}_{size[0]}x{size[1]}.png"
        path = ROOT / "assets" / filename
        result.save(path, optimize=True)
        histogram = result.convert("RGBA").getchannel("A").histogram()
        content_bbox = bbox(result.convert("RGBA"))
        margin = min(content_bbox[0], content_bbox[1],
                     size[0] - content_bbox[2], size[1] - content_bbox[3])
        if generation.id != "map_region" and margin < 2:
            raise RuntimeError(f"Insufficient clear margin: {filename}: {margin}")
        pivot = (size[0] // 2, size[1] // 2)
        if generation.id.startswith("map_") and generation.id != "map_region":
            pivot = (48, 88)
        if generation.id.startswith("flag_"):
            pivot = (14, 90)
        rows.append(Metric(
            id=generation.id, label=generation.label, output=f"assets/{filename}",
            width=size[0], height=size[1], mode=result.mode,
            raw_path=str(generation.raw_path), raw_sha256=sha256(generation.raw_path),
            output_sha256=sha256(path), source_bbox_alpha_gt16=bbox(source),
            output_bbox_alpha_gt16=content_bbox, alpha_zero_pixels=histogram[0],
            alpha_partial_pixels=sum(histogram[1:255]), alpha_opaque_pixels=histogram[255],
            minimum_clear_margin_px=margin, pivot_x=pivot[0], pivot_y=pivot[1],
            transform="center aspect crop + LANCZOS resize" if generation.id == "map_region"
            else "alpha>16 bbox trim + uniform LANCZOS resize + transparent padding"))
    return rows


def proofs(rows: list[Metric]) -> None:
    """Compose inspection evidence at exactly 1x plus a labeled 2x comparison."""
    icons = [row for row in rows if row.id != "map_region"]
    maps = [row for row in rows if row.id == "map_region"]
    top = 1080 if maps else 60
    proof = Image.new("RGB", (1760, top + math.ceil(len(icons) / 4) * 220 + 40), "#efe4cb")
    draw = ImageDraw.Draw(proof)
    draw.text((20, 16), "CANDIDATE ASSETS | native 1x parchment + oak | comparison 2x | no runtime QA", fill="#32291e")
    if maps:
        with Image.open(ROOT / maps[0].output) as source:
            proof.paste(source, (80, 52))
        draw.text((20, 36), "map_region 1600x1000 EXACT 1x", fill="#32291e")
    for index, row in enumerate(icons):
        x, y = (index % 4) * 440, top + (index // 4) * 220
        draw.text((x + 12, y + 4), f"{row.id} {row.width}x{row.height}", fill="#32291e")
        draw.rectangle((x + 10, y + 26, x + 113, y + 147), fill="#e8d9b8")
        draw.rectangle((x + 120, y + 26, x + 223, y + 147), fill="#342a22")
        with Image.open(ROOT / row.output) as source:
            icon = source.convert("RGBA")
        proof.paste(icon, (x + 62 - row.width // 2, y + 86 - row.height // 2), icon)
        proof.paste(icon, (x + 172 - row.width // 2, y + 86 - row.height // 2), icon)
        enlarged = icon.resize((row.width * 2, row.height * 2), Image.Resampling.NEAREST)
        proof.paste(enlarged, (x + 226, y + 24), enlarged)
        draw.text((x + 16, y + 156), "1x / parchment", fill="#32291e")
        draw.text((x + 126, y + 156), "1x / dark oak", fill="#32291e")
        draw.text((x + 236, y + 202), "2x / NEAREST", fill="#32291e")
    proof.save(ROOT / "proofs/actual-size.png", optimize=True)
    proof.save(ROOT / "proofs/actual-size.jpg", quality=88, optimize=True, subsampling=0)


def main() -> None:
    """Read current records; never invent or duplicate missing generations."""
    generations = TypeAdapter(list[Generation]).validate_json((ROOT / "records/generations.json").read_text())
    ids = [generation.id for generation in generations]
    if len(set(ids)) != len(ids):
        raise RuntimeError("Duplicate generation IDs")
    (ROOT / "assets").mkdir(exist_ok=True)
    (ROOT / "proofs").mkdir(exist_ok=True)
    rows = [row for generation in generations for row in export(generation)]
    (ROOT / "records/asset-metrics.json").write_text(
        json.dumps([row.model_dump() for row in rows], ensure_ascii=False, indent=2) + "\n")
    with (ROOT / "assets.csv").open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(Metric.model_fields))
        writer.writeheader()
        writer.writerows(row.model_dump() for row in rows)
    proofs(rows)
    print(f"Exported {len(generations)} concepts -> {len(rows)} PNG files; proofs and metrics written.")


if __name__ == "__main__":
    main()
