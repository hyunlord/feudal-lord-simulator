"""UI-4: install Wave 9 (41 confirmed runtime files: event overlays, decals, field ridges, fx sheets, props, event
walkers; candidates-20260925 and the rework-20260926 that replaced the plague shutters, hungry queue and biers) into
public/assets/wave9/<group>, and register Wave 16 (35 illustrations: event cards, famine decisions, chronicle,
chapter screens) as build-time web derivatives (judgement 2026-09-26, scripts/keyartDerivatives.ts: the PNGs stay in
assets-inbox). One docs/provenance/assets.csv row each (replacing earlier UI-4 rows) with one prompt file each,
`installed_by` = UI-4 in the inbox ledger, and two manifests:
  src/render/wave9ArtManifest.generated.ts  (url, size, frames: columns x rows for sheets, house overlays share the
                                             house art canvas, placed at (0,0) with the house's own pivot)
  src/ui/wave16ArtManifest.generated.ts     (url of the web derivative, size)
Run: python3 scripts/installWave9and16.py
"""
import csv
import hashlib
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
WAVE9 = [ROOT / "assets-inbox/wave9/candidates-20260925", ROOT / "assets-inbox/wave9/rework-20260926"]
WAVE16 = ROOT / "assets-inbox/wave16/candidates-v1"
MANIFEST9 = ROOT / "src/render/wave9ArtManifest.generated.ts"
MANIFEST16 = ROOT / "src/ui/wave16ArtManifest.generated.ts"
USED_IN9 = "src/render/wave9ArtManifest.generated.ts (UI-4: fire, burnt and abandoned houses, smoke, wet-summer ridges, puddles, rain, leaving family, petitioners)"
USED_IN16 = "src/ui/wave16ArtManifest.generated.ts (UI-4: event cards, famine decision, chronicle page, chapter screens; build-time web derivatives)"
csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_size(path: Path) -> tuple[int, int]:
    return struct.unpack(">II", path.read_bytes()[16:24])


