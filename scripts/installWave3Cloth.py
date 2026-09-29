"""INSTALL-C5: install the cloth chain's part of Wave 3 (confirmed in assets-inbox/INBOX_LEDGER.csv: the batch of
2026-09-26 and its rework of the same day) into public/assets/wave3/<folder>: weaver house a / b (bld), fulling mill
nesw / nwse + wheel sheet (bld), dyehouse a / b + active overlay (bld), woolhouse, shepherd hut (bld), tenter frames
a / b / dyed (yard), wool-bale and cloth cart loads in two headings (loads), fleece-heap, wool-bale, yarn-skein and
raw-cloth-bolt piles in three stages each (pile), shepherd, fuller and wool-merchant walker sheets (workers). The
reworked cloth-dyed cart loads and tenter_frames_dyed (fix-20260926) replace their first versions. Three Wave 2
farm_pastoral sprites (spring / summer / winter) are installed from assets-inbox/wave2/hold/ into
public/assets/wave2/bld/ using the wave2 provenance CSV. The batches carry no C2PA chunk (asserted): received bytes
= runtime bytes.
One docs/provenance/assets.csv row each (replacing earlier rows for those runtime paths), one prompt file each,
`installed_by` = INSTALL-C5 in the inbox ledger, and src/render/wave3ClothManifest.generated.ts (url, folder, size).
Run: python3 scripts/installWave3Cloth.py
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
WAVE2 = INBOX / "wave2"
RUNTIME3 = ROOT / "public/assets/wave3"
RUNTIME2 = ROOT / "public/assets/wave2"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = INBOX / "INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/render/wave3ClothManifest.generated.ts"
USED_IN = ("src/render/wave3ClothManifest.generated.ts (INSTALL-C5: the cloth chain — weaver house, fulling mill, "
           "dyehouse, tenter yard, piles, cart loads, walkers, pastoral farm)")
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
# These three files were reworked; install from fix-20260926 instead of candidates-20260926.
FIX_FILES = {
    "loads/cart_load_cloth_dyed_ne-v1.png",
    "loads/cart_load_cloth_dyed_nw-v1.png",
    "yard/tenter_frames_dyed-v1.png",
}
WANTED = [
    "bld/weaver_house_a.png",
    "bld/weaver_house_b.png",
    "bld/fulling_mill_nesw.png",
    "bld/fulling_mill_nwse.png",
    "bld/fulling_mill_wheel_sheet.png",
    "bld/dyehouse_a.png",
    "bld/dyehouse_b.png",
    "bld/dyehouse_state_active-overlay.png",
    "bld/woolhouse.png",
    "bld/shepherd_hut.png",
    "yard/tenter_frames_a-v1.png",
    "yard/tenter_frames_b-v1.png",
    "yard/tenter_frames_dyed-v1.png",
    "loads/cart_load_wool_bales_ne-v1.png",
    "loads/cart_load_wool_bales_nw-v1.png",
    "loads/cart_load_cloth_raw_ne-v1.png",
    "loads/cart_load_cloth_raw_nw-v1.png",
    "loads/cart_load_cloth_dyed_ne-v1.png",
    "loads/cart_load_cloth_dyed_nw-v1.png",
    "pile/fleece_heap_1-v1.png",
    "pile/fleece_heap_2-v1.png",
    "pile/fleece_heap_3-v1.png",
    "pile/wool_bales_1-v1.png",
    "pile/wool_bales_2-v1.png",
    "pile/wool_bales_3-v1.png",
    "pile/yarn_skeins_1-v1.png",
    "pile/yarn_skeins_2-v1.png",
    "pile/yarn_skeins_3-v1.png",
    "pile/cloth_bolts_raw_1-v1.png",
    "pile/cloth_bolts_raw_2-v1.png",
    "pile/cloth_bolts_raw_3-v1.png",
    "workers/wk_shepherd-v1.png",
    "workers/wk_fuller-v1.png",
    "workers/wk_wool_merchant-v1.png",
]
# Wave 2 pastoral: filenames in wave2/hold/ and their manifest key (no -v1 suffix in key).
WAVE2_PASTORAL = [
    "farm_pastoral_spring-v1.png",
    "farm_pastoral_summer-v1.png",
    "farm_pastoral_winter-v1.png",
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
    wave2_prov = {row["assetId"]: row for row in csv.DictReader(open(WAVE2 / "provenance-wave2.csv", encoding="utf-8-sig"))}
    rows, installed, images = [], set(), {}

    # --- Wave 3 cloth assets ---
    for rel in WANTED:
        is_fix = rel in FIX_FILES
        batch = FIX if is_fix else FIRST
        source = batch / "assets" / rel
        inbox_key = source.relative_to(INBOX).as_posix()
        digest = sha(source)
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        chunks, width, height = png_info(source.read_bytes())
        assert not C2PA_CHUNKS & chunks, f"{rel} carries a C2PA chunk"
        folder, name = rel.split("/")
        key = name.removesuffix(".png").removesuffix("-v1")
        runtime = RUNTIME3 / folder / f"{key}.png"
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, rel
        # Both batch records CSVs are keyed by runtimePath which matches rel exactly
        # (e.g. "bld/weaver_house_a.png", "loads/cart_load_cloth_dyed_ne-v1.png").
        record = (fix if is_fix else first).get(rel)
        assert record is not None and record["runtimeSha256"] == digest, f"{rel}: record missing or sha mismatch"
        images[key] = {"url": f"assets/wave3/{folder}/{key}.png", "folder": folder, "width": width, "height": height}
        prompt = ROOT / "docs/provenance/prompts" / f"{key}-wave3cloth.txt"
        prompt.write_text((record.get("prompt") or "(no prompt recorded)").strip() + "\n")
        rows.append({**record, "assetId": f"wave3cloth/{key}", "runtimePath": str(runtime.relative_to(ROOT)),
                     "runtimeSha256": digest, "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest,
                     "prompt": str(prompt.relative_to(ROOT)), "usedIn": USED_IN, "status": "runtime",
                     "notes": (f"Astra wave3 cloth {record['assetId']} (confirmed in assets-inbox/INBOX_LEDGER.csv) "
                               f"installed by INSTALL-C5 on 2026-09-29 from {batch.relative_to(ROOT)}; "
                               f"no C2PA chunk, received bytes = runtime bytes.")})
        installed.add(inbox_key)

    # --- Wave 2 pastoral farm ---
    for filename in WAVE2_PASTORAL:
        source = WAVE2 / "hold" / filename
        inbox_key = source.relative_to(INBOX).as_posix()
        digest = sha(source)
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        chunks, width, height = png_info(source.read_bytes())
        assert not C2PA_CHUNKS & chunks, f"{filename} carries a C2PA chunk"
        key = filename.removesuffix(".png").removesuffix("-v1")
        runtime = RUNTIME2 / "bld" / f"{key}.png"
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, filename
        # provenance-wave2.csv assetId uses the -v1 form: "farm_pastoral_spring-v1"
        asset_id_w2 = filename.removesuffix(".png")
        record = wave2_prov.get(asset_id_w2)
        assert record is not None and record["runtimeSha256"] == digest, f"{filename}: wave2 record missing or sha mismatch"
        images[key] = {"url": f"assets/wave2/bld/{key}.png", "folder": "bld", "width": width, "height": height}
        prompt = ROOT / "docs/provenance/prompts" / f"{key}-wave2.txt"
        prompt.write_text((record.get("prompt") or "(no prompt recorded)").strip() + "\n")
        rows.append({**record, "assetId": f"wave2/{key}", "runtimePath": str(runtime.relative_to(ROOT)),
                     "runtimeSha256": digest, "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest,
                     "prompt": str(prompt.relative_to(ROOT)), "usedIn": USED_IN, "status": "runtime",
                     "notes": (f"Astra wave2 pastoral {asset_id_w2} (confirmed in assets-inbox/INBOX_LEDGER.csv) "
                               f"installed by INSTALL-C5 on 2026-09-29 from wave2/hold; "
                               f"no C2PA chunk, received bytes = runtime bytes.")})
        installed.add(inbox_key)

    assert len(images) == len(WANTED) + len(WAVE2_PASTORAL)
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    raw = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
    fields = list(inbox[0].keys())
    for row in inbox:
        if row["file"] in installed:
            row["installed_by"] = "INSTALL-C5"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if "\r\n" in raw else "\n")
        writer.writeheader()
        writer.writerows(inbox)
    body = "\n".join(f"  {k}: {json.dumps(v, separators=(', ', ': '))}," for k, v in sorted(images.items()))
    MANIFEST.write_text(
        "// Generated by scripts/installWave3Cloth.py — Wave 3 cloth chain + Wave 2 pastoral (INSTALL-C5):"
        " url, folder and size of each picture.\n"
        "export const WAVE3_CLOTH_IMAGES = {\n" + body + "\n} as const;\n\n"
        "export type Wave3ClothKey = keyof typeof WAVE3_CLOTH_IMAGES;\n"
    )
    print(len(rows), "rows;", len(images), "images installed")


if __name__ == "__main__":
    main()
