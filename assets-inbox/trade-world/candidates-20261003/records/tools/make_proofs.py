# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow", "pydantic>=2"]
# ///
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw
from pydantic import BaseModel, TypeAdapter

ROOT = Path(__file__).resolve().parents[1]


class Asset(BaseModel):
    id: str
    category: str
    archetype: str
    season: str


class Key(BaseModel):
    anonymous_id: str
    asset_id: str
    category: str


class Anchor(BaseModel):
    foot: tuple[int, int]


class Placement(BaseModel):
    asset_id: str
    foot_px: tuple[int, int]
    scale: float
    visible_box: tuple[int, int, int, int]


def sprite_path(asset: Asset) -> Path:
    return ROOT / 'assets' / asset.category / f'{asset.id}.png'


def anonymous_boards() -> None:
    keys = TypeAdapter(list[Key]).validate_json((ROOT / 'review/FROZEN_KEY.json').read_text())
    if not all((ROOT / 'assets' / k.category / f'{k.asset_id}.png').exists() for k in keys):
        return
    out = ROOT / 'review/blind'
    out.mkdir(exist_ok=True)
    if (out / 'board-01.jpg').exists():
        return
    for start in range(0, len(keys), 8):
        board = Image.new('RGB', (1200, 400), '#c7bea7')
        draw = ImageDraw.Draw(board)
        for index, key in enumerate(keys[start:start + 8]):
            x, y = index % 4 * 300, index // 4 * 200
            sprite = Image.open(ROOT / 'assets' / key.category / f'{key.asset_id}.png').convert('RGBA')
            board.paste(sprite, (x + (300 - sprite.width) // 2, y + 24), sprite)
            draw.text((x + 132, y + 168), key.anonymous_id, fill='#211b17')
        board.save(out / f'board-{start // 8 + 1:02d}.jpg', quality=95)


def place(scene: Image.Image, asset: Asset, foot: tuple[int, int], scale: float) -> Placement:
    sprite = Image.open(sprite_path(asset)).convert('RGBA')
    anchors = TypeAdapter(dict[str, Anchor]).validate_json((ROOT / 'provenance/asset_anchors.json').read_text())
    anchor = anchors[asset.id].foot
    size = (round(sprite.width * scale), round(sprite.height * scale))
    sprite = sprite.resize(size, Image.Resampling.LANCZOS)
    xy = (round(foot[0] - anchor[0] * scale), round(foot[1] - anchor[1] * scale))
    scene.alpha_composite(sprite, xy)
    bounds = sprite.getbbox()
    if bounds is None:
        raise ValueError(asset.id)
    return Placement(asset_id=asset.id, foot_px=foot, scale=scale,
                     visible_box=(xy[0] + bounds[0], xy[1] + bounds[1], xy[0] + bounds[2], xy[1] + bounds[3]))


def city_proofs(assets: list[Asset]) -> None:
    source = Image.open(ROOT / 'references/city/city-1380-spring-z1-source.png').convert('RGBA')
    out = ROOT / 'proofs/city'
    out.mkdir(parents=True, exist_ok=True)
    source.convert('RGB').save(out / 'before.jpg', quality=93)
    yards = [a for a in assets if a.category == 'yard' and a.season == 'summer'
             and a.archetype not in ('water_power', 'waterside_workshop')]
    fronts = [a for a in assets if a.category == 'front']
    streets = [a for a in assets if a.category == 'street']
    placements: list[dict[str, object]] = []
    for page in range(10):
        scene = source.copy()
        records: list[Placement] = []
        for offset, foot in enumerate(((465, 600), (1170, 910))):
            index = page * 2 + offset
            if index < len(yards):
                asset = yards[index]
                scale = .38 if asset.archetype in ('rear_workshop', 'forge', 'institution') else .32
                records.append(place(scene, asset, foot, scale))
        for offset, foot in enumerate(((860, 804), (1523, 474))):
            index = page * 2 + offset
            if index < len(fronts):
                records.append(place(scene, fronts[index], foot, .28))
        for offset, foot in enumerate(((716, 373), (849, 334))):
            index = page * 2 + offset
            if index < len(streets):
                records.append(place(scene, streets[index], foot, .23))
        stem = f'after-{page + 1:02d}'
        scene.convert('RGB').save(out / f'{stem}-z1.jpg', quality=93)
        scene.resize((960, 660), Image.Resampling.LANCZOS).convert('RGB').save(out / f'{stem}-z06-proxy.jpg', quality=93)
        annotated = scene.convert('RGB')
        draw = ImageDraw.Draw(annotated)
        for index, record in enumerate(records):
            coords = record.visible_box
            draw.rectangle(coords, outline='#b32922', width=1)
            draw.text((coords[0], coords[1] - 12), str(index + 1), fill='#b32922')
        annotated.save(out / f'{stem}-locations.jpg', quality=88)
        placements.append({'page': page + 1, 'assets': [record.model_dump() for record in records]})
    _ = (ROOT / 'proofs/city/placements.json').write_text(json.dumps(placements, indent=2) + '\n')


def main() -> None:
    assets = TypeAdapter(list[Asset]).validate_json((ROOT / 'provenance/EXPECTED_ASSETS.json').read_text())
    available = [a for a in assets if sprite_path(a).exists()]
    city_proofs(available)
    anonymous_boards()
    print(f'Proofs from {len(available)} available assets; blind boards require all64')


if __name__ == '__main__':
    main()
