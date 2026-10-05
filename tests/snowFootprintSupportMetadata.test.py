"""Every visible source pixel square must be inside the generated support hull."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
entries = {entry['id']: entry for bundle in json.loads((ROOT/'src/render/art/catalog.json').read_text()) for entry in bundle['entries']}
count = 0
for row in json.loads((ROOT/'src/render/art/snowFootprintSupport.json').read_text()):
    entry = entries[row['id']]
    source = ROOT/'public'/entry['image']['url']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == entry['provenance']['runtimeSha256']
    hull = row['hull']
    with Image.open(source) as image:
        alpha = image.convert('RGBA').getchannel('A')
        for y in range(image.height):
            for x in range(image.width):
                if alpha.getpixel((x, y)) > 0:
                    count += 1
                    for c in ((x,y),(x+1,y),(x,y+1),(x+1,y+1)):
                        assert all((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]) >= 0 for a,b in zip(hull,hull[1:]+hull[:1]))
print(json.dumps({'sourceImages': 2, 'nonzeroPixelSquaresWhollyEnclosed': count, 'alphaThreshold': 1}))
