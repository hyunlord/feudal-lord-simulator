"""INSTALL-30: install Wave 30, the pair-house variants (90 confirmed files from assets-inbox/wave30/candidates-20260929,
verdict 2026-09-29) into public/assets/wave30/house_pair: for each two-lot house (L2-L4, horizontal and vertical) three
new paintings c-e on the approved pair's own runtime canvas (L2h 195x156, L2v 183, L3h 209x167, L3v 183, L4h 204,
L4v 184 px; records/source-contract.json: the approved crop and pivot unchanged, never re-cropped), and for each of
them its own state layers weathered / fresh / snow / boarded (transparent, same size, source-over at (0, 0); never
laid on another variant). The two check pictures (proofs/), the masks and record pictures are not installed. No C2PA
chunk (asserted): received bytes = runtime bytes, each checked against the inbox ledger and the batch's CSV.
One docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths), one prompt file each (the
batch's own generation prompt for that file, records/l2h.json..l4v.json), `installed_by` = INSTALL-30 in the inbox
ledger, and src/render/wave30PairHouseManifest.generated.ts: every picture's url and size, and for each painting its
level, lot, roof (records/generation-records.csv `roof`, read as thatch / clay_tile / stone_slate) and crop — the
approved pair's alpha bounds widened to the painting's own opaque pixels (alpha >= 64), in the approved pair's
declared frame, as INSTALL-26 does, so a wider eave is not cut off and the registration stays the approved pair's.
Run: python3 scripts/installWave30.py
"""
import csv
import hashlib
import json
import math
import re
import shutil
import struct
import sys
from pathlib import Path

from PIL import Image
from registerStateLayers import main as register_state_layers

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/wave30/candidates-20260929"
RUNTIME = ROOT / "public/assets/wave30/house_pair"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
PAIRS = ROOT / "src/render/houseCompoundAssetManifest.generated.ts"
MANIFEST = ROOT / "src/render/wave30PairHouseManifest.generated.ts"
USED_IN = "src/render/wave30PairHouseManifest.generated.ts (INSTALL-30: pair-house variants c-e and their weathered / fresh / snow / boarded layers)"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
STATES = ("weathered", "fresh", "snow", "boarded")
csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_chunks(data: bytes) -> set:
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    found, i = set(), 8
    while i < len(data):
        n = struct.unpack(">I", data[i:i + 4])[0]
        found.add(data[i + 4:i + 8])
        i += 12 + n
    return found


def approved_pairs() -> dict:
    text = PAIRS.read_text()
    body = re.sub(r",(\s*[\]}])", r"\1", text[text.index("["):])
    return {(entry["level"], entry["axis"]): entry for entry in json.JSONDecoder().raw_decode(body)[0]}


def roof(text: str) -> str:
    """The batch's free-text roof ("muted flat clay tile", "warm_limestone_slabs", ...) as the game's three roofs."""
    words = text.lower().replace("_", " ")
    found = [name for name, keys in (("thatch", ("thatch",)), ("clay_tile", ("tile",)), ("stone_slate", ("slab", "slate")))
             if any(key in words for key in keys)]
    assert len(found) == 1, text
    return found[0]


def prompt_for(family: str, file: str) -> str:
    """The batch's prompt for one file: its entry in the family record (records/l2h.json..l4v.json, reworks folded in)."""
    entries = json.loads((BATCH / f"records/{family}.json").read_text())["assets"]
    named = [entry for entry in entries if entry.get("file") == file]
    assert len(named) == 1 and named[0].get("prompt"), file
    return named[0]["prompt"]


