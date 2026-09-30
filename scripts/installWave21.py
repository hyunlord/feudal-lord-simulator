"""UI-8/UI-9/UI-10: install the confirmed Wave 21 chapter 3, 4 and 5 illustrations.
  UI-8: 19 ch3_* runtime images (4 decision cards, 6 chronicle scenes, 8 event illustrations, 1 chapter-3 ending).
  UI-9: 19 ch4_* runtime images (4 decision cards, 6 chronicle scenes, 9 event illustrations + chapter-4 ending).
  UI-10: 20 ch5_* runtime images (4 decision cards, 6 chronicle scenes, 8 event illustrations, the chapter-5 end and
  the campaign end).
No C2PA chunks (asserted); the PNGs stay in assets-inbox; the game loads build-time JPEG derivatives
(scripts/keyartDerivatives.ts WAVE21_DERIVATIVES → WEB_ART_DERIVATIVES).
Writes:
  src/ui/wave21ArtManifest.generated.ts   (url, width, height, source for each id)
  docs/provenance/assets.csv              (one row per image, replacing earlier UI-8 / UI-9 / UI-10 rows)
  docs/provenance/prompts/                (one .txt per image)
  assets-inbox/INBOX_LEDGER.csv           (installed_by = UI-8/UI-9/UI-10 for each confirmed file)
Run: python3 scripts/installWave21.py
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
CANDIDATES = ROOT / "assets-inbox/wave21/candidates-v1"
REWORK = ROOT / "assets-inbox/wave21/rework-20260927"
INSTALLED_BY_CH3 = "UI-8"
INSTALLED_BY_CH4 = "UI-9"
INSTALLED_BY_CH5 = "UI-10"
INSTALLED_ON = "2026-09-29"
INSTALLED_ON_CH5 = "2026-09-30"
GENERATED_ON = "2026-09-27"
USED_IN_CH3 = "src/ui/wave21ArtManifest.generated.ts (UI-8: chapter 3 decision cards, event illustrations, chronicle scenes, chapter-end page; build-time web derivatives)"
USED_IN_CH4 = "src/ui/wave21ArtManifest.generated.ts (UI-9: chapter 4 decision cards, event illustrations, chronicle scenes, chapter-end page; build-time web derivatives)"
USED_IN_CH5 = "src/ui/wave21ArtManifest.generated.ts (UI-10: chapter 5 decision cards, event illustrations, chronicle scenes, chapter-end and campaign-end pages; build-time web derivatives)"
MANIFEST = ROOT / "src/ui/wave21ArtManifest.generated.ts"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}

# (asset_id, inbox-relative-path, sub-folder-for-url)
# Sub-folder matches the inbox subfolder: ch3_records or ch3_events.
WAVE21_CH3 = [
    ("ch3_decision_wages",             "candidates-v1/assets/ch3_records/ch3_decision_wages.png",             "ch3_records"),
    ("ch3_decision_land_redistribution","candidates-v1/assets/ch3_records/ch3_decision_land_redistribution.png","ch3_records"),
    ("ch3_decision_vacant_priest",     "candidates-v1/assets/ch3_records/ch3_decision_vacant_priest.png",     "ch3_records"),
    ("ch3_decision_cash_rent",         "candidates-v1/assets/ch3_records/ch3_decision_cash_rent.png",         "ch3_records"),
    ("ch3_chronicle_first_death",      "candidates-v1/assets/ch3_records/ch3_chronicle_first_death.png",      "ch3_records"),
    ("ch3_chronicle_churchyard",       "candidates-v1/assets/ch3_records/ch3_chronicle_churchyard.png",       "ch3_records"),
    ("ch3_chronicle_abandoned_fields", "candidates-v1/assets/ch3_records/ch3_chronicle_abandoned_fields.png", "ch3_records"),
    ("ch3_chronicle_ordinance",        "candidates-v1/assets/ch3_records/ch3_chronicle_ordinance.png",        "ch3_records"),
    ("ch3_chronicle_resettlement",     "candidates-v1/assets/ch3_records/ch3_chronicle_resettlement.png",     "ch3_records"),
    ("ch3_chronicle_spring_recovery",  "candidates-v1/assets/ch3_records/ch3_chronicle_spring_recovery.png",  "ch3_records"),
    ("ch3_event_harbour_fever",        "candidates-v1/assets/ch3_events/ch3_event_harbour_fever.png",         "ch3_events"),
    ("ch3_event_priest_death",         "candidates-v1/assets/ch3_events/ch3_event_priest_death.png",          "ch3_events"),
    ("ch3_event_new_graves",           "candidates-v1/assets/ch3_events/ch3_event_new_graves.png",            "ch3_events"),
    ("ch3_event_empty_streets",        "candidates-v1/assets/ch3_events/ch3_event_empty_streets.png",         "ch3_events"),
    ("ch3_event_abandoned_fields",     "candidates-v1/assets/ch3_events/ch3_event_abandoned_fields.png",      "ch3_events"),
    ("ch3_event_wage_demand",          "candidates-v1/assets/ch3_events/ch3_event_wage_demand.png",           "ch3_events"),
    ("ch3_event_ordinance_reading",    "candidates-v1/assets/ch3_events/ch3_event_ordinance_reading.png",     "ch3_events"),
    ("ch3_event_resettlement",         "candidates-v1/assets/ch3_events/ch3_event_resettlement.png",          "ch3_events"),
    # ch3_ending: rework-20260927, not candidates-v1
    ("ch3_ending",                     "rework-20260927/assets/ch3_events/ch3_ending.png",                    "ch3_events"),
]

# UI-9: Wave 21 chapter 4 art. rework-20260927 where candidates-v1 was superseded, else candidates-v1.
WAVE21_CH4 = [
    # Decisions — all four use rework-20260927 (candidates-v1 versions are superseded)
    ("ch4_decision_guild_approval",       "rework-20260927/assets/ch4_records/ch4_decision_guild_approval.png",       "ch4_records"),
    ("ch4_decision_tax_collection",       "rework-20260927/assets/ch4_records/ch4_decision_tax_collection.png",       "ch4_records"),
    ("ch4_decision_textile_or_grain",     "rework-20260927/assets/ch4_records/ch4_decision_textile_or_grain.png",     "ch4_records"),
    ("ch4_decision_charter_negotiation",  "rework-20260927/assets/ch4_records/ch4_decision_charter_negotiation.png",  "ch4_records"),
    # Chronicles — three from rework-20260927, three from candidates-v1
    ("ch4_chronicle_guild",               "rework-20260927/assets/ch4_records/ch4_chronicle_guild.png",               "ch4_records"),
    ("ch4_chronicle_petitions",           "rework-20260927/assets/ch4_records/ch4_chronicle_petitions.png",           "ch4_records"),
    ("ch4_chronicle_charter_negotiation", "rework-20260927/assets/ch4_records/ch4_chronicle_charter_negotiation.png", "ch4_records"),
    ("ch4_chronicle_rebellion_rumour",    "candidates-v1/assets/ch4_records/ch4_chronicle_rebellion_rumour.png",      "ch4_records"),
    ("ch4_chronicle_textile_street",      "candidates-v1/assets/ch4_records/ch4_chronicle_textile_street.png",        "ch4_records"),
    ("ch4_chronicle_wage_competition",    "candidates-v1/assets/ch4_records/ch4_chronicle_wage_competition.png",      "ch4_records"),
    # Events — two from rework-20260927, seven from candidates-v1
    ("ch4_event_guild_foundation",        "rework-20260927/assets/ch4_events/ch4_event_guild_foundation.png",         "ch4_events"),
    ("ch4_event_lord_warning",            "rework-20260927/assets/ch4_events/ch4_event_lord_warning.png",             "ch4_events"),
    ("ch4_event_wage_competition",        "candidates-v1/assets/ch4_events/ch4_event_wage_competition.png",           "ch4_events"),
    ("ch4_event_textile_growth",          "candidates-v1/assets/ch4_events/ch4_event_textile_growth.png",             "ch4_events"),
    ("ch4_event_alehouse",                "candidates-v1/assets/ch4_events/ch4_event_alehouse.png",                   "ch4_events"),
    ("ch4_event_petitions",               "candidates-v1/assets/ch4_events/ch4_event_petitions.png",                  "ch4_events"),
    ("ch4_event_rebellion_1381",          "candidates-v1/assets/ch4_events/ch4_event_rebellion_1381.png",             "ch4_events"),
    ("ch4_event_autonomy_request",        "candidates-v1/assets/ch4_events/ch4_event_autonomy_request.png",           "ch4_events"),
    ("ch4_ending",                        "candidates-v1/assets/ch4_events/ch4_ending.png",                           "ch4_events"),
]

# UI-10: Wave 21 chapter 5 art. rework-20260927 where candidates-v1 was superseded, else candidates-v1.
WAVE21_CH5 = [
    # Decisions — all four use rework-20260927 (candidates-v1 versions are superseded)
    ("ch5_decision_autonomy",             "rework-20260927/assets/ch5_records/ch5_decision_autonomy.png",             "ch5_records"),
    ("ch5_decision_royal_tax_response",   "rework-20260927/assets/ch5_records/ch5_decision_royal_tax_response.png",   "ch5_records"),
    ("ch5_decision_heir_choice",          "rework-20260927/assets/ch5_records/ch5_decision_heir_choice.png",          "ch5_records"),
    ("ch5_decision_legacy",               "rework-20260927/assets/ch5_records/ch5_decision_legacy.png",               "ch5_records"),
    # Chronicles — four from rework-20260927, two from candidates-v1
    ("ch5_chronicle_charter_sealing",     "rework-20260927/assets/ch5_records/ch5_chronicle_charter_sealing.png",     "ch5_records"),
    ("ch5_chronicle_city_seal",           "rework-20260927/assets/ch5_records/ch5_chronicle_city_seal.png",           "ch5_records"),
    ("ch5_chronicle_heir",                "rework-20260927/assets/ch5_records/ch5_chronicle_heir.png",                "ch5_records"),
    ("ch5_chronicle_legacy_sealing",      "rework-20260927/assets/ch5_records/ch5_chronicle_legacy_sealing.png",      "ch5_records"),
    ("ch5_chronicle_mayor_election",      "candidates-v1/assets/ch5_records/ch5_chronicle_mayor_election.png",        "ch5_records"),
    ("ch5_chronicle_last_market",         "candidates-v1/assets/ch5_records/ch5_chronicle_last_market.png",           "ch5_records"),
    # Events — six from rework-20260927, two from candidates-v1
    ("ch5_event_mayor_demand",            "rework-20260927/assets/ch5_events/ch5_event_mayor_demand.png",             "ch5_events"),
    ("ch5_event_charter_sealing",         "rework-20260927/assets/ch5_events/ch5_event_charter_sealing.png",          "ch5_events"),
    ("ch5_event_city_seal_making",        "rework-20260927/assets/ch5_events/ch5_event_city_seal_making.png",         "ch5_events"),
    ("ch5_event_royal_tax_envoy",         "rework-20260927/assets/ch5_events/ch5_event_royal_tax_envoy.png",          "ch5_events"),
    ("ch5_event_succession",              "rework-20260927/assets/ch5_events/ch5_event_succession.png",               "ch5_events"),
    ("ch5_event_legacy_record",           "rework-20260927/assets/ch5_events/ch5_event_legacy_record.png",            "ch5_events"),
    ("ch5_event_family_departure",        "candidates-v1/assets/ch5_events/ch5_event_family_departure.png",           "ch5_events"),
    ("ch5_event_last_market",             "candidates-v1/assets/ch5_events/ch5_event_last_market.png",                "ch5_events"),
    # The chapter-5 end page and the campaign end page (1920 × 1080), candidates-v1
    ("ch5_ending",                        "candidates-v1/assets/ch5_events/ch5_ending.png",                           "ch5_events"),
    ("ch5_campaign_ending",               "candidates-v1/assets/ch5_events/ch5_campaign_ending.png",                  "ch5_events"),
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


def prompt_for(asset_id: str, pack_dir: Path) -> str:
    """Extract the last generation prompt from the pack's assets.csv row, or fall back to '(no prompt recorded)'."""
    records_csv = pack_dir / "records" / "assets.csv"
    if not records_csv.exists():
        return "(no prompt recorded)"
    for row in csv.DictReader(open(records_csv, encoding="utf-8-sig")):
        row_id = row.get("asset_id") or row.get("id") or ""
        if row_id == asset_id:
            # candidates-v1 assets.csv: generation_records is a JSON array; rework has 'full_prompt'
            full_prompt = row.get("full_prompt", "")
            if full_prompt:
                return full_prompt.strip()
            gen_records = row.get("generation_records", "")
            if gen_records:
                try:
                    steps = json.loads(gen_records)
                    if steps:
                        return (steps[-1].get("prompt") or "(no prompt recorded)").strip()
                except (json.JSONDecodeError, KeyError, IndexError):
                    pass
            return "(no prompt recorded)"
    return "(no prompt recorded)"


