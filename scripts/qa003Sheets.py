"""QA-003 evidence sheets: the crops of scripts/qa003GateCaptures.ts (<scene>-<season>-z<zoom>-<label>.jpg) paired per
scene and season, before | after, zoom 1.0 above zoom 0.6, each crop 2x nearest (pixels as drawn), one small JPEG per
scene and season in <out dir>.
Run: python3 scripts/qa003Sheets.py <crops dir> <out dir>
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

SCENES = ["palisade-straight", "palisade-corner", "stone-straight", "stone-corner"]
SEASONS = ["summer", "winter"]
ZOOMS = ["1", "0.6"]
SCALE = 2
GAP = 8
LABEL = 18


def main() -> None:
    crops, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for scene in SCENES:
        for season in SEASONS:
            rows = []
            for zoom in ZOOMS:
                pair = [crops / f"{scene}-{season}-z{zoom}-{label}.jpg" for label in ("before", "after")]
                if not all(path.exists() for path in pair):
                    continue
                rows.append((zoom, [Image.open(path).convert("RGB") for path in pair]))
            if not rows:
                continue
            width = max(sum(image.width * SCALE for image in images) + GAP for _, images in rows)
            height = sum(LABEL + max(image.height for image in images) * SCALE for _, images in rows) + GAP * (len(rows) - 1)
            sheet = Image.new("RGB", (width, height), (245, 242, 232))
            draw = ImageDraw.Draw(sheet)
            y = 0
            for zoom, images in rows:
                x = 0
                for label, image in zip(("before (e69ebae5)", "after"), images):
                    draw.text((x + 4, y + 3), f"{scene} {season} zoom {zoom} (2x) {label}" if label != "after" else "after", fill=(20, 20, 20))
                    sheet.paste(image.resize((image.width * SCALE, image.height * SCALE), Image.NEAREST), (x, y + LABEL))
                    x += image.width * SCALE + GAP
                y += LABEL + max(image.height for image in images) * SCALE + GAP
            sheet.save(out / f"{scene}-{season}.jpg", quality=80, optimize=True)
    print(sorted(path.name for path in out.glob("*.jpg")))


if __name__ == "__main__":
    main()
