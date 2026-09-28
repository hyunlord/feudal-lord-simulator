"""ASSET-2 gate ①: the four counts from ASSET-1's own outputs (hashes.json, reconcile.json)."""
import json
import os
from collections import defaultdict

r = json.load(open('reconcile.json'))
h = json.load(open('hashes.json'))
runtime = [f for f in h['files'] if f['path'].startswith('public/assets/')]
rows = [row for row in r['rows'] if row['surface'] == 'public/assets']
out = {
    'not_in_any_ledger': [row['path'] for row in rows if row['class'].startswith('장부 밖 — 설치 대장에도 없음')],
    'old_version_registered': [row['path'] for row in rows if row['class'].startswith('confirmed 옛 버전')],
    'cabx': [f['path'] for f in runtime if f.get('cabx', 0) > 0],
}
by_name = defaultdict(set)
for f in runtime:
    if f['path'].endswith('.png'):
        by_name[os.path.basename(f['path'])].add(f.get('psha') or f['sha'])
out['same_name_different_content'] = sorted(name for name, shas in by_name.items() if len(shas) > 1)
print(json.dumps({key: len(value) for key, value in out.items()}))
json.dump(out, open('gate.json', 'w'), ensure_ascii=False, indent=1)