def frames_of(layout: str) -> dict | None:
    # "4 columns x1 row" / "4 columns x2 rows;74x74; source column order"
    if "columns" not in layout:
        return None
    head = layout.split(";")[0]
    columns = int(head.split("columns")[0].strip())
    rows = int(head.split("x")[1].strip().split(" ")[0])
    return {"columns": columns, "rows": rows}


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    confirmed = {row["file"]: row for row in inbox if row["wave"] in ("wave9", "wave16") and row["status"] == "confirmed" and "/assets/" in row["file"]}
    records = {}
    for batch in WAVE9:
        for row in csv.DictReader(open(batch / "records/assets.csv", encoding="utf-8-sig")):
            records[(batch / row["file"]).relative_to(ROOT / "assets-inbox").as_posix()] = (batch, row)
    for row in csv.DictReader(open(WAVE16 / "records/assets.csv", encoding="utf-8-sig")):
        records[(WAVE16 / row["file"]).relative_to(ROOT / "assets-inbox").as_posix()] = (WAVE16, row)
    rows, installed, images9, images16 = [], set(), {}, {}
    for file, inbox_row in sorted(confirmed.items()):
        source = ROOT / "assets-inbox" / file
        digest = sha(source)
        assert digest == inbox_row["sha256"], file
        batch, record = records[file]
        wave = "wave16" if batch == WAVE16 else "wave9"
        relative = source.relative_to(batch / "assets").as_posix()
        name = source.name
        asset_id = (record.get("asset_id") or record.get("id")).replace("/", "_").removesuffix("-v1")
        width, height = png_size(source)
        prompt_text = record.get("full_prompt") or record.get("scene_description") or "(no prompt recorded)"
        prompt = ROOT / "docs/provenance/prompts" / f"{asset_id}-{wave}.txt"
        prompt.write_text(prompt_text.strip() + "\n")
        if wave == "wave9":
            group = relative.split("/")[0] if "/" in relative else "walker"
            runtime = ROOT / "public/assets/wave9" / group / name
            runtime.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, runtime)
            assert sha(runtime) == digest, name
            runtime_path = str(runtime.relative_to(ROOT))
            entry = {"url": f"assets/wave9/{group}/{name}", "width": width, "height": height}
            frames = frames_of(record.get("frame_layout", "") or "")
            cell_w = width // frames["columns"] if frames else width
            cell_h = height // frames["rows"] if frames else height
            # Pivots (manifestArt): house overlays share the house canvas (0,0, drawn on its rect); the smoke column
            # rises from its bottom centre; walker cells stand on their feet (the actor sheets' 74 px cell, 4 px up);
            # decals, ridges, piles and props sit on their centre.
            if group == "event" and asset_id.split("_")[1] in ("fire", "burnt", "abandoned", "plague"):
                entry["pivot"] = {"x": 0, "y": 0, "overlay": True}
            elif asset_id.startswith("fx_black_smoke"):
                entry["pivot"] = {"x": cell_w // 2, "y": cell_h - 6}
            elif group == "walker" or asset_id.startswith("prop_leaving_child"):
                entry["pivot"] = {"x": cell_w // 2, "y": cell_h - 4}
            else:
                entry["pivot"] = {"x": cell_w // 2, "y": cell_h // 2}
            if frames is not None:
                entry["frames"] = {"width": cell_w, "height": cell_h, "count": frames["columns"], "rows": frames["rows"]}
            images9[asset_id] = entry
            note = "installed to public/assets/wave9 (received bytes = runtime bytes)"
        else:
            group = relative.split("/")[0]
            url = f"assets/wave16/{group}/{source.stem}.jpg"
            images16[asset_id] = {"url": url, "width": width, "height": height, "source": str(source.relative_to(ROOT))}
            runtime_path = str(source.relative_to(ROOT))
            note = (f"runtime is the web derivative {url} made at build time from this received file by "
                    f"scripts/keyartDerivatives.ts (judgement 2026-09-26; the PNG stays in assets-inbox only)")
        rows.append({"assetId": asset_id, "version": "v1", "runtimePath": runtime_path, "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": record.get("generation_tool", "native image_gen"),
                     "model": record.get("model", "not exposed"), "generatedAt": "", "prompt": str(prompt.relative_to(ROOT)),
                     "referenceInputs": record.get("reference_files", record.get("references", "")), "seed": "not exposed",
                     "candidates": record.get("candidate_count", "1"), "manualEdits": record.get("postprocessing", record.get("processing", "")),
                     "artBible": "AB_2026-09-19_v1", "historicalProfile": "S_England_1300_1450_v1", "owner": f"Astra {wave}",
                     "usedIn": USED_IN16 if wave == "wave16" else USED_IN9, "status": "runtime",
                     "notes": f"Astra {wave} {asset_id} (confirmed in assets-inbox/INBOX_LEDGER.csv) installed by UI-4 on 2026-09-26 from "
                              f"{batch.relative_to(ROOT)}; {note}."})
        installed.add(file)
    assert len(images9) == 41 and len(images16) == 35, (len(images9), len(images16))
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8"))
            if not row["runtimePath"].startswith("public/assets/wave9/") and not row["runtimePath"].startswith("assets-inbox/wave16/")]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    fields = list(inbox[0].keys())
    for row in inbox:
        if row["file"] in installed:
            row["installed_by"] = "UI-4"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n")
        writer.writeheader(); writer.writerows(inbox)
    import json
    body = lambda table: "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(table.items()))
    MANIFEST9.write_text("// Generated by scripts/installWave9and16.py — Wave 9 runtime art (UI-4): url, size and, for sheets, the frame grid.\n"
                         "// House overlays (fire_roof, burnt, abandoned, plague_shut) share the house art's canvas: drawn at (0,0) with its pivot.\n"
                         "export const WAVE9_IMAGES = {\n" + body(images9) + "\n} as const;\n")
    MANIFEST16.write_text("// Generated by scripts/installWave9and16.py — Wave 16 illustrations (UI-4), loaded as build-time web derivatives\n"
                          "// (scripts/keyartDerivatives.ts); `source` is the received PNG in assets-inbox.\n"
                          "export const WAVE16_IMAGES = {\n" + body(images16) + "\n} as const;\n")
    print(len(rows), "rows;", len(images9), "wave 9 installed;", len(images16), "wave 16 derivatives")


if __name__ == "__main__":
    main()
