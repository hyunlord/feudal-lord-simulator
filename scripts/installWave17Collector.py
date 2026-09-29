"""UI-9b: install Wave 17's lord's tax collector walker (wk/wk_tax_collector-v1, confirmed in
assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-26) into public/assets/wave17/walker, for the 1381 chase (it replaces the
Wave 9 royal messenger that stood in for him in UI-9). The batch carries no C2PA chunks (asserted): received bytes =
runtime bytes. One docs/provenance/assets.csv row (replacing an earlier row for the runtime path) with its prompt file,
`installed_by` = UI-9b in the inbox ledger, and src/render/wave17WalkerManifest.generated.ts with the sheet's frame data
from the batch records: the cell size, columns and gait rows (records/assets.csv cell_width/cell_height, columns,
frames), each cell's foot (records/frame_pivots.csv: Astra's measurement of the registered template, one row per
direction and gait frame) and the pivot (the cell's centre, the feet's median row); the figure height is the cells'
median opaque height (alpha > 32), the rule the other story walkers are scaled by (storyWorldProps.ts).
Run: python3 scripts/installWave17Collector.py
"""
import csv
import hashlib
import json
import shutil
import statistics
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
BATCH = ROOT / "assets-inbox/wave17/candidates-20260926"
FILE = "wk/wk_tax_collector-v1.png"
KEY = "wk_tax_collector"
RUNTIME = ROOT / "public/assets/wave17/walker"
MANIFEST = ROOT / "src/render/wave17WalkerManifest.generated.ts"
USED_IN = "src/render/wave17WalkerManifest.generated.ts (UI-9b: the lord's collector chased in 1381, src/render/reorgWorldProps.ts)"
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
    source = BATCH / "assets" / FILE
    inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
    digest = sha(source)
    inbox_text = INBOX_LEDGER.read_bytes().decode("utf-8")
    inbox = list(csv.DictReader(inbox_text.splitlines()))
    row = next(row for row in inbox if row["file"] == inbox_key)
    assert row["sha256"] == digest and row["status"] == "confirmed", inbox_key
    record = {row["file"]: row for row in csv.DictReader(open(BATCH / "records/assets.csv", encoding="utf-8-sig"))}[f"assets/{FILE}"]
    assert record["sha256"] == digest, FILE
    assert not C2PA_CHUNKS & set(png_chunks(source.read_bytes())), f"{FILE} carries a C2PA chunk"
    runtime = RUNTIME / source.name
    runtime.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, runtime)
    assert sha(runtime) == digest, FILE

    cell_w, cell_h = int(record["cell_width"]), int(record["cell_height"])
    columns, rows = int(record["columns"]), int(record["frames"])
    directions = record["directions"].split("|")
    assert (cell_w * columns, cell_h * rows) == (int(record["width"]), int(record["height"])), "the sheet is its cells"
    feet = {direction: [None] * rows for direction in directions}
    for pivot in csv.DictReader(open(BATCH / "records/frame_pivots.csv", encoding="utf-8-sig")):
        if pivot[next(iter(pivot))] != f"assets/{FILE}":
            continue
        values = list(pivot.values())
        direction, frame, x, y = values[1], int(values[2]), float(values[3]), float(values[4])
        feet[direction][frame] = {"x": round(x, 2), "y": round(y, 2)}
    assert all(foot is not None for cells in feet.values() for foot in cells), "a foot for every cell"
    image = Image.open(runtime).convert("RGBA")
    heights = []
    for column in range(columns):
        for frame in range(rows):
            box = image.crop((column * cell_w, frame * cell_h, (column + 1) * cell_w, (frame + 1) * cell_h)).getchannel("A").point(lambda a: 255 if a > 32 else 0).getbbox()
            heights.append(box[3] - box[1])
    manifest = {"url": f"assets/wave17/walker/{source.name}", "width": image.width, "height": image.height,
                "pivot": {"x": cell_w // 2, "y": round(statistics.median(foot["y"] for cells in feet.values() for foot in cells))},
                "frames": {"width": cell_w, "height": cell_h, "count": columns, "rows": rows}, "directions": directions,
                "feet": feet, "figureHeight": round(statistics.median(heights))}

    prompt = ROOT / "docs/provenance/prompts" / f"{KEY}-wave17.txt"
    prompt.write_text((record.get("full_prompt") or "(no prompt recorded)").strip() + "\n")
    ledger_row = {"assetId": f"wave17/{KEY}", "version": "v1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                  "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": "native image_gen", "model": "not exposed",
                  "generatedAt": "2026-09-26", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": record.get("reference_files", "") or "none",
                  "seed": "not exposed", "candidates": "1", "manualEdits": record.get("processing", ""),
                  "artBible": "AB_2026-09-19_v1", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra wave17",
                  "usedIn": USED_IN, "status": "runtime",
                  "notes": f"Astra wave17 {record['asset_id']} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-26) installed by UI-9b "
                           f"on 2026-09-29 from {BATCH.relative_to(ROOT)}; no C2PA chunk, received bytes = runtime bytes."}
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] != ledger_row["runtimePath"]]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: ledger_row.get(key, "") for key in header}])
    # The inbox ledger: only this row's installed_by changes (the file keeps its CRLF lines byte for byte otherwise).
    line = next(line for line in inbox_text.split("\r\n") if line.startswith(f"wave17,{inbox_key},"))
    assert line.endswith(","), line
    INBOX_LEDGER.write_bytes(inbox_text.replace(line + "\r\n", line + "UI-9b\r\n", 1).encode("utf-8"))

    MANIFEST.write_text("// Generated by scripts/installWave17Collector.py — Wave 17's lord's tax collector (UI-9b): url, size, the pivot (cell\n"
                        "// centre, the feet's median row), the sheet's cells (columns NE SE SW NW, rows the gait frames) with each cell's\n"
                        "// foot from records/frame_pivots.csv, and the figure height (median opaque cell height, alpha > 32).\n"
                        "export const WAVE17_WALKER_IMAGES = {\n"
                        f"  {KEY}: {json.dumps(manifest, separators=(', ', ': '))},\n"
                        "} as const;\n")
    print("installed", KEY, manifest["pivot"], manifest["figureHeight"])


if __name__ == "__main__":
    main()
