#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow>=10"]
# ///
# ─── How to run ───
# Use the already-installed Pillow; no installation is required.
# python3 records/tools/compose_city.py [artifact-root] [--background-only]
# Optional SOURCE_ROOT environment variable selects the read-only source checkout.
# ──────────────────
"""Fixed-layout static proof composite; never an engine screenshot or asset editor."""
from __future__ import annotations

import csv
import hashlib
import json
import os
from pathlib import Path
import random
import shutil
import sys
from dataclasses import dataclass
from typing import Final

from PIL import Image, ImageDraw

SIZE: Final = (1280, 800)
SOURCE: Final = Path(os.environ.get("SOURCE_ROOT", "/Users/rexxa/fls-astra-landmarks"))
ANCHORS: Final = {"church": (315, 320), "market": (605, 465), "gate": (1075, 580),
                 "bridge": (1010, 300), "manor": (670, 220),
                 "guildhall": (325, 650), "inn": (575, 680)}
STAGES: Final = {"church": 4, "market": 3, "gate": 3, "bridge": 3,
                "manor": 3, "guildhall": 3, "inn": 3}
SOURCES: Final = {
    "grass": "terrain/grass.png", "winter": "wave15/terrain/grass_winter_fill-v1.png",
    "road": "terrain/packed_earth_road.png",
    "water": "complete-art-v1/water-bridges/water_surface-v1.png",
    "house": "wave26/house/house_l1_c.png",
    "snow": "wave26/house/house_l1_c_snow.png",
    "walker": "walkers-v2/wk_labor_m_01-v1.png",
}
HOUSES: Final = ((140, 230), (110, 110), (430, 95), (480, 155), (825, 95),
                 (1170, 160), (150, 425), (240, 410), (390, 430), (455, 395),
                 (800, 405), (885, 450), (135, 620), (195, 580), (500, 630),
                 (100, 720), (1180, 450), (1110, 735), (1200, 700))
PEOPLE: Final = ((450, 340), (480, 360), (450, 475), (780, 460), (780, 490),
                (450, 735), (885, 515), (490, 660), (350, 680), (1000, 610),
                (180, 280), (700, 320), (825, 295), (1185, 575))


@dataclass(frozen=True, slots=True)
class Asset:
    """Validated manifest entry with source-pixel registration and world scale."""
    path: Path
    family: str
    stage: int
    season: str
    width: int
    height: int
    pivot: tuple[float, float]
    scale: float


def read_manifest(path: Path) -> tuple[Asset, ...]:
    """Reject incomplete, duplicated, unsafe, or dimension-inconsistent inputs."""
    result: list[Asset] = []
    with path.open(newline="", encoding="utf-8-sig") as stream:
        for row in csv.DictReader(stream):
            raw_stage = row["stage"]
            stage = int(raw_stage.lstrip("CMGBLUI"))
            item = Asset((path.parent / row["filename"]).resolve(), row["family"],
                         stage, row["season"], int(row["canvas_width"]),
                         int(row["canvas_height"]),
                         (float(row["pivot_x"]), float(row["pivot_y"])),
                         float(row["world_scale"]))
            if item.family not in STAGES or item.season not in ("summer", "winter"):
                raise RuntimeError(f"Unsupported family/season: {item}")
            if not 1 <= item.stage <= STAGES[item.family] or not 0 < item.scale <= 1:
                raise RuntimeError(f"Invalid stage/scale: {item}")
            if not (0 <= item.pivot[0] <= item.width and 0 <= item.pivot[1] <= item.height):
                raise RuntimeError(f"Pivot outside canvas: {item}")
            with Image.open(item.path) as source:
                if source.size != (item.width, item.height) or source.mode != "RGBA":
                    raise RuntimeError(f"Canvas/mode mismatch: {item.path}")
            result.append(item)
    expected = {(f, s, season) for f, n in STAGES.items()
                for s in range(1, n + 1) for season in ("summer", "winter")}
    if len(result) != 44 or {(a.family, a.stage, a.season) for a in result} != expected:
        raise RuntimeError("Manifest must contain each of 44 family-stage-season entries once")
    for family in STAGES:
        registered = {(a.width, a.height, a.pivot, a.scale) for a in result if a.family == family}
        if len(registered) != 1:
            raise RuntimeError(f"Family canvas/pivot/scale changed: {family}")
    return tuple(result)


