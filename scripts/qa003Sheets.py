"""QA-003 evidence sheets: the crops of scripts/qa003GateCaptures.ts (<scene>-<season>-z<zoom>-<label>.jpg) paired per
scene and season, before | after, zoom 1.0 above zoom 0.6, one small JPEG per scene and season in <out dir>. The gate
crops are shown 2x nearest (pixels as drawn), the rock crops (400 x 260) as captured. QUALITY keeps the folder under 1 MB.
Run: python3 scripts/qa003Sheets.py <crops dir> <out dir>
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

SCENES = {"palisade-straight": 2, "palisade-corner": 2, "stone-straight": 2, "stone-corner": 2, "rock-river": 1, "rock-chalk": 1}
SEASONS = ["summer", "winter"]
ZOOMS = ["1", "0.6"]
QUALITY = 62
BASE = "a9a13158"
GAP = 8
LABEL = 18


def main() -> None:
    crops, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for scene, scale in SCENES.items():
        for season in SEASONS:
            rows = []
            for zoom in ZOOMS:
                pair = [crops / f"{scene}-{season}-z{zoom}-{label}.jpg" for label in ("before", "after")]
                if not all(path.exists() for path in pair):
                    continue
                rows.append((zoom, [Image.open(path).convert("RGB") for path in pair]))
            if not rows:
                continue
            width = max(sum(image.width * scale for image in images) + GAP for _, images in rows)
            height = sum(LABEL + max(image.height for image in images) * scale for _, images in rows) + GAP * (len(rows) - 1)
            sheet = Image.new("RGB", (width, height), (245, 242, 232))
            draw = ImageDraw.Draw(sheet)
            y = 0
            for zoom, images in rows:
                x = 0
                for label, image in zip((f"before ({BASE})", "after"), images):
                    shown = f" ({scale}x)" if scale != 1 else ""
                    draw.text((x + 4, y + 3), f"{scene} {season} zoom {zoom}{shown} {label}" if label != "after" else "after", fill=(20, 20, 20))
                    sheet.paste(image.resize((image.width * scale, image.height * scale), Image.NEAREST), (x, y + LABEL))
                    x += image.width * scale + GAP
                y += LABEL + max(image.height for image in images) * scale + GAP
            sheet.save(out / f"{scene}-{season}.jpg", quality=QUALITY, optimize=True)
    print(sorted(path.name for path in out.glob("*.jpg")))


if __name__ == "__main__":
    main()
