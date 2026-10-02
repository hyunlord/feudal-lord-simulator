"""NAT-5 (QA-039): install Wave 41's reworked rock texture (ENV-07, assets-inbox/wave41/candidates-20261002, asset_id rock:
assets/24-rock-wave41-v1.png, confirmed 2026-10-02 in assets-inbox/INBOX_LEDGER.csv) over public/assets/terrain/rock.png,
the file it reworks (records/assets.csv source_path; same 512 x 512 RGBA, same alpha, same outer border: it tiles as the
old one did). Only this one row of the batch; the batch's other confirmed reworks are other installers'.
- Checks: the ledger row is confirmed, its sha256 matches the file, the batch record names the current runtime bytes as
  its source (source_sha256), no C2PA chunk, 512 x 512. Received bytes = runtime bytes (no edit here).
- docs/provenance/assets.csv: the `rock` row is replaced in place (version v2) from the batch's generation record
  (records/generations-24.json: tool, prompt, references, post-processing); the prompt goes to
  docs/provenance/prompts/rock-wave41.txt.
- assets-inbox/INBOX_LEDGER.csv: installed_by = NAT-5 on that row only (CRLF kept; the line is edited as text).
Rerunnable: a second run finds the runtime file already the candidate and writes the same rows.
Run: python3 scripts/installWave41Rock.py
"""
import csv
import hashlib
import io
import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/wave41/candidates-20261002"
SOURCE = BATCH / "assets/24-rock-wave41-v1.png"
RECORD = BATCH / "records/generations-24.json"
RUNTIME = ROOT / "public/assets/terrain/rock.png"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
PROMPT = ROOT / "docs/provenance/prompts/rock-wave41.txt"
ORIGINAL_SHA = "7b7055de1f931e2a00b3cbbf0963268d44c8781c753fb9a530ed4ff991c68bd1"
INSTALLED_BY = "NAT-5"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
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


def main() -> None:
    inbox_key = SOURCE.relative_to(ROOT / "assets-inbox").as_posix()
    entry = next(row for row in csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")) if row["file"] == inbox_key)
    assert entry["status"] == "confirmed", entry
    digest = sha(SOURCE)
    assert digest == entry["sha256"], inbox_key
    batch_row = next(row for row in csv.DictReader(open(BATCH / "records/assets.csv", encoding="utf-8")) if row["asset_id"] == "rock")
    assert batch_row["source_path"] == "public/assets/terrain/rock.png" and batch_row["source_sha256"] == ORIGINAL_SHA, batch_row
    assert batch_row["output_sha256"] == digest, batch_row
    chunks, width, height = png_info(SOURCE.read_bytes())
    assert not C2PA_CHUNKS & chunks and (width, height) == (512, 512), (chunks, width, height)
    assert sha(RUNTIME) in (ORIGINAL_SHA, digest), "public/assets/terrain/rock.png is neither the original nor the candidate"
    shutil.copyfile(SOURCE, RUNTIME)
    assert sha(RUNTIME) == digest

    record = json.loads(RECORD.read_text())
    PROMPT.write_text(record["prompt"].strip() + "\n")
    references = "; ".join(f"{Path(ref['path']).name} ({ref['role']}, {ref['sha256'][:12]})" for ref in record["references"])
    post = record["postprocessing"]
    row = {"assetId": "rock", "version": "v2", "runtimePath": "public/assets/terrain/rock.png", "runtimeSha256": digest,
           "sourcePath": SOURCE.relative_to(ROOT).as_posix(), "sourceSha256": digest, "tool": record["tool"], "model": "not exposed",
           "generatedAt": "2026-10-02", "prompt": PROMPT.relative_to(ROOT).as_posix(), "referenceInputs": references,
           "seed": "not exposed", "candidates": "1", "manualEdits": f"{post['resize']}; {post['method']}", "artBible": "ART_BIBLE_v2",
           "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra",
           "usedIn": "src/render/worldAssetManifest.generated.ts; public/assets/world_asset_manifest.json (the rock tiles; NAT-5: the lands' rock region, landRockRegions.ts)",
           "status": "runtime",
           "notes": f"Astra wave41 rework ENV-07 rock (asset_id rock, confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-10-02) installed by {INSTALLED_BY} "
                    f"on 2026-10-03 from {BATCH.relative_to(ROOT).as_posix()} over v1 ({ORIGINAL_SHA}); no C2PA chunk, received bytes = runtime bytes. "
                    "Same 512 x 512 RGBA, alpha and outer border as v1 (records/generations-24.json edge_repair). The batch records give the delivery date, not a generation time."}
    text = LEDGER.read_text(encoding="utf-8")
    header = next(csv.reader(io.StringIO(text)))
    lines = text.split("\n")
    at = [index for index, line in enumerate(lines) if line.startswith("rock,") and ",public/assets/terrain/rock.png," in line]
    assert len(at) == 1, at
    out = io.StringIO()
    csv.DictWriter(out, fieldnames=header, lineterminator="").writerow({key: row.get(key, "") for key in header})
    lines[at[0]] = out.getvalue()
    LEDGER.write_text("\n".join(lines), encoding="utf-8")

    raw = INBOX_LEDGER.read_bytes().decode("utf-8")
    rows = raw.split("\r\n")
    hits = [index for index, line in enumerate(rows) if line.startswith(f"wave41,{inbox_key},")]
    assert len(hits) == 1, hits
    fields = next(csv.reader(io.StringIO(rows[hits[0]])))
    assert fields[-1] in ("", INSTALLED_BY), fields
    if fields[-1] == "":
        rows[hits[0]] = rows[hits[0]] + INSTALLED_BY
    INBOX_LEDGER.write_bytes("\r\n".join(rows).encode("utf-8"))
    print("rock installed:", digest)


if __name__ == "__main__":
    main()
