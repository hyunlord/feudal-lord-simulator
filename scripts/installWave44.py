"""LM-R1 (petitions): install the confirmed Wave 44 home-petition illustrations (assets-inbox/wave44/candidates-20261002,
confirmed 2026-10-02 in assets-inbox/INBOX_LEDGER.csv; spec docs/ops/install-plan-20261003/SPECS/wave44.md): one 960 x 540
event-card picture per FIX-14 home petition kind (src/engine/stewardship.types.ts HomePetitionKind) that matches one to
one, and the precedent picture:
  boundary_dispute  <- 01_boundary_dispute.jpg      (경계 다툼)
  mill_suit         <- 02_suit_of_mill.jpg          (방앗간 강제)
  heriot            <- 03_heriot.jpg                (사망 부과금)
  merchet           <- 04_merchet.jpg               (혼인 부담금)
  ale_fines         <- 05_ale_assize.jpg            (에일 검정)
  road_bridge       <- 06_bridge_repair.jpg         (길·다리 수리 분담)
  stall_dispute     <- 07_market_stall_dispute.jpg  (시장 좌판 다툼; v2, chimneys removed)
  wardship          <- 08_minor_wardship.jpg        (미성년 상속자 후견)
  common_pasture    <- 09_common_pasture.jpg        (공유지 방목)
  newcomer          <- 10_migrant_settlement.jpg    (이주민 정착 허가; v2, chimney removed)
  by_precedent      <- 13_by_precedent.jpg          (선례대로 처리: only a steward's answer by precedent,
                                                     decidedBy steward && precedent true)
Not installed (the spec's three mismatches, left as render / content items): 11_court_baron (no engine kind),
12_forest_trespass (not the same case as `pannage`, no automatic substitute), and `chancel_repair` has no picture.
The pictures arrive as JPEG (q86 4:4:4, the pack's single resize). They ship as they came, like the ending paintings:
scripts/keyartDerivatives.ts (format jpeg-received) copies each received file into the build and serves it in `vite`
dev at assets/wave44/<file>.jpg (the inventory's proposed runtime path); no second lossy encode, no public/ copy.
No APPn JUMBF / C2PA segment (asserted); size 960 x 540 measured from the frame header (asserted against INVENTORY).
Writes:
  src/ui/wave44ArtManifest.generated.ts   (url, width, height, assetId, title, source per key)
  docs/provenance/assets.csv              (one row per picture, replacing earlier rows for the same source)
  docs/provenance/prompts/                (one .txt per picture: the pack's generation prompt, and the edit prompt of a v2)
  assets-inbox/INBOX_LEDGER.csv           (only with --mark-installed: installed_by = LM-R1 on these eleven rows, set after
                                           the copy, the consumer and a capture are confirmed — INSTALL_PROTOCOL 6)
Run: python3 scripts/installWave44.py [--mark-installed]
"""
import csv
import hashlib
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "assets-inbox/wave44/candidates-20261002"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/ui/wave44ArtManifest.generated.ts"
INSTALLED_BY = "LM-R1"
INSTALLED_ON = "2026-10-03"
USED_IN = ("src/ui/wave44ArtManifest.generated.ts (LM-R1: the lord-mode home petition card and its event chip, one picture per "
           "matching HomePetitionKind; by_precedent on the steward's precedent card; shipped as received)")

# (manifest key, the pack's asset id = records/manifest.json asset_id and the file's stem)
WAVE44 = [
    ("boundary_dispute", "01_boundary_dispute"),
    ("mill_suit", "02_suit_of_mill"),
    ("heriot", "03_heriot"),
    ("merchet", "04_merchet"),
    ("ale_fines", "05_ale_assize"),
    ("road_bridge", "06_bridge_repair"),
    ("stall_dispute", "07_market_stall_dispute"),
    ("wardship", "08_minor_wardship"),
    ("common_pasture", "09_common_pasture"),
    ("newcomer", "10_migrant_settlement"),
    ("by_precedent", "13_by_precedent"),
]
# The inventory's measured size (INVENTORY.csv.astra-raw.txt rows 734-746: 960 x 540 for every Wave 44 picture).
SIZE = (960, 540)

csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def jpeg_facts(data: bytes) -> tuple[int, int, bool]:
    """(width, height, a JUMBF/C2PA box seen in an APPn segment) from a baseline or progressive JPEG."""
    assert data[:2] == b"\xff\xd8", "not a JPEG"
    i, c2pa, size = 2, False, None
    while i + 4 <= len(data):
        assert data[i] == 0xFF, f"bad marker at {i}"
        marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        length = struct.unpack(">H", data[i + 2:i + 4])[0]
        body = data[i + 4:i + 2 + length]
        if 0xE0 <= marker <= 0xEF:
            c2pa = c2pa or b"jumb" in body or b"c2pa" in body
        if marker in (0xC0, 0xC1, 0xC2) and size is None:
            height, width = struct.unpack(">HH", body[1:5])
            size = (width, height)
        if marker == 0xDA:
            break
        i += 2 + length
    assert size is not None, "no frame header"
    return size[0], size[1], c2pa


