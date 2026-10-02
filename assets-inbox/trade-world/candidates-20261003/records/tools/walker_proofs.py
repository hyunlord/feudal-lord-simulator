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
DIRECTIONS = ['NE', 'SE', 'SW', 'NW']


class Point(BaseModel):
    x: float
    y: float


class Hands(BaseModel):
    left: Point
    right: Point


class Frame(BaseModel):
    direction: str
    gaitFrame: int
    hands: Hands
    figureHeight: float


class Body(BaseModel):
    frames: list[Frame]


class Walker(BaseModel):
    body_template: Body


class Specs(BaseModel):
    walker: Walker


class Cargo(BaseModel):
    id: str
    grip: tuple[float, float]
    prop_scale: float
    role: str


def compose(sheet: Image.Image, frame: Frame, cargo: Cargo) -> Image.Image:
    column = DIRECTIONS.index(frame.direction)
    body = sheet.crop((column * 74, frame.gaitFrame * 74, column * 74 + 74, frame.gaitFrame * 74 + 74))
    prop = Image.open(ROOT / 'assets/cargo' / f'{cargo.id}.png').convert('RGBA')
    size = round(32 * cargo.prop_scale)
    prop = prop.resize((size, size), Image.Resampling.LANCZOS)
    hand = frame.hands.left if frame.direction in ('SE', 'SW') else frame.hands.right
    xy = (round(17 + hand.x - cargo.grip[0] * cargo.prop_scale),
          round(17 + hand.y - cargo.grip[1] * cargo.prop_scale))
    cell = Image.new('RGBA', (108, 108))
    if frame.direction in ('SW', 'NW'):
        cell.alpha_composite(prop, xy)
    cell.alpha_composite(body, (17, 17))
    if frame.direction in ('NE', 'SE'):
        cell.alpha_composite(prop, xy)
    return cell


def main() -> None:
    cargo = TypeAdapter(list[Cargo]).validate_json((ROOT / 'provenance/CARGO_ANCHORS.json').read_text())
    specs = Specs.model_validate_json((ROOT / 'provenance/asset-specs.json').read_text())
    sheet = Image.open(ROOT / 'references/style/wk_artisan_m_01-v1.png').convert('RGBA')
    out = ROOT / 'proofs/walkers'
    out.mkdir(parents=True, exist_ok=True)
    kinds = list(dict.fromkeys(item.id.rsplit('_', 1)[0] for item in cargo))
    frame_map = {(f.direction, f.gaitFrame): f for f in specs.walker.body_template.frames}
    cargo_map = {item.id: item for item in cargo}
    measurements: list[dict[str, object]] = []
    for kind in kinds:
        board = Image.new('RGB', (1080, 310), '#c7bea7')
        draw = ImageDraw.Draw(board)
        for row in range(2):
            for column, direction in enumerate(DIRECTIONS):
                item = cargo_map[f'{kind}_{direction}']
                frame = frame_map[(direction, row)]
                cell = compose(sheet, frame, item)
                enlarged = cell.resize((162, 162), Image.Resampling.NEAREST)
                x, y = column * 270, row * 155
                board.paste(enlarged, (x, y - 12), enlarged)
                native = cell.resize((27, 27), Image.Resampling.LANCZOS)
                board.paste(native, (x + 192, y + 68), native)
                far = cell.resize((16, 16), Image.Resampling.LANCZOS)
                board.paste(far, (x + 230, y + 79), far)
                draw.text((x + 15, y + 137), f'{direction} gait{row} | H16 | 0.6 proxy', fill='#211b17')
                prop = Image.open(ROOT / 'assets/cargo' / f'{item.id}.png')
                bounds = prop.getbbox()
                if bounds is None:
                    raise ValueError(item.id)
                measurements.append({'id': item.id, 'gait': row, 'scale': item.prop_scale,
                                     'height_H': round((bounds[3] - bounds[1]) * item.prop_scale / frame.figureHeight, 3),
                                     'depth': 'behind_body' if direction in ('SW', 'NW') else 'in_front'})
        board.save(out / f'{kind}.jpg', quality=95)
    _ = (out / 'measurements.json').write_text(json.dumps(measurements, indent=2) + '\n')
    print('80 composites: 10 cargo kinds x4 native directions x2 gait frames')


if __name__ == '__main__':
    main()
