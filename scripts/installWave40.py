"""EVENT-ART (wave40): install the confirmed Wave 40 lord-mode moment illustrations (assets-inbox/wave40/candidates-20261001,
confirmed 2026-10-01 in assets-inbox/INBOX_LEDGER.csv; spec docs/ops/install-plan-20261003/SPECS/wave40.md): one 960 x 540
picture per lord-mode state transition the engine records in the ledger (src/ui/wave40Art.ts maps each history record to
its picture; the brief, records/provenance/brief.md, names the moment of each):
  moment_marriage_negotiation    <- 01_marriage_negotiation.jpg   (negotiation.offered: an offer the counterpart weighs)
  moment_marriage_sealing        <- 02_marriage_sealing.jpg       (marriage.contracted)
  moment_bride_arrival           <- 03_bride_arrival.jpg          (marriage.bride_arrived)
  moment_first_child             <- 04_first_child.jpg            (marriage.child_born)
  moment_brother_in_law_born     <- 05_brother_in_law_born.jpg    (marriage.brother_in_law_born)
  moment_old_lord_sickbed        <- 06_old_lord_sickbed.jpg       (marriage.father_ill)
  moment_attempted_will_change   <- 07_attempted_will_change.jpg  (marriage.will_change)
  moment_inheritance_fealty      <- 08_inheritance_fealty.jpg     (marriage.inherited)
  moment_lawsuit_filed           <- 09_lawsuit_filed.jpg          (estate.suit_filed)
  moment_documentary_evidence    <- 10_documentary_evidence.jpg   (estate.suit_stage, stage evidence)
  moment_possession_refused      <- 11_possession_refused.jpg     (estate.possession_enforced, not succeeded)
  moment_possession_taken        <- 12_possession_taken.jpg       (estate.possession_enforced, succeeded)
  moment_child_lord_guardian     <- 13_child_lord_guardian.jpg    (lord.wardship_begun; v2, the parchment removed)
  moment_end_of_wardship         <- 14_end_of_wardship.jpg        (lord.wardship_ended)
The pictures arrive as JPEG (mozjpeg q88 4:4:4, the pack's single resize). EVENT-ART (user decision 2026-10-05, EVA-D2): like the
registry's event pictures they load only when their chip or record shows, and only the build output is re-encoded —
scripts/keyartDerivatives.ts (format jpeg-reencoded, q70 4:2:0) serves it at assets/wave40/<file>.jpg; no public/ copy.
No APPn JUMBF / C2PA segment (asserted); size 960 x 540 measured from the frame header (asserted against the pack record).
Writes:
  src/ui/wave40ArtManifest.generated.ts   (url, width, height, assetId, title, source per key)
  docs/provenance/assets.csv              (one row per picture, replacing earlier rows for the same source)
  docs/provenance/prompts/                (one .txt per picture: the pack's generation prompt, and the edit prompt of 13)
  assets-inbox/INBOX_LEDGER.csv           (only with --mark-installed: installed_by = EVENT-ART on these fourteen rows, set after
                                           the copy, the consumer and a capture are confirmed — INSTALL_PROTOCOL 6; only
                                           those lines change, CRLF kept)
Run: python3 scripts/installWave40.py [--mark-installed]
"""
import csv
import hashlib
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "assets-inbox/wave40/candidates-20261001"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/ui/wave40ArtManifest.generated.ts"
INSTALLED_BY = "EVENT-ART"
INSTALLED_ON = "2026-10-05"
USED_IN = ("src/ui/wave40ArtManifest.generated.ts (EVENT-ART: lord mode only — the moment's story chip and card, one per history "
           "record (src/ui/lordMomentBeats.ts), and the record's picture in the chronicle (src/ui/wave40Art.ts wave40RecordArt); "
           "re-encoded at build, loaded when its chip or record shows)")

