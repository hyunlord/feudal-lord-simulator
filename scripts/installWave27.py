"""INSTALL-27: install Wave 27, the backyard decals (40 confirmed files from assets-inbox/wave27/candidates-20260928,
verdict 2026-09-28) into public/assets/wave27/yards: the twelve occupations a / b and the six household states a / b
(256 x 128, footprint 2 x 1 cells) and the four shared yard props (128 x 64, footprint 1 x 1). The check pictures
(proofs/, records/qa/) are not installed. No C2PA chunk (asserted): received bytes = runtime bytes; nothing is
cropped or resized (the batch's placement anchors hold on the whole canvas).
One docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths), one prompt file each (the
batch's own generation prompt), `installed_by` = INSTALL-27 in the inbox ledger, and
src/render/wave27YardManifest.generated.ts: url, size, category, occupation / state, variant, anchor, footprint and
display scale (records/assets.csv).
Run: python3 scripts/installWave27.py
"""
import csv
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INBOX = ROOT / "assets-inbox"
BATCH = INBOX / "wave27/candidates-20260928"
RUNTIME = ROOT / "public/assets/wave27/yards"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = INBOX / "INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/render/wave27YardManifest.generated.ts"
USED_IN = "src/render/wave27YardManifest.generated.ts (INSTALL-27: backyard decals — occupations, household states, shared yard props)"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
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


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    parts = list(csv.DictReader(open(BATCH / "records/assets.csv", encoding="utf-8-sig")))
    generation = {record["id"]: record for record in json.loads((BATCH / "records/provenance/generation_records.json").read_text())}
    rows, installed, images = [], set(), {}
    RUNTIME.mkdir(parents=True, exist_ok=True)
    for part in parts:
        source = BATCH / part["file"]
        inbox_key = source.relative_to(INBOX).as_posix()
        digest = sha(source)
        assert digest == part["sha256"], part["id"]
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        chunks, width, height = png_info(source.read_bytes())
        assert not C2PA_CHUNKS & chunks, f"{part['id']} carries a C2PA chunk"
        assert (width, height) == (int(part["width"]), int(part["height"])), part["id"]
        key = part["id"].removesuffix("-v1")
        runtime = RUNTIME / f"{key}.png"
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, part["id"]
        record = generation[part["id"]]
        # The occupation rows carry "normal" / "working" in `state` (their scene's mood): only the state rows name a state.
        images[key] = {"url": f"assets/wave27/yards/{key}.png", "width": width, "height": height, "category": part["category"],
                       "kind": part["occupation"] if part["category"] == "occupation" else part["state"] if part["category"] == "state" else key.removeprefix("yard_"),
                       "variant": part["variant"] or None, "anchor": {"x": int(part["anchor_x"]), "y": int(part["anchor_y"])},
                       "footprint": {"x": int(part["footprint_cells_x"]), "y": int(part["footprint_cells_y"])},
                       "displayScale": float(part["recommended_display_scale"])}
        prompt = ROOT / "docs/provenance/prompts" / f"{key}-wave27.txt"
        prompt.write_text(part["prompt"].strip() + "\n")
        rows.append({"assetId": f"wave27/{key}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": record.get("generation_tool", "built-in image_gen"),
                     "model": "not provided", "generatedAt": "2026-09-28", "prompt": str(prompt.relative_to(ROOT)),
                     "referenceInputs": "records/provenance/reference_manifest.json", "seed": "not provided", "candidates": "1",
                     "manualEdits": "uniform alpha-bounds contain into the canvas (records/provenance/scripts); no installation edit",
                     "artBible": "Wave 27 records/README.md", "historicalProfile": "", "owner": "Astra", "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave27 {part['id']} (confirmed in assets-inbox/INBOX_LEDGER.csv) installed by INSTALL-27 on 2026-09-29 from "
                              f"{BATCH.relative_to(ROOT)}; generation source sha256 {record.get('generation_source_sha256', 'not recorded')}; "
                              f"no C2PA chunk, received bytes = runtime bytes. QA: {part['visual_notes']}"})
        installed.add(inbox_key)
    assert len(images) == 40, len(images)
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    raw = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
    fields = list(inbox[0].keys())
    for row in inbox:
        if row["file"] in installed:
            row["installed_by"] = "INSTALL-27"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if "\r\n" in raw else "\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '), ensure_ascii=False)}," for key, value in sorted(images.items()))
    MANIFEST.write_text("// Generated by scripts/installWave27.py — Wave 27 backyard decals (INSTALL-27): url, size, category, kind, variant,\n"
                        "// anchor (the canvas's front ground point), footprint in cells and Astra's display scale (records/assets.csv).\n"
                        "export const WAVE27_YARD_IMAGES = {\n" + body + "\n} as const;\n\nexport type Wave27YardKey = keyof typeof WAVE27_YARD_IMAGES;\n")
    print(len(rows), "rows;", len(images), "installed")


if __name__ == "__main__":
    main()
