#!/usr/bin/env python3
"""INSTALL-7: ring each wheat -> bread -> home link in its chain capture (captures.json `chain[*].mark`), and write a
contact sheet chain-sheet.jpg of the six links with their tick and state note.
  python3 scripts/install7Annotate.py docs/verification/install7/captures
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

root = Path(sys.argv[1])
rows = json.loads((root / "captures.json").read_text())
chain = next(row["chain"] for row in rows if "chain" in row)
cells = []
for link, entry in sorted(chain.items(), key=lambda item: item[1]["file"]):
    image = Image.open(root / entry["file"]).convert("RGB")
    # Tight around the link and enlarged 2x (the chain is watched at zoom 0.8 so the whole town is in view).
    x, y = entry["mark"]["x"], entry["mark"]["y"]
    left = max(0, min(image.width - 240, x - 120)); top = max(0, min(image.height - 170, y - 100))
    image = image.crop((left, top, left + 240, top + 170)).resize((480, 340), Image.LANCZOS)
    x, y = (x - left) * 2, (y - top) * 2
    draw = ImageDraw.Draw(image)
    for radius, colour in ((46, (40, 30, 20)), (44, (230, 190, 60))):
        draw.ellipse([x - radius, y - radius * 0.6 - 10, x + radius, y + radius * 0.6 - 10], outline=colour, width=3)
    image.save(root / entry["file"].replace(".jpg", "-ringed.jpg"), quality=80)
    caption = Image.new("RGB", (image.width, 36), (236, 226, 200))
    ImageDraw.Draw(caption).text((6, 4), f'{entry["file"]}  tick {entry["tick"]}\n{entry["note"][:78]}', fill=(40, 30, 20))
    cell = Image.new("RGB", (image.width, image.height + 36)); cell.paste(image, (0, 0)); cell.paste(caption, (0, image.height))
    cells.append(cell)
sheet = Image.new("RGB", (cells[0].width * 3, cells[0].height * 2), (255, 255, 255))
for index, cell in enumerate(cells[:6]):
    sheet.paste(cell, ((index % 3) * cell.width, (index // 3) * cell.height))
sheet.save(root / "chain-sheet.jpg", quality=78)
print(len(cells), "links ringed")
