"""INSTALL-3: install the ale chain's part of Wave 3 (confirmed in assets-inbox/INBOX_LEDGER.csv: the batch of
2026-09-26 and its rework of the same day) into public/assets/wave3/<folder>: the barley ridge strips growing and ripe
(field), the malt kiln a / b, the alehouse a / b with its ale stake and the brewhouse (bld), barley, malt and ale
barrel piles in three stages (pile), barley, malt and ale cart loads for two headings (loads), the alewife and the
maltster walker sheets (workers) and the two icon sheets (icons: resources and buildings; the textile chain's icons
share them). The reworked barley pictures (fix-20260926) replace their first versions. The textile chain (wool,
cloth, dye, fulling, sheep) is not installed. The batch carries no C2PA chunk (asserted): received bytes = runtime
bytes.
One docs/provenance/assets.csv row each (the batch's own records/assets.csv row, with the runtime path and status;
replacing earlier rows for these runtime paths), one prompt file each, `installed_by` = INSTALL-3 in the inbox ledger,
and src/render/wave3AleManifest.generated.ts (url, folder, size).
Run: python3 scripts/installWave3Ale.py
"""
import csv
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INBOX = ROOT / "assets-inbox"
FIRST = INBOX / "wave3/candidates-20260926"
FIX = INBOX / "wave3/fix-20260926"
RUNTIME = ROOT / "public/assets/wave3"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = INBOX / "INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/render/wave3AleManifest.generated.ts"
USED_IN = "src/render/wave3AleManifest.generated.ts (INSTALL-3: the ale chain — barley strips, malt kiln, alehouse, piles, cart loads, walkers, icons)"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
FIX_FILES = {"field/ridge_barley_ripe_a-v1.png", "field/ridge_barley_ripe_b-v1.png", "loads/cart_load_barley_ne-v1.png",
             "loads/cart_load_barley_nw-v1.png", "pile/barley_sacks_1-v1.png", "pile/barley_sacks_2-v1.png", "pile/barley_sacks_3-v1.png"}
WANTED = [
    "field/ridge_barley_growing_a-v1.png", "field/ridge_barley_growing_b-v1.png", "field/ridge_barley_ripe_a-v1.png", "field/ridge_barley_ripe_b-v1.png",
    "bld/malthouse_a.png", "bld/malthouse_b.png", "bld/alehouse_a.png", "bld/alehouse_b.png", "bld/brewhouse.png",
    "pile/barley_sacks_1-v1.png", "pile/barley_sacks_2-v1.png", "pile/barley_sacks_3-v1.png",
    "pile/malt_sacks_1-v1.png", "pile/malt_sacks_2-v1.png", "pile/malt_sacks_3-v1.png",
    "pile/ale_barrels_1-v1.png", "pile/ale_barrels_2-v1.png", "pile/ale_barrels_3-v1.png",
    "loads/cart_load_barley_ne-v1.png", "loads/cart_load_barley_nw-v1.png", "loads/cart_load_malt_ne-v1.png", "loads/cart_load_malt_nw-v1.png",
    "loads/cart_load_ale_barrels_ne-v1.png", "loads/cart_load_ale_barrels_nw-v1.png",
    "workers/wk_alewife-v1.png", "workers/wk_maltster-v1.png",
    "icons/icon_resource_chain_sheet.png", "icons/icon_building_chain_sheet.png",
]
csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_info(data: bytes) -> tuple:
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    found, i = set(), 8
    while i < len(data):
        n = struct.unpack(">I", data[i:i + 4])[0]
        found.add(data[i + 4:i + 8])
        i += 12 + n
    width, height = struct.unpack(">II", data[16:24])
    return found, width, height


def records(batch: Path) -> dict:
    return {row["runtimePath"]: row for row in csv.DictReader(open(batch / "records/assets.csv", encoding="utf-8-sig"))}


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    first, fix = records(FIRST), records(FIX)
    rows, installed, images = [], set(), {}
    for rel in WANTED:
        batch = FIX if rel in FIX_FILES else FIRST
        source = batch / "assets" / rel
        inbox_key = source.relative_to(INBOX).as_posix()
        digest = sha(source)
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        chunks, width, height = png_info(source.read_bytes())
        assert not C2PA_CHUNKS & chunks, f"{rel} carries a C2PA chunk"
        folder, name = rel.split("/")
        key = name.removesuffix(".png").removesuffix("-v1")
        runtime = RUNTIME / folder / f"{key}.png"
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, rel
        record = (fix if batch is FIX else first).get(rel)
        assert record is not None and record["runtimeSha256"] == digest, rel
        images[key] = {"url": f"assets/wave3/{folder}/{key}.png", "folder": folder, "width": width, "height": height}
        prompt = ROOT / "docs/provenance/prompts" / f"{key}-wave3.txt"
        prompt.write_text((record.get("prompt") or "(no prompt recorded)").strip() + "\n")
        rows.append({**record, "assetId": f"wave3/{key}", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "prompt": str(prompt.relative_to(ROOT)),
                     "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave3 {record['assetId']} (confirmed in assets-inbox/INBOX_LEDGER.csv) installed by INSTALL-3 on 2026-09-28 from "
                              f"{batch.relative_to(ROOT)}; no C2PA chunk, received bytes = runtime bytes."})
        installed.add(inbox_key)
    assert len(images) == len(WANTED)
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    raw = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
    fields = list(inbox[0].keys())
    for row in inbox:
        if row["file"] in installed:
            row["installed_by"] = "INSTALL-3"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if "\r\n" in raw else "\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(images.items()))
    MANIFEST.write_text("// Generated by scripts/installWave3Ale.py — Wave 3's ale chain (INSTALL-3): url, folder and size of each picture.\n"
                        "export const WAVE3_ALE_IMAGES = {\n" + body + "\n} as const;\n\nexport type Wave3AleKey = keyof typeof WAVE3_ALE_IMAGES;\n")
    print(len(rows), "rows;", len(images), "installed")


if __name__ == "__main__":
    main()
