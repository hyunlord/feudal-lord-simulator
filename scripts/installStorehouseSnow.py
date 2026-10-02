"""NAT-5 (RUN-02, decision N4-D3): install the three storehouse snow layers (assets-inbox/storehouse-corner/
candidates-20261003, confirmed 2026-10-03 in assets-inbox/INBOX_LEDGER.csv) into public/assets/buildings/storehouse-snow/.
Each is a snow-only layer on its storehouse painting's own canvas (160 x 136, pivot inherited, offset (0, 0);
records/README.md): a over public/assets/buildings/storehouse.png, b over variants-wave2/storehouse_b-v1.png, c over
variants-wave2/storehouse_c-v1.png. Asserted before copying: the canvas is the body's, and no snow pixel (alpha > 8)
lies where the body is transparent (alpha < 128) or stronger than the body there — the layer sits on the roof at
(0, 0), as drawn into the body's fitted rect (storehouseSnowArt.ts).
Only these three files; the pack's gate corner pieces are not installed (the user is redoing the corners). The `-vN`
suffix is dropped. No C2PA chunk (asserted): received bytes = runtime bytes. One docs/provenance/assets.csv row each
(replacing earlier rows for these runtime paths) built from records/manifest.csv (prompt, references, edits), one
prompt file each, `installed_by` = NAT-5 in the inbox ledger (these rows only, CRLF kept), and
src/render/storehouseSnowManifest.generated.ts: url, size and pivot of each layer, keyed by the body's variant.
Run: python3 scripts/installStorehouseSnow.py
"""
import csv
import hashlib
import io
import json
import shutil
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/storehouse-corner/candidates-20261003"
RUNTIME = ROOT / "public/assets/buildings/storehouse-snow"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/render/storehouseSnowManifest.generated.ts"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
INSTALLED_BY = "NAT-5"
# The body variant (buildingVariantManifest.ts pool building:storehouse: base, b, c) -> its painting.
BODIES = {"a": "public/assets/buildings/storehouse.png", "b": "public/assets/buildings/variants-wave2/storehouse_b-v1.png",
          "c": "public/assets/buildings/variants-wave2/storehouse_c-v1.png"}
USED_IN = ("src/render/storehouseSnowManifest.generated.ts (NAT-5 RUN-02 / N4-D3: winter roof snow on the storehouse, "
           "buildingOverlays.ts via storehouseSnowArt.ts, in the body's fitted rect)")
csv.field_size_limit(sys.maxsize)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def chunks(data: bytes) -> set:
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    found, i = set(), 8
    while i < len(data):
        n = struct.unpack(">I", data[i:i + 4])[0]
        found.add(data[i + 4:i + 8])
        i += 12 + n
    return found


def check_registration(variant: str, layer: bytes) -> None:
    snow = Image.open(io.BytesIO(layer)).convert("RGBA")
    body = Image.open(ROOT / BODIES[variant]).convert("RGBA")
    assert snow.size == body.size == (160, 136), f"{variant}: canvas {snow.size} / body {body.size}"
    outside = sum(1 for s, b in zip(snow.getchannel("A").tobytes(), body.getchannel("A").tobytes()) if s > 8 and (b < 128 or s > b + 8))
    assert outside == 0, f"{variant}: {outside} snow pixels off the body"


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8", newline="")))
    by_file = {row["file"]: row for row in inbox}
    records = {row["﻿id"]: row for row in csv.DictReader(open(BATCH / "records/manifest.csv", encoding="utf-8"))}
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    images, rows, installed = {}, [], set()
    RUNTIME.mkdir(parents=True, exist_ok=True)
    for variant in BODIES:
        asset_id = f"storehouse_{variant}_snow-v1"
        source = BATCH / "assets" / f"{asset_id}.png"
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        entry = by_file[inbox_key]
        assert entry["status"] == "confirmed", inbox_key
        data = source.read_bytes()
        digest = sha(data)
        assert digest == entry["sha256"] == records[asset_id]["sha256"], inbox_key
        assert not C2PA_CHUNKS & chunks(data), f"{inbox_key} carries a C2PA chunk"
        check_registration(variant, data)
        name = f"storehouse_{variant}_snow"
        runtime = RUNTIME / f"{name}.png"
        shutil.copyfile(source, runtime)
        assert sha(runtime.read_bytes()) == digest, inbox_key
        images[variant] = {"url": f"assets/buildings/storehouse-snow/{name}.png", "width": 160, "height": 136, "pivot": {"x": 0, "y": 0},
                           "body": BODIES[variant].removeprefix("public/")}
        record = records[asset_id]
        prompt = ROOT / "docs/provenance/prompts" / f"{name}-nat5.txt"
        prompt.write_text(record["prompt"].strip() + "\n")
        references = "; ".join(Path(ref.get("repoPath") or ref.get("packagePath") or ref.get("generationId", "")).name
                               for ref in json.loads(record["references"]))
        rows.append({"assetId": f"storehouse-snow/{name}", "version": "1", "runtimePath": runtime.relative_to(ROOT).as_posix(), "runtimeSha256": digest,
                     "sourcePath": source.relative_to(ROOT).as_posix(), "sourceSha256": digest, "tool": "image_gen.imagegen", "model": "not exposed",
                     "generatedAt": "2026-10-03", "prompt": prompt.relative_to(ROOT).as_posix(), "referenceInputs": references, "seed": "not exposed",
                     "candidates": "1", "manualEdits": record["edits"], "artBible": "ART_BIBLE_v2", "historicalProfile": "S_England_1300_1450_v1",
                     "owner": "Astra", "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra storehouse snow layer {variant} (generation {record['generationId']}, roof cover {float(record['coverage']):.1%}; confirmed in "
                              f"assets-inbox/INBOX_LEDGER.csv, verdict 2026-10-03) installed by {INSTALLED_BY} on 2026-10-03: the canvas of {BODIES[variant]}, "
                              "offset (0, 0), no snow pixel off the body; no C2PA chunk, received bytes = runtime bytes. The batch records give the "
                              "delivery date, not a generation time."})
        installed.add(inbox_key)
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    raw = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
    for row in inbox:
        if row["file"] in installed:
            row["installed_by"] = INSTALLED_BY
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(inbox[0].keys()), lineterminator="\r\n" if raw.split("\n", 1)[0].endswith("\r") else "\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in images.items())
    MANIFEST.write_text("// Generated by scripts/installStorehouseSnow.py — the storehouse snow layers (NAT-5 RUN-02): one per body variant\n"
                        "// (a = the base storehouse.png, b, c = the Wave 2 variants), each on its body's 160 x 136 canvas at offset (0, 0).\n"
                        "export const STOREHOUSE_SNOW_IMAGES = {\n" + body + "\n} as const;\n\n"
                        "export type StorehouseSnowKey = keyof typeof STOREHOUSE_SNOW_IMAGES;\n")
    print(len(rows), "rows")


if __name__ == "__main__":
    main()
