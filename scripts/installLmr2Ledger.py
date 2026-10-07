"""LM-R2 (ledger area): install the lord screen's promise-ledger and suit-track pictures through renderer B's art
contract (src/render/art: the `ui-frame` and `ui-image` kinds; scripts/lmr2ArtBundle.ts puts the bundle in catalog.json):
- wave35-promises (assets-inbox/wave35/candidates-20260930/assets/C_promises, confirmed 2026-09-30 in
  assets-inbox/INBOX_LEDGER.csv; docs/ops/install-plan-20261003/SPECS/wave35-promises.md), all nine:
  ledger_book (768 x 512, nine-slice l72 t72 r72 b72 from records/nine-slice.json) the open book behind the promises;
  ledger_spine (24 x 384) the book's spine, 24 px wide (records/nine-slice.json assembly: "ledger_spine centered, fixed24px
  width"); promise_active / due / kept / broken (64 x 64) one mark per promise state, mutually exclusive;
  deadline_marker (64 x 64) beside an open promise's deadline; witness_seal (64 x 64) beside its witnesses;
  debt_note (128 x 96) beside a debt instalment;
- wave35-operations litigation_track (640 x 96, nine-slice l72 t20 r72 b20) the suit track's bar (the rest of
  wave35-operations is the estates area's).
Runtime paths: public/assets/lord-ui/<spec>/<file>.png (the LM-R2 lord-ui layout; the install plan proposed
public/assets/<spec>/<group>/). Screen art: no pivot. The received files carry no C2PA chunk (asserted, and the
inventory's metadata-stripped SHA equals the source SHA): received bytes = runtime bytes. The records give no content
rect for the two frames, so their content inset is the slice (said in the notes).
One docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths) from records/frames.json or
records/marks.json (tool, prompt, crop and processing), one prompt file each. `--installed` also writes
installed_by = LM-R2 on these ten inbox ledger rows (only that field of those lines; CRLF kept); run it only after the
consumer and the real-screen captures of the specs' 캡처 관문 are confirmed (INSTALL_PROTOCOL 6).
Run: python3 scripts/installLmr2Ledger.py [--installed]
"""
import csv
import hashlib
import json
import shutil
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/wave35/candidates-20260930"
RUNTIME = ROOT / "public/assets/lord-ui"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
BUNDLE = ROOT / "scripts/lmr2LedgerBundle.json"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
INSTALLED_BY = "LM-R2"
USED_IN = "src/ui/lord/ledger/LedgerPanel.tsx; src/styles/lordLedger.css (LM-R2: the lord screen's 약속·소송, the promise ledger and the suit track)"
# name: (spec, group, width, height, record file, nine-slice l|t|r|b or None, ui kind fields) — sizes measured on the
# files, the slices from records/nine-slice.json, the CSS widths the screen draws them at.
EXPECTED = {
    "ledger_book": ("wave35-promises", "C_promises", 768, 512, "frames.json", (72, 72, 72, 72), {"kind": "ui-frame", "scale": 0.375, "centre": "fill", "repeat": "stretch"}),
    "ledger_spine": ("wave35-promises", "C_promises", 24, 384, "frames.json", None, {"kind": "ui-image", "cssWidths": [24]}),
    "promise_active": ("wave35-promises", "C_promises", 64, 64, "marks.json", None, {"kind": "ui-image", "cssWidths": [32]}),
    "promise_due": ("wave35-promises", "C_promises", 64, 64, "marks.json", None, {"kind": "ui-image", "cssWidths": [32]}),
    "promise_kept": ("wave35-promises", "C_promises", 64, 64, "marks.json", None, {"kind": "ui-image", "cssWidths": [32]}),
    "promise_broken": ("wave35-promises", "C_promises", 64, 64, "marks.json", None, {"kind": "ui-image", "cssWidths": [32]}),
    "deadline_marker": ("wave35-promises", "C_promises", 64, 64, "marks.json", None, {"kind": "ui-image", "cssWidths": [24]}),
    "witness_seal": ("wave35-promises", "C_promises", 64, 64, "marks.json", None, {"kind": "ui-image", "cssWidths": [24]}),
    "debt_note": ("wave35-promises", "C_promises", 128, 96, "marks.json", None, {"kind": "ui-image", "cssWidths": [32]}),
    "litigation_track": ("wave35-operations", "D_operations", 640, 96, "frames.json", (72, 20, 72, 20), {"kind": "ui-frame", "scale": 0.5, "centre": "fill", "repeat": "stretch"}),
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


def mark_installed(keys: set) -> list:
    """installed_by on exactly these rows: the line's last field, empty or ours, set to LM-R2 (the rest byte for byte)."""
    raw = INBOX_LEDGER.read_bytes().decode("utf-8")
    lines = raw.split("\r\n")
    marked = []
    for index, line in enumerate(lines):
        fields = line.split(",")
        if len(fields) < 3 or fields[1] not in keys:
            continue
        assert fields[-1] in ("", INSTALLED_BY), f"{fields[1]} already installed by {fields[-1]}"
        lines[index] = ",".join(fields[:-1] + [INSTALLED_BY])
        marked.append(fields[1])
    assert sorted(marked) == sorted(keys), f"rows not found: {sorted(set(keys) - set(marked))}"
    INBOX_LEDGER.write_bytes("\r\n".join(lines).encode("utf-8"))
    return marked


def main() -> None:
    mark = "--installed" in sys.argv[1:]
    inbox = {row["file"]: row for row in csv.DictReader(open(INBOX_LEDGER, encoding="utf-8"))}
    records = {name: {entry["id"]: entry for entry in json.loads((BATCH / "records" / name).read_text())} for name in ("frames.json", "marks.json")}
    slices = json.loads((BATCH / "records/nine-slice.json").read_text())
    assert slices["order"] == "left,top,right,bottom"
    rows, entries, keys = [], [], set()
    for name, (spec, group, width, height, record_file, nine, ui) in EXPECTED.items():
        source = BATCH / "assets" / group / f"{name}.png"
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        entry = inbox[inbox_key]
        # INSTALL_PROTOCOL 1: only confirmed rows nobody replaced; an installed_by someone else wrote is not copied blindly.
        assert entry["status"] == "confirmed" and entry["replaced_by"] == "", inbox_key
        assert entry["installed_by"] in ("", INSTALLED_BY), f"{inbox_key} installed by {entry['installed_by']}"
        digest = sha(source)
        assert digest == entry["sha256"], inbox_key
        chunks, real_width, real_height = png_info(source.read_bytes())
        assert not C2PA_CHUNKS & chunks, f"{inbox_key} carries a C2PA chunk"
        assert (real_width, real_height) == (width, height), inbox_key
        if nine is not None:
            assert tuple(slices["margins"][name]) == nine, name
        runtime = RUNTIME / spec / f"{name}.png"
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, inbox_key
        record = records[record_file][name]
        prompt = ROOT / "docs/provenance/prompts" / f"{name}-wave35.txt"
        prompt.write_text(record["prompt"].strip() + "\n")
        if record_file == "frames.json":
            crop = record["crop"]
            edits = f"at delivery: crop {crop['left']},{crop['top']} {crop['width']}x{crop['height']} of the raw image; {record['processing']}"
            references = record["reference_usage"]
        else:
            edits = f"at delivery: from the raw {record['raw']['width']}x{record['raw']['height']} image; {record['postprocess']}"
            references = "; ".join(record["references"])
        url = runtime.relative_to(ROOT / "public").as_posix()
        rows.append({"assetId": f"lord-ui/{spec}/{name}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": record["tool"], "model": "not exposed",
                     "generatedAt": "2026-09-30", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": references,
                     "seed": "not exposed", "candidates": "1", "manualEdits": edits,
                     "artBible": "ART_BIBLE_v2", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra", "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave35 {group}/{name} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-30) installed by "
                              f"{INSTALLED_BY} on 2026-10-06 through the art contract (catalog bundle lord-ledger, {ui['kind']} lord.ledger.{name}); "
                              f"no C2PA chunk, received bytes = runtime bytes; {width} x {height}"
                              + (f", nine-slice l{nine[0]} t{nine[1]} r{nine[2]} b{nine[3]} (records/nine-slice.json; no content rect in the records, so the content inset is the slice)" if nine is not None else "")
                              + ". The batch records give the delivery date, not a generation time."})
        base = {"id": f"lord.ledger.{name}", "kind": ui["kind"], "image": {"url": url, "width": width, "height": height},
                "provenance": {"inboxFile": f"assets-inbox/{inbox_key}", "sourceSha256": digest, "runtimeSha256": digest}}
        if ui["kind"] == "ui-frame":
            left, top, right, bottom = nine
            sides = {"top": top, "right": right, "bottom": bottom, "left": left}
            base.update({"slice": sides, "scale": ui["scale"], "contentInset": dict(sides), "centre": ui["centre"], "repeat": ui["repeat"]})
        else:
            base.update({"cssWidths": ui["cssWidths"], "derivatives": []})
        entries.append(base)
        keys.add(inbox_key)
    BUNDLE.write_text(json.dumps({"schemaVersion": 1, "bundleId": "lord-ledger", "entries": entries, "rules": []}, ensure_ascii=False, indent=2) + "\n")
    subprocess.run(["node_modules/.bin/tsx", "scripts/lmr2ArtBundle.ts", str(BUNDLE.relative_to(ROOT))], cwd=ROOT, check=True)
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    marked = mark_installed(keys) if mark else []
    print(json.dumps({"installed": sorted(keys), "ledgerMarked": sorted(marked)}))


if __name__ == "__main__":
    main()
