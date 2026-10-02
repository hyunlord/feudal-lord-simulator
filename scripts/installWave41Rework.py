"""NAT-5: install the Wave 41 art-audit reworks (assets-inbox/wave41/candidates-20261002, confirmed 2026-10-02 in
assets-inbox/INBOX_LEDGER.csv; the findings in docs/design/art-audit-20261002/ART_AUDIT.md) over the runtime pictures
they redraw. Each rework keeps its original's canvas, size and alpha support (records/DELIVERY_VALIDATION.json:
canvas 29/29, alpha support 29/29, full alpha 28/29 — the guildhall overlay's smoke is thinner on purpose), so the
manifests' size, pivot, anchor, alpha fit and display scale stay as they are: only the bytes change.
- 26 runtime PNGs are replaced in place (same file name, received bytes = runtime bytes, no C2PA chunk; asserted).
- keyart_title_bg ships as a build-time JPEG (scripts/keyartDerivatives.ts); its ledger row's runtime path is the
  received PNG, now the Wave 41 one (KEYART_DERIVATIVES points there).
- Not installed: `rock` (ENV-07; the NAT-5 ground installer's), `seal_slot` (UI-02; the seal button's art belongs to
  LM-R1's Wave 38 button work).
Before copying, each runtime file must still be the rework's recorded original (source_sha256) or already the rework
(output_sha256: a rerun is a no-op), and the rework must match the original's size and alpha (the smoke may only thin).
One docs/provenance/assets.csv row each is rewritten in place (asset id and version kept; the received file, the
generation record's tool, prompt, references and processing), one prompt file each, `installed_by` = NAT-5 in the
inbox ledger (these rows only, CRLF kept).
Run: python3 scripts/installWave41Rework.py
"""
import csv
import hashlib
import io
import json
import shutil
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/wave41/candidates-20261002"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
KEYART_SCRIPT = ROOT / "scripts/keyartDerivatives.ts"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
INSTALLED_BY = "NAT-5"
SKIPPED = {"rock": "the NAT-5 ground installer's", "seal_slot": "UI-02, LM-R1's Wave 38 button work"}
# The one rework whose alpha changes on purpose (BLD-04: the smoke's closed outline thinned; records/generations-04.json).
SMOKE_ROI = {"wave12/guildhall_active": (0, 0, 352, 100)}
KEYART = "keyart_title_bg"
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


def check_geometry(asset_id: str, original: bytes, rework: bytes) -> None:
    """Same canvas; alpha identical, or (the smoke) only lower and only inside its region."""
    old, new = (Image.open(io.BytesIO(data)).convert("RGBA") for data in (original, rework))
    assert old.size == new.size, f"{asset_id}: canvas {old.size} -> {new.size}"
    old_alpha, new_alpha = old.getchannel("A").tobytes(), new.getchannel("A").tobytes()
    if asset_id not in SMOKE_ROI:
        assert old_alpha == new_alpha, f"{asset_id}: alpha changed"
        return
    left, top, right, bottom = SMOKE_ROI[asset_id]
    width = old.size[0]
    for index, (a, b) in enumerate(zip(old_alpha, new_alpha)):
        if a == b:
            continue
        x, y = index % width, index // width
        assert left <= x < right and top <= y < bottom and b < a and b > 0, f"{asset_id}: alpha changed outside the smoke at ({x}, {y})"


