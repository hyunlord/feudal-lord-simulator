"""UI-9b: the pastoral farm fitted to its 2 x 1 plot. Wave 2's farm_pastoral paintings (CLOTH-UI) are a large farm — a
wide grass diamond around a fenced sheep pen and a shelter — so, fitted to the plot's width (R0-2), the pen came out
small. This writes one runtime copy of each season's painting cut to the diamond that holds the pen, the shelter and the
hay rick (PEN below, the same on all three paintings), its edge faded over FEATHER of the diamond so the grass ends
softly, then cropped to that diamond's box; no pixel inside is repainted. The copies replace the full paintings in
src/render/historicalFacilityManifest.ts (url, size, source rect, sha256; displayWidth is set by the R0-2 fit below),
each with one docs/provenance/assets.csv row (derived from the Wave 2 runtime painting, which keeps its own row).
Run: python3 scripts/fitPastoralFarm.py
"""
import csv
import hashlib
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SEASONS = ("spring", "summer", "winter")
# The pen's diamond on the 384 x 192 paintings: centre, half width, half height (px), a 2:1 diamond like the plot's.
PEN = {"cx": 212, "cy": 84, "hw": 136, "hh": 68}
FEATHER = 0.1
# The share of the plot's diamond width the pen's diamond is drawn at (R0-2 bounds: 0.72..1.05).
FIT = 1.0
PLOT_WIDTH_PX = 96  # a 2 x 1 footprint diamond at zoom 1: (2 + 1) x 32 px
MANIFEST = ROOT / "src/render/historicalFacilityManifest.ts"
LEDGER = ROOT / "docs/provenance/assets.csv"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    text = MANIFEST.read_text()
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ledger = list(csv.DictReader(open(LEDGER, encoding="utf-8")))
    rows = []
    for season in SEASONS:
        source = ROOT / f"public/assets/wave2/bld/farm_pastoral_{season}.png"
        image = np.asarray(Image.open(source).convert("RGBA")).astype(np.float64)
        ys, xs = np.mgrid[0:image.shape[0], 0:image.shape[1]]
        d = np.abs(xs + 0.5 - PEN["cx"]) / PEN["hw"] + np.abs(ys + 0.5 - PEN["cy"]) / PEN["hh"]
        fade = np.clip((1 - d) / FEATHER, 0, 1)
        out = image.copy()
        out[..., 3] = np.round(image[..., 3] * fade)
        box = (PEN["cx"] - PEN["hw"], PEN["cy"] - PEN["hh"], PEN["cx"] + PEN["hw"], PEN["cy"] + PEN["hh"])
        fitted = Image.fromarray(out.astype(np.uint8), "RGBA").crop(box)
        runtime = source.with_name(f"farm_pastoral_{season}_fit.png")
        fitted.save(runtime, optimize=True)
        digest = sha(runtime)
        opaque = np.asarray(fitted.getchannel("A")) > 128
        cols = np.nonzero(opaque.any(axis=0))[0]
        display = round(FIT * PLOT_WIDTH_PX * fitted.width / (cols.max() - cols.min() + 1))
        entry = {"id": f"farm_pastoral_{season}", "kind": "pastoral_farm", "url": f"assets/wave2/bld/{runtime.name}",
                 "width": fitted.width, "height": fitted.height, "source": {"x": 0, "y": 0, "width": fitted.width, "height": fitted.height},
                 "displayWidth": display, "sha256": digest}
        block = re.compile(r"  \{\n    \"id\": \"farm_pastoral_" + season + r"\",\n.*?\n  \}", re.S)
        assert len(block.findall(text)) == 1, season
        body = json.dumps(entry, indent=2).replace('"source": {\n    "x": 0,\n    "y": 0,\n    "width": ' + str(fitted.width) + ',\n    "height": ' + str(fitted.height) + '\n  }',
                                                   '"source": { "x": 0, "y": 0, "width": ' + str(fitted.width) + ', "height": ' + str(fitted.height) + ' }')
        text = block.sub("\n".join("  " + line for line in body.splitlines()), text)
        base = next(row for row in ledger if row["runtimePath"] == str(source.relative_to(ROOT)))
        rows.append({**base, "assetId": f"{base['assetId']}_fit", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": sha(source),
                     "manualEdits": f"UI-9b scripted fit (scripts/fitPastoralFarm.py): cut to the pen's diamond {PEN} with a {FEATHER} alpha fade, cropped to its box; no repaint",
                     "usedIn": "src/render/historicalFacilityManifest.ts (UI-9b: the pastoral farm on its 2 x 1 plot)",
                     "notes": f"Derived from {source.relative_to(ROOT)} (Wave 2 farm_pastoral, installed by CLOTH-UI) by UI-9b on 2026-09-29."})
    MANIFEST.write_text(text)
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in ledger if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    print("\n".join(f"{row['runtimePath']} {row['runtimeSha256'][:12]}" for row in rows))


if __name__ == "__main__":
    main()
