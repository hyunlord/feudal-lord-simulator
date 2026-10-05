from __future__ import annotations

import csv
import hashlib
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HELPER = ROOT / 'scripts/buildSeasonalGroundCatalog.py'
PROTECTED = [
    ROOT / 'public/assets/wave7',
    ROOT / 'src/render/wave7ArtManifest.generated.ts',
    ROOT / 'docs/provenance/assets.csv',
    ROOT / 'assets-inbox/INBOX_LEDGER.csv',
]


def digest(path: Path) -> str:
    h = hashlib.sha256()
    if path.is_dir():
        for child in sorted(p for p in path.rglob('*') if p.is_file()):
            h.update(str(child.relative_to(path)).encode())
            h.update(hashlib.sha256(child.read_bytes()).digest())
    else:
        h.update(path.read_bytes())
    return h.hexdigest()


class SeasonalGroundCatalogHelperTest(unittest.TestCase):
    def make_root(self) -> Path:
        temp = Path(tempfile.mkdtemp(prefix='leaves-catalog-'))
        for rel in [
            'scripts/buildSeasonalGroundCatalog.py',
            'src/render/art/catalog.json',
            'assets-inbox/wave7/candidates-v1/records/assets.csv',
            'assets-inbox/wave7/candidates-v1/assets/season',
            'public/assets/wave7/season',
            'src/render/wave7ArtManifest.generated.ts',
            'docs/provenance/assets.csv',
            'assets-inbox/INBOX_LEDGER.csv',
        ]:
            src = ROOT / rel
            dst = temp / rel
            if src.is_dir():
                shutil.copytree(src, dst)
            else:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(src, dst)
        return temp

    def run_helper(self, root: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(['python3', str(root / 'scripts/buildSeasonalGroundCatalog.py'), '--root', str(root)], cwd=root, text=True, capture_output=True, check=False)

    def test_helper_is_idempotent_and_preserves_non_catalog_outputs(self) -> None:
        root = self.make_root()
        before = {str(path.relative_to(ROOT)): digest(root / path.relative_to(ROOT)) for path in PROTECTED}
        first = self.run_helper(root)
        second = self.run_helper(root)
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(json.loads(first.stdout), {'bundleId': 'wave7-seasonal-ground-old3', 'entries': 3, 'changed': False})
        self.assertEqual(json.loads(second.stdout), {'bundleId': 'wave7-seasonal-ground-old3', 'entries': 3, 'changed': False})
        after = {str(path.relative_to(ROOT)): digest(root / path.relative_to(ROOT)) for path in PROTECTED}
        self.assertEqual(after, before)
        catalog = json.loads((root / 'src/render/art/catalog.json').read_text())
        bundle = [entry for entry in catalog if entry['bundleId'] == 'wave7-seasonal-ground-old3']
        self.assertEqual(len(bundle), 1)
        self.assertEqual([entry['id'] for entry in bundle[0]['entries']], ['leaves_a', 'leaves_b', 'leaves_c'])

    def test_helper_rejects_duplicate_missing_or_mismatched_records(self) -> None:
        root = self.make_root()
        records = root / 'assets-inbox/wave7/candidates-v1/records/assets.csv'
        with records.open(encoding='utf-8-sig', newline='') as handle:
            rows = list(csv.DictReader(handle))
        fields = list(rows[0].keys())
        duplicate = rows + [next(row for row in rows if row['file'] == 'assets/season/leaves_a-v1.png')]
        with records.open('w', encoding='utf-8', newline='') as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator='\n')
            writer.writeheader(); writer.writerows(duplicate)
        self.assertNotEqual(self.run_helper(root).returncode, 0)
        root = self.make_root(); records = root / 'assets-inbox/wave7/candidates-v1/records/assets.csv'
        with records.open(encoding='utf-8-sig', newline='') as handle:
            rows = [row for row in csv.DictReader(handle) if row['file'] != 'assets/season/leaves_b-v1.png']
        with records.open('w', encoding='utf-8', newline='') as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator='\n')
            writer.writeheader(); writer.writerows(rows)
        self.assertNotEqual(self.run_helper(root).returncode, 0)
        root = self.make_root(); records = root / 'assets-inbox/wave7/candidates-v1/records/assets.csv'
        with records.open(encoding='utf-8-sig', newline='') as handle:
            rows = list(csv.DictReader(handle))
        for row in rows:
            if row['file'] == 'assets/season/leaves_c-v1.png':
                row['sha256'] = '0' * 64
        with records.open('w', encoding='utf-8', newline='') as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator='\n')
            writer.writeheader(); writer.writerows(rows)
        self.assertNotEqual(self.run_helper(root).returncode, 0)


if __name__ == '__main__':
    unittest.main()
