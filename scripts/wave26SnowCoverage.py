"""INSTALL-26: roof snow coverage of the stone-slate L4 variants e and f (inbox ledger note: "설치 때 피복률 60~80% 확인"),
measured the Wave 20 way (assets-inbox/wave20/snow-v4-20260927/records/README.md, provenance/coverage.mjs): the main
roof faces traced by hand on the variant's own painting, independently of its snow layer (hip e: both faces from the
apex and short ridge to the eaves; gable f: the one visible slope, the gable wall and its bargeboard excluded), kept
where the painting is opaque (alpha >= 128); coverage = the snow layer's alpha summed over that mask / the mask's pixel
count. Also printed: the share of mask pixels with snow alpha >= 128, the snow alpha outside the mask, and the coverage
with the traced outline moved 2 px in and out (Wave 20's stated boundary error). The target is 60-80 %; the art is not
edited here. Run: python3 scripts/wave26SnowCoverage.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "public/assets/wave26/house"
# Canvas pixels of the 161 px L4 canvas, traced on house_l4_e / house_l4_f.
ROOFS = {
    "house_l4_e": [(71, 11), (97, 26), (139, 54), (100, 82), (26, 41)],
    "house_l4_f": [(45, 11), (119, 51), (98, 83), (26, 43)],
}


def coverage(snow: np.ndarray, mask: np.ndarray) -> float:
    return round(100 * float(snow[mask].sum()) / int(mask.sum()), 2)


rows = []
for key, polygon in ROOFS.items():
    body = np.array(Image.open(ART / f"{key}.png").convert("RGBA"))
    snow = np.array(Image.open(ART / f"{key}_snow.png").convert("RGBA"))[:, :, 3] / 255
    outline = Image.new("L", (body.shape[1], body.shape[0]), 0)
    ImageDraw.Draw(outline).polygon(polygon, fill=255)
    opaque = body[:, :, 3] >= 128
    mask = (np.array(outline) > 0) & opaque
    inner = (np.array(outline.filter(ImageFilter.MinFilter(5))) > 0) & opaque
    outer = (np.array(outline.filter(ImageFilter.MaxFilter(5))) > 0) & opaque
    value = coverage(snow, mask)
    rows.append({"house": f"{key}.png", "overlay": f"{key}_snow.png", "roof_area_px": int(mask.sum()),
                 "alpha_weighted_snow_area_px": round(float(snow[mask].sum()), 2), "coverage_percent": value,
                 "opaque_half_threshold_percent": round(100 * float((snow[mask] >= 0.5).mean()), 2),
                 "outside_main_roof_alpha_area_px": round(float(snow[~mask].sum()), 2),
                 "coverage_inner_2px_percent": coverage(snow, inner), "coverage_outer_2px_percent": coverage(snow, outer),
                 "pass_60_80": 60 <= value <= 80})
print(json.dumps(rows, indent=1))
