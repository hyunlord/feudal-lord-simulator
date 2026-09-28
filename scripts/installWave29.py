"""INSTALL-29: install Wave 29, the water's motion (14 confirmed effect sheets from assets-inbox/wave29/candidates-20260928,
verdict 2026-09-28) into public/assets/wave29/water: the deep and shallow ripples, the shore foam strip, the static ice
rim, the river flow in four directions, the mill-race rapids, the three reed sway sheets, the sun glint and the fish
ring. The proofs, the previews (the WebP loop, the representative-frame PNGs) and the QA pictures are records, not
runtime, and stay in the inbox. The batch carries no C2PA chunk (asserted): received bytes = runtime bytes.
One docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths), one prompt file each (the
batch's own records/assets.csv prompt), `installed_by` = INSTALL-29 in the inbox ledger, and
src/render/wave29WaterManifest.generated.ts: url, frame size, frame count, fps, loop, repeat axes, recommended alpha,
anchor and placement offset of each sheet, as records/assets.csv gives them.
Run: python3 scripts/installWave29.py
"""
import csv
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/wave29/candidates-20260928"
RUNTIME = ROOT / "public/assets/wave29/water"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/render/wave29WaterManifest.generated.ts"
USED_IN = "src/render/wave29WaterManifest.generated.ts (INSTALL-29: water motion — ripples, shore foam, ice rim, river flow, reeds, glints, fish rings; the mill race registered only)"
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


def number(text: str):
    """An integer when the CSV value is one, else a float; empty -> None."""
    if text == "":
        return None
    value = float(text)
    return int(value) if value.is_integer() else value


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    sheets = list(csv.DictReader(open(BATCH / "records/assets.csv", encoding="utf-8-sig")))
    rows, installed, images = [], set(), {}
    RUNTIME.mkdir(parents=True, exist_ok=True)
    for sheet in sheets:
        source = BATCH / sheet["file"]
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        digest = sha(source)
        assert digest == sheet["sha256"], sheet["id"]
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        chunks, width, height = png_info(source.read_bytes())
        assert not C2PA_CHUNKS & chunks, f"{sheet['id']} carries a C2PA chunk"
        frames, frame_width, frame_height = int(sheet["frame_count"]), int(sheet["frame_width"]), int(sheet["frame_height"])
        # One row, left to right, no margins: the sheet is exactly frames x frame wide.
        assert sheet["layout"] == "horizontal" and (width, height) == (frames * frame_width, frame_height), sheet["id"]
        assert (width, height) == (int(sheet["sheet_width"]), int(sheet["sheet_height"])), sheet["id"]
        runtime = RUNTIME / f"{sheet['id']}.png"
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, sheet["id"]
        images[sheet["id"]] = {
            "url": f"assets/wave29/water/{sheet['id']}.png", "frameWidth": frame_width, "frameHeight": frame_height, "frames": frames,
            "fps": number(sheet["fps"]), "loop": sheet["loop"] == "true", "repeatX": sheet["repeat_x"] == "true", "repeatY": sheet["repeat_y"] == "true",
            "alpha": number(sheet["recommended_alpha"]), "anchorX": number(sheet["anchor_x"]), "anchorY": number(sheet["anchor_y"]),
            "offsetX": number(sheet["placement_offset_x"]), "offsetY": number(sheet["placement_offset_y"]),
        }
        prompt = ROOT / "docs/provenance/prompts" / f"{sheet['id']}-wave29.txt"
        prompt.write_text(sheet["prompt"].strip() + "\n")
        rows.append({"assetId": f"wave29/{sheet['id']}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": "native image_gen", "model": "not exposed",
                     "generatedAt": "2026-09-28", "prompt": str(prompt.relative_to(ROOT)),
                     "referenceInputs": f"generation source {sheet['generation_source']} (sha256 {sheet['source_sha256']}); records/provenance/", "seed": "not exposed",
                     "candidates": "1", "manualEdits": f"sheet cut from one painted base (records/provenance/): {sheet['notes']}", "artBible": "AB_2026-09-19_v1",
                     "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra wave29", "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave29 water/{sheet['id']} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-28) installed by INSTALL-29 on 2026-09-29 from "
                              f"{BATCH.relative_to(ROOT)}; no C2PA chunk, received bytes = runtime bytes. Condition: {sheet['activation_condition']}."})
        installed.add(inbox_key)
    assert len(images) == 14 and sum(image["frames"] for image in images.values()) == 77, (len(images), sum(image["frames"] for image in images.values()))
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
            row["installed_by"] = "INSTALL-29"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if "\r\n" in raw else "\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(images.items()))
    MANIFEST.write_text("// Generated by scripts/installWave29.py — Wave 29 water motion sheets (INSTALL-29), from the batch's records/assets.csv: url,\n"
                        "// frame size and count (one row, left to right, no margins), fps (0: static), loop, repeat axes, recommended alpha (the\n"
                        "// ripples' low alpha is baked in the PNG: only this is applied), anchor and placement offset (null: none given).\n"
                        "export const WAVE29_WATER = {\n" + body + "\n} as const;\n\nexport type Wave29WaterKey = keyof typeof WAVE29_WATER;\n")
    print(len(rows), "rows;", len(images), "installed")


if __name__ == "__main__":
    main()
