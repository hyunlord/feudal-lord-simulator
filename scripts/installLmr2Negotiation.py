"""LM-R2 (negotiation): install the Wave 35 negotiation parts (assets-inbox/wave35/candidates-20260930/assets/B_negotiation,
confirmed 2026-09-30 in assets-inbox/INBOX_LEDGER.csv; docs/ops/install-plan-20261003/SPECS/wave35-negotiation.md) into
public/assets/lord-ui/wave35-negotiation/ and the `lord-negotiation` bundle of renderer B's art catalog
(src/render/art/catalog.json, through scripts/lmr2ArtBundle.ts), for the lord screen's 혼인 item
(src/ui/lord/negotiation/NegotiationPanel.tsx):
- treaty_frame (768 x 512): `ui-frame`, nine-slice l128 t160 r128 b112 from records/nine-slice.json, drawn x0.375; the
  records give no content rect, so the content inset is the slice (the corner shields and seal places stay clear);
- clause_row / clause_row_changed / clause_row_rejected (512 x 80, l48 t18 r48 b18) and reason_chip_plus / reason_chip_minus
  (256 x 64, l44 t14 r24 b14): `ui-frame`, x0.5, the records' slices (a row and a chip take their text's width);
- seal_empty / seal_stamped / seal_broken (96 x 96): `ui-image` at 48 css px (the file is the 2x);
- acceptance_scale (640 x 128, five 128 px cells, records/README.md): `ui-image` at 320 css px, one 64 px cell shown;
- treaty_divider (16 x 256): `ui-image` at its fixed 16 px (records/nine-slice.json "fixed16px width").
Screen art: no pivot. The received files carry no C2PA chunk (asserted): received bytes = runtime bytes. One
docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths) from records/frames.json or
records/marks.json (tool, prompt, crop / postprocess), one prompt file each. `--installed` also writes installed_by = LM-R2
on these eleven inbox ledger rows; run it only after the consumer and the spec's capture gate are confirmed
(INSTALL_PROTOCOL 6). Rerunnable.
Run: python3 scripts/installLmr2Negotiation.py [--installed]
"""
import csv
import hashlib
import json
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/wave35/candidates-20260930"
RUNTIME = ROOT / "public/assets/lord-ui/wave35-negotiation"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
INSTALLED_BY = "LM-R2"
USED_IN = "src/ui/lord/negotiation/negotiationArt.ts; src/ui/lord/negotiation/NegotiationPanel.tsx; src/styles/lordNegotiation.css (LM-R2: the lord screen's 혼인 item)"
FRAME_SCALE = {"treaty_frame": 0.375}
ROW_SCALE = 0.5
# name: (width, height, kind, nine-slice l|t|r|b or None, cssWidths) — sizes measured on the files, the slice from records/nine-slice.json.
EXPECTED = {
    "treaty_frame": (768, 512, "ui-frame", (128, 160, 128, 112), None),
    "clause_row": (512, 80, "ui-frame", (48, 18, 48, 18), None),
    "clause_row_changed": (512, 80, "ui-frame", (48, 18, 48, 18), None),
    "clause_row_rejected": (512, 80, "ui-frame", (48, 18, 48, 18), None),
    "reason_chip_plus": (256, 64, "ui-frame", (44, 14, 24, 14), None),
    "reason_chip_minus": (256, 64, "ui-frame", (44, 14, 24, 14), None),
    "seal_empty": (96, 96, "ui-image", None, [48]),
    "seal_stamped": (96, 96, "ui-image", None, [48]),
    "seal_broken": (96, 96, "ui-image", None, [48]),
    "acceptance_scale": (640, 128, "ui-image", None, [320]),
    "treaty_divider": (16, 256, "ui-image", None, [16]),
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


def record_of(name: str, frames: dict, marks: dict, revision: dict) -> dict:
    """The delivery record: the frames' (tool, prompt, crop, processing) or the marks' (tool, prompt, postprocess)."""
    if name in frames:
        entry = frames[name]
        crop = entry["crop"]
        return {"tool": entry["tool"], "prompt": entry["prompt"], "references": entry["reference_usage"],
                "edits": f"at delivery: crop {crop['left']},{crop['top']} {crop['width']}x{crop['height']} of the raw image; {entry['processing']}"}
    entry = marks[name]
    # seal_empty's first draw was rejected for its ornament (records/marks.json); its kept image is the revision's prompt.
    prompt = revision["prompt"] if name == "seal_empty" else entry["prompt"]
    return {"tool": entry["tool"], "prompt": prompt, "references": "; ".join(entry["references"]) or "none",
            "edits": f"at delivery: {entry['postprocess']}"}


def main() -> None:
    mark = "--installed" in sys.argv[1:]
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    records = BATCH / "records"
    frames = {entry["id"]: entry for entry in json.loads((records / "frames.json").read_text())}
    marks = {entry["id"]: entry for entry in json.loads((records / "marks-input.json").read_text())}
    marks_out = {entry["id"]: entry for entry in json.loads((records / "marks.json").read_text())}
    for name, entry in marks.items():
        entry["postprocess"] = marks_out.get(name, {}).get("postprocess", "")
    revision = json.loads((records / "marks-empty-revision.json").read_text())
    slices = json.loads((records / "nine-slice.json").read_text())
    assert slices["order"] == "left,top,right,bottom"
    rows, entries, installed = [], [], set()
    for name, (width, height, kind, nine, css) in EXPECTED.items():
        source = BATCH / "assets/B_negotiation" / f"{name}.png"
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
        url = runtime.relative_to(ROOT / "public").as_posix()
        base = {"id": f"lord.negotiation.{name}", "kind": kind, "image": {"url": url, "width": width, "height": height},
                "provenance": {"inboxFile": f"assets-inbox/{inbox_key}", "sourceSha256": digest, "runtimeSha256": digest}}
        if kind == "ui-frame":
            left, top, right, bottom = nine
            sides = {"top": top, "right": right, "bottom": bottom, "left": left}
            entries.append({**base, "slice": sides, "scale": FRAME_SCALE.get(name, ROW_SCALE), "contentInset": sides, "centre": "fill", "repeat": "stretch"})
        else:
            entries.append({**base, "cssWidths": css, "derivatives": []})
        record = record_of(name, frames, marks, revision)
        prompt = ROOT / "docs/provenance/prompts" / f"{name}-wave35.txt"
        prompt.write_text(record["prompt"].strip() + "\n")
        rows.append({"assetId": f"lord-ui/wave35-negotiation/{name}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": record["tool"], "model": "not exposed",
                     "generatedAt": "2026-09-30", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": record["references"],
                     "seed": "not exposed", "candidates": "1", "manualEdits": record["edits"],
                     "artBible": "ART_BIBLE_v2", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra", "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave35 B_negotiation/{name} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-30) installed by "
                              f"{INSTALLED_BY} on 2026-10-06 as the art catalog's lord-negotiation {kind}; no C2PA chunk, received bytes = runtime bytes; {width} x {height}"
                              + (f", nine-slice l{nine[0]} t{nine[1]} r{nine[2]} b{nine[3]} (records/nine-slice.json)" if nine is not None else "")
                              + ". The batch records give the delivery date, not a generation time."})
        installed.add(inbox_key)
    bundle = {"schemaVersion": 1, "bundleId": "lord-negotiation", "entries": entries, "rules": []}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump(bundle, handle)
    subprocess.run([str(ROOT / "node_modules/.bin/tsx"), "scripts/lmr2ArtBundle.ts", handle.name], cwd=ROOT, check=True)
    Path(handle.name).unlink()
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
