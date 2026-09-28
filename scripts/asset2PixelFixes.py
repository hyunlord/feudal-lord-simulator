"""ASSET-2 ⑧: the two small pixel defects ASSET-1 found (docs/verification/asset-audit, defects.csv), fixed in place.
 - The palisade face v2 strips (wall/palisade_face_a-v2, _b-v2): a band of stray colour (blue, green, red, yellow) on the
   stake tips at the strips' two ends, rows 6-8. Each such pixel takes the wood colour of the first ordinary pixel below
   it in its column (its alpha stays).
 - Semi-transparent residue: tiny isolated specks (<= 6 px, no pixel >= 128, more than 2 px from the body — ASSET-1's
   own rule, method/specks.py) in the five runtime files that still have them: set to alpha 0.
Each changed file's docs/provenance/assets.csv row gets its new runtimeSha256 and a manualEdits note, and its old hash
is replaced by the new one where the runtime derivative registry and the provenance evidence pin it
(src/render/runtimeAssetDerivatives.generated.ts, docs/provenance/evidence.json: the downscaled bridge pieces).
Idempotent: a second run finds nothing to change.
Run: python3 scripts/asset2PixelFixes.py
"""
import csv
import hashlib
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "docs/provenance/assets.csv"
BANDS = ["public/assets/wall/palisade_face_a-v2.png", "public/assets/wall/palisade_face_b-v2.png"]
SPECKS = ["public/assets/complete-art-v1/water-bridges/bridge_wood_ne_sw-v2.png", "public/assets/complete-art-v1/water-bridges/riverbank_stone-v2.png",
          "public/assets/wall/stone_pillar_135-v1.png", "public/assets/wave15/orchard/orchard_apple_d_winter-v1.png",
          "public/assets/wave9/walker/wk_royal_messenger-v1.png"]
PINNED = [ROOT / "src/render/runtimeAssetDerivatives.generated.ts", ROOT / "docs/provenance/evidence.json"]
csv.field_size_limit(sys.maxsize)


def stray(rgba: np.ndarray) -> np.ndarray:
    """Pixels that are no wood: bluer or greener than red, or a red with little green (the band's colours)."""
    r, g, b, a = (rgba[..., i].astype(int) for i in range(4))
    return ((b > r + 8) | (g > r + 8) | ((r - g > 70) & (g < b + 5))) & (a > 40)


def fix_band(rgba: np.ndarray) -> int:
    odd = stray(rgba)
    ys, xs = np.nonzero(odd)
    for y, x in zip(ys, xs):
        for below in range(y + 1, min(rgba.shape[0], y + 8)):
            if not odd[below, x] and rgba[below, x, 3] > 40:
                rgba[y, x, :3] = rgba[below, x, :3]
                break
    return len(ys)


def fix_specks(rgba: np.ndarray) -> int:
    alpha = rgba[..., 3]
    body = alpha >= 128
    labels, count = ndimage.label(alpha > 0, structure=np.ones((3, 3)))
    if count == 0 or not body.any():
        return 0
    index = np.arange(1, count + 1)
    size = ndimage.sum(np.ones_like(alpha, dtype=np.int32), labels, index)
    most = ndimage.maximum(alpha, labels, index)
    far = ndimage.distance_transform_edt(~body) > 2
    all_far = ndimage.minimum(far.astype(np.int8), labels, index)
    chosen = index[(size <= 6) & (most < 128) & (all_far == 1)]
    mask = np.isin(labels, chosen)
    rgba[mask] = 0
    return int(mask.sum())


def main() -> None:
    changed = {}
    for rel, fix, what in [*[(rel, fix_band, "stray colour on the stake tips recoloured from the wood below") for rel in BANDS],
                           *[(rel, fix_specks, "isolated semi-transparent specks set to alpha 0") for rel in SPECKS]]:
        path = ROOT / rel
        before = hashlib.sha256(path.read_bytes()).hexdigest()
        rgba = np.array(Image.open(path).convert("RGBA"))
        count = fix(rgba)
        if count == 0:
            print(rel, "nothing to fix")
            continue
        Image.fromarray(rgba, "RGBA").save(path, optimize=True)
        changed[rel] = (hashlib.sha256(path.read_bytes()).hexdigest(), f"ASSET-2 (2026-09-28): {count} px — {what} (ASSET-1 defects.csv).")
        for pinned in PINNED:
            text = pinned.read_text()
            if before in text:
                pinned.write_text(text.replace(before, changed[rel][0]))
        print(rel, count, "px")
    rows = list(csv.DictReader(open(LEDGER, encoding="utf-8")))
    fields = list(rows[0].keys())
    for row in rows:
        if row["runtimePath"] in changed:
            digest, note = changed[row["runtimePath"]]
            row["runtimeSha256"] = digest
            row["manualEdits"] = f"{row['manualEdits']} {note}".strip() if note not in row["manualEdits"] else row["manualEdits"]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader(); writer.writerows(rows)
    print(len(changed), "files changed")


if __name__ == "__main__":
    main()
