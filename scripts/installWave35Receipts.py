"""LM-R1 (receipt): install the Wave 35 receipt pictures (assets-inbox/wave35/candidates-20260930/assets/E_receipts,
confirmed 2026-09-30 in assets-inbox/INBOX_LEDGER.csv; docs/ops/install-plan-20261003/SPECS/wave35-receipts.md) into
public/assets/wave35-receipts/E_receipts/ (the install plan's target paths):
- receipt_frame (384 x 512, nine-slice l40 t190 r40 b110 from records/nine-slice.json; the top 190 px hold the building's
  picture recess, the bottom 110 px the separator and the lower field): the "왜 여기?" receipt (src/ui/lord/ReceiptPanel.tsx);
- reason_bar_cap_plus / reason_bar_cap_minus (48 x 48): a reason row's cap by the reason's sign;
- related_decision_ribbon (256 x 64): a lord's decision behind the receipt (opens its ledger record).
Screen art: no pivot. The received files carry no C2PA chunk (asserted): received bytes = runtime bytes. One
docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths) from records/frames.json (tool,
prompt, crop and processing), one prompt file each. `--installed` also writes installed_by = LM-R1 on these four inbox
ledger rows; run it only after the consumer and its captures are confirmed (INSTALL_PROTOCOL 6).
Run: python3 scripts/installWave35Receipts.py [--installed]
"""
import csv
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/wave35/candidates-20260930"
RUNTIME = ROOT / "public/assets/wave35-receipts/E_receipts"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
INSTALLED_BY = "LM-R1"
USED_IN = "src/ui/lord/receiptArt.ts; src/styles/lordReceipt.css (LM-R1: the lord mode's \"왜 여기?\" receipt, src/ui/lord/ReceiptPanel.tsx)"
# name: (width, height, nine-slice l|t|r|b or None) — sizes measured on the files, the slice from records/nine-slice.json.
EXPECTED = {
    "receipt_frame": (384, 512, (40, 190, 40, 110)),
    "reason_bar_cap_plus": (48, 48, None),
    "reason_bar_cap_minus": (48, 48, None),
    "related_decision_ribbon": (256, 64, None),
}
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
    mark = "--installed" in sys.argv[1:]
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    frames = {entry["id"]: entry for entry in json.loads((BATCH / "records/frames.json").read_text())}
    slices = json.loads((BATCH / "records/nine-slice.json").read_text())
    rows, installed = [], set()
    for name, (width, height, nine) in EXPECTED.items():
        source = BATCH / "assets/E_receipts" / f"{name}.png"
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        entry = by_file[inbox_key]
        assert entry["status"] == "confirmed" and entry["replaced_by"] == "", inbox_key
        digest = sha(source)
        assert digest == entry["sha256"], inbox_key
        chunks, real_width, real_height = png_info(source.read_bytes())
        assert not C2PA_CHUNKS & chunks, f"{inbox_key} carries a C2PA chunk"
        assert (real_width, real_height) == (width, height), inbox_key
        if nine is not None:
            assert tuple(slices["margins"][name]) == nine, name
        runtime = RUNTIME / f"{name}.png"
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, inbox_key
        record = frames[name]
        prompt = ROOT / "docs/provenance/prompts" / f"{name}-wave35.txt"
        prompt.write_text(record["prompt"].strip() + "\n")
        crop = record["crop"]
        rows.append({"assetId": f"wave35-receipts/{name}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": record["tool"], "model": "not exposed",
                     "generatedAt": "2026-09-30", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": record["reference_usage"],
                     "seed": "not exposed", "candidates": "1",
                     "manualEdits": f"at delivery: crop {crop['left']},{crop['top']} {crop['width']}x{crop['height']} of the raw image; {record['processing']}",
                     "artBible": "ART_BIBLE_v2", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra", "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave35 E_receipts/{name} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-30) installed by "
                              f"{INSTALLED_BY} on 2026-10-03; no C2PA chunk, received bytes = runtime bytes; {width} x {height}"
                              + (f", nine-slice l{nine[0]} t{nine[1]} r{nine[2]} b{nine[3]} (records/nine-slice.json)" if nine is not None else "")
                              + ". The batch records give the delivery date, not a generation time."})
        installed.add(inbox_key)
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    if mark:
        raw = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
        fields = list(inbox[0].keys())
        for row in inbox:
            if row["file"] in installed:
                row["installed_by"] = INSTALLED_BY
        with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if raw.split("\n", 1)[0].endswith("\r") else "\n")
            writer.writeheader(); writer.writerows(inbox)
    print(json.dumps({"installed": sorted(installed), "ledgerMarked": mark}))


if __name__ == "__main__":
    main()
