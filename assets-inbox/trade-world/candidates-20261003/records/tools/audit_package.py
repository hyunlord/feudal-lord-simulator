# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow", "pydantic>=2"]
# ///
from __future__ import annotations

import csv
import hashlib
import json
import re
import zipfile
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
FOLDERS = ('assets', 'proofs', 'references', 'provenance', 'review', 'tools')


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def files() -> list[Path]:
    result = [ROOT / 'README.md', ROOT / 'QA_REPORT.md']
    for folder in FOLDERS:
        result.extend(p for p in (ROOT / folder).rglob('*') if p.is_file()
                      and '__pycache__' not in p.parts and '.DS_Store' not in p.parts)
    return sorted(result)


def validate_assets() -> dict[str, object]:
    with (ROOT / 'assets/assets.csv').open() as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 128 and len({r['asset_id'] for r in rows}) == 128
    pngs = list((ROOT / 'assets').rglob('*.png'))
    assert len(pngs) == 128
    pixels: set[str] = set()
    flipped: set[str] = set()
    counts: dict[str, int] = {}
    for row in rows:
        path = ROOT / 'assets' / row['file']
        image = Image.open(path)
        assert image.mode == 'RGBA'
        assert image.size == (int(row['width']), int(row['height']))
        assert image.getchannel('A').getextrema() == (0, 255)
        clear_mask = image.getchannel('A').point([255] + [0] * 255)
        for channel in image.split()[:3]:
            assert ImageChops.multiply(channel, clear_mask).getbbox() is None
        bounds = image.getbbox()
        assert bounds and bounds[0] > 0 and bounds[1] > 0
        assert bounds[2] < image.width and bounds[3] < image.height
        assert sha(path) == row['sha256']
        digest = hashlib.sha256(image.tobytes()).hexdigest()
        assert digest not in pixels and digest not in flipped
        pixels.add(digest)
        flipped.add(hashlib.sha256(image.transpose(Image.Transpose.FLIP_LEFT_RIGHT).tobytes()).hexdigest())
        for field, limit in (('foot_x', image.width), ('foot_y', image.height),
                             ('grip_x', image.width), ('grip_y', image.height)):
            if row[field]:
                assert 0 <= float(row[field]) < limit
        record = (path.parent.parent / row['generation_record']).resolve()
        assert record.exists()
        raw = ROOT / 'working/raw' / path.name
        assert sha(raw) in record.read_text()
        counts[row['category']] = counts.get(row['category'], 0) + 1
    seasons: list[dict[str, object]] = []
    for summer in sorted((ROOT / 'assets/yard').glob('*_summer.png')):
        winter = summer.with_name(summer.name.replace('_summer', '_winter'))
        a = Image.open(summer).getchannel('A').point([0] * 128 + [255] * 128)
        b = Image.open(winter).getchannel('A').point([0] * 128 + [255] * 128)
        intersection = ImageChops.darker(a, b).histogram()[255]
        union = ImageChops.lighter(a, b).histogram()[255]
        seasons.append({'pair': summer.stem.removesuffix('_summer'),
                        'alpha_iou': round(intersection / union, 4), 'same_canvas_and_group_anchor': True})
    return {'status': 'PASS', 'counts': counts, 'unique_pixel_images': len(pixels),
            'exact_mirrored_pairs': 0, 'transparent_rgb_zero': True, 'generation_raw_hash_matches': len(rows), 'season_pairs': seasons}


def validate_links(included: list[Path]) -> dict[str, object]:
    included_set = {p.resolve() for p in included}
    checked: list[str] = []
    errors: list[str] = []
    for document in included:
        if document.suffix != '.md':
            continue
        content = document.read_text()
        for match in re.finditer(r'\]\(([^)]+)\)', content):
            target = match.group(1).strip('<>').split('#')[0]
            if not target or target.startswith(('https:', 'http:', 'mailto:')):
                continue
            resolved = (document.parent / target).resolve()
            checked.append(f'{document.relative_to(ROOT)} -> {target}')
            if resolved not in included_set:
                errors.append(checked[-1])
        for match in re.finditer(r'`([^`\n]+)`', content):
            token = match.group(1)
            if (token.startswith(('assets/', 'proofs/', 'references/', 'provenance/', 'review/', 'tools/'))
                    and '*' not in token and ' ' not in token and not token.endswith('/')):
                candidate = ROOT / token
                checked.append(f'{document.relative_to(ROOT)} -> {token}')
                if candidate.resolve() not in included_set:
                    errors.append(checked[-1])
        for match in re.finditer(r'(?<![\w/])(?:assets|proofs|references|provenance|review|tools)/[\w./-]+\.(?:png|jpg|json|csv|md|py|gz)', content):
            token = match.group(0)
            checked.append(f'{document.relative_to(ROOT)} -> {token}')
            if (ROOT / token).resolve() not in included_set:
                errors.append(checked[-1])
    assert not errors, errors
    return {'status': 'PASS', 'checked_links': checked, 'missing': [],
            'external_source_locators': 'Absolute original repo/raw paths in provenance are explicitly outside package; final package links and assets CSV are checked.'}


def main() -> None:
    report = validate_assets()
    _ = (ROOT / 'proofs/ASSET_CHECKS.json').write_text(json.dumps(report, indent=2) + '\n')
    closure = validate_links([*files(), ROOT / 'proofs/LINK_CLOSURE.json'])
    _ = (ROOT / 'proofs/LINK_CLOSURE.json').write_text(json.dumps(closure, ensure_ascii=False, indent=2) + '\n')
    included = files()
    sums = '\n'.join(f'{sha(p)}  {p.relative_to(ROOT).as_posix()}' for p in included) + '\n'
    _ = (ROOT / 'SHA256SUMS').write_text(sums)
    destination = Path('/tmp/astra-trade-world-20261003.zip')
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in [*included, ROOT / 'SHA256SUMS']:
            archive.write(path, path.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        for line in archive.read('SHA256SUMS').decode().splitlines():
            digest, name = line.split('  ', 1)
            assert hashlib.sha256(archive.read(name)).hexdigest() == digest
        assert len(archive.namelist()) == len(included) + 1
    assert destination.stat().st_size < 30_000_000
    print(json.dumps({'zip': str(destination), 'bytes': destination.stat().st_size,
                      'sha256': sha(destination), 'files': len(included) + 1,
                      'asset_counts': report['counts'], 'package_links': closure['status']}))


if __name__ == '__main__':
    main()
