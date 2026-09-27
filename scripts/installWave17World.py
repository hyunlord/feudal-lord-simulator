"""UI-6: install Wave 17's four world sprites (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-26) into
public/assets/wave17/world: the coastal beacon unlit and lit (bld/beacon_idle-v1, bld/beacon_lit-v1) and the raid's
burning quay and smoke column sheet (event/raid_burning_quay-v1, event/raid_smoke_column_sheet-v1). The batch carries
no C2PA chunks (asserted): received bytes = runtime bytes. One docs/provenance/assets.csv row each (replacing earlier
rows for these runtime paths) with one prompt file each (records/assets.csv `full_prompt`), `installed_by` = UI-6 in
the inbox ledger, and src/render/wave17WorldManifest.generated.ts: url, size, cell size, frames and the ground pivot
(records/assets.csv pivot_x/pivot_y, cell_width/cell_height, frames, game_zoom_1_source_scale).
Run: python3 scripts/installWave17World.py   (then python3 scripts/installChronicleArt.py keeps these rows)
"""
import csv
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
BATCH = ROOT / "assets-inbox/wave17/candidates-20260926"
RUNTIME = ROOT / "public/assets/wave17/world"
MANIFEST = ROOT / "src/render/wave17WorldManifest.generated.ts"
WANTED = {"beacon_idle": "bld/beacon_idle-v1.png", "beacon_lit": "bld/beacon_lit-v1.png",
          "raid_burning_quay": "event/raid_burning_quay-v1.png", "raid_smoke_column_sheet": "event/raid_smoke_column_sheet-v1.png"}
USED_IN = "src/render/wave17WorldManifest.generated.ts (UI-6: the coastal beacon and the raid's burning quay and smoke, src/render/warWorldProps.ts)"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_chunks(data: bytes) -> list:
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    chunks, i = [], 8
    while i < len(data):
        n = struct.unpack(">I", data[i:i + 4])[0]
        chunks.append(data[i + 4:i + 8])
        i += 12 + n
    return chunks


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    records = {row["file"]: row for row in csv.DictReader(open(BATCH / "records/assets.csv", encoding="utf-8-sig"))}
    rows, installed, images = [], set(), {}
    for key, file in WANTED.items():
        source = BATCH / "assets" / file
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        digest = sha(source)
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        record = records[f"assets/{file}"]
        assert record["sha256"] == digest, file
        assert not C2PA_CHUNKS & set(png_chunks(source.read_bytes())), f"{file} carries a C2PA chunk"
        runtime = RUNTIME / source.name
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, file
        frames = int(record["frames"] or "1")
        images[key] = {"url": f"assets/wave17/world/{source.name}", "width": int(record["width"]), "height": int(record["height"]),
                       "pivot": {"x": int(record["pivot_x"]), "y": int(record["pivot_y"])},
                       "cell": {"width": int(record["cell_width"]), "height": int(record["cell_height"])},
                       **({"frames": {"width": int(record["cell_width"]), "height": int(record["cell_height"]), "count": frames}} if frames > 1 else {}),
                       "footprint": {"width": int(record["footprint_tiles_x"]), "height": int(record["footprint_tiles_y"])},
                       "zoom1Scale": float(record["game_zoom_1_source_scale"])}
        assert images[key]["cell"]["width"] * frames == images[key]["width"], key
        prompt = ROOT / "docs/provenance/prompts" / f"{key}-wave17.txt"
        prompt.write_text((record.get("full_prompt") or "(no prompt recorded)").strip() + "\n")
        rows.append({"assetId": f"wave17/{key}", "version": "v1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": "native image_gen", "model": "not exposed",
                     "generatedAt": "2026-09-26", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": record.get("reference_files", "") or "none",
                     "seed": "not exposed", "candidates": "1", "manualEdits": record.get("processing", ""),
                     "artBible": "AB_2026-09-19_v1", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra wave17",
                     "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave17 {record['asset_id']} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-26) installed by UI-6 "
                              f"on 2026-09-28 from {BATCH.relative_to(ROOT)}; no C2PA chunk, received bytes = runtime bytes."})
        installed.add(inbox_key)
    assert len(images) == 4, len(images)
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    fields = list(inbox[0].keys())
    for row in inbox:
        if row["file"] in installed:
            row["installed_by"] = "UI-6"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(images.items()))
    MANIFEST.write_text("// Generated by scripts/installWave17World.py — Wave 17 world sprites (UI-6): url, size, ground pivot (Astra's\n"
                        "// registration, source px), cell and, for the smoke sheet, its frames; footprint in tiles; zoom1Scale = world px per\n"
                        "// source px (game_zoom_1_source_scale).\n"
                        "export const WAVE17_WORLD_IMAGES = {\n" + body + "\n} as const;\n")
    print(len(rows), "rows;", len(images), "installed")


if __name__ == "__main__":
    main()
