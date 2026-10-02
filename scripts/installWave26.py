"""INSTALL-26: install Wave 26, the house variants (100 confirmed files from assets-inbox/wave26/candidates-20260928,
verdict 2026-09-28) into public/assets/wave26/house: for each single-lot level L0-L4 four new paintings c-f on the
level's own canvas (L0 153, L1 139, L2 137, L3 142, L4 161 px, the approved house's coordinates and pivot inherited
unchanged), and for each of them its own state layers weathered / fresh / snow / boarded (transparent, same size,
source-over at (0, 0); never laid on another variant). The three check pictures (proofs/) are not installed. No C2PA
chunk (asserted): received bytes = runtime bytes, each checked against the inbox ledger and the batch's CSV.
One docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths), one prompt file each (the
batch's own generation prompt for that file, records/l0.json..l4.json), `installed_by` = INSTALL-26 in the inbox
ledger, and src/render/wave26HouseManifest.generated.ts: every picture's url and size, and for each painting its
level, roof material (records/generation-records.csv `roof`) and crop — the approved house's alpha bounds widened to
the painting's own opaque pixels (alpha >= 64, the threshold the approved bounds match), in the approved house's
declared frame, so a wider eave (L0 d/e/f) is not cut off and the registration stays the approved house's.
Run: python3 scripts/installWave26.py
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
BATCH = ROOT / "assets-inbox/wave26/candidates-20260928"
RUNTIME = ROOT / "public/assets/wave26/house"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
HOUSES = ROOT / "src/render/historicalHouseAssetManifest.generated.ts"
MANIFEST = ROOT / "src/render/wave26HouseManifest.generated.ts"
USED_IN = "src/render/wave26HouseManifest.generated.ts (INSTALL-26: single-lot house variants c-f and their weathered / fresh / snow / boarded layers)"
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


def approved_houses() -> dict:
    text = HOUSES.read_text()
    body = re.sub(r",(\s*[\]}])", r"\1", text[text.index("["):])
    return {entry["level"]: entry for entry in json.JSONDecoder().raw_decode(body)[0]}


def walk(node, out: list) -> None:
    if isinstance(node, dict):
        if "prompt" in node:
            out.append(node)
        for value in node.values():
            walk(value, out)
    elif isinstance(node, list):
        for value in node:
            walk(value, out)


def prompt_for(level: int, variant: str, state: str) -> str:
    """The batch's prompt for one file: the record naming the file, else (l0.json) the one with its variant and state; the last wins (reworks follow)."""
    entries: list = []
    walk(json.loads((BATCH / f"records/l{level}.json").read_text()), entries)
    name = f"house_l{level}_{variant}{'' if state == 'base' else '_' + state}-v1.png"
    named = [entry for entry in entries if any(isinstance(value, str) and value.endswith(name) for value in entry.values())]
    keyed = [entry for entry in entries if (entry.get("variant") or entry.get("v") or entry.get("id")) == variant and entry.get("state", "base") == state]
    found = named or keyed
    assert found, name
    return found[-1]["prompt"]


def crop(image: Path, approved: dict) -> dict:
    """The approved alpha bounds widened to this painting's alpha >= 64 pixels, in the approved house's declared units."""
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
    approved = approved_houses()
    rows, installed, images, variants = [], set(), {}, []
    RUNTIME.mkdir(parents=True, exist_ok=True)
    for record in records:
        source = BATCH / record["file"]
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        digest = sha(source)
        assert digest == record["sha256"], record["id"]
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        assert not C2PA_CHUNKS & png_chunks(source.read_bytes()), f"{record['id']} carries a C2PA chunk"
        level, variant, state = int(record["level"]), record["variant"], record["state"]
        assert state in ("base", *STATES) and variant in "cdef", record["id"]
        width, height = int(record["width"]), int(record["height"])
        with Image.open(source) as picture:
            assert picture.size == (width, height) and picture.mode == "RGBA", record["id"]
        key = record["id"].removesuffix("-v1")
        runtime = RUNTIME / f"{key}.png"
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, record["id"]
        images[key] = {"url": f"assets/wave26/house/{key}.png", "width": width, "height": height, "pivot": {"x": 0, "y": 0}}
        if state == "base":
            variants.append({"key": key, "level": level, "variant": variant, "roof": record["roof"], "crop": crop(source, approved[level])})
        prompt = ROOT / "docs/provenance/prompts" / f"{key}-wave26.txt"
        prompt.write_text(prompt_for(level, variant, state).strip() + "\n")
        method = ("registered state layer: generated state picture, difference extracted, clipped to the variant's alpha "
                  f"(records/l{level}.json); contact band normalised (records/contact-normalization.json)") if state != "base" \
            else f"generated edit of the approved L{level} house on its canvas; contact band normalised (records/contact-normalization.json)"
        rows.append({"assetId": f"wave26/{key}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": "builtin image_gen", "model": record["model"],
                     "generatedAt": "2026-09-28", "prompt": str(prompt.relative_to(ROOT)),
                     "referenceInputs": f"{record['source_reference']};{record['generation_record']}", "seed": record["seed"], "candidates": "1",
                     "manualEdits": method, "artBible": "Wave 26 records/README.md", "historicalProfile": "Southern England 1300",
                     "owner": "Astra", "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave26 {record['id']} (confirmed in assets-inbox/INBOX_LEDGER.csv) installed by INSTALL-26 on 2026-09-29 from "
                              f"{BATCH.relative_to(ROOT)}; no C2PA chunk, received bytes = runtime bytes. Roof {record['roof']} "
                              f"({record['observed_roof_shape']}), contact difference {record['contact_difference_channels']}, "
                              f"overlay outside base {record['overlay_outside_base_pixels']}."})
        installed.add(inbox_key)
    assert len(images) == 100 and len(variants) == 20, (len(images), len(variants))
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
            row["installed_by"] = "INSTALL-26"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if "\r\n" in raw else "\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(images.items()))
    listed = "\n".join(f"  {json.dumps({k: v for k, v in entry.items()}, separators=(', ', ': '))}," for entry in
                       sorted(variants, key=lambda item: (item["level"], item["variant"])))
    MANIFEST.write_text(
        "// Generated by scripts/installWave26.py — Wave 26 house variants c-f and their state layers (INSTALL-26): url and size of each\n"
        "// picture; for each painting its level, roof and crop (the approved house's alpha bounds widened to the painting, declared units).\n"
        "export const WAVE26_HOUSE_IMAGES = {\n" + body + "\n} as const;\n\nexport type Wave26HouseKey = keyof typeof WAVE26_HOUSE_IMAGES;\n\n"
        "export const WAVE26_HOUSE_VARIANTS = [\n" + listed + "\n] as const;\n")
    print(len(rows), "rows;", len(images), "installed;", len(variants), "paintings")
    register_state_layers()  # BLD-06: the repainted layers registered onto their painting (scripts/registerStateLayers.py)


if __name__ == "__main__":
    main()
