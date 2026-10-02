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
    scenes = json.loads((ROOT / 'records/runtime-scenes.json').read_text())
    native = json.loads((ROOT / 'records/native-runtime-scenes.json').read_text())
    groups: dict[str, list[tuple[str, Image.Image]]] = {}
    stimuli: list[tuple[str, bool, Image.Image]] = []
    for scene in scenes + native:
        ident = scene['id']
        shot = Image.open(ROOT / scene['file']).convert('RGB')
        shot.save(ROOT / f'proofs/scenes/{ident}.jpg', quality=92)
        crop = shot.crop(CROP)
        key = f"{scene['material']}_{scene['season']}"
        if ident.startswith('native_'):
            groups.setdefault('native-polygon', []).append((ident, crop))
            continue
        groups.setdefault(key, []).append((ident, crop))
        stimuli.append((ident, True, crop))
        control_id = ident.replace('runtime_', 'control_')
        control = Image.open(ROOT / f'records/captures/{control_id}.png').convert('RGB').crop(CROP)
        stimuli.append((control_id, False, control))
    for group, items in groups.items():
        board = Image.new('RGB', (1280, 800), '#20251e')
        draw = ImageDraw.Draw(board)
        for index, (ident, crop) in enumerate(items):
            x, y = index % 2 * 640, index // 2 * 400
            draw.text((x + 12, y + 10), ident + ' / 2x', font=FONT, fill='white')
            board.paste(crop.resize((640, 360), Image.Resampling.NEAREST), (x, y + 40))
        board.save(ROOT / f'proofs/final-{group}.jpg', quality=95)
    blind = ROOT / 'blind/round2'
    (blind / 'public').mkdir(parents=True, exist_ok=True)
    (blind / 'private').mkdir(exist_ok=True)
    random.Random(202610030732).shuffle(stimuli)
    key = []
    for index, (ident, added, crop) in enumerate(stimuli, 1):
        code = f'S{index:02}'
        crop.resize((960, 540), Image.Resampling.NEAREST).save(blind / f'public/{code}.png')
        key.append({'case': code, 'source': ident, 'added': added})
    keyfile = blind / 'private/key.json'
    keyfile.write_text(json.dumps(key, indent=2))
    (blind / 'private/key.sha256').write_text(hashlib.sha256(keyfile.read_bytes()).hexdigest() + '\n')
    (blind / 'public/INSTRUCTIONS.md').write_text('Inspect S01-S32. Decide if a separate corner asset was inserted: added=true/false, confidence 0-1, short visual reason. Also rate unnaturalness from 0 (natural continuation) to 3 (obvious pasted block or broken join). Do not assume class balance. Read only this public folder. Do not search source, sibling folders, previous reviews or answer keys.\n')


if __name__ == '__main__':
    main()
