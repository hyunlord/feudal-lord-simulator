"""Outer hull of every nontransparent pixel square, without changing source artwork."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def hull(points):
    points = sorted(set(points))
    def cross(a, b, c):
        return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    lower, upper = [], []
    for target, sequence in ((lower, points), (upper, reversed(points))):
        for point in sequence:
            while len(target) >= 2 and cross(target[-2], target[-1], point) <= 0:
                target.pop()
            target.append(point)
    return lower[:-1]+upper[:-1]

rows = []
for bundle in json.loads((ROOT/'src/render/art/catalog.json').read_text()):
    for entry in bundle['entries']:
        if entry.get('role') != 'snow-footprint':
            continue
        with Image.open(ROOT/'public'/entry['image']['url']) as image:
            alpha = image.convert('RGBA').getchannel('A')
            points, count = [], 0
            for y in range(image.height):
                for x in range(image.width):
                    if alpha.getpixel((x, y)) > 0:
                        count += 1
                        points.extend(((x,y),(x+1,y),(x,y+1),(x+1,y+1)))
            rows.append({'id': entry['id'], 'alphaThreshold': 1, 'opaquePixelCount': count, 'hull': hull(points)})
if len(rows) != 2:
    raise ValueError('Expected both footprint sources')
(ROOT/'src/render/art/snowFootprintSupport.json').write_text(json.dumps(rows,separators=(',',':'))+'\n')