def main() -> None:
    mark = "--mark-installed" in sys.argv[1:]
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8", newline="")))
    by_file = {row["file"]: row for row in inbox}
    manifest = {entry["asset_id"]: entry for entry in json.load(open(PACK / "records/manifest.json", encoding="utf-8"))}
    revisions = {(entry["id"], entry["version"]): entry for entry in json.load(open(PACK / "records/revisions.json", encoding="utf-8"))}
    generations = {(entry["id"], entry["version"]): entry for entry in json.load(open(PACK / "records/generations.json", encoding="utf-8"))}

    images: dict[str, dict] = {}
    rows: list[dict] = []
    installed: set[str] = set()
    for key, asset_id in WAVE44:
        record = manifest[asset_id]
        source = PACK / record["file"]
        relative = source.relative_to(ROOT / "assets-inbox").as_posix()  # as in INBOX_LEDGER's file column
        entry = by_file[relative]
        # INSTALL_PROTOCOL 1: a row whose state moved since the plan (replaced, installed by another) is not copied blindly.
        assert entry["status"] == "confirmed", f"{relative}: status {entry['status']!r}"
        assert entry["replaced_by"] == "", f"{relative}: replaced by {entry['replaced_by']!r}"
        assert entry["installed_by"] in ("", INSTALLED_BY), f"{relative}: installed by {entry['installed_by']!r}"
        data = source.read_bytes()
        digest = sha(source)
        assert digest == entry["sha256"] == record["sha256"], f"{relative}: sha256 differs from the ledger or the pack record"
        width, height, c2pa = jpeg_facts(data)
        assert not c2pa, f"{relative} carries a C2PA / JUMBF segment"
        assert (width, height) == SIZE == (record["width"], record["height"]), f"{relative}: {width}x{height}"

        url = f"assets/wave44/{source.name}"
        images[key] = {"url": url, "width": width, "height": height, "assetId": asset_id, "title": record["title"],
                       "source": source.relative_to(ROOT).as_posix()}
        version = record["selected_version"]
        generation = generations[(asset_id, 1)]
        prompt = record["prompt_exact"].strip()
        edits = record["crop_or_edit"].strip()
        if version > 1:
            # A corrected version: the edit prompt of the selected revision (records/revisions.json) follows the generation's.
            revision = revisions[(asset_id, version)]
            prompt = f"{prompt}\n\n[v{version} edit] {revision['prompt'].strip()}"
            edits = f"{edits}; v{version} is an image edit of v{version - 1} (records/revisions.json)"
        prompt_file = ROOT / "docs/provenance/prompts" / f"{asset_id}-wave44.txt"
        prompt_file.write_text(prompt + "\n", encoding="utf-8")
        runtime_path = source.relative_to(ROOT).as_posix()
        rows.append({
            "assetId": f"wave44/{key}", "version": f"v{version}", "runtimePath": runtime_path, "runtimeSha256": digest,
            "sourcePath": runtime_path, "sourceSha256": digest, "tool": generation["generator"], "model": "not exposed",
            "generatedAt": generation["generation_date"], "prompt": prompt_file.relative_to(ROOT).as_posix(),
            "referenceInputs": record["reference_images"], "seed": "not exposed", "candidates": "1",
            "manualEdits": f"{edits} (pack record); no picture edits at install.",
            "artBible": generation["art_bible_version"], "historicalProfile": generation["historical_profile"],
            "owner": "Astra wave44", "usedIn": USED_IN, "status": "runtime",
            "notes": (f"Astra wave44 {asset_id} ({record['title']}; confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-10-02) installed by "
                      f"{INSTALLED_BY} on {INSTALLED_ON} as the {key} picture; runtime is {url}, the received JPEG copied as it came by "
                      "scripts/keyartDerivatives.ts (format jpeg-received; no C2PA segment). The pack records give no model or seed."),
        })
        installed.add(relative)
    assert len(rows) == 11, len(rows)

    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(kept)
        writer.writerows([{key: row.get(key, "") for key in header} for row in rows])

    if mark:
        raw = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
        fields = list(inbox[0].keys())
        for row in inbox:
            if row["file"] in installed:
                row["installed_by"] = INSTALLED_BY
        with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if raw.split("\n", 1)[0].endswith("\r") else "\n")
            writer.writeheader()
            writer.writerows(inbox)

    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '), ensure_ascii=False)}," for key, value in images.items())
    MANIFEST.write_text(
        "// Generated by scripts/installWave44.py — the Wave 44 home-petition illustrations (LM-R1): one 960 × 540 picture per\n"
        "// FIX-14 home petition kind that matches one to one, and `by_precedent` for the steward's answer by precedent; shipped\n"
        "// as the received JPEGs (scripts/keyartDerivatives.ts, format jpeg-received); `source` is the received file in assets-inbox.\n"
        "export const WAVE44_IMAGES = {\n" + body + "\n} as const;\n",
        encoding="utf-8",
    )
    print(f"wave44 {len(images)} pictures, {len(rows)} provenance rows{', installed_by set' if mark else ''}")


if __name__ == "__main__":
    main()
