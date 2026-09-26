"""INSTALL-7: install the 77 Wave 7 runtime files (the work order's assets/ = the confirmed rows in
assets-inbox/INBOX_LEDGER.csv; 60 first cuts from candidates-v1, 17 reworks from rework-v1 whose v1 rows INBOX-1 set
to `superseded`) into public/assets/wave7/<group>, add one docs/provenance/assets.csv row each (replacing earlier
INSTALL-7 rows) with one prompt file each, fill `installed_by` in the inbox ledger, and write the render manifest
src/render/wave7ArtManifest.generated.ts (size, pivot, frames from the Astra records).
The received PNGs carry no C2PA caBX chunk: runtime bytes = received bytes = the Astra SHA.
Run: python3 scripts/installWave7.py <work order assets dir>
"""
import csv
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCHES = ["assets-inbox/wave7/candidates-v1", "assets-inbox/wave7/rework-v1"]
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/render/wave7ArtManifest.generated.ts"
USED_IN = "src/render/wave7ArtManifest.generated.ts (INSTALL-7: cart loads, piles, smoke and dust sheets, work props, winter overlays and decals, world signals, roof frames)"
csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pivot_of(value: str, width: int, height: int) -> dict:
    data = json.loads(value)
    pivot = data.get("pivot", data) if isinstance(data, dict) else data
    if isinstance(pivot, list):
        return {"x": pivot[0], "y": pivot[1]}
    if isinstance(pivot, dict) and "x" in pivot:
        return {"x": pivot["x"], "y": pivot["y"]}
    return {"x": 0, "y": 0, "overlay": True}  # overlays drawn on the original house canvas at zero offset


def frames_of(value: str) -> dict | None:
    data = json.loads(value)
    frame = data.get("frameSize") if isinstance(data, dict) else None
    return frame if isinstance(frame, dict) and "count" in frame else None


def main() -> None:
    wanted = Path(sys.argv[1])
    records = {}
    for batch in BATCHES:
        for row in csv.DictReader(open(ROOT / batch / "records/assets.csv", encoding="utf-8-sig")):
            records.setdefault(row["sha256"], (batch, row))
    inbox_by_sha = {}
    for batch in BATCHES:
        for path in (ROOT / batch / "assets").rglob("*.png"):
            inbox_by_sha.setdefault(sha(path), path)
    rows, installed, manifest = [], set(), {}
    for source_file in sorted(wanted.rglob("*.png")):
        digest = sha(source_file)
        source = inbox_by_sha[digest]
        batch, record = records[digest]
        group = source_file.parent.name if source_file.parent != wanted else "cart"
        name = source.name
        stem = name[: -len(".png")]
        asset_id, version = stem.rsplit("-v", 1)
        runtime_dir = f"public/assets/wave7/{group}"
        runtime = ROOT / runtime_dir / name
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest == record["sha256"], name
        generations = json.loads(record["generation_records"] or "[]")
        prompt_text = (generations[0].get("prompt", "") if generations else "").strip() or "(no prompt recorded)"
        prompt = ROOT / "docs/provenance/prompts" / f"{asset_id}-wave7.txt"
        prompt.write_text(prompt_text + "\n")
        references = sorted({Path(ref).name for g in generations for ref in g.get("references", [])})
        rows.append({
            "assetId": asset_id, "version": f"v{version}", "runtimePath": f"{runtime_dir}/{name}", "runtimeSha256": digest,
            "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest,
            "tool": (generations[0].get("tool") if generations else None) or "native image_gen", "model": "not exposed",
            "generatedAt": "2026-09-26", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": ";".join(references) or "none",
            "seed": "not exposed", "candidates": f"{len(generations)} recorded attempts; see {batch}/records",
            "manualEdits": "Astra deterministic crop / fit / registration (records processing); no procedural repaint",
            "artBible": "AB_2026-09-19_v1", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra Wave7", "usedIn": USED_IN,
            "status": "runtime",
            "notes": (f"Astra Wave 7 row {record['asset_id']} (confirmed in assets-inbox/INBOX_LEDGER.csv) installed by INSTALL-7 on "
                      f"2026-09-26 from {batch}; received bytes = runtime bytes = the Astra SHA (no caBX). Role: {record['role']}."),
        })
        installed.add(str(source.relative_to(ROOT / "assets-inbox")))
        key = f"pile_{asset_id}" if group == "pile" else asset_id
        entry = {"url": f"assets/wave7/{group}/{name}", "width": int(record["width"]), "height": int(record["height"]),
                 "pivot": pivot_of(record["pivot_or_attachment"], int(record["width"]), int(record["height"]))}
        frames = frames_of(record["pivot_or_attachment"])
        if frames is not None:
            entry["frames"] = {"width": frames["width"], "height": frames["height"], "count": frames["count"]}
        manifest[key] = entry
    assert len(rows) == 77, len(rows)
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if not row["runtimePath"].startswith("public/assets/wave7/")]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + rows)
    inbox_rows = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    fields = list(inbox_rows[0].keys())
    marked = 0
    for row in inbox_rows:
        if row["file"] in installed:
            row["installed_by"] = "INSTALL-7"; marked += 1
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n")
        writer.writeheader(); writer.writerows(inbox_rows)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(manifest.items()))
    MANIFEST.write_text("// Generated by scripts/installWave7.py — Wave 7 runtime art: size, pivot (Astra registration), frames.\n"
                        "export const WAVE7_ART = {\n" + body + "\n} as const;\n")
    print(len(rows), "installed;", marked, "inbox rows marked;", len(manifest), "manifest keys")


if __name__ == "__main__":
    main()
