#!/usr/bin/env python3
"""Footprint board (render fix R0-2): every finished-building art at the place its draw path puts it, over its
footprint diamond (red), with the ground contour's lowest point (blue dot) and the measurement line from
scripts/footprintAlignment.ts. Offline: the same rects the renderer uses, composited at SCALE for reading.

  tsx scripts/footprintAlignment.ts --json /tmp/fa.json && python3 scripts/footprintBoard.py /tmp/fa.json out.jpg
"""
import json
import sys

from PIL import Image, ImageDraw

SCALE = 3
CELL_W, CELL_H = 150 * SCALE // 2, 150 * SCALE // 2
COLS = 8


def main(src: str, out: str) -> None:
    rows = json.load(open(src))
    sheet = Image.new("RGB", (CELL_W * COLS, CELL_H * ((len(rows) + COLS - 1) // COLS)), (88, 104, 72))
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(rows):
        ox, oy = (index % COLS) * CELL_W, (index // COLS) * CELL_H
        d = row["diamond"]
        # World -> cell: the diamond centre sits at 50 % across, 68 % down the cell.
        cx, cy = ox + CELL_W / 2, oy + CELL_H * 0.68

        def to(x: float, y: float) -> tuple[float, float]:
            return cx + (x - d["cx"]) * SCALE, cy + (y - d["cy"]) * SCALE
        poly = [to(d["cx"], d["cy"] - d["hh"]), to(d["cx"] + d["hw"], d["cy"]), to(d["cx"], d["cy"] + d["hh"]), to(d["cx"] - d["hw"], d["cy"])]
        draw.polygon(poly, fill=(120, 132, 92))
        image = Image.open("public/" + row["png"].lstrip("/")).convert("RGBA")
        crop = row["crop"]
        declared = row["declared"]
        kx, ky = image.width / declared["width"], image.height / declared["height"]
        box = (round(crop["x"] * kx), round(crop["y"] * ky), round((crop["x"] + crop["width"]) * kx), round((crop["y"] + crop["height"]) * ky))
        art = image.crop(box)
        dest = row["dest"]
        x0, y0 = to(dest["x"], dest["y"])
        size = (max(1, round(dest["width"] * SCALE)), max(1, round(dest["height"] * SCALE)))
        art = art.resize(size, Image.LANCZOS)
        sheet.paste(art, (round(x0), round(y0)), art)
        draw.line(poly + [poly[0]], fill=(200, 40, 40), width=2)
        bx, by = to(d["cx"] + row["dx"], d["cy"] + d["hh"] + row["dy"])
        draw.ellipse([bx - 4, by - 4, bx + 4, by + 4], fill=(40, 90, 220))
        verdict = "ok" if not row["problems"] else ", ".join(row["problems"])
        draw.rectangle([ox, oy + CELL_H - 34, ox + CELL_W, oy + CELL_H], fill=(236, 226, 200))
        draw.text((ox + 4, oy + CELL_H - 32), row["label"], fill=(40, 30, 20))
        draw.text((ox + 4, oy + CELL_H - 17), f'dx {row["dx"]:.1f} dy {row["dy"]:.1f} foot {row["foot"]:.2f}  {verdict}',
                  fill=(40, 30, 20) if not row["problems"] else (170, 30, 30))
    sheet.save(out, quality=78)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
