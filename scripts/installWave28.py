"""INSTALL-28: install Wave 28, the countryside outside the walls (39 confirmed files from
assets-inbox/wave28/candidates-20260928, INBOX-2e, verdict 2026-09-28) into public/assets/wave28/<folder>: the four
boundary strips (hedgerow a / b, the field baulk, the dry-stone wall; 512 x 64, repeating along x) in strip/, the seven
point props (solitary oak, pollard willow, roadside cross, haystack, hurdle sheepfold, skep row, boundary stone) in
prop/ and the two wildflower field patches (small 128 x 64, large 256 x 128) in field/, each in summer, autumn and
winter (spring shares summer: records/README.md). The check pictures (proofs/) and the record layers are not
installed. No C2PA chunk (asserted): received bytes = runtime bytes.
One docs/provenance/assets.csv row each (replacing earlier INSTALL-28 rows for these paths), one prompt file each (the
batch's own generation prompt for the asset), `installed_by` = INSTALL-28 in the inbox ledger, and
src/render/wave28CountryManifest.generated.ts: url, folder, family, season, size and the ground pivot
(records/generation-records.csv `pivot_x` / `pivot_y`, top-left pixel coordinates).
Run: python3 scripts/installWave28.py
"""
import csv
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/wave28/candidates-20260928"
RUNTIME = ROOT / "public/assets/wave28"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/render/wave28CountryManifest.generated.ts"
USED_IN = "src/render/wave28CountryManifest.generated.ts (INSTALL-28: the countryside outside the walls — hedgerows, baulks and dry-stone walls on field edges, point props and wildflower patches)"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
FOLDERS = {
    "hedgerow_a": "strip", "hedgerow_b": "strip", "baulk": "strip", "dry_stone_wall": "strip",
    "oak_solitary": "prop", "willow_pollard": "prop", "roadside_cross": "prop", "haystack": "prop", "hurdle_fold": "prop",
    "skep_row": "prop", "boundary_stone": "prop",
    "wildflower_small": "field", "wildflower_large": "field",
}
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


def record_prompt(asset_id: str, record: str) -> str:
    """The batch's own generation prompt for the asset (records/<family>.json: `prompt`, or `prompt_exact` for the trees)."""
    data = json.loads((BATCH / record).read_text())
    entries = data["assets"] if isinstance(data, dict) else data
    entry = next(item for item in entries if item["id"] == asset_id)
    prompt = entry.get("prompt") or entry.get("prompt_exact")
    assert prompt, asset_id
    return prompt


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    parts = list(csv.DictReader(open(BATCH / "records/generation-records.csv", encoding="utf-8-sig")))
    rows, installed, images = [], set(), {}
    for part in parts:
        source = BATCH / part["file"]
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        digest = sha(source)
        assert digest == part["sha256"], part["id"]
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        chunks, width, height = png_info(source.read_bytes())
        assert not C2PA_CHUNKS & chunks, f"{part['id']} carries a C2PA chunk"
        assert (width, height) == (int(part["width"]), int(part["height"])), part["id"]
        folder = FOLDERS[part["family"]]
        runtime = RUNTIME / folder / f"{part['id']}.png"
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, part["id"]
        images[part["id"]] = {"url": f"assets/wave28/{folder}/{part['id']}.png", "folder": folder, "family": part["family"],
                              "season": part["season"], "width": width, "height": height,
                              "pivot": {"x": int(part["pivot_x"]), "y": int(part["pivot_y"])}}
        prompt = ROOT / "docs/provenance/prompts" / f"{part['id']}-wave28.txt"
        prompt.write_text(record_prompt(part["id"], part["provenance"]).strip() + "\n")
        qa = f"repeat {part['repeat']}" + (f", x edge difference {part['x_edge_diff_channels']} channels" if part["repeat"] == "X" else "")
        rows.append({"assetId": f"wave28/{part['id']}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": "builtin image_gen + batch normalization",
                     "model": part["model"], "generatedAt": "2026-09-28", "prompt": str(prompt.relative_to(ROOT)),
                     "referenceInputs": part["provenance"], "seed": part["seed"], "candidates": "1",
                     "manualEdits": "batch normalization (records/scripts); none at install", "artBible": "Wave 28 records/README.md",
                     "historicalProfile": "", "owner": "Astra", "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave28 {part['id']} (confirmed in assets-inbox/INBOX_LEDGER.csv) installed by INSTALL-28 on 2026-09-28 from "
                              f"{BATCH.relative_to(ROOT)}; no C2PA chunk, received bytes = runtime bytes. {qa}; spring reuse: {part['spring_reuse'] or 'no'}."})
        installed.add(inbox_key)
    assert len(images) == 39, len(images)
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
            row["installed_by"] = "INSTALL-28"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if "\r\n" in raw else "\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(images.items()))
    MANIFEST.write_text("// Generated by scripts/installWave28.py — Wave 28's countryside (INSTALL-28): url, folder, family, season, size and ground pivot of each picture.\n"
                        "export const WAVE28_COUNTRY_IMAGES = {\n" + body + "\n} as const;\n\nexport type Wave28CountryKey = keyof typeof WAVE28_COUNTRY_IMAGES;\n")
    print(len(rows), "rows;", len(images), "installed")


if __name__ == "__main__":
    main()
