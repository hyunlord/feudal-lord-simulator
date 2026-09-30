"""INSTALL-30: roof snow coverage of the 18 Wave 30 pair-house paintings, re-measured on the installed files the Wave 20
way (as scripts/wave26SnowCoverage.py): the visible roof faces are the batch's hand-traced roof masks
(records/masks/*-roof.png, drawn on each painting before its snow; l2v e and l3v e share their d's mask, same bytes),
kept where the painting is opaque (alpha >= 128); coverage = the snow layer's alpha summed over that mask / the mask's
pixel count. Also printed: the share of mask pixels with snow alpha >= 128 (the batch's own count, records/QA.md) and the
coverage with the mask moved 2 px in and out (Wave 20's stated boundary error). The target is 60-80 %; the art is not
edited here. Run: python3 scripts/wave30SnowCoverage.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "public/assets/wave30/house_pair"
MASKS = ROOT / "assets-inbox/wave30/candidates-20260929/records/masks"
SHARED = {"l2v-e": "l2v-d", "l3v-e": "l3v-d"}


def mask_file(level: int, lot: str, variant: str) -> Path:
    family = f"l{level}{lot[0]}-{variant}"
    named = MASKS / f"house_pair_l{level}_{lot}_{variant}-roof.png"
    return named if named.exists() else MASKS / f"{SHARED.get(family, family)}-roof.png"


def coverage(snow: np.ndarray, mask: np.ndarray) -> float:
    return round(100 * float(snow[mask].sum()) / int(mask.sum()), 2)


rows = []
for level in (2, 3, 4):
    for lot in ("horizontal", "vertical"):
        for variant in "cde":
            key = f"house_pair_l{level}_{lot}_{variant}"
            body = np.array(Image.open(ART / f"{key}.png").convert("RGBA"))
            snow = np.array(Image.open(ART / f"{key}_snow.png").convert("RGBA"))[:, :, 3] / 255
            traced = np.array(Image.open(mask_file(level, lot, variant)).convert("RGBA"))
            outline = Image.fromarray(((traced[:, :, 3] >= 128) & (traced[:, :, 0] >= 128)).astype(np.uint8) * 255)
            opaque = body[:, :, 3] >= 128
            mask = (np.array(outline) > 0) & opaque
            inner = (np.array(outline.filter(ImageFilter.MinFilter(5))) > 0) & opaque
            outer = (np.array(outline.filter(ImageFilter.MaxFilter(5))) > 0) & opaque
            value = coverage(snow, mask)
            rows.append({"house": f"{key}.png", "roof_area_px": int(mask.sum()), "coverage_percent": value,
                         "opaque_half_threshold_percent": round(100 * float((snow[mask] >= 0.5).mean()), 2),
                         "coverage_inner_2px_percent": coverage(snow, inner), "coverage_outer_2px_percent": coverage(snow, outer),
                         "pass_60_80": 60 <= value <= 80})
print(json.dumps(rows, indent=1))
