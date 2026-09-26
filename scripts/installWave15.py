"""INSTALL-15: install Wave 15 (65 confirmed runtime files, the seasonal nature: trees, shrubs, stumps, tufts and
stones; orchard trees; forest fringe and grass edge; pasture, grass fill, winter fallow ridge and soil; snow drifts,
ice, spring flowers and orchard petals; falling-leaf and snowfall sheets) from assets-inbox/wave15/candidates-20260926
into public/assets/wave15/<group>. One docs/provenance/assets.csv row each (replacing earlier INSTALL-15 rows; the
batch's own 20-column rows, re-pointed at the runtime file, with one prompt file each), `installed_by` = INSTALL-15 in the inbox ledger, and
src/render/seasonArtManifest.generated.ts: per variant its url, size, the art it replaces (`base`, same canvas and
registration) and its season; decals and sheets carry a pivot and frames instead.
Run: python3 scripts/installWave15.py
"""
import csv
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
BATCH = ROOT / "assets-inbox/wave15/candidates-20260926"
MANIFEST = ROOT / "src/render/seasonArtManifest.generated.ts"
USED_IN = "src/render/seasonArtManifest.generated.ts (INSTALL-15: seasonal trees, orchards, forest fringe, grass, pasture, winter fields, season decals and fx)"
SEASONS = ("spring", "autumn", "winter_snow", "winter")
# Bases a variant stands in for when its file name is not the base's own key (every pasture floor, both soils and
# both fallow ridges take the one seasonal image; `grass_<season>_fill` is the `grass` terrain texture's).
BASES = {"soil": ["soil_a", "soil_b"], "ridge_fallow": ["ridge_fallow_a", "ridge_fallow_b"],
         "pasture": ["pasture_fill", "pasture_fill_b", "pasture_fill_c"]}
csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_size(path: Path) -> tuple[int, int]:
    return struct.unpack(">II", path.read_bytes()[16:24])


def split_season(stem: str) -> tuple[str, str | None]:
    for season in SEASONS:
        if stem.endswith("_" + season):
            return stem[: -len(season) - 1], season
    return stem, None


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    confirmed = {row["file"]: row for row in inbox if row["wave"] == "wave15" and row["status"] == "confirmed" and "/assets/" in row["file"]}
    records = {row["runtimePath"]: row for row in csv.DictReader(open(BATCH / "records/assets.csv", encoding="utf-8-sig"))}
    rows, installed, images = [], set(), {}
    for file, inbox_row in sorted(confirmed.items()):
        source = ROOT / "assets-inbox" / file
        digest = sha(source)
        assert digest == inbox_row["sha256"], file
        relative = source.relative_to(BATCH / "assets").as_posix()
        record = records[relative]
        assert record["runtimeSha256"] == digest, relative
        group = relative.split("/")[0]
        stem = source.stem.removesuffix("-v1")
        runtime = ROOT / "public/assets/wave15" / relative
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, relative
        width, height = png_size(source)
        entry = {"url": f"assets/wave15/{relative}", "width": width, "height": height}
        if group == "fx":
            # Four frames across (falling leaves 64x96, snowfall 128x128, records/README.md); pivot the cell centre.
            cell = width // 4
            entry.update({"pivot": {"x": cell // 2, "y": height // 2}, "frames": {"width": cell, "height": height, "count": 4}})
        elif group == "season" or stem == "orchard_spring_petals":
            entry["pivot"] = {"x": width // 2, "y": height // 2}
        else:
            base, season = split_season(stem.removesuffix("_fill"))
            assert season is not None, stem
            entry.update({"bases": BASES.get(base, [base]), "season": season})
        images[stem] = entry
        prompt = ROOT / "docs/provenance/prompts" / f"{stem}-wave15.txt"
        prompt.write_text((record["prompt"].strip() or "(no prompt recorded)") + "\n")
        # The batch row's source is Astra's raw generation (a path on Astra's machine, before the recorded manual edits);
        # the ledger's source of record is the received inbox file, and the raw source moves into the notes.
        rows.append({**record, "prompt": str(prompt.relative_to(ROOT)), "runtimePath": str(runtime.relative_to(ROOT)), "sourcePath": str(source.relative_to(ROOT)),
                     "sourceSha256": digest, "usedIn": USED_IN, "status": "runtime",
                     "notes": f"{record['notes']}; raw generation {record['sourceSha256']} (Astra's machine, before the manual edits); "
                              f"installed by INSTALL-15 on 2026-09-27 from {BATCH.relative_to(ROOT)} "
                              "(confirmed in assets-inbox/INBOX_LEDGER.csv; received bytes = runtime bytes)"})
        installed.add(file)
    assert len(images) == 65, len(images)
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if not row["runtimePath"].startswith("public/assets/wave15/")]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    fields = list(inbox[0].keys())
    for row in inbox:
        if row["file"] in installed:
            row["installed_by"] = "INSTALL-15"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(images.items()))
    MANIFEST.write_text("// Generated by scripts/installWave15.py — Wave 15 seasonal nature (INSTALL-15): url and size; a variant names the\n"
                        "// art it replaces (`bases`: same canvas and registration) and its season; decals and fx sheets carry a pivot\n"
                        "// (and frames for the sheets).\n"
                        "export const SEASON_IMAGES = {\n" + body + "\n} as const;\n")
    print(len(rows), "rows;", len(images), "installed")


if __name__ == "__main__":
    main()
