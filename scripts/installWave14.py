"""UI-5: install the Wave 14 art the person card uses (verdict 2026-09-26, confirmed in assets-inbox/INBOX_LEDGER.csv) into
public/assets/wave14/<group>: the person card frame; the heraldry masks the lord's arms are composed from (three
shields, ten partitions, seven ordinaries — the bordure, which needs its own shield-UV mapping, is not used — twelve
charges) with the texture rework's multiply and screen surfaces; the merchant marks' frames, staffs and branches with the
rework's ink-stamp retention map. Received bytes = runtime bytes (the batches carry no C2PA chunks). One
docs/provenance/assets.csv row each (replacing earlier UI-5 rows) with one prompt file each, `installed_by` = UI-5 in the
inbox ledger, and src/ui/wave14ArtManifest.generated.ts (url, size, group; the card's 9-slice insets and slots).
Run: python3 scripts/installWave14.py
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
BATCH = ROOT / "assets-inbox/wave14/candidates-v1"
REWORK = ROOT / "assets-inbox/wave14/texture-rework-20260926"
MANIFEST = ROOT / "src/ui/wave14ArtManifest.generated.ts"
USED_IN = "src/ui/wave14ArtManifest.generated.ts (UI-5: the person card, the lord's arms and the merchant marks composed on it)"
csv.field_size_limit(sys.maxsize)

WANTED = (["ui-frames/frame_person_card-v1.png"]
          + [f"heraldry/shield_{shape}.png" for shape in ("heater", "knightly", "rounded")]
          + [f"heraldry/partition_{name}.png" for name in ("barry", "paly", "per_bend", "per_bend_sinister", "per_chevron", "per_fess", "per_pale",
                                                          "per_pale_indented", "per_saltire", "quarterly")]
          + [f"heraldry/ordinary_{name}.png" for name in ("bend", "chevron", "chief", "cross", "fess", "pale", "saltire")]
          + [f"charges/charge_{name}.png" for name in ("boar", "cartwheel", "crescent", "eagle", "fish", "fleur_de_lis", "lion_passant", "mullet",
                                                       "rose", "stag_head", "tower", "wheatsheaf")]
          + [f"merchant/merchant_frame_{name}-v1.png" for name in ("circle", "shield")]
          + [f"merchant/merchant_staff_{name}-v1.png" for name in ("figure4", "pennant", "rake", "topcross")]
          + [f"merchant/merchant_branch_{name}-v1.png" for name in ("diagonal", "diamond", "double_fork", "horizontal", "loop", "steps", "v", "w")])
# UI-6: the lord's rights register (the ledger drawer's rights tab), its six right icons, and the hanging wax seal the
# Crown's writs carry on the chapter 2 decision cards.
WANTED_UI6 = (["ui-frames/frame_rights_register-v1.png", "seals/wax_seal_hanging.png"]
              + [f"ui-icons/icon_right_{name}-v1.png" for name in ("burgage", "court", "fair", "guild", "market", "toll")])
USED_IN_UI6 = "src/ui/wave14ArtManifest.generated.ts (UI-6: the ledger drawer's rights register and right icons; the Crown's writ seal)"
REWORKED = ["shield_surface_texture_multiply.png", "shield_surface_texture_screen.png", "merchant/merchant_ink_stamp_texture.png"]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def records(batch: Path) -> dict:
    return {row["file"]: row for row in csv.DictReader(open(batch / "records/assets.csv", encoding="utf-8-sig"))}


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    batch_records, rework_records = records(BATCH), records(REWORK)
    rows, installed, images = [], set(), {}
    sources = ([(BATCH, f"assets/{file}", batch_records) for file in WANTED] + [(REWORK, f"assets/{file}", rework_records) for file in REWORKED]
               + [(BATCH, f"assets/{file}", batch_records) for file in WANTED_UI6])
    ui6 = {f"assets/{file}" for file in WANTED_UI6}
    installed_by = {}
    for batch, relative, table in sources:
        source = batch / relative
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        digest = sha(source)
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        record = table[relative]
        assert record["sha256"] == digest, relative
        name = source.name
        group = "heraldry" if relative.startswith("assets/shield_surface") else relative.split("/")[1]
        runtime = ROOT / "public/assets/wave14" / group / name
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, relative
        key = record["asset_id"].removesuffix("-v1")
        entry = {"url": f"assets/wave14/{group}/{name}", "width": int(record["width"]), "height": int(record["height"]), "group": group}
        if key == "frame_person_card":
            # records/asset-rows.json: insets (top, right, bottom, left) 136, 64, 20, 112, minimum 320 x 200; the generation
            # prompt's slots: portrait recess centre (60, 94) radius 39, emblem slot centre (279, 45) 40 x 48.
            entry["nineSlice"] = {"insets": {"left": 112, "top": 136, "right": 64, "bottom": 20}, "minimumSize": {"width": 320, "height": 200}}
            entry["slots"] = {"portrait": {"x": 60, "y": 94, "radius": 39}, "emblem": {"x": 279, "y": 45, "width": 40, "height": 48}}
        if key == "frame_rights_register":
            # records/asset-rows.json: insets (top, right, bottom, left) 24 each, minimum 512 x 512 (two facing pages).
            entry["nineSlice"] = {"insets": {"left": 24, "top": 24, "right": 24, "bottom": 24}, "minimumSize": {"width": 512, "height": 512}}
        images[key] = entry
        generations = json.loads(record["generation_records"] or "[]")
        prompt = ROOT / "docs/provenance/prompts" / f"{key}-wave14.txt"
        prompt.write_text(((generations[0].get("prompt", "") if generations else "").strip() or "(no prompt recorded)") + "\n")
        references = sorted({ref for generation in generations for ref in generation.get("referenceImages", [])})
        rows.append({"assetId": f"wave14/{group}/{key}", "version": "v1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest,
                     "tool": (generations[0].get("tool") if generations else None) or "native image_gen", "model": "not exposed", "generatedAt": "",
                     "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": ";".join(references) or "none", "seed": "not exposed",
                     "candidates": str(max(1, len(generations))), "manualEdits": record["processing"], "artBible": "AB_2026-09-19_v1",
                     "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra wave14", "usedIn": USED_IN_UI6 if relative in ui6 else USED_IN, "status": "runtime",
                     "notes": f"Astra wave14 {key} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-26) installed by "
                              f"{'UI-6 on 2026-09-28' if relative in ui6 else 'UI-5 on 2026-09-27'} "
                              f"from {batch.relative_to(ROOT)}; received bytes = runtime bytes."})
        installed.add(inbox_key)
        if relative in ui6: installed_by[inbox_key] = "UI-6"
    assert len(images) == 58, len(images)
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if not row["runtimePath"].startswith("public/assets/wave14/")]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    fields = list(inbox[0].keys())
    for row in inbox:
        if row["file"] in installed:
            row["installed_by"] = installed_by.get(row["file"], "UI-5")
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(images.items()))
    MANIFEST.write_text("// Generated by scripts/installWave14.py — Wave 14 runtime art (UI-5): url, size, group; the person card's 9-slice\n"
                        "// insets and its portrait and emblem slots. Heraldry and merchant masks are composed by src/ui/heraldry.\n"
                        "export const WAVE14_IMAGES = {\n" + body + "\n} as const;\n")
    print(len(rows), "rows;", len(images), "installed")


if __name__ == "__main__":
    main()