def crop(image: Path, approved: dict) -> dict:
    """The approved alpha bounds widened to this painting's alpha >= 64 pixels, in the approved pair's declared units."""
    picture = Image.open(image).convert("RGBA")
    bbox = picture.getchannel("A").point(lambda a: 255 if a >= 64 else 0).getbbox()
    assert bbox is not None, image
    kx, ky = approved["width"] / picture.width, approved["height"] / picture.height
    bounds = approved["alphaBounds"]
    x0 = min(bounds["x"], math.floor(bbox[0] * kx)); y0 = min(bounds["y"], math.floor(bbox[1] * ky))
    x1 = max(bounds["x"] + bounds["width"], math.ceil(bbox[2] * kx)); y1 = max(bounds["y"] + bounds["height"], math.ceil(bbox[3] * ky))
    return {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0}


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    records = list(csv.DictReader(open(BATCH / "records/generation-records.csv", encoding="utf-8-sig")))
    checks = {row["file"]: row for row in json.loads((BATCH / "records/manifest.json").read_text())["assets"]}
    approved = approved_pairs()
    rows, installed, images, variants = [], set(), {}, []
    RUNTIME.mkdir(parents=True, exist_ok=True)
    for record in records:
        source = BATCH / record["file"]
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        digest = sha(source)
        assert digest == record["sha256"], record["id"]
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        assert not C2PA_CHUNKS & png_chunks(source.read_bytes()), f"{record['id']} carries a C2PA chunk"
        level, lot, variant, state = int(record["level"]), record["direction"], record["variant"], record["state"]
        assert state in ("base", *STATES) and variant in "cde" and lot in ("horizontal", "vertical"), record["id"]
        width, height = int(record["width"]), int(record["height"])
        pair = approved[(level, lot)]
        with Image.open(source) as picture:
            assert picture.size == (width, height) and picture.mode == "RGBA", record["id"]
            # The approved pair's runtime derivative canvas (records/source-contract.json): same size, same frame.
            with Image.open(ROOT / "public" / pair["url"]) as base:
                assert base.size == picture.size, record["id"]
        check = checks[record["file"]]
        assert check["contactMismatch"] == 0 and check["outsideBase"] == 0, record["id"]
        key = record["id"].removesuffix("-v1")
        runtime = RUNTIME / f"{key}.png"
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, record["id"]
        images[key] = {"url": f"assets/wave30/house_pair/{key}.png", "width": width, "height": height, "pivot": {"x": 0, "y": 0}}
        if state == "base":
            variants.append({"key": key, "level": level, "lot": lot, "variant": variant, "roof": roof(record["roof"]), "crop": crop(source, pair)})
        prompt = ROOT / "docs/provenance/prompts" / f"{key}-wave30.txt"
        prompt.write_text(prompt_for(record["family"], record["file"]).strip() + "\n")
        method = ("registered state layer on the variant's canvas, alpha 0 on the contact band and outside the variant "
                  f"({record['provenance']}; records/final-contract-qa.json)") if state != "base" \
            else (f"generated edit of the approved L{level} {lot} pair on its canvas, approved crop and pivot kept; stone contact band "
                  f"restored from the approved pair ({record['provenance']}; records/final-contract-qa.json)")
        coverage = f" Roof snow cover {float(record['snow_coverage_percent']):.2f} % (records/QA.md)." if record["snow_coverage_percent"] else ""
        rows.append({"assetId": f"wave30/{key}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": "builtin image_gen", "model": record["model_version"],
                     "generatedAt": "2026-09-29", "prompt": str(prompt.relative_to(ROOT)),
                     "referenceInputs": f"records/source-contract.json ({record['family']});{record['provenance']}", "seed": record["seed"], "candidates": "1",
                     "manualEdits": method, "artBible": "Wave 30 records/README.md", "historicalProfile": "Southern England 1300",
                     "owner": "Astra", "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave30 {record['id']} (confirmed in assets-inbox/INBOX_LEDGER.csv) installed by INSTALL-30 on 2026-09-30 from "
                              f"{BATCH.relative_to(ROOT)}; no C2PA chunk, received bytes = runtime bytes. Roof {record['roof']} "
                              f"({record['shape']}), contact difference {check['contactMismatch']}, overlay outside base {check['outsideBase']}.{coverage}"})
        installed.add(inbox_key)
    assert len(images) == 90 and len(variants) == 18, (len(images), len(variants))
    for entry in variants:
        assert all(f"{entry['key']}_{state}" in images for state in STATES), entry["key"]
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
            row["installed_by"] = "INSTALL-30"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if "\r\n" in raw else "\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(images.items()))
    listed = "\n".join(f"  {json.dumps(entry, separators=(', ', ': '))}," for entry in
                       sorted(variants, key=lambda item: (item["level"], item["lot"], item["variant"])))
    MANIFEST.write_text(
        "// Generated by scripts/installWave30.py — Wave 30 pair-house variants c-e and their state layers (INSTALL-30): url and size of\n"
        "// each picture; for each painting its level, lot, roof and crop (the approved pair's alpha bounds widened to the painting,\n"
        "// declared units).\n"
        "export const WAVE30_PAIR_HOUSE_IMAGES = {\n" + body + "\n} as const;\n\nexport type Wave30PairHouseKey = keyof typeof WAVE30_PAIR_HOUSE_IMAGES;\n\n"
        "export const WAVE30_PAIR_HOUSE_VARIANTS = [\n" + listed + "\n] as const;\n")
    print(len(rows), "rows;", len(images), "installed;", len(variants), "paintings")
    register_state_layers()  # BLD-06: the repainted layers registered onto their painting (scripts/registerStateLayers.py)


if __name__ == "__main__":
    main()
