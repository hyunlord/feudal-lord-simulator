"""LAND-UI: install Wave 34, the river crossings and the fen's drainage works (28 confirmed files from
assets-inbox/wave34/candidates-20260929 and stage3-regions-20260929, verdict 2026-09-29) into public/assets/wave34/<folder>:
the fords (widths 2 / 3 / 4, axes ne / nw, summer and winter; 512 x 256, centre pivot) in ford/, the drainage stages 1 and
2 (128 x 64 isometric tiles), the stage 3 region sheets (5 x 5: 640 x 320, 3 x 3: 384 x 192, each drawn once over its
region, never repeated) and the finished drain strip (512 x 64, repeating along x) in drain/, and the works props and
the ford splashes in props/. The two stage 3 v1 tiles are superseded by the v3 region sheets (ledger `replaced_by`) and
are not installed; neither are the proofs and records. The `-vN` suffix is dropped. No C2PA chunk (asserted): received
bytes = runtime bytes.
One docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths), one prompt file each (the
batch's own records/assets.csv prompt), `installed_by` = LAND-UI in the inbox ledger (these rows only), and
src/render/wave34WorksManifest.generated.ts: url, folder, stage, season, repeat, size and pivot of each picture
(records/assets.csv `pivotX` / `pivotY`, top-left pixel coordinates).
Run: python3 scripts/installWave34.py
"""
import csv
import hashlib
import json
import re
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCHES = [ROOT / "assets-inbox/wave34/candidates-20260929", ROOT / "assets-inbox/wave34/stage3-regions-20260929"]
RUNTIME = ROOT / "public/assets/wave34"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/render/wave34WorksManifest.generated.ts"
USED_IN = "src/render/wave34WorksManifest.generated.ts (LAND-UI: fords on ford roads, the fen's drainage works by stage, the drained ground's edge, works props and ford splashes)"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
INSTALLED_BY = "LAND-UI"
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


def repeat_of(text: str) -> str:
    """none (one picture), x (a strip repeating along x), grid (isometric tiles on the 64 / 32 lattice), region (once)."""
    if text.startswith("NONE"):
        return "region"
    return {"none": "none", "X": "x", "isometric-grid": "grid"}[text]


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    rows, installed, images = [], set(), {}
    skipped = []
    for batch in BATCHES:
        for part in csv.DictReader(open(batch / "records/assets.csv", encoding="utf-8-sig")):
            source = batch / "assets" / part["runtimePath"]
            inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
            entry = by_file[inbox_key]
            if entry["status"] != "confirmed":
                assert entry["status"] == "superseded" and entry["replaced_by"], inbox_key
                skipped.append(inbox_key)
                continue
            digest = sha(source)
            assert digest == part["runtimeSha256"] == entry["sha256"], inbox_key
            chunks, width, height = png_info(source.read_bytes())
            assert not C2PA_CHUNKS & chunks, f"{inbox_key} carries a C2PA chunk"
            assert (width, height) == (int(part["width"]), int(part["height"])), inbox_key
            folder, file = part["runtimePath"].split("/")
            name = re.sub(r"-v\d+\.png$", "", file)
            runtime = RUNTIME / folder / f"{name}.png"
            runtime.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, runtime)
            assert sha(runtime) == digest, inbox_key
            assert name not in images, name
            images[name] = {"url": f"assets/wave34/{folder}/{name}.png", "folder": folder, "stage": part["stage"], "season": part["season"],
                            "repeat": repeat_of(part["repeat"]), "width": width, "height": height,
                            "pivot": {"x": int(part["pivotX"]), "y": int(part["pivotY"])}}
            prompt = ROOT / "docs/provenance/prompts" / f"{name}-wave34.txt"
            prompt.write_text(part["prompt"].strip() + "\n")
            rows.append({"assetId": f"wave34/{name}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                         "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": part["tool"], "model": part["model"],
                         "generatedAt": part["generatedAt"], "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": part["referenceInputs"],
                         "seed": part["seed"], "candidates": part["candidates"], "manualEdits": part["manualEdits"], "artBible": part["artBible"],
                         "historicalProfile": part["historicalProfile"], "owner": part["owner"], "usedIn": USED_IN, "status": "runtime",
                         "notes": f"Astra wave34 {folder}/{name} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-29) installed by {INSTALLED_BY} on "
                                  f"2026-10-01 from {batch.relative_to(ROOT)}; no C2PA chunk, received bytes = runtime bytes. Stage {part['stage']}, season "
                                  f"{part['season']}, repeat {part['repeat']}, pivot ({part['pivotX']}, {part['pivotY']})."})
            installed.add(inbox_key)
    assert len(images) == 28 and len(skipped) == 2, (len(images), skipped)
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
            row["installed_by"] = INSTALLED_BY
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if "\r\n" in raw else "\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(images.items()))
    MANIFEST.write_text("// Generated by scripts/installWave34.py — Wave 34's fords and drainage works (LAND-UI): url, folder, stage, season, repeat\n"
                        "// (none: one picture; x: a strip repeating along x; grid: 128 x 64 isometric tiles; region: one sheet drawn once over its\n"
                        "// region), size and pivot of each picture.\n"
                        "export const WAVE34_WORKS = {\n" + body + "\n} as const;\n\nexport type Wave34WorksKey = keyof typeof WAVE34_WORKS;\n")
    print(len(rows), "rows;", len(images), "installed;", len(skipped), "superseded skipped")


if __name__ == "__main__":
    main()
