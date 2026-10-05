"""LM-R1 (UI-02): install Wave 41's reworked seal_slot (assets-inbox/wave41/candidates-20261002/assets/27-seal_slot-wave41-v1.png,
confirmed 2026-10-02; docs/design/art-audit-20261002/ART_AUDIT.md UI-02), which NAT-5's scripts/installWave41Rework.py
left to the Wave 38 button work. Same rules as that installer: the runtime file must still be the rework's recorded
original (or already the rework: a rerun is a no-op), the rework keeps its canvas (64 x 64) and its alpha byte for byte
(generations-27.json: "original alpha bytes reapplied exactly"), so the CSS that names it (global.css .build-seal /
.speed-seal, background-size: contain) is unchanged; only the bytes change. No C2PA chunk (asserted).
The docs/provenance/assets.csv row is rewritten in place (asset id and version kept), one prompt file. `--installed` also
writes installed_by = LM-R1 on its inbox ledger row (CRLF kept) — only once a capture shows the picture drawn.
Run: python3 scripts/installWave41SealSlot.py [--installed]
"""
import csv
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from installWave41Rework import BATCH, C2PA_CHUNKS, INBOX_LEDGER, LEDGER, ROOT, check_geometry, chunks, generation, sha  # noqa: E402

ASSET_ID = "seal_slot"
INSTALLED_BY = "LM-R1"


def main() -> None:
    mark = "--installed" in sys.argv[1:]
    asset = next(row for row in csv.DictReader(open(BATCH / "records/assets.csv", encoding="utf-8")) if row["asset_id"] == ASSET_ID)
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8", newline="")))
    source = BATCH / asset["candidate_file"]
    inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
    entry = next(row for row in inbox if row["file"] == inbox_key)
    assert entry["status"] == "confirmed" and entry["replaced_by"] == "", inbox_key
    rework = source.read_bytes()
    digest = sha(rework)
    assert digest == entry["sha256"] == asset["output_sha256"], inbox_key
    assert not C2PA_CHUNKS & chunks(rework), f"{inbox_key} carries a C2PA chunk"
    runtime = ROOT / asset["source_path"]
    current = runtime.read_bytes()
    if sha(current) == asset["source_sha256"]:
        check_geometry(ASSET_ID, current, rework)
        shutil.copyfile(source, runtime)
    else:
        assert sha(current) == digest, f"{runtime}: neither the recorded original nor the rework"
    assert sha(runtime.read_bytes()) == digest
    record = generation(BATCH / asset["generation_record"])
    prompt = ROOT / "docs/provenance/prompts/seal_slot-wave41.txt"
    prompt.write_text(record["prompt"].strip() + "\n")
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ledger = list(csv.DictReader(open(LEDGER, encoding="utf-8")))
    row = next(row for row in ledger if row["runtimePath"] == asset["source_path"])
    row.update({"runtimeSha256": digest, "sourcePath": source.relative_to(ROOT).as_posix(), "sourceSha256": digest, "tool": record["tool"],
                "model": "not exposed", "generatedAt": "2026-10-02", "prompt": prompt.relative_to(ROOT).as_posix(),
                "referenceInputs": record["references"], "seed": "not exposed", "candidates": record["attempts"], "manualEdits": record["edits"],
                "artBible": "ART_BIBLE_v2", "owner": "Astra", "status": "runtime",
                "notes": f"Astra Wave 41 art-audit rework ({asset['finding_ids']}; confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-10-02) "
                         f"installed by {INSTALLED_BY} on 2026-10-03 over {asset['source_path']} (sha {asset['source_sha256'][:12]}): same canvas "
                         f"{asset['width']} x {asset['height']} and alpha bytes, so the CSS that names it is unchanged; no C2PA chunk, received "
                         f"bytes = runtime bytes. The batch records give the delivery date, not a generation time."})
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(ledger)
    if mark:
        raw = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
        entry["installed_by"] = INSTALLED_BY
        with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(inbox[0].keys()), lineterminator="\r\n" if raw.split("\n", 1)[0].endswith("\r") else "\n")
            writer.writeheader(); writer.writerows(inbox)
    print("seal_slot:", "installed_by written" if mark else "copied; installed_by not written (pass --installed after the capture)")


if __name__ == "__main__":
    main()
