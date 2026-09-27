"""CHRON-1: register the portrait pool (PERSON-0's 232 pictures: the pivot pilot's 36 and its 12 aging frames, pool 1's
92 and pool 2's 92, I037-I100) and the two Wave 17 chronicle illustrations the ledger's records use now (stone town
proclaimed / finished) as build-time web derivatives (judgement 2026-09-26, scripts/keyartDerivatives.ts: the PNGs
stay in assets-inbox; a portrait ships as a 256 px and a 96 px baseline JPEG, the received eXIf chunk dropped).
One docs/provenance/assets.csv row each (replacing earlier CHRON-1 rows) with one prompt file each,
`installed_by` = CHRON-1 in the inbox ledger (its status column is left as received: pool 2 is still `candidate`),
and two manifests:
  src/ui/portraitArtManifest.generated.ts  (the 256 and 96 px urls of each pool picture, its received PNG)
  src/ui/wave17ArtManifest.generated.ts    (url of the web derivative, size, received PNG)
Run: python3 scripts/installChronicleArt.py
"""
import csv
import hashlib
import json
import re
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
POOL = ROOT / "src/content/portraitPool.ts"
PACKS = [ROOT / "assets-inbox/portrait-pool/pivot-pilot-20260926", ROOT / "assets-inbox/portrait-pool/pool1-20260926",
         ROOT / "assets-inbox/portrait-pool/pool2-20260926"]
WAVE17 = ROOT / "assets-inbox/wave17/candidates-20260926"
# CHRON-1's two chronicle scenes, then UI-6's chapter 2 illustrations (decision cards, event cards, chronicle, chapter end).
WAVE17_IDS = {"stonewall_start": "illustration/chronicle/stonewall_start.png", "stonewall_complete": "illustration/chronicle/stonewall_complete.png"}
WAVE17_UI6 = {f"{folder}_{name}": f"illustration/{folder}/{name}.png" for folder, names in {
    "decision": ("levy_response", "refugee_admission", "wall_or_market", "war_funding", "wool_payment"),
    "event": ("beacon_warning", "coastal_raid", "conscription_departure", "empty_workshop", "raid_aftermath", "royal_messenger_arrival",
              "stonewall_charter", "wool_levy_edict"),
    "chronicle": ("beacon", "conscription", "messenger", "purveyance_licence", "raid", "wool_levy")}.items() for name in names}
WAVE17_UI6["chapter2_end"] = "illustration/chapter2_end.png"
MANIFEST_PORTRAITS = ROOT / "src/ui/portraitArtManifest.generated.ts"
MANIFEST17 = ROOT / "src/ui/wave17ArtManifest.generated.ts"
USED_IN_PORTRAITS = "src/ui/portraitArtManifest.generated.ts (CHRON-1: biography portraits and the chronicle's person cards; build-time web derivatives)"
USED_IN17 = "src/ui/wave17ArtManifest.generated.ts (CHRON-1: chronicle record cards; build-time web derivatives)"
USED_IN17_UI6 = "src/ui/wave17ArtManifest.generated.ts (UI-6: chapter 2 decision and event cards, chronicle, chapter end; build-time web derivatives)"
INSTALLED_BY = "CHRON-1"
csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_size(path: Path) -> tuple[int, int]:
    return struct.unpack(">II", path.read_bytes()[16:24])


