"""LM-R1: install Wave 38, the UI controls (40 confirmed files: 35 from assets-inbox/wave38/candidates-20260930, verdict
2026-09-30, and the five reworks in assets-inbox/wave38/rework-20261001 that replace the primary button's four states and
tab_hover, verdict 2026-10-01; docs/ops/install-plan-20261003/SPECS/wave38.md) into public/assets/wave38/.
- The inbox ledger decides which file is current: a superseded candidate is followed to its replaced_by rework; every
  installed row must be `confirmed`, its bytes must match the ledger's sha256, and its size the batch record's.
- No C2PA chunk (asserted): received bytes = runtime bytes, nothing is resized, trimmed or flipped.
- src/ui/wave38ArtManifest.generated.ts: url, size, 9-slice (records/assets.csv slice_top/right/bottom/left, source px),
  min size and text_safe [x, y, width, height] as the batch records give them (the rework's own records/assets.csv for
  its five). scripts/frameTokens.ts turns these into the CSS tokens the kit and the skin wear.
- One docs/provenance/assets.csv row each (replacing earlier rows for these paths) and one prompt file each (the
  batch's catalog prompt, or the rework's generation prompt).
- `--installed`: also writes installed_by = LM-R1 on these 40 inbox ledger rows (CRLF kept). Run it only after the copy,
  the consumers and the captures are confirmed (INSTALL_PROTOCOL.md 6).
Run: python3 scripts/installWave38.py [--installed]
"""
import csv
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
INBOX = ROOT / "assets-inbox"
BATCH = INBOX / "wave38/candidates-20260930"
REWORK = INBOX / "wave38/rework-20261001"
RUNTIME = ROOT / "public/assets/wave38"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = INBOX / "INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/ui/wave38ArtManifest.generated.ts"
PROMPTS = ROOT / "docs/provenance/prompts"
INSTALLED_BY = "LM-R1"
USED_IN = ("src/ui/wave38ArtManifest.generated.ts -> scripts/frameTokens.ts (src/styles/frameTokens.generated.css --button-* / --control-*) "
           "-> src/styles/uiKit.css, src/styles/uiSkin.css (LM-R1: the kit's buttons, tabs, checkbox, radio, toggle, select, slider, "
           "number field, chip, the close button and the scrollbars)")
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
csv.field_size_limit(sys.maxsize)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def png_chunks(data: bytes) -> set:
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    found, i = set(), 8
    while i < len(data):
        n = struct.unpack(">I", data[i:i + 4])[0]
        found.add(data[i + 4:i + 8])
        i += 12 + n
    return found


def records(batch: Path) -> dict:
    return {row["id"]: row for row in csv.DictReader(open(batch / "records/assets.csv", encoding="utf-8-sig"))}


