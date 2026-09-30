"""UI-10: install the confirmed Wave 33 interlude illustrations (INBOX-2k, assets-inbox/wave33/candidates-20260929):
the five 1384–1400 interlude events of chapter 5 (F5-A / FIX-9 LG-13), one 960 × 540 event illustration each.
Ids are `interlude_<LegacyInterludeId>` (src/content/legacyConfig.ts LEGACY_INTERLUDE_IDS), one image per engine id:
  interlude_staple            ← 1391-wool-staple.png       (1391 the wool staple moves)
  interlude_guild_dispute     ← 1394-guild-dispute.png     (1394 the guild and the merchants dispute)
  interlude_market_fire       ← 1394-market-fire.png       (1394 the market's fire; the engine's branch without a guild)
  interlude_church_rebuilding ← 1396-church-extension.png  (1396 the nave extension)
  interlude_deposition        ← 1399-henry-iv-news.png     (1399 news of Henry IV)
No C2PA chunks (asserted); the PNGs stay in assets-inbox; the game loads build-time JPEG derivatives
(scripts/keyartDerivatives.ts WAVE33_DERIVATIVES → WEB_ART_DERIVATIVES).
Writes:
  src/ui/wave33ArtManifest.generated.ts   (url, width, height, year, source for each id)
  docs/provenance/assets.csv              (one row per image, replacing earlier rows for the same source)
  docs/provenance/prompts/                (one .txt per image, the pack's own prompt from records/manifest.json)
  assets-inbox/INBOX_LEDGER.csv           (installed_by = UI-10 for each installed file)
Run: python3 scripts/installWave33.py
"""
import csv
import hashlib
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
PACK = ROOT / "assets-inbox/wave33/candidates-20260929"
MANIFEST = ROOT / "src/ui/wave33ArtManifest.generated.ts"
INSTALLED_BY = "UI-10"
INSTALLED_ON = "2026-09-30"
GENERATED_ON = "2026-09-29"
USED_IN = "src/ui/wave33ArtManifest.generated.ts (UI-10: chapter 5's 1384–1400 interlude event illustrations; build-time web derivatives)"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}

# (asset_id, pack file stem = records/manifest.json id)
WAVE33_INTERLUDE = [
    ("interlude_staple",            "1391-wool-staple"),
    ("interlude_guild_dispute",     "1394-guild-dispute"),
    ("interlude_market_fire",       "1394-market-fire"),
    ("interlude_church_rebuilding", "1396-church-extension"),
    ("interlude_deposition",        "1399-henry-iv-news"),
]

csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    return struct.unpack(">II", data[16:24])


def png_chunks(data: bytes) -> set[bytes]:
    chunks, i = set(), 8
    while i + 8 <= len(data):
        length = struct.unpack(">I", data[i:i + 4])[0]
        chunks.add(data[i + 4:i + 8])
        i += 12 + length
    return chunks


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    records = {entry["id"]: entry for entry in json.load(open(PACK / "records/manifest.json", encoding="utf-8"))["assets"]}

    images: dict[str, dict] = {}
    new_provenance_paths: set[str] = set()
    installed_files: set[str] = set()
    ledger_rows: list[dict] = []

    for asset_id, stem in WAVE33_INTERLUDE:
        source = PACK / "assets" / f"{stem}.png"
        relative = str(source.relative_to(ROOT / "assets-inbox"))  # as in INBOX_LEDGER file column
        record = records[stem]

        data = source.read_bytes()
        digest = sha(source)
        inbox_row = by_file.get(relative, {})
        assert inbox_row.get("sha256") == digest, f"{asset_id}: sha256 mismatch (inbox says {inbox_row.get('sha256')!r})"
        assert inbox_row.get("status") == "confirmed", f"{asset_id}: not confirmed (status={inbox_row.get('status')!r})"
        assert record.get("sha256") == digest, f"{asset_id}: sha256 differs from the pack's records/manifest.json"
        assert not C2PA_CHUNKS & png_chunks(data), f"{asset_id} carries a C2PA chunk"

        width, height = png_size(source)
        url = f"assets/wave33/interlude/{asset_id}.jpg"
        images[asset_id] = {"url": url, "width": width, "height": height, "year": record["year"],
                            "source": str(source.relative_to(ROOT))}

        prompt_file = ROOT / "docs/provenance/prompts" / f"{asset_id}-wave33.txt"
        prompt_file.write_text((record.get("prompt") or "(no prompt recorded)").strip() + "\n")

        runtime_path = str(source.relative_to(ROOT))
        notes = (f"Astra wave33 {stem} (INBOX-2k, confirmed in assets-inbox/INBOX_LEDGER.csv) installed by {INSTALLED_BY} "
                 f"on {INSTALLED_ON} as {asset_id}; runtime is the web derivative {url} made at build time from this "
                 f"received file by scripts/keyartDerivatives.ts (the PNG stays in assets-inbox only; no C2PA chunk).")
        ledger_rows.append({
            "assetId": f"wave33/{asset_id}", "version": "v1",
            "runtimePath": runtime_path, "runtimeSha256": digest,
            "sourcePath": runtime_path, "sourceSha256": digest,
            "tool": "native image_gen", "model": "not exposed",
            "generatedAt": GENERATED_ON, "prompt": str(prompt_file.relative_to(ROOT)),
            "referenceInputs": "", "seed": "not exposed", "candidates": "1",
            "manualEdits": f"{record['postprocess']} (pack record); no painting edits.",
            "artBible": "AB_2026-09-19_v1", "historicalProfile": "S_England_1300_1450_v1",
            "owner": "Astra wave33", "usedIn": USED_IN, "status": "runtime", "notes": notes,
        })
        new_provenance_paths.add(runtime_path)
        installed_files.add(relative)

    # Update docs/provenance/assets.csv — replace any earlier rows for these sources, keep everything else
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8"))
            if row["runtimePath"] not in new_provenance_paths]
    with open(LEDGER, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(kept)
        writer.writerows([{key: row.get(key, "") for key in header} for row in ledger_rows])

    # Update INBOX_LEDGER installed_by column
    fields = list(inbox[0].keys())
    for row in inbox:
        if row["file"] in installed_files:
            row["installed_by"] = INSTALLED_BY
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, lineterminator="\r\n")
        writer.writeheader()
        writer.writerows(inbox)

    body = "\n".join(
        f"  {key}: {json.dumps(value, separators=(', ', ': '), ensure_ascii=False)},"
        for key, value in images.items()
    )
    MANIFEST.write_text(
        "// Generated by scripts/installWave33.py — Wave 33 interlude illustrations (UI-10): chapter 5's five 1384–1400\n"
        "// interlude events, one per LegacyInterludeId (`interlude_<id>`), loaded as build-time JPEG derivatives\n"
        "// (scripts/keyartDerivatives.ts); `source` is the received PNG in assets-inbox.\n"
        "export const WAVE33_IMAGES = {\n" + body + "\n} as const;\n"
    )
    print(f"wave33 {len(images)} images, {len(ledger_rows)} provenance rows")


if __name__ == "__main__":
    main()
