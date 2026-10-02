#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy"]
# ///
from __future__ import annotations

import csv
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'delivery'
ARCHIVE = Path('/tmp/astra-strip-corners-20261003.zip')
PREFIX = 'astra-strip-corners-20261003'


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def copy(relative: str) -> None:
    source, dest = ROOT / relative, DEST / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, dest)


def main() -> None:
    DEST.mkdir(exist_ok=True)
    for directory in ['assets', 'references']:
        for source in (ROOT / directory).glob('*.png'):
            copy(str(source.relative_to(ROOT)))
    for source in ROOT.glob('*.md'):
        copy(source.name)
    copy('manifest.json')
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    with (DEST / 'manifest.csv').open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(manifest[0]))
        writer.writeheader()
        writer.writerows(manifest)
    for source in (ROOT / 'proofs').glob('final-*.jpg'):
        copy(str(source.relative_to(ROOT)))
    copy('proofs/01-all-16.jpg')
    archive_images = []
    scenes = json.loads((ROOT / 'records/runtime-scenes.json').read_text())
    scenes += json.loads((ROOT / 'records/native-runtime-scenes.json').read_text())
    for scene in scenes:
        source = ROOT / scene['file']
        target = DEST / f"proofs/scenes/{scene['id']}.jpg"
        target.parent.mkdir(parents=True, exist_ok=True)
        original = Image.open(source).convert('RGB')
        original.save(target, 'JPEG', quality=82, optimize=True)
        archive_images.append({'original': scene['file'], 'originalSha256': digest(source), 'archive': str(target.relative_to(DEST)), 'decodedPixelsIdentical': False, 'format': 'JPEG quality82; full source PNG retained locally'})
    rounds = [('round1', ROOT / 'records/blind-round1')] + [(f'round{n}', ROOT / f'blind/round{n}') for n in [2, 3, 4]]
    for label, source_dir in rounds:
        for source in source_dir.rglob('*'):
            if not source.is_file():
                continue
            target = DEST / 'blind' / label / source.relative_to(source_dir)
            target.parent.mkdir(parents=True, exist_ok=True)
            if source.suffix == '.png':
                target = target.with_suffix('.webp')
                original = Image.open(source).convert('RGB')
                compact = original.resize((original.width // 3, original.height // 3), Image.Resampling.NEAREST)
                compact.save(target, 'WEBP', lossless=True, method=6)
                restored = Image.open(target).resize(original.size, Image.Resampling.NEAREST)
                assert np.array_equal(np.array(original), np.array(restored))
                archive_images.append({'original': str(source.relative_to(ROOT)), 'originalSha256': digest(source), 'archive': str(target.relative_to(DEST)), 'decodedPixelsIdenticalAfterNearestScale3': True})
            else:
                shutil.copy2(source, target)
    for source in (ROOT / 'records').iterdir():
        if source.is_file() and source.suffix in {'.py', '.mjs', '.json', '.md'}:
            copy(str(source.relative_to(ROOT)))
    (DEST / 'records/archive-images.json').write_text(json.dumps(archive_images, indent=2))
    files = sorted(p for p in DEST.rglob('*') if p.is_file() and p.name != 'SHA256SUMS')
    (DEST / 'SHA256SUMS').write_text(''.join(f'{digest(p)}  {p.relative_to(DEST)}\n' for p in files))
    with zipfile.ZipFile(ARCHIVE, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for source in sorted(DEST.rglob('*')):
            if source.is_file():
                archive.write(source, f'{PREFIX}/{source.relative_to(DEST)}')
    with zipfile.ZipFile(ARCHIVE) as archive:
        assert archive.testzip() is None
        for line in archive.read(f'{PREFIX}/SHA256SUMS').decode().splitlines():
            checksum, name = line.split('  ', 1)
            assert hashlib.sha256(archive.read(f'{PREFIX}/{name}')).hexdigest() == checksum
    ARCHIVE.with_suffix('.zip.sha256').write_text(f'{digest(ARCHIVE)}  {ARCHIVE.name}\n')
    print(json.dumps({'archive': str(ARCHIVE), 'bytes': ARCHIVE.stat().st_size, 'files': len(files) + 1, 'sha256': digest(ARCHIVE), 'losslessBlindConversions': sum('decodedPixelsIdenticalAfterNearestScale3' in row for row in archive_images), 'jpegContexts': len(scenes), 'crcAndHashes': 'PASS'}))


if __name__ == '__main__':
    main()
