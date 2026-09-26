"""F0-V: install the 22 Wave 6 candidates (confirmed in assets-inbox/INBOX_LEDGER.csv) from
assets-inbox/wave6/candidates-20260925/assets into public/assets, add their ledger rows to docs/provenance/assets.csv
(replacing earlier Wave 5c rows) with one prompt file each, and fill `installed_by` in the inbox ledger.
The received PNGs carry no C2PA caBX chunk: the runtime bytes are the received bytes and equal the Astra SHA.
Run: python3 scripts/installWave5c.py
"""
import csv
import hashlib
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH = "assets-inbox/wave6/candidates-20260925"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
csv.field_size_limit(sys.maxsize)
# Astra folder -> runtime folder, and what reads the file.
TARGET = {folder: (f"public/assets/visibility-v1/{folder}", "src/render/visibilityArtManifest.ts (F0-V construction visibility: piles, sign, well stages, effects, smoke, plot stake, work props)")
          for folder in ("construction", "fx", "marker", "work")}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    astra = list(csv.DictReader(open(ROOT / BATCH / "records/assets.csv", encoding="utf-8-sig")))
    assert len(astra) == 22, len(astra)
    rows, installed = [], {}
    for row in astra:
        folder, name = row["runtimePath"].split("/", 1)
        source = ROOT / BATCH / "assets" / folder / name
        assert sha(source) == row["runtimeSha256"], name
        runtime_dir, used_in = TARGET[folder]
        runtime = ROOT / runtime_dir / name
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        asset_id = name[: -len(".png")].removesuffix("-v1")
        prompt = ROOT / "docs/provenance/prompts" / f"{asset_id}-wave6.txt"
        prompt.write_text(row["prompt"].strip() + "\n")
        rows.append({
            "assetId": asset_id, "version": "v1", "runtimePath": f"{runtime_dir}/{name}", "runtimeSha256": sha(runtime),
            "sourcePath": f"{BATCH}/assets/{folder}/{name}", "sourceSha256": sha(source),
            "tool": row["tool"], "model": row["model"], "generatedAt": row["generatedAt"][:10],
            "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": row["referenceInputs"], "seed": row["seed"],
            "candidates": row["candidates"], "manualEdits": row["manualEdits"], "artBible": row["artBible"],
            "historicalProfile": row["historicalProfile"], "owner": row["owner"], "usedIn": used_in, "status": "runtime",
            "notes": (f"Astra Wave 6 ledger row {row['assetId']} (candidate; confirmed in assets-inbox/INBOX_LEDGER.csv) installed by "
                      f"F0-V on 2026-09-26 from {BATCH}; received bytes = runtime bytes = the Astra SHA (no caBX). "
                      f"Astra note: {row['notes'][:300]}"),
        })
        installed[f"wave6/candidates-20260925/assets/{folder}/{name}"] = True
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if not row["sourcePath"].startswith(BATCH)]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + rows)
    inbox_rows = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    fields = list(inbox_rows[0].keys())
    for row in inbox_rows:
        if row["file"] in installed:
            row["installed_by"] = "F0-V"
            row["verdict_note"] = row["verdict_note"].replace("설치 예정 F0-V(본선 93d0f32 public/assets에서 같은 바이트 미발견)", "F0-V가 public/assets에 같은 바이트로 설치")
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n")
        writer.writeheader(); writer.writerows(inbox_rows)
    print(len(rows), "installed;", sum(1 for row in inbox_rows if row["installed_by"] == "F0-V"), "inbox rows marked")


if __name__ == "__main__":
    main()
