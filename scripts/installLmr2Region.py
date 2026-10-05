"""LM-R2 (region): install the lord-components-region pictures (assets-inbox/lord-components/candidates-20261002/assets,
confirmed 2026-10-02 in assets-inbox/INBOX_LEDGER.csv; docs/ops/install-plan-20261003/SPECS/lord-components-region.md)
into public/assets/lord-ui/lord-components-region/ and put them into renderer B's art catalog as the bundle `lord-region`
(scripts/lmr2ArtBundle.ts: schema, semantic and file checks before anything is written):
- map_region (1600 x 1000, opaque): `regional-map` lord.region.map_region, the lord screen's single region map
  (src/ui/lord/region/RegionPanel.tsx). Its slots are measured, not guessed: the batch's own assembly proof
  (proofs/map-assembly-native.jpg, confirmed with the batch) is the map with the four site pictures and their flags pasted
  at 1x; each picture is found in it by template matching against the map (sum of squared differences under the
  picture's alpha, every offset in a window round the place the proof shows), and the slot is the found top-left plus the
  picture's recorded pivot (sites 48,88 and flags 14,90: records/asset-metrics.json). The match is checked to be a sharp
  minimum (each 1 px neighbour at least 3x the error).
- map_manor / map_market / map_mill (96 x 96, bottom y88): `ui-image` lord.region.<stem>, CSS widths 48 and 96.
- flag_direct / flag_delegated / flag_neighbor (64 x 96, pivot 14,90): `ui-image` lord.region.<stem>, CSS widths 32, 64.
- nav_<id> (40 x 40) x 8: `ui-image` lord.nav.<id>, CSS width 40 (the lord screen host's menu, LordScreen.tsx).
Held (not copied, not in the catalog): map_abbey — no estate the engine has is a religious house (EstateKind is manor,
market_town, mill_estate or fishery; the abbey estates come with LM-E10's neighbours, neighbor-world MAP.md h10).
Screen art: the received files carry no C2PA chunk (asserted), so received bytes = runtime bytes. One
docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths) from records/generations.json and
records/asset-metrics.json, one prompt file each. `--installed` also writes installed_by = LM-R2 on these inbox ledger
rows (only those lines are rewritten; CRLF kept); run it only after the consumer and its captures are confirmed
(INSTALL_PROTOCOL 6).
Run: python3 scripts/installLmr2Region.py [--installed]
"""
import csv
import hashlib
import json
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/lord-components/candidates-20261002"
RUNTIME = ROOT / "public/assets/lord-ui/lord-components-region"
URL = "assets/lord-ui/lord-components-region"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
INSTALLED_BY = "LM-R2"
USED_IN = {
    "map": "src/ui/lord/region/RegionPanel.tsx; src/ui/lord/region/regionArt.ts; src/styles/lordRegion.css (LM-R2: the lord screen's region map)",
    "nav": "src/ui/lord/screen/LordScreen.tsx (LM-R2: the lord screen's left menu; installed with the region bundle)",
}
NAV = ["character", "council", "dynasty", "estates", "marriage", "military", "petitions", "region"]
# stem: (catalog id, kind, width, height, css widths, pivot from records/asset-metrics.json or None)
FILES = {
    "map_region_1600x1000": ("lord.region.map_region", "regional-map", 1600, 1000, None, None),
    "map_manor_96x96": ("lord.region.map_manor", "ui-image", 96, 96, [48, 96], (48, 88)),
    "map_market_96x96": ("lord.region.map_market", "ui-image", 96, 96, [48, 96], (48, 88)),
    "map_mill_96x96": ("lord.region.map_mill", "ui-image", 96, 96, [48, 96], (48, 88)),
    "flag_direct_64x96": ("lord.region.flag_direct", "ui-image", 64, 96, [32, 64], (14, 90)),
    "flag_delegated_64x96": ("lord.region.flag_delegated", "ui-image", 64, 96, [32, 64], (14, 90)),
    "flag_neighbor_64x96": ("lord.region.flag_neighbor", "ui-image", 64, 96, [32, 64], (14, 90)),
    **{f"nav_{nav}_40x40": (f"lord.nav.{nav}", "ui-image", 40, 40, [40], (20, 20)) for nav in NAV},
}
HELD = {"map_abbey_96x96": "no engine estate is a religious house (EstateKind: manor, market_town, mill_estate, fishery); LM-E10"}
# The proof's sites and their flags: (slot id, site picture, flag picture, search window x0, x1, y0, y1 for the top-left).
# The windows only bound the search round the place the proof shows; the slot is where the match is.
PROOF = "proofs/map-assembly-native.jpg"
PROOF_SITES = [
    ("manor", "map_manor_96x96", "flag_direct_64x96", (280, 400, 150, 260), (340, 460, 110, 230)),
    ("market", "map_market_96x96", "flag_delegated_64x96", (1130, 1260, 120, 240), (1180, 1300, 80, 200)),
    ("mill", "map_mill_96x96", "flag_direct_64x96", (1060, 1180, 460, 580), (1110, 1230, 430, 560)),
    ("abbey", "map_abbey_96x96", "flag_neighbor_64x96", (240, 360, 600, 720), (300, 420, 580, 700)),
]
# The records' land: "an anonymous fictional southern English rural district" (records/prompts/map_region.txt).
LAND_TYPE = "southern-district"
csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_info(data: bytes) -> tuple:
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    found, i = set(), 8
    while i < len(data):
        n = struct.unpack(">I", data[i:i + 4])[0]
        found.add(data[i + 4:i + 8])
        i += 12 + n
    width, height = struct.unpack(">II", data[16:24])
    return found, width, height


