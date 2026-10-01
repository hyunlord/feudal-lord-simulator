"""LAND-UI: install Wave 22, the lands' ground (confirmed files from assets-inbox/wave22, verdict 2026-09-27) into
public/assets/wave22/<folder>: what world/archetypeGround.ts (MA-5) can name and the season / a-b files behind it —
  - terrain/: the 30 fills (5 lands x summer, autumn, winter x a / b; 256 x 128, opaque, repeating in x and y) from
    rework-20260927 (the v2 files; the 15 superseded v1 fills are never installed);
  - boundary/: the four transition edges a / b (512 x 64) and the reed bed a / b (512 x 96), X-repeating strips;
  - shore/: sand beach, shingle and salt marsh a / b (512 x 96, X-repeating): sand_beach_a-v2 from the rework (its v1
    is superseded), the rest from candidates-20260927;
  - decals/ and props/: the pieces the lands' decal lists name (src/content/scenario/archetypes.ts `decals`), pivot
    (w / 2, h - 8) (records/README.md). decals/heath_patch_b and _c are confirmed but no land names them: not installed.
The file name drops its -vN suffix (`terrain/fen_summer_a-v2.png` -> `terrain/fen_summer_a.png`). The proofs and the
records stay in the inbox. No C2PA chunk (asserted): received bytes = runtime bytes.
One docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths), one prompt file each (the
rework's records/assets.csv prompt, which carries all 81 files' generation records), `installed_by` = LAND-UI in the
inbox ledger for these rows only, and src/render/wave22GroundManifest.generated.ts: url, folder, size and pivot.
Run: python3 scripts/installWave22.py
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
WAVE = ROOT / "assets-inbox/wave22"
BATCHES = [WAVE / "rework-20260927", WAVE / "candidates-20260927"]  # the rework first: its v2 files replace v1
RECORDS = WAVE / "rework-20260927/records/assets.csv"
ARCHETYPES = ROOT / "src/content/scenario/archetypes.ts"
RUNTIME = ROOT / "public/assets/wave22"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/render/wave22GroundManifest.generated.ts"
USED_IN = "src/render/wave22GroundManifest.generated.ts (LAND-UI: the lands' ground — fills, transition / shore / reed strips, decals and props; archetypeGroundDraw.ts)"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
FOLDERS = ("terrain", "boundary", "shore", "decals", "props")
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


def wanted(asset_id: str, named: set) -> bool:
    """A runtime file archetypeGroundLayer can name (its key = the id without the version, fills with season and a / b)."""
    folder, name = asset_id.split("/", 1)
    key = f"{folder}/{re.sub(r'-v[0-9]+$', '', name)}"
    if folder in ("terrain", "boundary", "shore"):
        return True
    return key in named


def main() -> None:
    named = set(re.findall(r'"((?:decals|props)/[a-z_]+)"', ARCHETYPES.read_text()))
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    records = list(csv.DictReader(open(RECORDS, encoding="utf-8-sig")))
    rows, installed, images = [], set(), {}
    for record in records:
        asset_id = record["assetId"]
        if not wanted(asset_id, named):
            continue
        source = next(batch / "assets" / record["runtimePath"] for batch in BATCHES if (batch / "assets" / record["runtimePath"]).exists())
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        digest = sha(source)
        assert digest == record["runtimeSha256"], asset_id
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        chunks, width, height = png_info(source.read_bytes())
        assert not C2PA_CHUNKS & chunks, f"{asset_id} carries a C2PA chunk"
        folder, name = asset_id.split("/", 1)
        assert folder in FOLDERS, asset_id
        key = f"{folder}/{re.sub(r'-v[0-9]+$', '', name)}"
        assert key not in images, key
        runtime = RUNTIME / f"{key}.png"
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, asset_id
        sprite = folder in ("decals", "props")
        images[key] = {"url": f"assets/wave22/{key}.png", "folder": folder, "width": width, "height": height,
                       "pivot": {"x": width // 2, "y": height - 8} if sprite else {"x": 0, "y": 0}}
        prompt = ROOT / "docs/provenance/prompts" / f"{key.replace('/', '-')}-wave22.txt"
        prompt.write_text(record["prompt"].strip() + "\n")
        rows.append({"assetId": f"wave22/{key}", "version": record["version"].lstrip("v"), "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": record["tool"], "model": record["model"],
                     "generatedAt": record["generatedAt"][:10], "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": record["referenceInputs"],
                     "seed": record["seed"], "candidates": record["candidates"], "manualEdits": record["manualEdits"], "artBible": record["artBible"],
                     "historicalProfile": record["historicalProfile"], "owner": record["owner"], "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave22 {asset_id} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-27) installed by LAND-UI on 2026-10-01 from "
                              f"{source.parent.parent.parent.relative_to(ROOT)}; no C2PA chunk, received bytes = runtime bytes."})
        installed.add(inbox_key)
    counts = {folder: sum(1 for image in images.values() if image["folder"] == folder) for folder in FOLDERS}
    assert counts == {"terrain": 30, "boundary": 10, "shore": 6, "decals": 13, "props": 20}, counts
    assert all(by_file[key]["status"] != "superseded" for key in installed)
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
            row["installed_by"] = "LAND-UI"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if "\r\n" in raw else "\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {json.dumps(key)}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(images.items()))
    MANIFEST.write_text("// Generated by scripts/installWave22.py — Wave 22's lands' ground (LAND-UI): url, folder, size and pivot of each picture\n"
                        "// (decals and props: the ground pivot (w / 2, h - 8); fills and strips: 0, 0). Keys are archetypeGroundLayer's keys, a\n"
                        "// fill's with its season and a / b (`terrain/fen_summer_a`).\n"
                        "export const WAVE22_GROUND_IMAGES = {\n" + body + "\n} as const;\n\nexport type Wave22GroundKey = keyof typeof WAVE22_GROUND_IMAGES;\n")
    print(len(rows), "rows;", len(images), "installed", counts)


if __name__ == "__main__":
    main()
