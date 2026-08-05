#!/usr/bin/env python3
# noqa: SIZE_OK -- the evidence layout and its exact asset table form one audit boundary.
from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Final, TypeAlias

from PIL import Image, ImageDraw

JsonValue: TypeAlias = str | int | float | bool | None | list["JsonValue"] | dict[str, "JsonValue"]

OUTPUT_NAMES: Final = {
    "family": "asset_family_sheet.png",
    "village": "village_composite.png",
    "ledger": "phase4c_placement_ledger.json",
}
ASSET_GROUPS: Final = {
    "buildings": (
        "house_l0", "house_l1", "house_l2", "house_l3", "mill", "barn", "well",
        "storehouse", "wheat_farm", "logging_camp", "sawmill",
    ),
    "foliage": (
        "tree_conifer_a", "tree_conifer_b", "tree_broadleaf_a", "tree_broadleaf_b",
        "shrub_a", "shrub_b",
    ),
    "terrain": ("grass", "forest_floor", "water", "rock", "packed_earth_road"),
}
ASSET_SIZES: Final = {
    "house_l0": (96, 112), "house_l1": (96, 120), "house_l2": (96, 144),
    "house_l3": (160, 192), "mill": (96, 160), "barn": (160, 144), "well": (72, 80),
    "storehouse": (160, 136), "wheat_farm": (160, 96), "logging_camp": (96, 104),
    "sawmill": (112, 112), "tree_conifer_a": (64, 96), "tree_conifer_b": (56, 80),
    "tree_broadleaf_a": (72, 88), "tree_broadleaf_b": (64, 72), "shrub_a": (40, 36),
    "shrub_b": (32, 28), "grass": (256, 256), "forest_floor": (256, 256),
    "water": (256, 256), "rock": (256, 256), "packed_earth_road": (256, 256),
}
REQUIRED_VILLAGE_OCCUPANTS: Final = (
    "house_l0", "house_l1", "house_l2", "house_l3", "mill", "barn", "storehouse",
    "well", "wheat_farm", "tree_conifer_a", "tree_broadleaf_a",
)
PACKED_BUILDING_ORDER: Final = (
    "house_l0", "house_l1", "house_l2", "house_l3", "mill", "barn", "storehouse",
    "well", "wheat_farm",
)
ADJACENCY_GAP: Final = 4
NEUTRAL: Final = (112, 110, 104)


@dataclass(frozen=True, slots=True)
class Placement:
    key: str
    category: str
    anchor: tuple[int, int]
    canvasBounds: tuple[int, int, int, int]
    opaqueBounds: tuple[int, int, int, int]


@dataclass(frozen=True, slots=True)
class EvidenceContractError(Exception):
    detail: str

    def __str__(self) -> str:
        return self.detail


def load_asset(asset_root: Path, category: str, key: str) -> Image.Image:
    path = asset_root / category / f"{key}.png"
    with Image.open(path) as source:
        image = source.convert("RGBA")
    expected = ASSET_SIZES[key]
    if image.size != expected:
        raise EvidenceContractError(
            f"{key} must be {expected[0]}x{expected[1]}, got {image.width}x{image.height}",
        )
    return image


def tile_2x2(image: Image.Image) -> Image.Image:
    tiled = Image.new("RGBA", (image.width * 2, image.height * 2))
    for y in (0, image.height):
        for x in (0, image.width):
            tiled.paste(image, (x, y))
    return tiled


def build_family_sheet(asset_root: Path, output: Path) -> list[dict[str, JsonValue]]:
    margin, gap, label_h = 24, 16, 20
    terrain_width = len(ASSET_GROUPS["terrain"]) * 512 + 4 * gap
    row_heights = (192, 96, 512)
    sheet_height = 36 + sum(label_h + height + label_h + 30 for height in row_heights)
    sheet = Image.new("RGB", (terrain_width + margin * 2, sheet_height), NEUTRAL)
    draw = ImageDraw.Draw(sheet)
    entries: list[dict[str, JsonValue]] = []
    y = 36
    for category in ("buildings", "foliage", "terrain"):
        draw.text((margin, y), category.upper(), fill=(242, 236, 217))
        y += label_h
        x = margin
        row_height = 0
        for key in ASSET_GROUPS[category]:
            source = load_asset(asset_root, category, key)
            rendered = tile_2x2(source) if category == "terrain" else source
            sheet.paste(rendered, (x, y), rendered)
            draw.text((x, y + rendered.height + 3), key, fill=(242, 236, 217))
            entry: dict[str, JsonValue] = {
                "key": key,
                "category": category,
                "sourceSize": list(source.size),
                "renderedSize": list(rendered.size),
                "bounds": [x, y, rendered.width, rendered.height],
            }
            if category == "terrain":
                entry["tileGrid"] = [2, 2]
            entries.append(entry)
            x += rendered.width + gap
            row_height = max(row_height, rendered.height)
        y += row_height + label_h + 30
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.crop((0, 0, sheet.width, y)).save(output)
    return entries