def generation(record: Path) -> dict:
    """Tool, prompt, reference names, attempts and the processing note of one generation record."""
    data = json.loads(record.read_text())
    if "final" in data:  # keyart: {attempts: [...], final: {...}}
        final = data["final"]
        chosen = next((item for item in data["attempts"] if item.get("attempt") == final.get("attempt")), data["attempts"][-1])
        merged = {**chosen, **final}
        attempts = len(data["attempts"])
    else:
        merged, attempts = data, int(data.get("attempt", 1))
    edits = {key: merged[key] for key in ("processing", "postprocess", "postprocessing", "post_review_revision") if key in merged}
    references = merged.get("references", [])
    names = "; ".join(Path(ref["path"] if isinstance(ref, dict) else ref).name for ref in references)
    return {"tool": merged.get("tool") or "image_gen.imagegen", "prompt": merged["prompt"], "references": names,
            "attempts": str(attempts), "edits": json.dumps(edits, ensure_ascii=False, separators=(",", ":"))}


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8", newline="")))
    by_file = {row["file"]: row for row in inbox}
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ledger = list(csv.DictReader(open(LEDGER, encoding="utf-8")))
    keyart_text = KEYART_SCRIPT.read_text()
    installed, rewritten, copied = set(), 0, 0
    for asset in csv.DictReader(open(BATCH / "records/assets.csv", encoding="utf-8")):
        asset_id = asset["asset_id"]
        if asset_id in SKIPPED:
            continue
        source = BATCH / asset["candidate_file"]
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        entry = by_file[inbox_key]
        assert entry["status"] == "confirmed", inbox_key
        rework = source.read_bytes()
        digest = sha(rework)
        assert digest == entry["sha256"] == asset["output_sha256"], inbox_key
        assert not C2PA_CHUNKS & chunks(rework), f"{inbox_key} carries a C2PA chunk"
        original_path = ROOT / asset["source_path"]
        if asset_id == KEYART:
            # The received PNG is the runtime asset of record; the game loads the JPEG made from it at build time.
            runtime = source
            assert f'"{source.parent.relative_to(ROOT).as_posix()}"' in keyart_text and f"/{source.name}`" in keyart_text, \
                "point KEYART_DERIVATIVES keyart_title_bg at the Wave 41 PNG"
            check_geometry(asset_id, original_path.read_bytes(), rework)
            old_runtime = asset["source_path"]
        else:
            runtime = original_path
            current = runtime.read_bytes()
            if sha(current) == asset["source_sha256"]:
                check_geometry(asset_id, current, rework)
                shutil.copyfile(source, runtime)
                copied += 1
            else:
                assert sha(current) == digest, f"{runtime}: neither the recorded original nor the rework"
            assert sha(runtime.read_bytes()) == digest, inbox_key
            old_runtime = asset["source_path"]
        record = generation(BATCH / asset["generation_record"])
        name = Path(asset["candidate_file"]).stem.split("-", 1)[1]
        prompt = ROOT / "docs/provenance/prompts" / f"{name}.txt"
        prompt.write_text(record["prompt"].strip() + "\n")
        row = next(row for row in ledger if row["runtimePath"] in (old_runtime, runtime.relative_to(ROOT).as_posix()))
        row.update({"runtimePath": runtime.relative_to(ROOT).as_posix(), "runtimeSha256": digest,
                    "sourcePath": source.relative_to(ROOT).as_posix(), "sourceSha256": digest, "tool": record["tool"],
                    "model": "not exposed", "generatedAt": "2026-10-02", "prompt": prompt.relative_to(ROOT).as_posix(),
                    "referenceInputs": record["references"], "seed": "not exposed", "candidates": record["attempts"],
                    "manualEdits": record["edits"], "artBible": "ART_BIBLE_v2", "owner": "Astra", "status": "runtime",
                    "notes": f"Astra Wave 41 art-audit rework ({asset['finding_ids'].replace('|', ', ')}; confirmed in "
                             f"assets-inbox/INBOX_LEDGER.csv, verdict 2026-10-02) installed by {INSTALLED_BY} on 2026-10-03 over "
                             f"{asset['source_path']} (sha {asset['source_sha256'][:12]}): same canvas {asset['width']} x {asset['height']} and "
                             f"alpha support, so size, pivot, anchor and display scale are unchanged; no C2PA chunk, received bytes = "
                             f"runtime bytes. The batch records give the delivery date, not a generation time."})
        rewritten += 1
        installed.add(inbox_key)
    assert rewritten == 27, rewritten
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(ledger)
    raw = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
    for row in inbox:
        if row["file"] in installed:
            row["installed_by"] = INSTALLED_BY
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(inbox[0].keys()), lineterminator="\r\n" if raw.split("\n", 1)[0].endswith("\r") else "\n")
        writer.writeheader(); writer.writerows(inbox)
    print(rewritten, "rows;", copied, "runtime files copied")


if __name__ == "__main__":
    main()
