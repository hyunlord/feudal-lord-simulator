#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

SUBJECTS = ("house", "mill", "granary")
DEFAULT_PICKS = {"house": "house_03", "mill": "mill_02", "granary": "granary_08"}


def load_rgba(root: Path, name: str) -> Image.Image:
    return Image.open(root / f"{name}.png").convert("RGBA")


def remove_soft_outline(image: Image.Image) -> Image.Image:
    output = image.copy()
    pixels = output.load()
    for y in range(output.height):
        for x in range(output.width):
            r, g, b, a = pixels[x, y]
            if a == 179:
                pixels[x, y] = (r, g, b, 0)
    return output


def contact_sheet(new_root: Path, output: Path, picks: dict[str, str]) -> None:
    cell_w, cell_h = 176, 190
    sheet = Image.new("RGB", (cell_w * 9, cell_h * 3), (112, 110, 104))
    draw = ImageDraw.Draw(sheet)
    for row, subject in enumerate(SUBJECTS):
        for column in range(8):
            name = f"{subject}_{column + 1:02d}"
            sprite = load_rgba(new_root, name)
            x = column * cell_w + (cell_w - sprite.width) // 2
            y = row * cell_h + 22 + (150 - sprite.height) // 2
            sheet.paste(sprite, (x, y), sprite)
            draw.text((column * cell_w + 8, row * cell_h + 6), name, fill=(242, 236, 217))
        if subject == "house":
            sprite = remove_soft_outline(load_rgba(new_root, picks[subject]))
            x = 8 * cell_w + (cell_w - sprite.width) // 2
            y = row * cell_h + 22 + (150 - sprite.height) // 2
            sheet.paste(sprite, (x, y), sprite)
            draw.text((8 * cell_w + 8, row * cell_h + 6), f"{picks[subject]} no outline", fill=(242, 236, 217))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)


def old_new_sheet(old_root: Path, new_root: Path, output: Path, picks: dict[str, str]) -> None:
    cell_w, cell_h = 250, 205
    sheet = Image.new("RGB", (cell_w * 2, cell_h * 3), (112, 110, 104))
    draw = ImageDraw.Draw(sheet)
    for row, subject in enumerate(SUBJECTS):
        names = (f"{subject}_03", picks[subject])
        for column, name in enumerate(names):
            root = old_root if column == 0 else new_root
            sprite = load_rgba(root, name)
            x = column * cell_w + (cell_w - sprite.width) // 2
            y = row * cell_h + 30 + (155 - sprite.height) // 2
            sheet.paste(sprite, (x, y), sprite)
            label = f"{subject}: {'Phase 4A 03' if column == 0 else 'Phase 4B ' + name[-2:]}"
            draw.text((column * cell_w + 12, row * cell_h + 9), label, fill=(242, 236, 217))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)


def in_context(terrain: Path, new_root: Path, output: Path, picks: dict[str, str]) -> None:
    source = Image.open(terrain).convert("RGBA")
    image = source.crop((0, 0, source.width, min(source.height, 570)))
    anchors = ((510, 395), (580, 422), (665, 450))
    for subject, anchor in zip(SUBJECTS, anchors, strict=True):
        sprite = load_rgba(new_root, picks[subject])
        image.alpha_composite(sprite, (anchor[0] - sprite.width // 2, anchor[1] - sprite.height))
    output.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--new-root", type=Path, required=True)
    parser.add_argument("--old-root", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--house", default=DEFAULT_PICKS["house"])
    parser.add_argument("--mill", default=DEFAULT_PICKS["mill"])
    parser.add_argument("--granary", default=DEFAULT_PICKS["granary"])
    parser.add_argument("--terrain", type=Path)
    args = parser.parse_args()
    picks = {subject: getattr(args, subject) for subject in SUBJECTS}
    contact_sheet(args.new_root, args.output_dir / "building_candidates_v2.png", picks)
    old_new_sheet(args.old_root, args.new_root, args.output_dir / "building_old_new_v2.png", picks)
    if args.terrain is not None:
        in_context(args.terrain, args.new_root, args.output_dir / "building_in_context_v2.png", picks)


if __name__ == "__main__":
    main()