def main() -> None:
    mark = "--installed" in sys.argv[1:]
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8", newline="")))
    by_file = {row["file"]: row for row in inbox}
    candidates, reworks = records(BATCH), records(REWORK)
    catalog = {entry["id"]: entry for entry in json.loads((BATCH / "records/provenance/catalog.json").read_text())}
    generations = {entry["id"]: entry for entry in json.loads((REWORK / "records/provenance/generations.json").read_text())}
    RUNTIME.mkdir(parents=True, exist_ok=True)
    manifest, installed, provenance = [], [], []
    for asset_id, candidate in candidates.items():
        key = (BATCH / candidate["file"]).relative_to(INBOX).as_posix()
        entry = by_file[key]
        if entry["status"] == "superseded":
            key = entry["replaced_by"]
            entry = by_file[key]
        assert entry["status"] == "confirmed" and entry["replaced_by"] == "", key
        rework = key.startswith(REWORK.relative_to(INBOX).as_posix())
        record = reworks[asset_id] if rework else candidate
        source = INBOX / key
        data = source.read_bytes()
        digest = sha(data)
        assert digest == entry["sha256"] == record["sha256"], key
        assert not C2PA_CHUNKS & png_chunks(data), f"{key} carries a C2PA chunk"
        with Image.open(source) as image:
            assert image.size == (int(record["width"]), int(record["height"])), f"{key}: {image.size}"
            assert image.mode == "RGBA", key
        # The rework's record keeps the candidate's slice and text_safe contract (asserted, not assumed).
        for field in ("width", "height", "slice_top", "slice_right", "slice_bottom", "slice_left", "min_width", "min_height", "text_safe"):
            assert record[field] == candidate[field], f"{asset_id}: {field} {record[field]} != {candidate[field]}"
        target = RUNTIME / source.name
        shutil.copyfile(source, target)
        assert sha(target.read_bytes()) == digest
        text_safe = json.loads(record["text_safe"])
        manifest.append((asset_id, {"url": target.relative_to(ROOT / "public").as_posix(), "width": int(record["width"]), "height": int(record["height"]),
                                    "slice": {"top": int(record["slice_top"]), "right": int(record["slice_right"]), "bottom": int(record["slice_bottom"]), "left": int(record["slice_left"])},
                                    "min": {"width": int(record["min_width"]), "height": int(record["min_height"])},
                                    "textSafe": None if text_safe is None else {"x": text_safe[0], "y": text_safe[1], "width": text_safe[2], "height": text_safe[3]}}))
        if rework:
            generation = generations[asset_id]
            assert generation["output_sha256"] == digest, asset_id
            prompt_text, tool, references = generation["prompt"], generation["tool"], "; ".join(Path(ref["file"]).name for ref in generation["reference_records"])
            edits = json.dumps(generation["processing"], ensure_ascii=False, separators=(",", ":"))
            note = (f"Astra Wave 38 rework (UI-01 / tab_hover; confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-10-01) replacing "
                    f"{(BATCH / candidate['file']).relative_to(ROOT).as_posix()} (sha {candidate['sha256'][:12]})")
            generated = "2026-10-01"
        else:
            generation = catalog[asset_id]
            prompt_text, tool, references = generation["prompt"], "built-in image_gen (records/README.md)", ""
            edits = json.dumps(generation["processing"], ensure_ascii=False, separators=(",", ":")) if isinstance(generation["processing"], dict) else str(generation["processing"])
            note = "Astra Wave 38 UI control (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-30)"
            generated = "2026-09-30"
        prompt = PROMPTS / f"{asset_id}-wave38.txt"
        prompt.write_text(prompt_text.strip() + "\n")
        provenance.append({"assetId": f"wave38/{asset_id}", "version": "1", "runtimePath": target.relative_to(ROOT).as_posix(), "runtimeSha256": digest,
                           "sourcePath": source.relative_to(ROOT).as_posix(), "sourceSha256": digest, "tool": tool, "model": "not exposed",
                           "generatedAt": generated, "prompt": prompt.relative_to(ROOT).as_posix(), "referenceInputs": references, "seed": "not exposed",
                           "candidates": "1", "manualEdits": edits, "artBible": "Wave 38 records/README.md", "historicalProfile": "", "owner": "Astra",
                           "usedIn": USED_IN, "status": "runtime",
                           "notes": f"{note}; installed by {INSTALLED_BY} on 2026-10-03 into public/assets/wave38; {record['width']} x {record['height']}, "
                                    f"9-slice {record['slice_top']} {record['slice_right']} {record['slice_bottom']} {record['slice_left']}, text_safe {record['text_safe']}; "
                                    f"no C2PA chunk, received bytes = runtime bytes. The batch records give the delivery date, not a generation time."})
        installed.append(key)
    assert len(manifest) == 40, len(manifest)
    lines = ["// Generated by scripts/installWave38.py — Wave 38 UI controls (LM-R1): url, size, 9-slice insets (source px), min size",
             "// and text_safe {x, y, width, height} (source px) from the batch records. scripts/frameTokens.ts makes the CSS tokens.",
             "export const WAVE38_ART = {"]
    for asset_id, item in sorted(manifest):
        lines.append(f"  {asset_id}: {json.dumps(item, separators=(', ', ': '))},")
    lines += ["} as const;", "", "export type Wave38ArtId = keyof typeof WAVE38_ART;", ""]
    MANIFEST.write_text("\n".join(lines))
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    paths = {row["runtimePath"] for row in provenance}
    ledger = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in paths]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(ledger + sorted(provenance, key=lambda row: row["runtimePath"]))
    if mark:
        raw = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
        for row in inbox:
            if row["file"] in installed:
                row["installed_by"] = INSTALLED_BY
        with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(inbox[0].keys()), lineterminator="\r\n" if raw.split("\n", 1)[0].endswith("\r") else "\n")
            writer.writeheader(); writer.writerows(inbox)
    print(len(manifest), "files;", "installed_by written" if mark else "installed_by not written (pass --installed after the captures)")


if __name__ == "__main__":
    main()