def pool_entries() -> list[dict]:
    return [json.loads(match) for match in re.findall(r"^  (\{\"id\":.*\}),$", POOL.read_text(), flags=re.M)]


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    # The pack each picture came in, with its generation record (prompt, references) and its portraits.csv row.
    located = {}
    for pack in PACKS:
        csv_rows = {row["id"]: row for row in csv.DictReader(open(pack / "records/portraits.csv", encoding="utf-8-sig"))}
        for picture in sorted((pack / "assets").glob("*/*.png")):
            located[f"{picture.parent.name}/{picture.name}"] = (pack, picture, csv_rows)
    entries = pool_entries()
    assert len(entries) == 232, len(entries)
    rows, installed, portraits, images17, installed_by = [], set(), {}, {}, {}
    for entry in entries:
        pack, source, csv_rows = located[entry["file"]]
        relative = source.relative_to(ROOT / "assets-inbox").as_posix()
        digest = sha(source)
        inbox_row = by_file[relative]
        assert inbox_row["sha256"] == digest, relative
        assert png_size(source) == (256, 256), relative
        record_path = pack / "records/provenance/generation-records" / f"{source.stem}.json"
        generation = json.loads(record_path.read_text()) if record_path.exists() else {}
        csv_row = csv_rows.get(source.stem) or csv_rows.get(entry["id"]) or {}
        prompt_text = generation.get("prompt") or csv_row.get("prompt") or "(no prompt recorded)"
        prompt = ROOT / "docs/provenance/prompts" / f"portrait_{entry['id']}.txt"
        prompt.write_text(prompt_text.strip() + "\n")
        references = generation.get("packaged_references") or ([csv_row["reference_files"]] if csv_row.get("reference_files") else [])
        url = f"assets/portraits/256/{entry['id']}.jpg"
        url96 = f"assets/portraits/96/{entry['id']}.jpg"
        portraits[entry["id"]] = {"url": url, "url96": url96, "source": str(source.relative_to(ROOT))}
        judged = "confirmed" if inbox_row["status"] == "confirmed" else f"{inbox_row['status']} — {inbox_row['verdict_note']}"
        rows.append({"assetId": f"portrait/{entry['id']}", "version": "v1", "runtimePath": str(source.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": "native image_gen",
                     "model": "not exposed", "generatedAt": "2026-09-26", "prompt": str(prompt.relative_to(ROOT)),
                     "referenceInputs": ";".join(references), "seed": "not exposed", "candidates": "1",
                     "manualEdits": generation.get("method", "256x256 downscale of the generated picture (pack records)"),
                     "artBible": "AB_2026-09-19_v1", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra portrait-pool",
                     "usedIn": USED_IN_PORTRAITS, "status": "runtime",
                     "notes": f"Astra portrait-pool {pack.name} {entry['id']} (assets-inbox/INBOX_LEDGER.csv: {judged}) installed by CHRON-1 "
                              f"on 2026-09-27; runtime is the web derivatives {url} and {url96} made at build time from this received "
                              f"file by scripts/keyartDerivatives.ts (the PNG stays in assets-inbox only; the eXIf chunk is not carried)."})
        installed.add(relative)
    wave17_records = {row["file"]: row for row in csv.DictReader(open(WAVE17 / "records/assets.csv", encoding="utf-8-sig"))}
    for asset_id, file in {**WAVE17_IDS, **WAVE17_UI6}.items():
        by = "UI-6" if asset_id in WAVE17_UI6 else INSTALLED_BY
        source = WAVE17 / "assets" / file
        relative = source.relative_to(ROOT / "assets-inbox").as_posix()
        digest = sha(source)
        inbox_row = by_file[relative]
        assert inbox_row["sha256"] == digest and inbox_row["status"] == "confirmed", relative
        record = wave17_records[f"assets/{file}"]
        prompt = ROOT / "docs/provenance/prompts" / f"{asset_id}-wave17.txt"
        prompt.write_text((record.get("full_prompt") or "(no prompt recorded)").strip() + "\n")
        width, height = png_size(source)
        url = f"assets/wave17/{Path(file).parent.relative_to('illustration').as_posix() + '/' if Path(file).parent.name != 'illustration' else ''}{source.stem}.jpg"
        images17[asset_id] = {"url": url, "width": width, "height": height, "source": str(source.relative_to(ROOT))}
        rows.append({"assetId": f"wave17/{asset_id}", "version": "v1", "runtimePath": str(source.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": "native image_gen", "model": "not exposed",
                     "generatedAt": "2026-09-26", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": record.get("reference_files", ""),
                     "seed": "not exposed", "candidates": "1", "manualEdits": record.get("processing", ""),
                     "artBible": "AB_2026-09-19_v1", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra wave17",
                     "usedIn": USED_IN17 if by == INSTALLED_BY else USED_IN17_UI6, "status": "runtime",
                     "notes": f"Astra wave17 {asset_id} (confirmed in assets-inbox/INBOX_LEDGER.csv) installed by {by} on {'2026-09-27' if by == INSTALLED_BY else '2026-09-28'} from "
                              f"{WAVE17.relative_to(ROOT)}; runtime is the web derivative {url} made at build time from this received file "
                              f"by scripts/keyartDerivatives.ts (the PNG stays in assets-inbox only)."})
        installed_by[relative] = by
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    fields = list(inbox[0].keys())
    for row in inbox:
        if row["file"] in installed:
            row["installed_by"] = INSTALLED_BY
        if row["file"] in installed_by:
            row["installed_by"] = installed_by[row["file"]]
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n")
        writer.writeheader(); writer.writerows(inbox)
    body = lambda table: "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '), ensure_ascii=False)}," for key, value in table.items())
    MANIFEST_PORTRAITS.write_text(
        "// Generated by scripts/installChronicleArt.py — the portrait pool (PERSON-0 src/content/portraitPool.ts ids) as build-time\n"
        "// web derivatives (scripts/keyartDerivatives.ts): `url` the 256 px JPEG, `url96` the 96 px one, `source` the received PNG.\n"
        "export const PORTRAIT_IMAGES = {\n" + body(portraits) + "\n} as const;\n")
    MANIFEST17.write_text(
        "// Generated by scripts/installChronicleArt.py — Wave 17 chronicle illustrations (CHRON-1), loaded as build-time web\n"
        "// derivatives (scripts/keyartDerivatives.ts); `source` is the received PNG in assets-inbox.\n"
        "export const WAVE17_IMAGES = {\n" + body(images17) + "\n} as const;\n")
    print(f"portraits {len(portraits)}, wave17 {len(images17)}, ledger rows {len(rows)}")


if __name__ == "__main__":
    main()
