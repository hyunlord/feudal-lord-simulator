"""PLAGUE-b: install the confirmed Wave 31 chapter opening paintings (assets-inbox/wave31/candidates-20260929,
1920 × 1080 JPEG) that a built chapter uses: chapter 3's (the chronicle's chapter-3 start and chapter 3's opening
screen). Chapters 4 and 5 join when their screens are built (INTRO below).
No C2PA marker (asserted). The received files are JPEG 95 (about 1 MB each) and the build-time derivatives
(scripts/keyartDerivatives.ts) decode PNG only, so the runtime copy is re-encoded here once at the Wave 16 / 21
derivatives' quality (JPEG 70, same size) into public/assets/wave31/chapters; the received JPEG stays in assets-inbox.
Writes:
  public/assets/wave31/chapters/<id>.jpg  (the runtime copy)
  src/ui/wave31ArtManifest.generated.ts   (url, width, height, source for each id)
  docs/provenance/assets.csv              (one row per image, replacing earlier rows for the same source)
  docs/provenance/prompts/                (one .txt per image, the pack's own prompt)
  assets-inbox/INBOX_LEDGER.csv           (installed_by for each installed file)
Run: python3 scripts/installWave31.py
"""
import csv
import hashlib
import json
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
PACK = ROOT / "assets-inbox/wave31/candidates-20260929"
MANIFEST = ROOT / "src/ui/wave31ArtManifest.generated.ts"
RUNTIME = ROOT / "public/assets/wave31/chapters"
QUALITY = 70
INSTALLED_ON = "2026-09-29"
USED_IN = "src/ui/wave31ArtManifest.generated.ts (chapter opening paintings: the chronicle's chapter start, the chapter's opening screen)"
# (id, chapter, installing task)
INTRO = [("chapter3_intro", 3, "PLAGUE-b")]
csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def jpeg_size(data: bytes) -> tuple[int, int]:
    assert data[:2] == b"\xff\xd8", "not a JPEG"
    i = 2
    while i < len(data):
        marker, length = data[i + 1], struct.unpack(">H", data[i + 2:i + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2):
            height, width = struct.unpack(">HH", data[i + 5:i + 9])
            return width, height
        i += 2 + length
    raise AssertionError("no frame header")


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    records = {row["file"]: row for row in csv.DictReader(open(PACK / "records/assets.csv", encoding="utf-8-sig"))}
    images, rows, installed = {}, [], {}
    for asset_id, chapter, task in INTRO:
        rel = f"illustrations/{asset_id}-v1.jpg"
        source = PACK / "assets" / rel
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        data = source.read_bytes()
        digest = sha(source)
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        assert records[rel]["sha256"] == digest, rel
        assert b"c2pa" not in data and b"jumb" not in data, f"{asset_id} carries a C2PA marker"
        width, height = jpeg_size(data)
        url = f"assets/wave31/chapters/{asset_id}.jpg"
        runtime_file = RUNTIME / f"{asset_id}.jpg"
        RUNTIME.mkdir(parents=True, exist_ok=True)
        Image.open(source).convert("RGB").save(runtime_file, "JPEG", quality=QUALITY, optimize=True)
        runtime_digest = sha(runtime_file)
        images[asset_id] = {"url": url, "width": width, "height": height, "chapter": chapter, "source": str(source.relative_to(ROOT))}
        prompt = ROOT / "docs/provenance/prompts" / f"{asset_id}-wave31.txt"
        prompt.write_text((PACK / f"records/provenance/chapter{chapter}-prompt.txt").read_text().strip() + "\n")
        rows.append({
            "assetId": f"wave31/{asset_id}", "version": "v1", "runtimePath": str(runtime_file.relative_to(ROOT)), "runtimeSha256": runtime_digest,
            "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": records[rel]["generator"], "model": "not exposed",
            "generatedAt": "2026-09-29", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": "", "seed": "not exposed",
            "candidates": "1", "manualEdits": f"{records[rel]['processing']}; runtime re-encoded JPEG {QUALITY} (same size) by scripts/installWave31.py", "artBible": "AB_2026-09-19_v1",
            "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra wave31", "usedIn": USED_IN, "status": "runtime",
            "notes": f"Astra wave31 {asset_id} (confirmed in assets-inbox/INBOX_LEDGER.csv) installed by {task} on {INSTALLED_ON}; "
                     f"runtime is this received file re-encoded at JPEG {QUALITY} (no C2PA marker).",
        })
        installed[inbox_key] = task
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows} | {row["sourcePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    raw = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
    for row in inbox:
        if row["file"] in installed: row["installed_by"] = installed[row["file"]]
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(inbox[0].keys()), lineterminator="\r\n" if "\r\n" in raw else "\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '), ensure_ascii=False)}," for key, value in images.items())
    MANIFEST.write_text("// Generated by scripts/installWave31.py — Wave 31 chapter opening paintings (1920 × 1080): the chronicle's\n"
                        "// chapter start and the chapter's opening screen (runtime JPEG 70 copies in public/assets/wave31);\n"
                        "// `source` is the received JPEG in assets-inbox.\n"
                        "export const WAVE31_IMAGES = {\n" + body + "\n} as const;\n")
    print(f"wave31 {len(images)} images, {len(rows)} provenance rows")


if __name__ == "__main__":
    main()
