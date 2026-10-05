"""QA-003: install the stone gate jamb (assets-inbox/nat5-fixes/candidates-20261003/assets/wall/gate_jamb_stone.png,
confirmed 2026-10-04 in assets-inbox/INBOX_LEDGER.csv) as public/assets/wall/gate_jamb_stone-v1.png, drawn where a
stone corner gate's off-axis arm ends (src/render/gateOpeningPosts.ts, key gate_jamb_stone in terrainVariantManifest.ts).
Its registration comes from the batch records (records/assets.json: 64 x 80 canvas, pivot (32, 70), world scale 0.5,
not flipped) and is asserted here, as are the ledger SHA, the records' SHA, the canvas and the body's place (alpha
bounding box x 10..53, y 10..69: the 44 x 60 body the records name). No C2PA chunk (asserted): received bytes =
runtime bytes. One docs/provenance/assets.csv row (replacing an earlier row for this runtime path) built from
records/gen-gate_jamb_stone.json (prompt, references) and records/export.cjs (the fit into the canvas), one prompt file.
The batch's timber jamb (rework_pending) and rock.png (rework_pending) are not installed.
`--installed` also writes installed_by = QA-003 on the jamb's inbox ledger row (that row only, CRLF kept): run it only
once the capture shows the jamb drawn.
Run: python3 scripts/installGateJambStone.py [--installed]
"""
import csv
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/nat5-fixes/candidates-20261003"
SOURCE = BATCH / "assets/wall/gate_jamb_stone.png"
RUNTIME = ROOT / "public/assets/wall/gate_jamb_stone-v1.png"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
PROMPT = ROOT / "docs/provenance/prompts/gate_jamb_stone-v1.txt"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
INSTALLED_BY = "QA-003"
REGISTRATION = {"canvas": [64, 80], "pivot": [32, 70], "worldScale": 0.5, "flip": False, "bodyWorld": [22, 30]}
USED_IN = ("src/render/terrainVariantManifest.ts (QA-003 stone gate jamb at a corner gate's off-axis arm end; "
           "gateOpeningPosts.ts drawStoneGateJamb via drawWallFaces.ts drawWallModules)")
csv.field_size_limit(sys.maxsize)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def chunks(data: bytes) -> set:
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    found, i = set(), 8
    while i < len(data):
        n = struct.unpack(">I", data[i:i + 4])[0]
        found.add(data[i + 4:i + 8])
        i += 12 + n
    return found


def main() -> None:
    mark = "--installed" in sys.argv[1:]
    inbox_key = SOURCE.relative_to(ROOT / "assets-inbox").as_posix()
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8", newline="")))
    entry = next(row for row in inbox if row["file"] == inbox_key)
    assert entry["status"] == "confirmed" and entry["replaced_by"] == "", f"{inbox_key}: {entry['status']} {entry['replaced_by']}"
    record = next(row for row in json.load(open(BATCH / "records/assets.json")) if row["id"] == "gate_jamb_stone")
    assert {key: record[key] for key in REGISTRATION} == REGISTRATION, record
    data = SOURCE.read_bytes()
    digest = sha(data)
    assert digest == entry["sha256"] == record["sha256"], inbox_key
    assert not C2PA_CHUNKS & chunks(data), f"{inbox_key} carries a C2PA chunk"
    image = Image.open(SOURCE)
    assert image.size == (64, 80) and image.mode == "RGBA", (image.size, image.mode)
    assert image.getchannel("A").getbbox() == (10, 10, 54, 70), image.getchannel("A").getbbox()
    shutil.copyfile(SOURCE, RUNTIME)
    assert sha(RUNTIME.read_bytes()) == digest
    generation = json.load(open(BATCH / "records/gen-gate_jamb_stone.json"))
    PROMPT.write_text(generation["prompt"].strip() + "\n")
    references = "; ".join(Path(path).name for path in generation["references"])
    row = {"assetId": "gate_jamb_stone", "version": "v1", "runtimePath": RUNTIME.relative_to(ROOT).as_posix(), "runtimeSha256": digest,
           "sourcePath": SOURCE.relative_to(ROOT).as_posix(), "sourceSha256": digest, "tool": "image_gen.imagegen", "model": "not exposed",
           "generatedAt": "2026-10-03", "prompt": PROMPT.relative_to(ROOT).as_posix(), "referenceInputs": references, "seed": "not exposed",
           "candidates": "1", "manualEdits": ("records/export.cjs: generated image cropped to its alpha bounding box, fitted to the 44 x 60 body "
                                              "at (10, 10) on a 64 x 80 transparent canvas (sharp); no repaint, no flip"),
           "artBible": "ART_BIBLE_v2", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra", "usedIn": USED_IN, "status": "runtime",
           "notes": (f"Astra nat5-fixes gate_jamb_stone (raw generation SHA {generation['raw_sha256']}; confirmed in assets-inbox/INBOX_LEDGER.csv, "
                     "verdict 2026-10-04) installed by QA-003 on 2026-10-04: registration from records/assets.json (canvas 64 x 80, pivot (32, 70), "
                     "world scale 0.5, body 22 x 30 at zoom 1); no C2PA chunk, received bytes = runtime bytes. The batch records give the delivery "
                     "date, not a generation time.")}
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    kept = [old for old in csv.DictReader(open(LEDGER, encoding="utf-8")) if old["runtimePath"] != row["runtimePath"]]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header}])
    if mark:
        raw = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
        entry["installed_by"] = INSTALLED_BY
        with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(inbox[0].keys()), lineterminator="\r\n" if raw.split("\n", 1)[0].endswith("\r") else "\n")
            writer.writeheader(); writer.writerows(inbox)
    print("installed", RUNTIME.relative_to(ROOT), "ledger row marked" if mark else "(ledger installed_by not written)")


if __name__ == "__main__":
    main()
