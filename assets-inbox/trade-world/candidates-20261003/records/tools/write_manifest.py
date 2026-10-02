# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow", "pydantic>=2"]
# ///
from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw
from pydantic import BaseModel, TypeAdapter

ROOT = Path(__file__).resolve().parents[1]


class Asset(BaseModel):
    id: str
    category: str
    trade: str
    archetype: str
    variant: str
    season: str
    direction: str
    width: int
    height: int


class Cargo(BaseModel):
    id: str
    grip: tuple[float, float]
    prop_scale: float


class Trade(BaseModel):
    id: str
    ko: str


class Contract(BaseModel):
    trades: list[Trade]


RULES = {
    'street_front_shop': '집 앞 독립 빈 땅; 문과 길을 비우고 벽 접합 금지',
    'rear_workshop': '집 뒤 별도 지면; 지붕끼리 닿지 않는 여백',
    'large_yard': '넓은 뒷마당; 짐 이동과 말 접근 통로 확보',
    'dirty_yard': '더러운 작업 뒷마당; 음식 판매대·취수구와 분리',
    'nuisance_yard': '주거 외곽 냄새 마당; 식수와 주거로부터 이격',
    'forge': '독립 화덕 공방; 가연 지붕·벽·나무와 안전 여백',
    'waterside_workshop': '물 접근 가능한 별도 지면; 취수구와 분리',
    'water_power': '축융 전용; 유효한 수로·낙차/동력 연결 필요; 곡물 수차 아님',
    'warehouse_shop': '창고 옆 독립 하역장; 출입·운송 통로 비우기',
    'institution': '기관 공용 마당의 중립 지원물; 특정 20직업으로 자동 지정 금지',
    'no_shop_labor': '임시 하역/도구 놓는 땅; 영구 점포로 해석 금지',
    'itinerant': '이동 가능한 임시 판매·수선 장비; 고정 기초 없음',
    'street_corner': '거리 모퉁이 독립 지주; 교차로 시야·통행 폭 확보',
}
CARGO_JOBS = {
    'leather_bundle': 'tanner;shoemaker', 'small_cask': 'brewer;cooper;vintner',
    'wheel': 'wheelwright;carrier', 'cloth_roll': 'weaver;tailor;dyer;fuller;mercer',
    'bread_basket': 'baker;innkeeper', 'malt_sack': 'brewer;miller',
    'timber_short_bundle': 'carpenter;wheelwright;cooper', 'iron_bar_bundle': 'smith',
    'wool_bundle': 'weaver;fuller', 'spice_pouch_bundle': 'spicer;mercer;merchant',
}


def foot(image: Image.Image) -> tuple[int, int]:
    alpha = image.getchannel('A')
    bounds = alpha.point([0] * 200 + [255] * 56).getbbox()
    if bounds is None:
        raise ValueError('Empty contact silhouette')
    y = bounds[3] - 2
    xs = [x for x in range(bounds[0], bounds[2]) if alpha.tobytes()[y * alpha.width + x] >= 200]
    if not xs:
        y += 1
        xs = [x for x in range(bounds[0], bounds[2]) if alpha.tobytes()[y * alpha.width + x] >= 200]
    return xs[len(xs) // 2], y


def main() -> None:
    assets = TypeAdapter(list[Asset]).validate_json((ROOT / 'provenance/EXPECTED_ASSETS.json').read_text())
    cargo = {a.id: a for a in TypeAdapter(list[Cargo]).validate_json((ROOT / 'provenance/CARGO_ANCHORS.json').read_text())}
    trades = {a.id: a.ko for a in Contract.model_validate_json((ROOT / 'provenance/PRODUCTION_CONTRACT.json').read_text()).trades}
    rows: list[dict[str, str | int | float]] = []
    anchors: dict[str, dict[str, object]] = {}
    for asset in assets:
        path = ROOT / 'assets' / asset.category / f'{asset.id}.png'
        image = Image.open(path)
        is_cargo = asset.category == 'cargo'
        fx, fy = (0, 0) if is_cargo else ((128, 104) if asset.category == 'yard' else foot(image))
        if not is_cargo:
            anchors[asset.id] = {'foot': [fx, fy], 'uncertainty_px': 2,
                                'method': 'Wave27 group ground registration' if asset.category == 'yard' else 'Nearest opaque ground contact; manual board check'}
        jobs = CARGO_JOBS[asset.variant] if is_cargo else asset.trade
        scale = .32 if asset.category == 'yard' else (.28 if asset.category == 'front' else .23)
        if asset.category == 'yard' and asset.archetype in ('rear_workshop', 'forge', 'institution'):
            scale = .38
        row: dict[str, str | int | float] = {
            'asset_id': asset.id, 'file': f'{asset.category}/{asset.id}.png', 'category': asset.category,
            'trade': jobs, 'trade_ko': ';'.join(trades.get(t, '중립 지원') for t in jobs.split(';')),
            'archetype': asset.archetype, 'variant': asset.variant, 'season': asset.season,
            'direction': asset.direction, 'width': asset.width, 'height': asset.height,
            'foot_x': '' if is_cargo else fx, 'foot_y': '' if is_cargo else fy,
            'grip_x': cargo[asset.id].grip[0] if is_cargo else '',
            'grip_y': cargo[asset.id].grip[1] if is_cargo else '',
            'anchor_uncertainty_px': 1 if is_cargo else 2,
            'prop_scale_in_74px_body': cargo[asset.id].prop_scale if is_cargo else '',
            'proof_scale_h19': '' if is_cargo else scale,
            'recommended_world_scale_h16': '' if is_cargo else round(scale * 16 / 19, 4),
            'placement_rule': '기존 손 기준점에 파지점 일치; NE/SE 앞, SW/NW 뒤; 좌우 반전 금지' if is_cargo else RULES[asset.archetype],
            'lighting': 'screen upper left', 'flipped': 'false', 'status': 'candidate_not_installed',
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'generation_record': f'../provenance/generation/{asset.id}.json',
        }
        rows.append(row)
    with (ROOT / 'assets/assets.csv').open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    _ = (ROOT / 'provenance/asset_anchors.json').write_text(json.dumps(anchors, indent=2) + '\n')
    signs = [a for a in assets if a.category in ('front', 'street')]
    for start in range(0, len(signs), 16):
        board = Image.new('RGB', (1200, 800), '#c7bea7')
        draw = ImageDraw.Draw(board)
        for index, asset in enumerate(signs[start:start + 16]):
            image = Image.open(ROOT / 'assets' / asset.category / f'{asset.id}.png')
            x, y = index % 4 * 300 + 80, index // 4 * 200 + 20
            board.paste(image, (x, y), image)
            fx, fy = foot(image)
            draw.ellipse((x + fx - 2, y + fy - 2, x + fx + 2, y + fy + 2), fill='red')
            draw.text((index % 4 * 300 + 8, index // 4 * 200 + 170), asset.id, fill='black')
        board.save(ROOT / 'proofs' / f'foot-anchors-{start // 16 + 1}.jpg', quality=94)
    print('128 CSV rows and 88 ground anchors written')


if __name__ == '__main__':
    main()
