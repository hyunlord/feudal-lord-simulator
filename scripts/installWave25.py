"""UI-7: install Wave 25, the family tree's parts (16 confirmed files from assets-inbox/wave25/candidates-20260928,
INBOX-2b, verdict 2026-09-28) into public/assets/wave25/tree: the lineage banner and generation label (9-slice), the
person frames plain, selected and deceased (9-slice), the branch lines (horizontal, vertical, four corners, T), the
marriage link, the outside-spouse marker and the expand / collapse buttons. The check picture (proofs/) is not
installed: it hangs outside spouses from their parents' branch line, which the tree does not do. No C2PA chunk
(asserted): received bytes = runtime bytes.
One docs/provenance/assets.csv row each (replacing earlier UI-7 rows for these paths), one prompt file each (the
batch's own record for the part: its generation prompt, or for the technical line derivatives the method),
`installed_by` = UI-7 in the inbox ledger, and src/ui/wave25ArtManifest.generated.ts: url, size and, for the 9-slice
parts, their insets (records/generation-records.csv `nine_slice_ltrb`).
Run: python3 scripts/installWave25.py
"""
import csv
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/wave25/candidates-20260928"
RUNTIME = ROOT / "public/assets/wave25/tree"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/ui/wave25ArtManifest.generated.ts"
USED_IN = "src/ui/wave25ArtManifest.generated.ts (UI-7: the biography's family tree — banner, generation labels, person frames, branch lines, marriage link, outside-spouse marker, expand / collapse)"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_chunks(data: bytes) -> set:
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    found, i = set(), 8
    while i < len(data):
        n = struct.unpack(">I", data[i:i + 4])[0]
        found.add(data[i + 4:i + 8])
        i += 12 + n
    return found


def part_record(part: str, source_record: str) -> str:
    """The batch's own words for how a part was made: its generation prompt(s), or the record's method."""
    # A part may name several records ("records/root-generation.json;records/lines.json"): the last is the part's own.
    path = BATCH / source_record.split(";")[-1]
    record = json.loads(path.read_text()) if path.exists() else {}
    prompts = [entry["prompt"] for entry in record.get("generations", []) if "prompt" in entry]
    if prompts and part.startswith("tree_node_frame"):
        return "\n\n".join(prompts)
    entry = next((asset for asset in record.get("assets", []) if asset.get("id") == part), None)
    if entry is not None and entry.get("prompt"):
        return entry["prompt"]
    method = record.get("method") or (entry or {}).get("processing") or record.get("postprocessing")
    return f"(technical part; {source_record}) {json.dumps(method if method is not None else entry, ensure_ascii=False)}"


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    parts = list(csv.DictReader(open(BATCH / "records/generation-records.csv", encoding="utf-8-sig")))
    rows, installed, images = [], set(), {}
    RUNTIME.mkdir(parents=True, exist_ok=True)
    for part in parts:
        source = BATCH / part["file"]
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        digest = sha(source)
        assert digest == part["sha256"], part["id"]
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        assert not C2PA_CHUNKS & png_chunks(source.read_bytes()), f"{part['id']} carries a C2PA chunk"
        runtime = RUNTIME / f"{part['id']}.png"
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, part["id"]
        image = {"url": f"assets/wave25/tree/{part['id']}.png", "width": int(part["width"]), "height": int(part["height"])}
        if part["nine_slice_ltrb"]:
            left, top, right, bottom = (int(value) for value in part["nine_slice_ltrb"].split(";"))
            image["nineSlice"] = {"left": left, "top": top, "right": right, "bottom": bottom}
        images[part["id"]] = image
        prompt = ROOT / "docs/provenance/prompts" / f"{part['id']}-wave25.txt"
        prompt.write_text(part_record(part["id"], part["source_record"]).strip() + "\n")
        rows.append({"assetId": f"wave25/{part['id']}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": part["processing"], "model": part["model"],
                     "generatedAt": "2026-09-28", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": part["source_record"], "seed": part["seed"],
                     "candidates": "1", "manualEdits": part["processing"], "artBible": "Wave 25 records/PLAN.md", "historicalProfile": "",
                     "owner": "Astra", "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave25 {part['id']} (confirmed in assets-inbox/INBOX_LEDGER.csv) installed by UI-7 on 2026-09-28 from "
                              f"{BATCH.relative_to(ROOT)}; no C2PA chunk, received bytes = runtime bytes. QA: {part['qa_note']}"})
        installed.add(inbox_key)
    assert len(images) == 16, len(images)
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows}
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] not in ours]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    raw = open(INBOX_LEDGER, encoding="utf-8", newline="").read()
    fields = list(inbox[0].keys())
    for row in inbox:
        if row["file"] in installed:
            row["installed_by"] = "UI-7"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if "\r\n" in raw else "\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(images.items()))
    MANIFEST.write_text("// Generated by scripts/installWave25.py — Wave 25 family tree parts (UI-7): url, size and, for 9-slice parts, the insets.\n"
                        "export const WAVE25_IMAGES = {\n" + body + "\n} as const;\n\nexport type Wave25ImageId = keyof typeof WAVE25_IMAGES;\n")
    print(len(rows), "rows;", len(images), "installed")


if __name__ == "__main__":
    main()