def load_reference(root: Path, key: str) -> Image.Image:
    """Use byte-identical local copies, retaining a package-local replay path."""
    destination = root / "references" / f"city-{key}.png"
    if not destination.exists():
        shutil.copyfile(SOURCE / "public/assets" / SOURCES[key], destination)
    with Image.open(destination) as source:
        return source.convert("RGBA")


def texture_fill(texture: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", SIZE)
    for y in range(0, SIZE[1], texture.height):
        for x in range(0, SIZE[0], texture.width):
            canvas.alpha_composite(texture, (x, y))
    return canvas


def sprite_at_height(sprite: Image.Image, height: float) -> Image.Image:
    """Preserve whole reference canvas; scale from opaque height, never stretch."""
    bbox = sprite.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError("Empty reference sprite")
    scale = height / (bbox[3] - bbox[1])
    return sprite.resize((round(sprite.width * scale), round(sprite.height * scale)),
                         Image.Resampling.LANCZOS)


def background(root: Path, season: str) -> Image.Image:
    """Only terrain masks/road layout are geometric; all visual textures are owned PNGs."""
    canvas = texture_fill(load_reference(root, {"summer": "grass", "winter": "winter"}[season]))
    mask = Image.new("L", SIZE)
    drawing = ImageDraw.Draw(mask)
    for points in (((80, 270), (650, 490), (870, 555)),
                   ((130, 660), (625, 485), (1020, 290)),
                   ((300, 320), (605, 465), (575, 680)),
                   ((1050, 300), (1100, 450), (1075, 580), (1210, 640)),
                   ((670, 220), (605, 465), (325, 650))):
        drawing.line(points, fill=255, width=27, joint="curve")
    drawing.ellipse((535, 405, 680, 485), fill=255)
    canvas.paste(texture_fill(load_reference(root, "road")), (0, 0), mask)
    river = Image.new("L", SIZE)
    ImageDraw.Draw(river).polygon(((1065, 0), (1120, 0), (920, 800), (865, 800)), fill=255)
    canvas.paste(texture_fill(load_reference(root, "water")), (0, 0), river)
    house = load_reference(root, "house")
    if season == "winter":
        house.alpha_composite(load_reference(root, "snow"))
    house = sprite_at_height(house, 56.32)
    for x, y in HOUSES:
        canvas.alpha_composite(house, (x - house.width // 2, y - house.height))
    sheet = load_reference(root, "walker")
    # The source is a project-owned 4-column x 2-row animation sheet, not generated candidate art.
    person = sprite_at_height(sheet.crop((0, 0, sheet.width // 4, sheet.height // 2)), 17.6)
    for x, y in PEOPLE:
        canvas.alpha_composite(person, (x - person.width // 2, y - person.height))
    return canvas


def place_landmark(canvas: Image.Image, asset: Asset) -> None:
    """Resample the entire RGBA canvas once, keeping the manifest pivot invariant."""
    with Image.open(asset.path) as source:
        sprite = source.resize((round(asset.width * asset.scale), round(asset.height * asset.scale)),
                               Image.Resampling.LANCZOS)
    x, y = ANCHORS[asset.family]
    position = (round(x - asset.pivot[0] * asset.scale), round(y - asset.pivot[1] * asset.scale))
    bbox = sprite.getchannel("A").getbbox()
    if bbox is None or not (0 <= position[0] + bbox[0] < position[0] + bbox[2] <= SIZE[0]
                            and 0 <= position[1] + bbox[1] < position[1] + bbox[3] <= SIZE[1]):
        raise RuntimeError(f"Empty/clipped landmark: {asset.path}")
    canvas.alpha_composite(sprite, position)


def identity_boards(root: Path, assets: tuple[Asset, ...]) -> None:
    """Show each registered family at CSV scale, plus an exact 2x reading aid."""
    destination = root / "proofs/identity"
    destination.mkdir(exist_ok=True)
    for family, count in STAGES.items():
        sprites: dict[tuple[int, str], Image.Image] = {}
        bounds: list[tuple[int, int, int, int]] = []
        for asset in (a for a in assets if a.family == family):
            with Image.open(asset.path) as source:
                sprite = source.resize((round(asset.width * asset.scale), round(asset.height * asset.scale)),
                                       Image.Resampling.LANCZOS)
            bbox = sprite.getchannel("A").getbbox()
            if bbox is None:
                raise RuntimeError(f"Empty identity sprite: {asset.path}")
            sprites[(asset.stage, asset.season)] = sprite
            bounds.append(bbox)
        union = (min(b[0] for b in bounds), min(b[1] for b in bounds),
                 max(b[2] for b in bounds), max(b[3] for b in bounds))
        if union[2] - union[0] > 450 or union[3] - union[1] > 300:
            raise RuntimeError(f"Identity window exceeded without rescaling: {family} {union}")
        offset = (225 - (union[0] + union[2]) // 2, 150 - (union[1] + union[3]) // 2)
        for season in ("summer", "winter"):
            board = Image.new("RGB", (900 * count, 936), (104, 117, 105))
            labels = ImageDraw.Draw(board)
            for stage in range(1, count + 1):
                cell = Image.new("RGBA", (450, 300), (104, 117, 105, 255))
                cell.alpha_composite(sprites[(stage, season)], offset)
                x = (stage - 1) * 900
                board.paste(cell.convert("RGB"), (x + 225, 24))
                board.paste(cell.resize((900, 600), Image.Resampling.LANCZOS).convert("RGB"), (x, 336))
                labels.text((x + 230, 7), f"S{stage} | world scale | 2x detail below", fill=(240, 240, 226))
            board.save(destination / f"{family}_{season}.png")


def main() -> None:
    roots = [arg for arg in sys.argv[1:] if arg != "--background-only"]
    root = Path(roots[0]) if roots else Path(__file__).resolve().parents[2]
    (root / "references").mkdir(exist_ok=True)
    (root / "proofs").mkdir(exist_ok=True)
    backgrounds = {season: background(root, season) for season in ("summer", "winter")}
    for season, canvas in backgrounds.items():
        canvas.save(root / "references" / f"city-background-{season}.png")
    provenance = {key: {"source": f"public/assets/{relative}",
                       "sha256": hashlib.sha256((root / "references" / f"city-{key}.png").read_bytes()).hexdigest()}
                  for key, relative in SOURCES.items() if (root / "references" / f"city-{key}.png").exists()}
    (root / "references/city-layout.json").write_text(json.dumps(
        {"kind": "static_composite_not_engine_capture", "canvas": SIZE, "anchors": ANCHORS,
         "houses": HOUSES, "people": PEOPLE, "adult_world_height": 17.6,
         "house_opaque_world_height": 56.32, "sources": provenance}, indent=2) + "\n")
    if "--background-only" in sys.argv:
        return
    assets = read_manifest(root / "assets/manifest.csv")
    identity_boards(root, assets)
    renders: list[tuple[Path, int, str, float]] = []
    for season, base in backgrounds.items():
        for year in (1300, 1380, 1450):
            canvas = base.copy()
            selected = {family: {1300: 1, 1380: 3 if family == "church" else 2,
                                 1450: maximum}[year] for family, maximum in STAGES.items()}
            for asset in sorted(assets, key=lambda a: ANCHORS[a.family][1]):
                if asset.season == season and asset.stage == selected[asset.family]:
                    place_landmark(canvas, asset)
            for zoom in (1.0, 0.6):
                size = (round(SIZE[0] * zoom), round(SIZE[1] * zoom))
                framed = Image.new("RGBA", SIZE, (48, 47, 43, 255))
                framed.alpha_composite(canvas.resize(size, Image.Resampling.LANCZOS),
                                       ((SIZE[0] - size[0]) // 2, (SIZE[1] - size[1]) // 2))
                path = root / "proofs" / f"city-{year}-{season}-zoom-{zoom:.1f}.png"
                framed.convert("RGB").save(path)
                renders.append((path, year, season, zoom))
    random.SystemRandom().shuffle(renders)
    blind = root / "proofs/blind"
    blind.mkdir(exist_ok=True)
    with (root / "proofs/answer-key.csv").open("w", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(("id", "year", "season", "zoom", "source"))
        for index, (path, year, season, zoom) in enumerate(renders, 1):
            identifier = f"R{index:02d}"
            shutil.copyfile(path, blind / f"{identifier}.png")
            writer.writerow((identifier, year, season, zoom, path.name))
    print("12 static composites and 12 blinded copies written; answer-key.csv must remain hidden.")


if __name__ == "__main__":
    main()
