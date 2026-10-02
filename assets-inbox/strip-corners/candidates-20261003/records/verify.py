#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy"]
# ///
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def assets() -> None:
    rows = []
    for path in sorted((ROOT / 'assets').glob('*.png')):
        image = Image.open(path)
        pixels = np.array(image)
        assert image.mode == 'RGBA' and image.size == (1024, 768)
        assert not pixels[0, :, 3].any() and not pixels[-1, :, 3].any()
        assert not pixels[:, 0, 3].any() and not pixels[:, -1, 3].any()
        assert not pixels[pixels[:, :, 3] == 0, :3].any()
        rows.append({'file': str(path.relative_to(ROOT)), 'size': list(image.size), 'mode': image.mode, 'bbox': image.getbbox(), 'sha256': sha(path)})
    assert len(rows) == 16 and len({row['sha256'] for row in rows}) == 16
    pairs = []
    for path in sorted((ROOT / 'assets').glob('*summer*.png')):
        winter = Path(str(path).replace('_summer', '_winter'))
        a, b = np.array(Image.open(path)), np.array(Image.open(winter))
        assert np.array_equal(a[544:], b[544:])
        assert Image.open(path).getbbox() == Image.open(winter).getbbox()
        pairs.append({'summer': path.name, 'winter': winter.name, 'differentPixels': int(np.count_nonzero(np.any(a != b, axis=2))), 'belowPivotUnchanged': True, 'sameBBox': True})
    (ROOT / 'records/asset-qa.json').write_text(json.dumps({'assets': rows, 'seasonalPairs': pairs, 'count': 16, 'unique': 16, 'transparentRGBclean': True, 'edgeClipping': False}, indent=2))
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    for entry in manifest:
        entry.update({'status': 'candidate_acceptance_failed', 'source_method': 'existing strip cuts and affine miter clips; no image generation', 'armLengthTiles': 1, 'wallClearanceTiles': .65, 'endpointOverlapTiles': .35, 'asset': f"assets/{entry['id']}.png", 'sha256': next(row['sha256'] for row in rows if entry['id'] in row['file'])})
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, indent=2))


def blind() -> None:
    rounds = [('round1', ROOT / 'records/blind-round1', ['one', 'two'])]
    rounds += [(f'round{n}', ROOT / f'blind/round{n}', ['a', 'b']) for n in [2, 3, 4]]
    output = []
    for label, directory, names in rounds:
        keyfile = directory / 'private/key.json'
        assert sha(keyfile) == (directory / 'private/key.sha256').read_text().strip()
        key = {row['case']: row for row in json.loads(keyfile.read_text())}
        reviewers = []
        for name in names:
            answers = json.loads((directory / f'reviewer-{name}.json').read_text())
            assert len(answers) == len(key)
            cases = [row.get('case', row.get('id')) for row in answers]
            assert set(cases) == set(key)
            correct = sum(row['added'] == key[case]['added'] for row, case in zip(answers, cases, strict=True))
            subsets = {}
            for subset in ['summer', 'winter', 'stone', 'palisade']:
                selected = [(row, case) for row, case in zip(answers, cases, strict=True) if subset in key[case]['source']]
                subsets[subset] = {'correct': sum(row['added'] == key[case]['added'] for row, case in selected), 'total': len(selected)}
            positives = [(row, case) for row, case in zip(answers, cases, strict=True) if key[case]['added']]
            reviewers.append({'reviewer': name, 'correct': correct, 'total': len(answers), 'accuracy': correct / len(answers), 'candidateDetected': sum(row['added'] for row, _ in positives), 'candidateTotal': len(positives), 'subsets': subsets})
        correct = sum(row['correct'] for row in reviewers)
        total = sum(row['total'] for row in reviewers)
        output.append({'round': label, 'reviewers': reviewers, 'correct': correct, 'total': total, 'accuracy': correct / total, 'targetMet': correct / total <= .60})
    (ROOT / 'records/blind-scores.json').write_text(json.dumps(output, indent=2))


def sources() -> None:
    repo = ROOT.parents[1]
    rows = []
    for reference in sorted((ROOT / 'references').glob('*.png')):
        relative = f'public/assets/wave28/strip/{reference.name}' if reference.name == 'dry_stone_wall_winter.png' else f'public/assets/wall/{reference.name}'
        assert sha(reference) == sha(repo / relative)
        rows.append({'reference': str(reference.relative_to(ROOT)), 'repositoryPath': relative, 'sha256': sha(reference), 'usedForPixels': '_b-' not in reference.name})
    (ROOT / 'records/source-hashes.json').write_text(json.dumps(rows, indent=2))
    captures = [{'file': str(path.relative_to(ROOT)), 'sha256': sha(path), 'bytes': path.stat().st_size} for path in sorted((ROOT / 'records/captures').glob('*.png'))]
    (ROOT / 'records/capture-hashes.json').write_text(json.dumps(captures, indent=2))


if __name__ == '__main__':
    assets()
    blind()
    sources()
    print('16 assets, 8 seasonal pairs, original source hashes and 4 blind rounds verified')
