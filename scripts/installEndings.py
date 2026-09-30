"""INSTALL-33: install the six confirmed campaign-ending paintings (INBOX-2s,
assets-inbox/endings-manors/candidates-20260930): one 1920 × 1080 painting per engine ending (F5-A LG-7,
src/content/legacyConfig.ts LEGACY_ENDING_IDS), in place of the shared Wave 21 ch5_campaign_ending on the ending
screen. The mapping follows the pack's README "장면 대응" table, which names each file's ending by its Korean title
(the titles of src/content/legacyCopy.ko.ts LEGACY_ENDING_COPY):
  free_borough      ← campaign_ending_self_governing_city-v1.jpg  (스스로 다스리는 도시: 길드홀 앞 시민과 자치 인장)
  house_remembered  ← campaign_ending_remembered_lineage-v1.jpg   (이름이 남은 가문: 교회 기념비와 후손)
  merchants_chantry ← campaign_ending_merchants_chantry-v1.jpg    (상인들의 기도처: 작은 독립 예배당)
  house_seat        ← campaign_ending_family_city-v1.jpg          (가문의 도시: 영주관에서 내려다본 가문 깃발 광장)
  lords_town        ← campaign_ending_lords_city-v1.jpg           (영주의 도시: 장원 홀의 법정)
  pilgrim_town      ← campaign_ending_pilgrims_city-v1.jpg        (순례자의 도시 = 기도의 도시: 교회와 순례 배지 노점)
The pack's two empty-manor pictures are left out (the user's decision: the empty manor stays minimal this time).
The paintings arrive as JPEG (quality 92, 1920 × 1080, the pack's single resize). They ship as they came: the build
copies each received file into the output (scripts/keyartDerivatives.ts format `jpeg-received`), with no second lossy
encode. No C2PA / JUMBF segment (asserted).
Writes:
  src/ui/endingArtManifest.generated.ts   (url, width, height, assetId, source per LegacyEndingId — typed, so a missing
                                           ending fails the type check)
  docs/provenance/assets.csv              (one row per painting, replacing earlier rows for the same source)
  docs/provenance/prompts/                (one .txt per painting, the pack's own prompt from records/assets.csv)
  assets-inbox/INBOX_LEDGER.csv           (installed_by = INSTALL-33 for each installed file)
Run: python3 scripts/installEndings.py
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
PACK = ROOT / "assets-inbox/endings-manors/candidates-20260930"
MANIFEST = ROOT / "src/ui/endingArtManifest.generated.ts"
INSTALLED_BY = "INSTALL-33"
INSTALLED_ON = "2026-09-30"
USED_IN = "src/ui/endingArtManifest.generated.ts (INSTALL-33: the campaign's ending screen, one painting per LegacyEndingId; shipped as received)"

# (LegacyEndingId, the pack's asset id = records/assets.csv assetId and the file's stem)
ENDINGS = [
    ("free_borough",      "campaign_ending_self_governing_city-v1"),
    ("house_remembered",  "campaign_ending_remembered_lineage-v1"),
    ("merchants_chantry", "campaign_ending_merchants_chantry-v1"),
    ("house_seat",        "campaign_ending_family_city-v1"),
    ("lords_town",        "campaign_ending_lords_city-v1"),
    ("pilgrim_town",      "campaign_ending_pilgrims_city-v1"),
]

csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def jpeg_facts(data: bytes) -> tuple[int, int, set[int], bool]:
    """(width, height, the APPn markers present, a JUMBF/C2PA box seen) from a baseline or progressive JPEG."""
    assert data[:2] == b"\xff\xd8", "not a JPEG"
    i, markers, c2pa, size = 2, set(), False, None
    while i + 4 <= len(data):
        assert data[i] == 0xFF, f"bad marker at {i}"
        marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        length = struct.unpack(">H", data[i + 2:i + 4])[0]
        body = data[i + 4:i + 2 + length]
        if 0xE0 <= marker <= 0xEF:
            markers.add(marker)
            c2pa = c2pa or b"jumb" in body or b"c2pa" in body
        if marker in (0xC0, 0xC1, 0xC2) and size is None:
            height, width = struct.unpack(">HH", body[1:5])
            size = (width, height)
        if marker == 0xDA:
            break
        i += 2 + length
    assert size is not None, "no frame header"
    return size[0], size[1], markers, c2pa


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    records = {row["assetId"]: row for row in csv.DictReader(open(PACK / "records/assets.csv", encoding="utf-8"))}

    images: dict[str, dict] = {}
    new_provenance_paths: set[str] = set()
    installed_files: set[str] = set()
    ledger_rows: list[dict] = []

    for ending_id, asset_id in ENDINGS:
        record = records[asset_id]
        source = PACK / record["runtimePath"]
        relative = str(source.relative_to(ROOT / "assets-inbox"))  # as in INBOX_LEDGER file column
        data = source.read_bytes()
        digest = sha(source)
        inbox_row = by_file.get(relative, {})
        assert inbox_row.get("sha256") == digest, f"{ending_id}: sha256 mismatch (inbox says {inbox_row.get('sha256')!r})"
        assert inbox_row.get("status") == "confirmed", f"{ending_id}: not confirmed (status={inbox_row.get('status')!r})"
        assert record.get("runtimeSha256") == digest, f"{ending_id}: sha256 differs from the pack's records/assets.csv"
        width, height, _, c2pa = jpeg_facts(data)
        assert not c2pa, f"{ending_id} carries a C2PA / JUMBF segment"
        assert (width, height) == (1920, 1080), f"{ending_id}: {width}x{height}"

        url = f"assets/endings/{asset_id}.jpg"
        images[ending_id] = {"url": url, "width": width, "height": height, "assetId": asset_id, "source": str(source.relative_to(ROOT))}

        prompt_file = ROOT / "docs/provenance/prompts" / f"{asset_id}-endings.txt"
        prompt_file.write_text((record.get("prompt") or "(no prompt recorded)").strip() + "\n")

        runtime_path = str(source.relative_to(ROOT))
        notes = (f"Astra endings-manors {asset_id} (INBOX-2s, confirmed in assets-inbox/INBOX_LEDGER.csv) installed by "
                 f"{INSTALLED_BY} on {INSTALLED_ON} as the {ending_id} ending's painting; runtime is {url}, the received "
                 f"JPEG copied as it came by scripts/keyartDerivatives.ts (format jpeg-received; no C2PA segment).")
        ledger_rows.append({
            "assetId": f"endings/{ending_id}", "version": record.get("version") or "v1",
            "runtimePath": runtime_path, "runtimeSha256": digest,
            "sourcePath": runtime_path, "sourceSha256": digest,
            "tool": record.get("tool") or "native image_gen", "model": record.get("model") or "not exposed",
            "generatedAt": record.get("generatedAt") or INSTALLED_ON, "prompt": str(prompt_file.relative_to(ROOT)),
            "referenceInputs": record.get("referenceInputs", ""), "seed": record.get("seed") or "not exposed",
            "candidates": record.get("candidates") or "1",
            "manualEdits": f"{record.get('manualEdits', '').strip()} (pack record); no painting edits at install.",
            "artBible": record.get("artBible") or "AB_2026-09-19_v1", "historicalProfile": record.get("historicalProfile") or "S_England_1300_1450_v1",
            "owner": "Astra endings-manors", "usedIn": USED_IN, "status": "runtime", "notes": notes,
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
        "// Generated by scripts/installEndings.py — the campaign's six ending paintings (INSTALL-33, INBOX-2s): one per\n"
        "// LegacyEndingId (a missing ending fails the type check), shipped as the received 1920 × 1080 JPEGs\n"
        "// (scripts/keyartDerivatives.ts, format jpeg-received); `source` is the received file in assets-inbox.\n"
        "import type { LegacyEndingId } from \"../content/legacyConfig\";\n\n"
        "export type EndingImage = Readonly<{ url: string; width: number; height: number; assetId: string; source: string }>;\n\n"
        "export const ENDING_IMAGES = {\n" + body + "\n} as const satisfies Readonly<Record<LegacyEndingId, EndingImage>>;\n"
    )
    print(f"endings {len(images)} paintings, {len(ledger_rows)} provenance rows")


if __name__ == "__main__":
    main()
