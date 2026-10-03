"""LM-R1 (Wave 37, docs/ops/install-plan-20261003/SPECS/wave37.md): install the 32 house-front signs — 12 trades x A/B and
8 circumstance props — into public/assets/wave37/<asset id>.png. The current set is the rework-v2 table
(assets-inbox/wave37/rework-v2/records/assets.csv, 32 rows): 28 pictures unchanged from candidates-20260930 and 4 reworked
in rework-v2 (condition_prosperous_bench, trade_carpenter_a, trade_miller_a, trade_miller_b; the inbox ledger's
superseded rows point at them). Each row is checked against the inbox ledger (status confirmed, sha256, replaced_by
followed) and its real PNG size; the foot (Astra's CSV foot_x / foot_y, the visual ground contact, shadow excluded) is
the manifest's pivot as delivered — no centre or bottom guess. No C2PA chunk (asserted, so received bytes = runtime
bytes). One docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths) from the batch's
generation records, one prompt file each, and src/render/wave37DoorSignManifest.generated.ts: url, size, pivot, which
sign (trade or circumstance) and its A / B (the circumstance pairs: the first listed picture is A).
`--mark <asset id,…>` sets installed_by = LM-R1 in the inbox ledger for those pictures only — the ones a capture has shown
drawn from a real state, after the copy and the consumer (src/render/doorSigns.ts) — and never for the pictures no engine
state can choose (NO_ENGINE_STATE: no shepherd or fisher trade exists; they are copied and wired, not counted installed).
Run: python3 scripts/installWave37DoorSigns.py [--mark id,id,…]
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
CANDIDATES = INBOX / "wave37/candidates-20260930"
REWORK = INBOX / "wave37/rework-v2"
RUNTIME = ROOT / "public/assets/wave37"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = INBOX / "INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/render/wave37DoorSignManifest.generated.ts"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
INSTALLED_BY = "LM-R1"
NO_ENGINE_STATE = {"trade_shepherd_a", "trade_shepherd_b", "trade_fisher_a", "trade_fisher_b"}
TRADE_SIGNS = {"빵집": "baker", "대장간": "smith", "직조": "weaver", "염색": "dyer", "무두장이": "tanner", "에일": "ale",
               "방앗간 일꾼": "miller", "목수": "carpenter", "상인": "merchant", "목동": "shepherd", "어부": "fisher", "여관": "inn"}
# The circumstance props: two pictures per circumstance, A first.
CONDITION_SIGNS = {"condition_prosperous_pots": ("prosperous", "a"), "condition_prosperous_bench": ("prosperous", "b"),
                   "condition_ordinary_bench": ("ordinary", "a"), "condition_ordinary_water": ("ordinary", "b"),
                   "condition_strained_barrel": ("strained", "a"), "condition_strained_firewood": ("strained", "b"),
                   "condition_newcomer_cart_a": ("newcomer", "a"), "condition_newcomer_cart_b": ("newcomer", "b")}
USED_IN = ("src/render/wave37DoorSignManifest.generated.ts (LM-R1: the lord-mode house-front sign on the road side, "
           "src/render/doorSigns.ts)")
RECORDS = ["candidates-20260930/records/trades-a.json", "candidates-20260930/records/trades-b.json",
           "candidates-20260930/records/trades-c.json", "candidates-20260930/records/conditions.json",
           "rework-v2/records/miller.json", "rework-v2/records/furniture.json"]
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


def generation_records() -> dict:
    """Per asset id: the generation record (the rework-v2 files last, so the four reworked pictures take theirs)."""
    records = {}
    for relative in RECORDS:
        for entry in json.loads((INBOX / "wave37" / relative).read_text()):
            records[entry["id"]] = {**entry, "file": f"assets-inbox/wave37/{relative}"}
    return records


def tool_of(record: dict) -> str:
    return str(record.get("tool") or record.get("generation_tool") or record.get("model") or "image_gen (not exposed)")


def references_of(record: dict) -> str:
    refs = record.get("references") or []
    return "; ".join(Path(ref["path"] if isinstance(ref, dict) else str(ref)).name for ref in refs)


def main(mark: set) -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    records = generation_records()
    table = list(csv.DictReader(open(REWORK / "records/assets.csv", encoding="utf-8-sig")))
    assert len(table) == 32, len(table)
    rows, manifest, copied = [], {}, []
    for entry in table:
        asset_id = entry["asset_id"]
        reworked = entry["revision"] == "reworked-v2"
        source = (REWORK if reworked else CANDIDATES) / "assets" / f"{asset_id}.png"
        key = source.relative_to(INBOX).as_posix()
        ledger = by_file[key]
        assert ledger["status"] == "confirmed" and ledger["replaced_by"] == "", f"{key}: {ledger['status']} {ledger['replaced_by']}"
        digest = sha(source)
        assert digest == ledger["sha256"] == entry["sha256"], key
        chunks, width, height = png_info(source.read_bytes())
        assert not C2PA_CHUNKS & chunks, f"{key} carries a C2PA chunk"
        assert (width, height) == (int(entry["width"]), int(entry["height"])), key
        assert entry["flipped"] == "false", key
        if entry["category"] == "trade":
            sign, variant = TRADE_SIGNS[entry["trade_or_condition"]], entry["variant"]
        else:
            sign, variant = CONDITION_SIGNS[asset_id]
        runtime = RUNTIME / f"{asset_id}.png"
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, key
        foot = {"x": float(entry["foot_x"]), "y": float(entry["foot_y"])}
        manifest[asset_id] = {"url": f"assets/wave37/{asset_id}.png", "width": width, "height": height, "pivot": foot,
                              "category": entry["category"], "sign": sign, "variant": variant}
        record = records[asset_id]
        prompt = ROOT / "docs/provenance/prompts" / f"{asset_id}-wave37.txt"
        prompt.write_text(str(record["prompt"]).strip() + "\n")
        rows.append({"assetId": f"wave37/{asset_id}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": tool_of(record), "model": "not exposed",
                     "generatedAt": "2026-09-30", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": references_of(record),
                     "seed": "not exposed", "candidates": "1", "manualEdits": entry["postprocess"], "artBible": "ART_BIBLE_v2",
                     "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra", "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra Wave 37 {asset_id} ({'rework-v2' if reworked else 'candidates-20260930'}, confirmed in "
                              f"assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-30) installed by {INSTALLED_BY} on 2026-10-03; no C2PA "
                              f"chunk, received bytes = runtime bytes, not mirrored. Pivot = Astra's foot ({entry['foot_x']}, {entry['foot_y']}) "
                              f"from rework-v2/records/assets.csv ({entry['foot_method']}; uncertainty {entry['foot_uncertainty_px']} px). "
                              f"Generation record {record['file']}. The batch records give the delivery date, not a generation time."})
        copied.append(key)
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    if mark:
        raw = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
        unknown = mark - {Path(key).stem for key in copied}
        assert not unknown and not mark & NO_ENGINE_STATE, f"cannot mark {sorted(unknown | (mark & NO_ENGINE_STATE))}"
        marked = {key for key in copied if Path(key).stem in mark}
        for row in inbox:
            if row["file"] in marked:
                row["installed_by"] = INSTALLED_BY
        with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(inbox[0].keys()), lineterminator="\r\n" if raw.split("\n", 1)[0].endswith("\r") else "\n")
            writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {json.dumps(key)}: {json.dumps(value, separators=(', ', ': '), ensure_ascii=False)}," for key, value in sorted(manifest.items()))
    MANIFEST.write_text("// Generated by scripts/installWave37DoorSigns.py — Wave 37 house-front signs (LM-R1, src/render/doorSigns.ts): url, size,\n"
                        "// pivot (Astra's foot: the visual ground contact, rework-v2/records/assets.csv), the sign it shows and its A / B.\n"
                        "export const WAVE37_DOOR_SIGNS = {\n" + body + "\n} as const;\n\nexport type Wave37DoorSignKey = keyof typeof WAVE37_DOOR_SIGNS;\n")
    print(len(rows), "pictures;", f"installed_by marked on {len(mark)}" if mark else "installed_by not marked")


if __name__ == "__main__":
    args = sys.argv[1:]
    main(set(args[args.index("--mark") + 1].split(",")) if "--mark" in args else set())
