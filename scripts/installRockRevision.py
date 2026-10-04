"""QA-003 (lead's brief 2026-10-04): install the NAT-5 rock revision (assets-inbox/nat5-fixes/revisions-20261004/assets/
rock.png, confirmed 2026-10-04 in assets-inbox/INBOX_LEDGER.csv; it supersedes the candidates-20261003 rock, which stays
uninstalled) over public/assets/terrain/rock.png, the Wave 41 ENV-07 texture it reworks (the land rock regions draw it:
landRockRegions.ts, key rock in worldAssetManifest.generated.ts; same url, so no consumer changes).
- Checks: the ledger row is confirmed with no replaced_by and its sha256 matches the file and records/SHA256SUMS; the
  runtime file is the Wave 41 rock the revision was made from (records/capture-provenance.json beforeRockSha256) or the
  revision; no C2PA chunk; 512 x 512. Received bytes = runtime bytes. The revision is an RGB PNG (no alpha channel; the
  Wave 41 rock was RGBA with every pixel opaque): copied as received.
- docs/provenance/assets.csv: the `rock` row is replaced in place (version v3) from records/gen-rock_cross.json (prompt,
  reference) and records/final-rock.cjs (the blend); the prompt goes to docs/provenance/prompts/rock-nat5-revision.txt.
- `--installed` also writes installed_by = QA-003 on the revision's inbox ledger row (that row only, CRLF kept): run it
  only once a capture shows the rock drawn.
Run: python3 scripts/installRockRevision.py [--installed]
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
BATCH = ROOT / "assets-inbox/nat5-fixes/revisions-20261004"
SOURCE = BATCH / "assets/rock.png"
RUNTIME = ROOT / "public/assets/terrain/rock.png"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
PROMPT = ROOT / "docs/provenance/prompts/rock-nat5-revision.txt"
WAVE41_SHA = "ed0764412eb37b2553085b5e40e0f78561dc702d169b9370da29a75ff5e842d2"
INSTALLED_BY = "QA-003"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
csv.field_size_limit(sys.maxsize)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


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
    mark = "--installed" in sys.argv[1:]
    inbox_key = SOURCE.relative_to(ROOT / "assets-inbox").as_posix()
    entry = next(row for row in csv.DictReader(open(INBOX_LEDGER, encoding="utf-8", newline="")) if row["file"] == inbox_key)
    assert entry["status"] == "confirmed" and entry["replaced_by"] == "", entry
    data = SOURCE.read_bytes()
    digest = sha(data)
    sums = dict(line.split()[::-1] for line in (BATCH / "records/SHA256SUMS").read_text().splitlines() if line.strip())
    assert digest == entry["sha256"] == sums["assets/rock.png"], inbox_key
    provenance = json.loads((BATCH / "records/capture-provenance.json").read_text())
    assert provenance["beforeRockSha256"] == WAVE41_SHA and provenance["afterRockSha256"] == digest, provenance
    chunks, width, height = png_info(data)
    assert not C2PA_CHUNKS & chunks and (width, height) == (512, 512), (chunks, width, height)
    assert sha(RUNTIME.read_bytes()) in (WAVE41_SHA, digest), "public/assets/terrain/rock.png is neither the Wave 41 rock nor the revision"
    shutil.copyfile(SOURCE, RUNTIME)
    assert sha(RUNTIME.read_bytes()) == digest

    record = json.loads((BATCH / "records/gen-rock_cross.json").read_text())
    PROMPT.write_text(record["prompt"].strip() + "\n")
    references = "; ".join(f"{Path(ref['path']).name} ({ref['sha256'][:12]})" for ref in record["referenceSha256"])
    row = {"assetId": "rock", "version": "v3", "runtimePath": "public/assets/terrain/rock.png", "runtimeSha256": digest,
           "sourcePath": SOURCE.relative_to(ROOT).as_posix(), "sourceSha256": digest, "tool": "image_gen.imagegen", "model": "not exposed",
           "generatedAt": "2026-10-04", "prompt": PROMPT.relative_to(ROOT).as_posix(),
           "referenceInputs": f"{references}; 24-rock-wave41-v1.png (base, {WAVE41_SHA[:12]})", "seed": "not exposed", "candidates": "1",
           "manualEdits": ("records/final-rock.cjs: the generated cross repair (generation SHA " + record["generatedSha256"][:12] + ") blended into the "
                           "Wave 41 rock within 40 px of the centre lines (full within 16 px), the rest the Wave 41 pixels with an RGB channel shift "
                           "to the mean #8A8071 (records/rock-final-process.json); opposite outer pixel pairs averaged so it tiles; no reflection"),
           "artBible": "ART_BIBLE_v2", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra",
           "usedIn": "src/render/worldAssetManifest.generated.ts; public/assets/world_asset_manifest.json (the rock tiles; the lands' rock region, landRockRegions.ts)",
           "status": "runtime",
           "notes": (f"Astra nat5-fixes revision rock (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-10-04; supersedes the candidates-20261003 rock) "
                     f"installed by {INSTALLED_BY} on 2026-10-04 over v2 ({WAVE41_SHA}); no C2PA chunk, received bytes = runtime bytes; RGB PNG (v2 was RGBA, "
                     "all opaque). The batch records give the delivery date, not a generation time.")}
    text = LEDGER.read_text(encoding="utf-8")
    header = next(csv.reader(io.StringIO(text)))
    lines = text.split("\n")
    at = [index for index, line in enumerate(lines) if line.startswith("rock,") and ",public/assets/terrain/rock.png," in line]
    assert len(at) == 1, at
    out = io.StringIO()
    csv.DictWriter(out, fieldnames=header, lineterminator="").writerow({key: row.get(key, "") for key in header})
    lines[at[0]] = out.getvalue()
    LEDGER.write_text("\n".join(lines), encoding="utf-8")

    if mark:
        raw = INBOX_LEDGER.read_bytes().decode("utf-8")
        rows = raw.split("\r\n")
        hits = [index for index, line in enumerate(rows) if line.startswith(f"nat5-fixes,{inbox_key},")]
        assert len(hits) == 1, hits
        fields = next(csv.reader(io.StringIO(rows[hits[0]])))
        assert fields[-1] in ("", INSTALLED_BY), fields
        if fields[-1] == "":
            rows[hits[0]] = rows[hits[0]] + INSTALLED_BY
        INBOX_LEDGER.write_bytes("\r\n".join(rows).encode("utf-8"))
    print("rock installed:", digest, "ledger row marked" if mark else "(ledger installed_by not written)")


if __name__ == "__main__":
    main()
