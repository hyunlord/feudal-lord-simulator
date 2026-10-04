"""LM-R1 (RUN-01 / QA-027; docs/ops/install-plan-20261003/SPECS/wave12-manor.md and SPECS/endings-manors.md): install the
manor house pictures into public/assets/<wave>/…:
- Wave 12 manor A and B bodies (wave12/candidates-20260926/assets/bld/manor_house_{a,b}-v1) and their activity overlays
  (wave12/rework-20260926/assets/active/manor_house_{a,b}-active-v1; the candidates' overlays are superseded by these),
- the empty manors (endings-manors): A (candidates-20260930/…/manor_house_a_empty-v1) and B v2 only
  (manor-b-rework-20260930/…/manor_house_b_empty-v2; v1 is superseded).
All six share one 416 x 328 canvas; the pivot is Astra's registration, A (249, 319) and B (251, 319): the front ground
contact of the courtyard wall (wave12 records/buildings.csv, endings manifests), read here from the records — no
centre or bottom guess. Each row is checked against the inbox ledger (confirmed, sha256, not superseded) and its real
size; no C2PA chunk (asserted), received bytes = runtime bytes, never mirrored. Writes one docs/provenance/assets.csv row
each (replacing earlier rows for these runtime paths), one prompt file each, and src/render/manorHouseManifest.generated.ts.
`--mark` sets installed_by = LM-R1 in the inbox ledger — only after the copy, the consumer (src/render/manorHouseArt.ts)
and the captures are confirmed.
Run: python3 scripts/installManorHouse.py [--mark]
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
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = INBOX / "INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/render/manorHouseManifest.generated.ts"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
INSTALLED_BY = "LM-R1"
USED_IN = "src/render/manorHouseManifest.generated.ts (LM-R1 RUN-01: the manor_house building, src/render/manorHouseArt.ts)"
WAVE12_RECORDS = INBOX / "wave12/candidates-20260926/records/buildings.csv"
# key: (inbox source, runtime path under public/, the wave12 record row whose pivot it shares)
PICTURES = {
    "manor_a": ("wave12/candidates-20260926/assets/bld/manor_house_a-v1.png", "assets/wave12/bld/manor_house_a-v1.png", "manor_house_a"),
    "manor_b": ("wave12/candidates-20260926/assets/bld/manor_house_b-v1.png", "assets/wave12/bld/manor_house_b-v1.png", "manor_house_b"),
    "manor_a_active": ("wave12/rework-20260926/assets/active/manor_house_a-active-v1.png", "assets/wave12/active/manor_house_a-active-v1.png", "manor_house_a"),
    "manor_b_active": ("wave12/rework-20260926/assets/active/manor_house_b-active-v1.png", "assets/wave12/active/manor_house_b-active-v1.png", "manor_house_b"),
    "manor_a_empty": ("endings-manors/candidates-20260930/assets/manors/manor_house_a_empty-v1.png", "assets/endings-manors/manors/manor_house_a_empty-v1.png", "manor_house_a"),
    "manor_b_empty": ("endings-manors/manor-b-rework-20260930/assets/manors/manor_house_b_empty-v2.png", "assets/endings-manors/manors/manor_house_b_empty-v2.png", "manor_house_b"),
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


def records() -> dict:
    """Per inbox source: tool, prompt, references, post-processing and the record file (the batches' own records)."""
    out = {}
    for row in csv.DictReader(open(INBOX / "wave12/candidates-20260926/records/assets.csv", encoding="utf-8-sig")):
        out[f"wave12/candidates-20260926/{row['file']}"] = {"tool": "image_gen (Astra wave12)", "prompt": row["full_prompt"],
            "references": "; ".join(Path(ref).name for ref in row["references"].split(";") if ref), "edits": row["processing"],
            "file": "assets-inbox/wave12/candidates-20260926/records/assets.csv"}
    for row in csv.DictReader(open(INBOX / "wave12/rework-20260926/records/assets.csv", encoding="utf-8-sig")):
        out[f"wave12/rework-20260926/{row['file']}"] = {"tool": "image_gen (Astra wave12 rework)", "prompt": row["full_prompt"],
            "references": "manor_house base (same canvas)", "edits": row["processing"], "file": "assets-inbox/wave12/rework-20260926/records/assets.csv"}
    for entry in json.loads((INBOX / "endings-manors/candidates-20260930/records/manors-manifest.json").read_text()):
        out[f"endings-manors/candidates-20260930/assets/manors/{entry['assetId']}.png"] = {"tool": entry["tool"], "prompt": entry["prompt"],
            "references": "; ".join(Path(str(ref.get("path", ref)) if isinstance(ref, dict) else str(ref)).name for ref in entry.get("references", [])),
            "edits": entry["manualEdits"], "file": "assets-inbox/endings-manors/candidates-20260930/records/manors-manifest.json"}
    entry = json.loads((INBOX / "endings-manors/manor-b-rework-20260930/records/manifest.json").read_text())
    out[f"endings-manors/manor-b-rework-20260930/assets/manors/{entry['assetId']}.png"] = {"tool": "image_gen (native edit) + compose.cjs",
        "prompt": entry["prompt"], "references": f"{Path(entry['sourcePath']).name}; {Path(entry['referencePath']).name}", "edits": entry["manualEdits"],
        "file": "assets-inbox/endings-manors/manor-b-rework-20260930/records/manifest.json"}
    return out


def main(mark: bool) -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    pivots = {row["id"]: (int(row["pivot_x"]), int(row["pivot_y"]), row["footprint"]) for row in csv.DictReader(open(WAVE12_RECORDS, encoding="utf-8-sig"))}
    generation = records()
    rows, manifest, copied = [], {}, []
    for key, (inbox_path, runtime_url, pivot_row) in PICTURES.items():
        source = INBOX / inbox_path
        ledger = by_file[inbox_path]
        assert ledger["status"] == "confirmed" and ledger["replaced_by"] == "", f"{inbox_path}: {ledger['status']}"
        digest = sha(source)
        assert digest == ledger["sha256"], inbox_path
        chunks, width, height = png_info(source.read_bytes())
        assert not C2PA_CHUNKS & chunks, f"{inbox_path} carries a C2PA chunk"
        assert (width, height) == (416, 328), f"{inbox_path}: {width} x {height}"
        pivot_x, pivot_y, footprint = pivots[pivot_row]
        runtime = ROOT / "public" / runtime_url
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, inbox_path
        manifest[key] = {"url": runtime_url, "width": width, "height": height, "pivot": {"x": pivot_x, "y": pivot_y}}
        record = generation[inbox_path]
        name = Path(inbox_path).stem
        prompt = ROOT / "docs/provenance/prompts" / f"{name}-lmr1.txt"
        prompt.write_text(str(record["prompt"]).strip() + "\n")
        rows.append({"assetId": f"manor/{key}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": record["tool"], "model": "not exposed",
                     "generatedAt": "2026-09-30" if inbox_path.startswith("endings") else "2026-09-26", "prompt": str(prompt.relative_to(ROOT)),
                     "referenceInputs": record["references"], "seed": "not exposed", "candidates": "1", "manualEdits": record["edits"],
                     "artBible": "AB_2026-09-26_wave12", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra", "usedIn": USED_IN,
                     "status": "runtime",
                     "notes": f"Astra {name} (confirmed in assets-inbox/INBOX_LEDGER.csv) installed by {INSTALLED_BY} on 2026-10-03; no C2PA chunk, "
                              f"received bytes = runtime bytes, not mirrored. Canvas 416 x 328, pivot ({pivot_x}, {pivot_y}) from "
                              f"wave12/candidates-20260926/records/buildings.csv ({pivot_row}, footprint {footprint}); generation record {record['file']}."})
        copied.append(inbox_path)
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    if mark:
        raw = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
        for row in inbox:
            if row["file"] in copied:
                row["installed_by"] = INSTALLED_BY
        with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(inbox[0].keys()), lineterminator="\r\n" if raw.split("\n", 1)[0].endswith("\r") else "\n")
            writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {json.dumps(key)}: {json.dumps(value, separators=(', ', ': '))}," for key, value in manifest.items())
    MANIFEST.write_text("// Generated by scripts/installManorHouse.py — the manor house (LM-R1 RUN-01, src/render/manorHouseArt.ts): Wave 12 manor\n"
                        "// A / B, their activity overlays and the empty manors (A, B v2) on one 416 x 328 canvas; pivot = Astra's front ground contact.\n"
                        "export const MANOR_HOUSE_IMAGES = {\n" + body + "\n} as const;\n\nexport type ManorHouseKey = keyof typeof MANOR_HOUSE_IMAGES;\n")
    print(len(rows), "pictures;", "installed_by marked" if mark else "installed_by not marked")


if __name__ == "__main__":
    main("--mark" in sys.argv[1:])
