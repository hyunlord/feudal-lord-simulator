#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy"]
# ///
from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 20)
CROP = (480, 265, 800, 445)


def main() -> None:
    scenes = json.loads((ROOT / 'records/scenes.json').read_text())
    stimuli: list[tuple[str, bool, Image.Image]] = []
    groups: dict[str, list[tuple[str, Image.Image]]] = {}
    for scene in scenes:
        ident = scene['id']
        background = Image.open(ROOT / scene['file']).convert('RGBA')
        asset = Image.open(ROOT / f"assets/corner_{ident}-v3.png").convert('RGBA')
        asset = asset.resize((179, 134), Image.Resampling.LANCZOS)
        background.alpha_composite(asset, (550, 282))
        (ROOT / 'proofs/scenes').mkdir(exist_ok=True)
        background.convert('RGB').save(ROOT / f'proofs/scenes/{ident}.jpg', quality=92)
        crop = background.crop(CROP).convert('RGB')
        key = f"{scene['material']}_{scene['season']}"
        groups.setdefault(key, []).append((ident, crop))
        if scene['season'] == 'summer':
            stimuli.append((ident, True, crop))
            control = Image.open(ROOT / f'records/captures/control_{ident}.png').convert('RGB').crop(CROP)
            stimuli.append((f'control_{ident}', False, control))
    for group, items in groups.items():
        board = Image.new('RGB', (1280, 800), '#20251e')
        draw = ImageDraw.Draw(board)
        for index, (ident, crop) in enumerate(items):
            x, y = index % 2 * 640, index // 2 * 400
            draw.text((x + 12, y + 10), ident + ' / 2x', font=FONT, fill='white')
            board.paste(crop.resize((640, 360), Image.Resampling.NEAREST), (x, y + 40))
        board.save(ROOT / f'proofs/seams-{group}.jpg', quality=95)
    random.Random(202610030731).shuffle(stimuli)
    key = []
    for index, (ident, added, crop) in enumerate(stimuli, 1):
        code = f'R{index:02}'
        crop.resize((960, 540), Image.Resampling.NEAREST).save(ROOT / f'blind/public/{code}.png')
        key.append({'case': code, 'source': ident, 'added': added})
    keyfile = ROOT / 'blind/private/key.json'
    keyfile.write_text(json.dumps(key, indent=2))
    (ROOT / 'blind/private/key.sha256').write_text(hashlib.sha256(keyfile.read_bytes()).hexdigest() + '\n')
    (ROOT / 'blind/public/INSTRUCTIONS.md').write_text('Each R image is a game wall corner. Decide whether a separately prepared corner patch appears to have been composited into the wall: added=true or false. Inspect all 16 images. Return one JSON row per case with case, added, confidence (0-1), reason. Do not assume class counts. Judge visible seams, shape, texture and occlusion. Read only this public directory. Do not inspect sibling folders, source code, history or metadata outside this directory.\n')


if __name__ == '__main__':
    main()