def process_batch(
    batch: list[tuple[str, str, str]],
    installed_by: str,
    used_in: str,
    by_file: dict,
    images: dict,
    new_provenance_paths: set,
    installed_files: set,
    ledger_rows: list,
    installed_on: str = INSTALLED_ON,
) -> None:
    """Process one wave21 batch (ch3, ch4 or ch5), updating images / provenance / installed_files in place."""
    for asset_id, inbox_rel, subfolder in batch:
        source = ROOT / "assets-inbox/wave21" / inbox_rel
        relative = f"wave21/{inbox_rel}"  # as in INBOX_LEDGER file column

        # sha256 and C2PA check
        data = source.read_bytes()
        digest = sha(source)
        inbox_row = by_file.get(relative, {})
        assert inbox_row.get("sha256") == digest, f"{asset_id}: sha256 mismatch (inbox says {inbox_row.get('sha256')!r})"
        assert inbox_row.get("status") == "confirmed", f"{asset_id}: not confirmed (status={inbox_row.get('status')!r})"
        assert not C2PA_CHUNKS & png_chunks(data), f"{asset_id} carries a C2PA chunk"

        width, height = png_size(source)
        url = f"assets/wave21/{subfolder}/{asset_id}.jpg"
        images[asset_id] = {"url": url, "width": width, "height": height,
                             "source": str(source.relative_to(ROOT))}

        # Which pack directory (for prompt lookup)
        pack_dir = REWORK if inbox_rel.startswith("rework-20260927") else CANDIDATES
        prompt_text = prompt_for(asset_id, pack_dir)
        prompt_file = ROOT / "docs/provenance/prompts" / f"{asset_id}-wave21.txt"
        prompt_file.write_text(prompt_text + "\n")

        runtime_path = str(source.relative_to(ROOT))
        notes = (f"Astra wave21 {asset_id} (confirmed in assets-inbox/INBOX_LEDGER.csv) installed by {installed_by} "
                 f"on {installed_on} from assets-inbox/wave21/{inbox_rel.split('/')[0]}; runtime is the web derivative "
                 f"{url} made at build time from this received file by scripts/keyartDerivatives.ts "
                 f"(the PNG stays in assets-inbox only; no C2PA chunk).")
        ledger_rows.append({
            "assetId": f"wave21/{asset_id}", "version": "v1",
            "runtimePath": runtime_path, "runtimeSha256": digest,
            "sourcePath": runtime_path, "sourceSha256": digest,
            "tool": "native image_gen", "model": "not exposed",
            "generatedAt": GENERATED_ON, "prompt": str(prompt_file.relative_to(ROOT)),
            "referenceInputs": "", "seed": "not exposed", "candidates": "1",
            "manualEdits": "Sharp resize cover centre to target dimensions; no painting edits.",
            "artBible": "AB_2026-09-19_v1", "historicalProfile": "S_England_1300_1450_v1",
            "owner": "Astra wave21", "usedIn": used_in, "status": "runtime", "notes": notes,
        })
        new_provenance_paths.add(runtime_path)
        installed_files.add((relative, installed_by))


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}

    images: dict[str, dict] = {}
    new_provenance_paths: set[str] = set()
    installed_files: set[tuple[str, str]] = set()  # (relative_path, installed_by)
    ledger_rows: list[dict] = []

    process_batch(WAVE21_CH3, INSTALLED_BY_CH3, USED_IN_CH3, by_file, images, new_provenance_paths, installed_files, ledger_rows)
    process_batch(WAVE21_CH4, INSTALLED_BY_CH4, USED_IN_CH4, by_file, images, new_provenance_paths, installed_files, ledger_rows)
    process_batch(WAVE21_CH5, INSTALLED_BY_CH5, USED_IN_CH5, by_file, images, new_provenance_paths, installed_files, ledger_rows, INSTALLED_ON_CH5)

    # Update docs/provenance/assets.csv — replace any UI-8/UI-9/UI-10 wave21 rows, keep everything else
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
        for rel_path, installed_by in installed_files:
            if row["file"] == rel_path:
                row["installed_by"] = installed_by
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, lineterminator="\r\n")
        writer.writeheader()
        writer.writerows(inbox)

    # Write the generated manifest (ch3 + ch4 + ch5 combined)
    body = "\n".join(
        f"  {key}: {json.dumps(value, separators=(', ', ': '), ensure_ascii=False)},"
        for key, value in images.items()
    )
    MANIFEST.write_text(
        "// Generated by scripts/installWave21.py — Wave 21 chapter 3 illustrations (UI-8), chapter 4 (UI-9) and\n"
        "// chapter 5 (UI-10): decision cards, event illustrations, chronicle scenes, the chapter end pages and the\n"
        "// campaign end page, loaded as build-time JPEG derivatives (scripts/keyartDerivatives.ts); `source` is the\n"
        "// received PNG in assets-inbox.\n"
        "export const WAVE21_IMAGES = {\n" + body + "\n} as const;\n"
    )
    print(f"wave21 {len(images)} images, {len(ledger_rows)} provenance rows")


if __name__ == "__main__":
    main()
