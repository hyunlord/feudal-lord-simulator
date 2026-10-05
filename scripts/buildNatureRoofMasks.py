"""Conservative contact domains from registered roof-only snow ink, never body bounding boxes."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / 'src/render/art/catalog.json').read_text())
rows = []
for bundle in CATALOG:
    for entry in bundle['entries']:
        if entry['kind'] != 'state-overlay' or entry.get('layer') != 'snow':
            continue
        path = ROOT / 'public' / entry['image']['url']
        with Image.open(path) as image:
            alpha = image.convert('RGBA').getchannel('A')
            width, height = image.size
            spans = []
            # A retained 2x2 block must be wholly inside opaque roof-snow ink.
            for y in range(0, height - 1, 2):
                start = None
                for x in range(0, width + 1, 2):
                    inside = x + 1 < width and min(alpha.getpixel((x + dx, y + dy)) for dx in (0, 1) for dy in (0, 1)) >= 180
                    if inside and start is None:
                        start = x
                    if not inside and start is not None:
                        if x - start >= 4:
                            spans.append([start, y, x - start, 2])
                        start = None
            if not spans:
                raise ValueError(f'No conservative roof domain: {path}')
        rows.append({'overlayId': entry['id'], 'bodyIds': entry['targetBodyIds'],
                     'source': entry['image']['url'], 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                     'width': width, 'height': height, 'alphaThreshold': 180, 'spans': spans})
(ROOT / 'src/render/art/natureRoofMasks.json').write_text(json.dumps(rows, separators=(',', ':')) + '\n')
print(json.dumps({'masks': len(rows), 'bodies': sum(len(row['bodyIds']) for row in rows)}))