def packed_placements(asset_root: Path, canvas: tuple[int, int]) -> tuple[list[Placement], list[dict[str, JsonValue]]]:
    images = {key: load_asset(asset_root, "buildings", key) for key in PACKED_BUILDING_ORDER}
    alpha_bounds: dict[str, tuple[int, int, int, int]] = {}
    for key, image in images.items():
        bounds = image.getchannel("A").getbbox()
        if bounds is None:
            raise EvidenceContractError(f"{key} has no visible pixels")
        alpha_bounds[key] = bounds
    opaque_width = sum(bounds[2] - bounds[0] for bounds in alpha_bounds.values())
    packed_width = opaque_width + ADJACENCY_GAP * (len(PACKED_BUILDING_ORDER) - 1)
    if packed_width + 80 > canvas[0]:
        raise EvidenceContractError("terrain screenshot is too narrow for the packed village")
    cursor = (canvas[0] - packed_width) // 2
    baseline = min(canvas[1] - 70, int(canvas[1] * 0.72))
    placements: list[Placement] = []
    adjacency: list[dict[str, JsonValue]] = []
    previous_key: str | None = None
    previous_right = 0
    for key in PACKED_BUILDING_ORDER:
        image = images[key]
        left, top, right, bottom = alpha_bounds[key]
        paste_x, paste_y = cursor - left, baseline - image.height
        opaque = (cursor, paste_y + top, cursor + right - left, paste_y + bottom)
        placement = Placement(
            key, "buildings", (paste_x + image.width // 2, baseline),
            (paste_x, paste_y, image.width, image.height), opaque,
        )
        placements.append(placement)
        if previous_key is not None:
            adjacency.append({"left": previous_key, "right": key, "opaqueGap": opaque[0] - previous_right})
        previous_key, previous_right = key, opaque[2]
        cursor = opaque[2] + ADJACENCY_GAP
    return placements, adjacency


def build_village(asset_root: Path, terrain_path: Path, output: Path) -> dict[str, JsonValue]:
    if not terrain_path.is_file():
        raise FileNotFoundError(terrain_path)
    with Image.open(terrain_path) as terrain_source:
        terrain = terrain_source.convert("RGB")
    image = terrain.convert("RGBA")
    placements, adjacency = packed_placements(asset_root, terrain.size)
    secondary = (("logging_camp", 0.38), ("sawmill", 0.62))
    for key, fraction in secondary:
        sprite = load_asset(asset_root, "buildings", key)
        anchor = (int(image.width * fraction), int(image.height * 0.42))
        bounds = (anchor[0] - sprite.width // 2, anchor[1] - sprite.height, sprite.width, sprite.height)
        alpha = sprite.getchannel("A").getbbox()
        if alpha is None:
            raise EvidenceContractError(f"{key} has no visible pixels")
        placements.append(Placement(key, "buildings", anchor, bounds, (
            bounds[0] + alpha[0], bounds[1] + alpha[1], bounds[0] + alpha[2], bounds[1] + alpha[3],
        )))
    foliage_positions = ((70, 0.66), (130, 0.72), (image.width - 130, 0.70),
                         (image.width - 70, 0.64), (190, 0.76), (image.width - 190, 0.76))
    for key, (anchor_x, fraction) in zip(ASSET_GROUPS["foliage"], foliage_positions, strict=True):
        sprite = load_asset(asset_root, "foliage", key)
        anchor = (anchor_x, int(image.height * fraction))
        bounds = (anchor_x - sprite.width // 2, anchor[1] - sprite.height, sprite.width, sprite.height)
        alpha = sprite.getchannel("A").getbbox()
        if alpha is None:
            raise EvidenceContractError(f"{key} has no visible pixels")
        placements.append(Placement(key, "foliage", anchor, bounds, (
            bounds[0] + alpha[0], bounds[1] + alpha[1], bounds[0] + alpha[2], bounds[1] + alpha[3],
        )))
    for placement in sorted(placements, key=lambda item: item.anchor[1]):
        sprite = load_asset(asset_root, placement.category, placement.key)
        image.alpha_composite(sprite, (placement.canvasBounds[0], placement.canvasBounds[1]))
    output.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(output)
    return {
        "canvas": list(image.size),
        "terrainSource": {
            "name": terrain_path.name,
            "size": list(terrain.size),
            "sha256": hashlib.sha256(terrain_path.read_bytes()).hexdigest(),
        },
        "placements": [
            {
                "key": placement.key,
                "category": placement.category,
                "anchor": list(placement.anchor),
                "canvasBounds": list(placement.canvasBounds),
                "opaqueBounds": list(placement.opaqueBounds),
            }
            for placement in placements
        ],
        "adjacency": adjacency,
    }


def build_evidence(asset_root: Path, terrain_path: Path, output_root: Path) -> dict[str, JsonValue]:
    output_root.mkdir(parents=True, exist_ok=True)
    family = build_family_sheet(asset_root, output_root / OUTPUT_NAMES["family"])
    village = build_village(asset_root, terrain_path, output_root / OUTPUT_NAMES["village"])
    ledger: dict[str, JsonValue] = {
        "outputs": OUTPUT_NAMES,
        "family": family,
        "village": village,
    }
    (output_root / OUTPUT_NAMES["ledger"]).write_text(
        json.dumps(ledger, indent=2, sort_keys=True) + "\n", encoding="utf-8",
    )
    return ledger


def main() -> None:
    parser = argparse.ArgumentParser(description="Build auditable Phase 4C visual evidence")
    parser.add_argument("--asset-root", type=Path, required=True)
    parser.add_argument("--terrain", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    build_evidence(args.asset_root, args.terrain, args.output_dir)


if __name__ == "__main__":
    main()
