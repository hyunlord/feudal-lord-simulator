"""UI-4b: install Wave 19 (53 confirmed runtime files from assets-inbox/wave19/candidates-v1, INBOX-1i, verdict
2026-09-27) into public/assets/wave19/<group>:
the 24 season-ledger scene icons (used by the season ledger card now) and the record-card frames, timeline, biography,
faction and decision-record art (registered for CHRON-1). One docs/provenance/assets.csv row each (replacing earlier
UI-4b rows) with one prompt file each, `installed_by` = UI-4b in the inbox ledger, and
src/ui/wave19ArtManifest.generated.ts: url, size, group and, for 9-slice frames, the insets and minimum size
(records/metadata-*.json).
Run: python3 scripts/installWave19.py
"""
import csv
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
BATCH = ROOT / "assets-inbox/wave19/candidates-v1"
MANIFEST = ROOT / "src/ui/wave19ArtManifest.generated.ts"
USED_IN = {
    "scenes": "src/ui/wave19ArtManifest.generated.ts (UI-4b: season ledger card scenes)",
    "other": "src/ui/wave19ArtManifest.generated.ts (UI-4b: registered for CHRON-1: record cards, timeline, biography and faction pages, decision record)",
}
csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    rows_in = {row["file"]: row for row in inbox if row["wave"] == "wave19" and row["status"] == "confirmed" and "/assets/" in row["file"]}
    records = {row["file"]: row for row in csv.DictReader(open(BATCH / "records/assets.csv", encoding="utf-8-sig"))}
    metadata = {}
    for path in sorted((BATCH / "records").glob("metadata-*.json")):
        for entry in json.loads(path.read_text()):
            metadata[entry["file"]] = entry
    rows, installed, images = [], set(), {}
    for file, inbox_row in sorted(rows_in.items()):
        source = ROOT / "assets-inbox" / file
        digest = sha(source)
        assert digest == inbox_row["sha256"], file
        relative = source.relative_to(BATCH).as_posix()  # assets/<group>/<name>.png
        record = records[relative]
        assert record["sha256"] == digest, relative
        group = relative.split("/")[1]
        runtime = ROOT / "public/assets/wave19" / group / source.name
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, relative
        key = record["asset_id"]
        entry = {"url": f"assets/wave19/{group}/{source.name}", "width": int(record["width"]), "height": int(record["height"]), "group": group}
        nine = metadata.get(relative, {}).get("nineSlice")
        if nine:
            # Three shapes in the batch's records: cards {insets, minimumSize{}}, pages {left..., minimumSize[w, h]},
            # the decision frame {left...} (minimum = its own size). One shape here.
            insets = nine.get("insets") or {side: nine[side] for side in ("left", "top", "right", "bottom")}
            minimum = nine.get("minimumSize") or [entry["width"], entry["height"]]
            if isinstance(minimum, dict):
                minimum = [minimum["width"], minimum["height"]]
            entry["nineSlice"] = {"insets": {side: insets[side] for side in ("left", "top", "right", "bottom")}, "minimumSize": {"width": minimum[0], "height": minimum[1]}}
        images[key] = entry
        generations = json.loads(record["generation_records"] or "[]")
        prompt = ROOT / "docs/provenance/prompts" / f"{key}-wave19.txt"
        prompt.write_text(((generations[0].get("prompt", "") if generations else "").strip() or "(no prompt recorded)") + "\n")
        references = sorted({ref for generation in generations for ref in generation.get("referenceImages", [])})
        rows.append({"assetId": f"wave19/{group}/{key}", "version": "v1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest,
                     "tool": (generations[0].get("tool") if generations else None) or "native image_gen", "model": "not exposed", "generatedAt": "",
                     "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": ";".join(references) or "none", "seed": "not exposed",
                     "candidates": str(max(1, len(generations))), "manualEdits": record["processing"], "artBible": "AB_2026-09-19_v1",
                     "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra wave19",
                     "usedIn": USED_IN["scenes" if group.startswith("scenes_") else "other"], "status": "runtime",
                     "notes": f"Astra wave19 {key} (confirmed in assets-inbox/INBOX_LEDGER.csv, INBOX-1i) installed by UI-4b on 2026-09-27 "
                              f"from {BATCH.relative_to(ROOT)}; received bytes = runtime bytes."})
        installed.add(file)
    assert len(images) == 53 and sum(1 for image in images.values() if image["group"].startswith("scenes_")) == 24, len(images)
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if not row["runtimePath"].startswith("public/assets/wave19/")]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    fields = list(inbox[0].keys())
    for row in inbox:
        if row["file"] in installed:
            row["installed_by"] = "UI-4b"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(images.items()))
    MANIFEST.write_text("// Generated by scripts/installWave19.py — Wave 19 runtime art (UI-4b): url, size, group and, for 9-slice frames, the\n"
                        "// fixed insets and minimum size. scenes_* are the season ledger card's scenes; the rest is registered for CHRON-1.\n"
                        "export const WAVE19_IMAGES = {\n" + body + "\n} as const;\n")
    print(len(rows), "rows;", len(images), "installed")


if __name__ == "__main__":
    main()