# (manifest key, the pack's id = records/assets.csv id and the file's stem)
WAVE40 = [
    ("moment_marriage_negotiation", "01_marriage_negotiation"),
    ("moment_marriage_sealing", "02_marriage_sealing"),
    ("moment_bride_arrival", "03_bride_arrival"),
    ("moment_first_child", "04_first_child"),
    ("moment_brother_in_law_born", "05_brother_in_law_born"),
    ("moment_old_lord_sickbed", "06_old_lord_sickbed"),
    ("moment_attempted_will_change", "07_attempted_will_change"),
    ("moment_inheritance_fealty", "08_inheritance_fealty"),
    ("moment_lawsuit_filed", "09_lawsuit_filed"),
    ("moment_documentary_evidence", "10_documentary_evidence"),
    ("moment_possession_refused", "11_possession_refused"),
    ("moment_possession_taken", "12_possession_taken"),
    ("moment_child_lord_guardian", "13_child_lord_guardian"),
    ("moment_end_of_wardship", "14_end_of_wardship"),
]
# The inventory's measured size (INVENTORY.csv rows 617-630: 960 x 540 for every Wave 40 picture).
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
    records = {row["id"]: row for row in csv.DictReader(open(PACK / "records/assets.csv", encoding="utf-8-sig", newline=""))}
    generations = {entry["id"]: entry for entry in json.load(open(PACK / "records/provenance/generations.json", encoding="utf-8"))}

    images: dict[str, dict] = {}
    rows: list[dict] = []
    installed: set[str] = set()
    for key, asset_id in WAVE40:
        record = records[asset_id]
        generation = generations[asset_id]
        source = PACK / record["file"]
        relative = source.relative_to(ROOT / "assets-inbox").as_posix()  # as in INBOX_LEDGER's file column
        entry = by_file[relative]
        # INSTALL_PROTOCOL 1: a row whose state moved since the plan (replaced, installed by another) is not copied blindly.
        assert entry["status"] == "confirmed", f"{relative}: status {entry['status']!r}"
        assert entry["replaced_by"] == "", f"{relative}: replaced by {entry['replaced_by']!r}"
        assert entry["installed_by"] in ("", INSTALLED_BY), f"{relative}: installed by {entry['installed_by']!r}"
        data = source.read_bytes()
        digest = sha(source)
        assert digest == entry["sha256"] == record["sha256"] == generation["sha256"], f"{relative}: sha256 differs from the ledger or the pack record"
        width, height, c2pa = jpeg_facts(data)
        assert not c2pa, f"{relative} carries a C2PA / JUMBF segment"
        assert (width, height) == SIZE == (int(record["width"]), int(record["height"])), f"{relative}: {width}x{height}"

        url = f"assets/wave40/{source.name}"
        images[key] = {"url": url, "width": width, "height": height, "assetId": asset_id, "title": record["title"],
                       "source": source.relative_to(ROOT).as_posix()}
        prompt = generation["prompt"].strip()
        processing = generation["processing"]
        edits = (f"{processing['resize']} from {processing['source_dimensions'][0]}x{processing['source_dimensions'][1]}; "
                 f"{processing['encoding']}")
        revision = generation.get("revision")
        if revision is not None:
            # 13: an image edit of the first generation (records/provenance/generations.json revision) removed a parchment.
            prompt = f"{revision['initial_prompt'].strip()}\n\n[edit: {revision['reason']}] {revision['edit_prompt'].strip()}"
            edits = f"{edits}; an image edit of the first generation ({revision['reason']}; records/provenance/generations.json)"
        prompt_file = ROOT / "docs/provenance/prompts" / f"{asset_id}-wave40.txt"
        prompt_file.write_text(prompt + "\n", encoding="utf-8")
        runtime_path = source.relative_to(ROOT).as_posix()
        rows.append({
            "assetId": f"wave40/{key}", "version": "v2" if revision is not None else "v1", "runtimePath": runtime_path, "runtimeSha256": digest,
            "sourcePath": runtime_path, "sourceSha256": digest, "tool": generation["tool"], "model": "not exposed",
            "generatedAt": "not recorded (pack verdict 2026-10-01)", "prompt": prompt_file.relative_to(ROOT).as_posix(),
            "referenceInputs": record["references"], "seed": "not exposed", "candidates": "1",
            "manualEdits": f"{edits} (pack record); no picture edits at install; at build re-encoded as a baseline JPEG q70 4:2:0 (scripts/jpegDecode.ts, scripts/keyartDerivatives.ts jpeg-reencoded).",
            "artBible": "not recorded", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra wave40", "usedIn": USED_IN, "status": "runtime",
            "notes": (f"Astra wave40 {asset_id} ({record['title']}; confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-10-01) installed by "
                      f"{INSTALLED_BY} on {INSTALLED_ON} as the {key} picture; runtime is {url}, made at build from this received JPEG by "
                      f"scripts/keyartDerivatives.ts (format jpeg-reencoded, q70 4:2:0 — user decision 2026-10-05 EVA-D2: on demand, only the build "
                      f"output re-encoded; the received file and its ledger row unchanged; no C2PA segment); generation source sha256 {generation['source_sha256']}. "
                      "The pack records give no model, seed or generation date."),
        })
        installed.add(relative)
    assert len(rows) == 14, len(rows)

    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(kept)
        writer.writerows([{key: row.get(key, "") for key in header} for row in rows])

    if mark:
        # Only these fourteen lines change (their installed_by, the last field, empty → EVENT-ART); every other byte is kept.
        raw = INBOX_LEDGER.read_bytes().decode("utf-8")
        lines = raw.split("\r\n")
        changed = 0
        for index, line in enumerate(lines):
            fields = next(csv.reader([line])) if line else []
            if len(fields) == 7 and fields[1] in installed and fields[6] == "":
                assert line.endswith(","), line
                lines[index] = line + INSTALLED_BY
                changed += 1
        assert changed + sum(1 for row in inbox if row["file"] in installed and row["installed_by"] == INSTALLED_BY) == 14, changed
        INBOX_LEDGER.write_bytes("\r\n".join(lines).encode("utf-8"))

    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '), ensure_ascii=False)}," for key, value in images.items())
    MANIFEST.write_text(
        "// Generated by scripts/installWave40.py — the Wave 40 lord-mode moment illustrations (EVENT-ART): one 960 × 540 picture per\n"
        "// lord-mode state transition the ledger records (marriage, inheritance, suits and possession, wardship; src/ui/wave40Art.ts);\n"
        "// re-encoded at build (scripts/keyartDerivatives.ts, format jpeg-reencoded; loaded on demand); `source` is the received file in assets-inbox.\n"
        "export const WAVE40_IMAGES = {\n" + body + "\n} as const;\n",
        encoding="utf-8",
    )
    print(f"wave40 {len(images)} pictures, {len(rows)} provenance rows{', installed_by set' if mark else ''}")


if __name__ == "__main__":
    main()
