"""INSTALL-23: install Wave 23's 82 pictures (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-28; INBOX-1r)
from assets-inbox/wave23/candidates-20260928 into public/assets/wave23/<group>: the royal arms (2 x 256/96), weather
(14), village life (birds 4, ground animals 8, props 8), person-state portrait ornaments (12 x 96/48) and pad glyphs (10
x 48/32). The batch carries no C2PA chunk (asserted): received bytes = runtime bytes.
 - The newborn ornament is installed as `child_born` (INSTALL-23 order: the parents' portrait, "아이를 얻음").
 - Each picture's Astra record (records/assets.csv) gives the manifest its size, role, blend mode and opacity cap, frame
   layout, pivot and display scale.
One docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths) with one prompt file each,
`installed_by` = INSTALL-23 in the inbox ledger, and src/render/wave23ArtManifest.generated.ts.
Run: python3 scripts/installWave23.py
"""
import csv
import hashlib
import json
import shutil
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/wave23/candidates-20260928"
RUNTIME = ROOT / "public/assets/wave23"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/render/wave23ArtManifest.generated.ts"
RENAME = {"newborn": "child_born"}
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
USED_IN = "src/render/wave23ArtManifest.generated.ts (INSTALL-23: royal arms, weather, village life, person-state ornaments, pad glyphs)"
csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def chunks(data: bytes) -> set:
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    found, i = set(), 8
    while i < len(data):
        n = struct.unpack(">I", data[i:i + 4])[0]
        found.add(data[i + 4:i + 8])
        i += 12 + n
    return found


def runtime_stem(stem: str) -> str:
    for old, new in RENAME.items():
        if stem == old or stem.startswith(f"{old}_"):
            return new + stem[len(old):]
    return stem


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    records = list(csv.DictReader(open(BATCH / "records/assets.csv", encoding="utf-8-sig")))
    # Pure ownership check precedes any writes; canonical82 is read anew on every invocation.
    canonical = [{"key": runtime_stem(Path(record["file"]).stem),
                  "url": f"assets/wave23/{Path(record['file']).parent.name}/{runtime_stem(Path(record['file']).stem)}.png",
                  "sha256": record["sha256"]} for record in records]
    legacy_keys = set(json.loads(subprocess.check_output(
        [str(ROOT / "node_modules/.bin/tsx"), str(ROOT / "scripts/wave23CloudOwnership.ts"),
         str(ROOT / "src/render/art/catalog.json")], input=json.dumps(canonical), text=True, cwd=ROOT)))
    rows, installed, images = [], set(), {}
    for record in records:
        source = BATCH / record["file"]
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        digest = sha(source)
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        assert record["sha256"] == digest, record["file"]
        assert not C2PA_CHUNKS & chunks(source.read_bytes()), f"{record['file']} carries a C2PA chunk"
        group = source.parent.name
        key = runtime_stem(source.stem)
        if key not in legacy_keys:
            continue
        runtime = RUNTIME / group / f"{key}.png"
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, record["file"]
        frames = json.loads(record["frame_layout"]) if record["frame_layout"] not in ("", "null") else None
        pivot = json.loads(record["pivot"])
        images[key] = {"url": f"assets/wave23/{group}/{key}.png", "group": group, "width": int(record["width"]), "height": int(record["height"]),
                       "role": record["role"], "blend": record["blend_mode"], "opacityMax": float(record["opacity_max"]),
                       **({"frames": frames} if frames is not None else {}),
                       "pivot": {"x": pivot[0], "y": pivot[1]} if isinstance(pivot, list) else {"x": pivot["x"], "y": pivot["y"]},
                       "displayScale": float(record["display_scale"])}
        prompt = ROOT / "docs/provenance/prompts" / f"{key}-wave23.txt"
        generation = json.loads(record["generation_records"] or "[]")
        prompt.write_text(((generation[0].get("prompt") if generation else None) or "(no prompt recorded)").strip() + "\n")
        renamed = key != source.stem
        rows.append({"assetId": f"wave23/{key}", "version": "v1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": "native image_gen", "model": "not exposed",
                     "generatedAt": "2026-09-28", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": "see records/asset-rows.json",
                     "seed": "not exposed", "candidates": "1", "manualEdits": record.get("processing", ""),
                     "artBible": "AB_2026-09-19_v1", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra wave23",
                     "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave23 {record['asset_id']} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-28) installed by INSTALL-23 on "
                              f"2026-09-28 from {BATCH.relative_to(ROOT)}; no C2PA chunk, received bytes = runtime bytes"
                              + (f"; installed as {key} (renamed from {source.stem})." if renamed else ".")})
        installed.add(inbox_key)
    assert len(images) == 80, len(images)
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
            row["installed_by"] = "INSTALL-23"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if "\r\n" in raw else "\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '), ensure_ascii=False)}," for key, value in sorted(images.items()))
    MANIFEST.write_text("// Generated by scripts/installWave23.py — Wave 23 (INSTALL-23): url, group, size, role, blend mode and opacity cap,\n"
                        "// frame layout, pivot and display scale from Astra's records (records/assets.csv). The newborn ornament is child_born.\n"
                        "export const WAVE23_IMAGES = {\n" + body + "\n} as const;\n\nexport type Wave23Key = keyof typeof WAVE23_IMAGES;\n")
    print(len(rows), "rows;", len(images), "installed")


if __name__ == "__main__":
    main()
