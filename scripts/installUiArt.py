"""UX-2: install the UI P0 art from assets-inbox/ui-p0 into public/assets/ui-p0 and write its manifest and ledger rows.

- Every received PNG loses its C2PA caBX chunk (IDAT unchanged); the result equals the Astra ledger SHA (P0 or rework).
- Icon sheets (96 px cells) get 24/32/48/64 px copies, each cell Lanczos-scaled on its own so no neighbour bleeds in;
  the UI shows an icon at 24/32/48 CSS px with the 1x / 2x copy (the 96 original is the 48 px icon's 2x). The browser
  never scales an icon at run time.
- Cursors (64 px) get a 32 px copy (1x; the original is the 2x), the steward portraits and their round frame (192 px)
  a 96 px copy.
- Writes src/ui/uiArtManifest.generated.ts (urls, sizes, 9-slice insets, cell ids, hotspots), the ledger rows in
  docs/provenance/assets.csv (replacing earlier ui-p0 rows) and one prompt file per received asset.
Run: python3 scripts/installUiArt.py            (idempotent: the same inbox gives byte-identical output)
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
INBOX = ROOT / "assets-inbox/ui-p0"
OUT = ROOT / "public/assets/ui-p0"
MANIFEST = ROOT / "src/ui/uiArtManifest.generated.ts"
LEDGER = ROOT / "docs/provenance/assets.csv"
PROMPTS = ROOT / "docs/provenance/prompts"
csv.field_size_limit(sys.maxsize)

# Cell ids of each icon sheet, in the ledger's cellOrder (the rework keeps the P0 order and replaces cells in place).
CELLS = {
    "icon_resource_sheet": ["population", "bread", "timber", "stone", "coin", "spring", "summer", "autumn", "winter"],
    "icon_build_category_sheet": ["living", "paths", "trade", "storage", "public", "defense"],
    "icon_layer_mode_sheet": ["direct", "zone", "direction"],
    "icon_first_session_buildings_sheet": ["hut", "well", "road", "field", "barn", "windmill", "granary", "warehouse",
                                           "chapel", "market", "burgage", "palisade"],
    "icon_prediction_sheet": ["pending", "ok", "warn", "block"],
    "icon_cause_family_sheet": ["water", "food", "access", "labour", "storage", "safety", "rights"],
    "icon_alert_priority_sheet": ["warn", "urgent", "info"],
    "icon_time_sheet": ["pause", "play", "fast", "fastest"],
    "icon_objective_action_sheet": ["open", "look", "log", "up"],
    "icon_lock_new_sheet": ["locked", "new", "help"],
    "warning_map_marker_sheet": ["warn", "urgent"],
}
ICON_SIZES = (24, 32, 48, 64)
CURSOR_SIZE = 32
PORTRAIT_SIZE = 96
PORTRAITS = ("advisor_steward_portrait_neutral", "advisor_steward_portrait_concern", "advisor_steward_portrait_success",
             "advisor_portrait_frame")


def without_cabx(data: bytes) -> bytes:
    out, i = data[:8], 8
    while i < len(data):
        n = struct.unpack(">I", data[i:i + 4])[0]
        if data[i + 4:i + 8] != b"caBX":
            out += data[i:i + 12 + n]
        i += 12 + n
    return out


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_bytes() != data:
        path.write_bytes(data)


def scaled_sheet(image: Image.Image, cells: int, size: int) -> Image.Image:
    sheet = Image.new("RGBA", (cells * size, size), (0, 0, 0, 0))
    for index in range(cells):
        cell = image.crop((index * 96, 0, index * 96 + 96, 96)).resize((size, size), Image.Resampling.LANCZOS)
        sheet.paste(cell, (index * size, 0))
    return sheet


def ledger_rows(name: str) -> tuple[dict, dict | None]:
    p0 = {row["file"]: row for row in csv.DictReader(open(INBOX / "provenance-ui-p0.csv", encoding="utf-8-sig"))}
    rework = {row["file"]: row for row in csv.DictReader(open(INBOX / "provenance-ui-p0-rework.csv", encoding="utf-8-sig"))}
    key = f"assets/ui/{name}.png"
    return p0[key], rework.get(key)


def prompt_text(record: str) -> str:
    try:
        data = json.loads(record)
    except json.JSONDecodeError:
        return record
    items = data if isinstance(data, list) else [data]
    parts = []
    for item in items:
        if not isinstance(item, dict):
            continue
        text = item.get("prompt")
        if text:
            parts.append(text)
        elif item.get("mode") == "reuse":
            parts.append(f"(reuse: {item.get('reference')} — {item.get('reason')})")
    return "\n\n---\n\n".join(parts) if parts else record


def references(record: str) -> str:
    try:
        data = json.loads(record)
    except json.JSONDecodeError:
        return "none"
    items = data if isinstance(data, list) else [data]
    refs = []
    for item in items:
        if isinstance(item, dict):
            value = item.get("references") or item.get("reference")
            refs.extend(value if isinstance(value, list) else [value] if value else [])
    return ", ".join(Path(ref).name for ref in refs) or "none"


def main() -> None:
    received = sorted((INBOX / "ui").glob("*.png"))
    assert len(received) == 43, len(received)
    manifest: dict = {"frames": {}, "iconSheets": {}, "cursors": {}, "portraits": {}, "textures": {}}
    rows = []

    def ledger_row(asset_id: str, runtime: Path, data: bytes, source: Path, p0: dict, rework: dict | None, derived: str | None) -> dict:
        record = rework or p0
        version = "p0r" if rework is not None and rework["sha256"] != p0["sha256"] else "p0"
        prompt_path = PROMPTS / f"ui_{source.stem}-{version}.txt"
        write(prompt_path, (prompt_text(record["generation_records"]) + "\n").encode())
        notes = (f"Astra UI P0 ledger row {record['asset_id']} ({'rework 2026-09-25 22:21' if version == 'p0r' else 'P0'}, "
                 f"status candidate) installed by UX-2 on 2026-09-26 from assets-inbox/ui-p0; the received PNG carries a C2PA "
                 f"caBX chunk, the original's runtime bytes are the received bytes without it (IDAT unchanged) and equal the ledger "
                 f"SHA {record['sha256']}; role: {record['role'][:160]}; slice/cells {record['slice_or_cells'][:200]}")
        if derived is not None:
            notes += f"; {derived}"
        return {
            "assetId": asset_id, "version": version, "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": sha(data),
            "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": sha(source.read_bytes()),
            "tool": "image_gen.imagegen; Astra PNG registration", "model": "not exposed", "generatedAt": "2026-09-25",
            "prompt": str(prompt_path.relative_to(ROOT)), "referenceInputs": references(record["generation_records"]),
            "seed": "not exposed", "candidates": "1",
            "manualEdits": (record["processing"].strip('"')[:300] + ("; UX-2: scripts/installUiArt.py " + derived if derived else "; UX-2: caBX removed only")),
            "artBible": "AB_2026-09-19_v1", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra UI P0",
            "usedIn": "src/ui/uiArtManifest.generated.ts; src/styles/uiSkin.css; src/ui/UiIcon.tsx", "status": "runtime", "notes": notes,
        }

    for source in received:
        name = source.stem
        p0, rework = ledger_rows(name)
        record = rework or p0
        original = without_cabx(source.read_bytes())
        assert sha(original) == record["sha256"], name
        runtime = OUT / f"{name}.png"
        write(runtime, original)
        rows.append(ledger_row(f"ui_{name}", runtime, original, source, p0, rework, None))
        url = f"assets/ui-p0/{name}.png"
        image = Image.open(io.BytesIO(original)).convert("RGBA")
        slice_info = json.loads(record["slice_or_cells"]) if record["slice_or_cells"] not in ("", "null") else {}
        if name in CELLS:
            cells = CELLS[name]
            assert image.size == (96 * len(cells), 96), (name, image.size)
            sizes = {"96": {"url": url}}
            for size in ICON_SIZES:
                data = png_bytes(scaled_sheet(image, len(cells), size))
                path = OUT / "icons" / f"{name}-{size}.png"
                write(path, data)
                rows.append(ledger_row(f"ui_{name}_{size}", path, data, source, p0, rework, f"per-cell Lanczos {size} px copy of the 96 px sheet"))
                sizes[str(size)] = {"url": f"assets/ui-p0/icons/{name}-{size}.png"}
            manifest["iconSheets"][name] = {"cells": cells, "sizes": sizes}
        elif name.startswith("cursor_"):
            hotspot = json.loads(p0["hotspot"])
            data = png_bytes(image.resize((CURSOR_SIZE, CURSOR_SIZE), Image.Resampling.LANCZOS))
            path = OUT / "cursors" / f"{name}-{CURSOR_SIZE}.png"
            write(path, data)
            rows.append(ledger_row(f"ui_{name}_{CURSOR_SIZE}", path, data, source, p0, rework, "Lanczos 32 px (1x) copy of the 64 px cursor"))
            manifest["cursors"][name] = {"x1": {"url": f"assets/ui-p0/cursors/{name}-{CURSOR_SIZE}.png"}, "x2": {"url": url},
                                         "hotspot": [round(hotspot[0] / 2), round(hotspot[1] / 2)]}
        elif name in PORTRAITS:
            data = png_bytes(image.resize((PORTRAIT_SIZE, PORTRAIT_SIZE), Image.Resampling.LANCZOS))
            path = OUT / "portraits" / f"{name}-{PORTRAIT_SIZE}.png"
            write(path, data)
            rows.append(ledger_row(f"ui_{name}_{PORTRAIT_SIZE}", path, data, source, p0, rework, "Lanczos 96 px (1x) copy of the 192 px portrait"))
            manifest["portraits"][name] = {"x1": {"url": f"assets/ui-p0/portraits/{name}-{PORTRAIT_SIZE}.png"}, "x2": {"url": url}}
        elif name.startswith("texture_") or name.startswith("divider_"):
            manifest["textures"][name] = {"url": url, "width": image.width, "height": image.height}
        else:
            manifest["frames"][name] = {"url": url, "width": image.width, "height": image.height,
                                        "slice": {side: slice_info[side] for side in ("left", "top", "right", "bottom")},
                                        "sourceScale": slice_info.get("sourceScale", 2)}

    body = json.dumps(manifest, indent=1, ensure_ascii=False, sort_keys=True)
    write(MANIFEST, (
        "// Generated by scripts/installUiArt.py from assets-inbox/ui-p0 (UX-2). Do not edit by hand.\n"
        "// Frames: 9-slice insets in source pixels (sourceScale 2 = drawn at half size, 1:1 on a DPR 2 screen).\n"
        "// Icon sheets: 96 px cells in `cells` order; `sizes` holds the per-cell Lanczos copies (1x / 2x per CSS size).\n"
        f"export const UI_ART_MANIFEST = {body} as const;\n").encode())

    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if not row["runtimePath"].startswith("public/assets/ui-p0/")]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(kept + rows)
    print(f"{len(received)} received · {len(rows)} ledger rows · {len(manifest['iconSheets'])} icon sheets")


if __name__ == "__main__":
    main()