def match(proof: np.ndarray, base: np.ndarray, stem: str, window: tuple) -> tuple:
    """The picture's top-left in the proof: least alpha-weighted squared error of (picture over map) against the proof."""
    sprite = np.asarray(Image.open(BATCH / "assets" / f"{stem}.png").convert("RGBA")).astype(float)
    h, w = sprite.shape[:2]
    alpha = sprite[:, :, 3:4] / 255
    rgb = sprite[:, :, :3]
    x0, x1, y0, y1 = window

    def error(ox: int, oy: int) -> float:
        patch = base[oy:oy + h, ox:ox + w]
        return float((((rgb * alpha + patch * (1 - alpha)) - proof[oy:oy + h, ox:ox + w]) ** 2 * alpha).sum() / alpha.sum())

    best = min((error(ox, oy), ox, oy) for oy in range(y0, y1) for ox in range(x0, x1))
    _, ox, oy = best
    neighbours = [error(ox + dx, oy + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
    assert min(neighbours) >= 3 * best[0], f"{stem}: no sharp match at {ox},{oy}"
    return ox, oy


def slots() -> list:
    proof = np.asarray(Image.open(BATCH / PROOF).convert("RGB")).astype(float)
    base = np.asarray(Image.open(BATCH / "assets/map_region_1600x1000.png").convert("RGB")).astype(float)
    assert proof.shape == base.shape == (1000, 1600, 3), "the proof is the map at 1x"
    found = []
    for slot, site, flag, site_window, flag_window in PROOF_SITES:
        sx, sy = match(proof, base, site, site_window)
        fx, fy = match(proof, base, flag, flag_window)
        found.append({"id": slot, "x": sx + 48, "y": sy + 88, "landType": LAND_TYPE})
        found.append({"id": f"{slot}.flag", "x": fx + 14, "y": fy + 90, "landType": LAND_TYPE})
    return found


def main() -> None:
    mark = "--installed" in sys.argv[1:]
    inbox_text = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
    inbox = list(csv.DictReader(inbox_text.splitlines()))
    by_file = {row["file"]: row for row in inbox}
    generations = {entry["id"]: entry for entry in json.loads((BATCH / "records/generations.json").read_text())}
    metrics = {Path(entry["output"]).stem: entry for entry in json.loads((BATCH / "records/asset-metrics.json").read_text())}
    entries, rows, installed = [], [], set()
    map_slots = slots()
    for stem, (asset_id, kind, width, height, css, pivot) in FILES.items():
        source = BATCH / "assets" / f"{stem}.png"
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        entry = by_file[inbox_key]
        assert entry["status"] == "confirmed" and entry["replaced_by"] == "", inbox_key
        digest = sha(source)
        assert digest == entry["sha256"], inbox_key
        chunks, real_width, real_height = png_info(source.read_bytes())
        assert not C2PA_CHUNKS & chunks, f"{inbox_key} carries a C2PA chunk"
        assert (real_width, real_height) == (width, height), inbox_key
        metric = metrics[stem]
        assert (metric["width"], metric["height"]) == (width, height) and metric["output_sha256"] == digest, stem
        if pivot is not None:
            assert (metric["pivot_x"], metric["pivot_y"]) == pivot, stem
        runtime = RUNTIME / f"{stem}.png"
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, inbox_key
        image = {"url": f"{URL}/{stem}.png", "width": width, "height": height}
        provenance = {"inboxFile": f"assets-inbox/{inbox_key}", "sourceSha256": digest, "runtimeSha256": digest}
        if kind == "regional-map":
            entries.append({"id": asset_id, "kind": kind, "image": image, "provenance": provenance, "mapId": "map_region",
                            "landTypes": [LAND_TYPE], "coordinateSpace": {"width": width, "height": height}, "slots": map_slots})
        else:
            entries.append({"id": asset_id, "kind": kind, "image": image, "provenance": provenance, "cssWidths": css, "derivatives": []})
        record = generations[metric["id"]]
        prompt = ROOT / "docs/provenance/prompts" / f"{metric['id']}-lord-components.txt"
        prompt.write_text(record["prompt"].strip() + "\n")
        geometry = "" if pivot is None or stem.startswith("nav_") else f", pivot {pivot[0]},{pivot[1]} (records/asset-metrics.json)"
        rows.append({"assetId": f"lord-ui/lord-components-region/{stem}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": record["tool"], "model": "not exposed",
                     "generatedAt": "2026-10-02", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": "none (records/visual-verdict.json reference_inputs [])",
                     "seed": "not exposed", "candidates": "1", "manualEdits": f"at delivery: {metric['transform']} (records/asset-metrics.json)",
                     "artBible": "ART_BIBLE_v2", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra",
                     "usedIn": USED_IN["nav" if stem.startswith("nav_") else "map"], "status": "runtime",
                     "notes": f"Astra lord-components {stem} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-10-02) installed by "
                              f"{INSTALLED_BY} on 2026-10-06 as {asset_id} ({kind}); no C2PA chunk, received bytes = runtime bytes; {width} x {height}{geometry}"
                              + (f"; slots measured on {PROOF}: " + " ".join(f"{s['id']} {s['x']},{s['y']}" for s in map_slots) if kind == "regional-map" else "")
                              + ". The batch records give the delivery date, not a generation time."})
        installed.add(inbox_key)
    bundle = {"schemaVersion": 1, "bundleId": "lord-region", "entries": entries, "rules": []}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump(bundle, handle)
    subprocess.run(["npx", "tsx", "scripts/lmr2ArtBundle.ts", handle.name], cwd=ROOT, check=True)
    Path(handle.name).unlink()
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    if mark:
        # Only these rows' lines change (the rest of the ledger keeps its bytes); their last field is installed_by.
        lines = inbox_text.split("\r\n")
        for index, line in enumerate(lines):
            fields = next(csv.reader([line])) if line else []
            if len(fields) >= 2 and fields[1] in installed and fields[-1] != INSTALLED_BY:
                assert len(fields) == 7 and fields[6] == "", fields[1]
                lines[index] = line + INSTALLED_BY
        open(INBOX_LEDGER, "w", encoding="utf-8", newline="").write("\r\n".join(lines))
    print(json.dumps({"installed": sorted(installed), "held": HELD, "slots": map_slots, "ledgerMarked": mark}))


if __name__ == "__main__":
    main()
