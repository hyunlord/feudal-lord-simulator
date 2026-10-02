"""NAT-4: install the Wave 41 additions (assets-inbox/wave41/additions-20261002, confirmed 2026-10-02 in
assets-inbox/INBOX_LEDGER.csv) into public/assets/wave41/<folder>:
- boundary/woodland_grass_edge_{summer,winter}: the woodland floor <-> meadow transition strip (512 x 64 RGBA, top the
  meadow, bottom the woodland floor, repeating along x every 512 px, Y 8 px transparent + 8 px fade, pivot (256, 32);
  records/README.md, strip-metrics.json): the forest edge the LU-D11 hook draws (src/render/landEdgeBand.ts);
- ford/ford_w1_{ne,nw}_{summer,winter}: the width-1 fords (512 x 256 RGBA, pivot (256, 128), water span one cell;
  records/ford-QA.md, ford-metrics.json): drawn for single-cell ford groups (LU-D4: until now the w2 sheet).
Only the six confirmed asset rows; the proofs, records and the batch's base29 files are not installed (base29 is the
art-audit rework, another installer's). The `-vN` suffix is dropped. No C2PA chunk (asserted): received bytes =
runtime bytes. One docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths) built from the
batch's records (strip-generations.json / ford-generations.json: tool, prompt, references, postprocess), one prompt file
each, `installed_by` = NAT-4 in the inbox ledger (these rows only), and src/render/wave41LandManifest.generated.ts:
url, folder, season, repeat, size and pivot of each picture (WAVE41_GROUND keyed `boundary/<name>`, WAVE41_FORDS keyed
`<name>`, as the Wave 22 and Wave 34 manifests key theirs).
Run: python3 scripts/installWave41.py
"""
import csv
import hashlib
import json
import re
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/wave41/additions-20261002"
RUNTIME = ROOT / "public/assets/wave41"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/render/wave41LandManifest.generated.ts"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
INSTALLED_BY = "NAT-4"
USED_IN = {
    "boundary": "src/render/wave41LandManifest.generated.ts (NAT-4 LU-D11: the forest edge band between the woodland floor and the meadow, landEdgeBand.ts)",
    "ford": "src/render/wave41LandManifest.generated.ts (NAT-4 LU-D4: width-1 fords on ford roads, landWorksDraw.ts via wave34Art.ts fordKey)",
}
EXPECTED = {
    "boundary/woodland_grass_edge_summer-v1.png": (512, 64, 256, 32, "summer", "x"),
    "boundary/woodland_grass_edge_winter-v1.png": (512, 64, 256, 32, "winter", "x"),
    "ford/ford_w1_ne_summer-v1.png": (512, 256, 256, 128, "summer", "none"),
    "ford/ford_w1_ne_winter-v1.png": (512, 256, 256, 128, "winter", "none"),
    "ford/ford_w1_nw_summer-v1.png": (512, 256, 256, 128, "summer", "none"),
    "ford/ford_w1_nw_winter-v1.png": (512, 256, 256, 128, "winter", "none"),
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


def generation_records() -> dict:
    """Per asset id (`woodland_grass_edge_summer-v1`): tool, prompt, reference inputs and the post-processing note."""
    records = {}
    strips = json.loads((BATCH / "records/strip-generations.json").read_text())
    metrics = {entry["id"]: entry for entry in json.loads((BATCH / "records/strip-metrics.json").read_text())}
    for entry in strips["assets"]:
        records[entry["id"]] = {"tool": strips["tool"], "prompt": entry["prompt"],
                                "references": "; ".join(Path(ref["path"]).name for ref in entry["references"]),
                                "edits": metrics[entry["id"]]["postprocess"]}
    for entry in json.loads((BATCH / "records/ford-generations.json").read_text()):
        records[entry["id"]] = {"tool": entry["tool"], "prompt": entry["prompt"], "references": Path(entry["input"]).name, "edits": entry["postprocess"]}
    return records


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    generations = generation_records()
    rows, installed, ground, fords = [], set(), {}, {}
    for relative, (width, height, pivot_x, pivot_y, season, repeat) in EXPECTED.items():
        source = BATCH / "assets" / relative
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        entry = by_file[inbox_key]
        assert entry["status"] == "confirmed", inbox_key
        digest = sha(source)
        assert digest == entry["sha256"], inbox_key
        chunks, real_width, real_height = png_info(source.read_bytes())
        assert not C2PA_CHUNKS & chunks, f"{inbox_key} carries a C2PA chunk"
        assert (real_width, real_height) == (width, height), inbox_key
        folder, file = relative.split("/")
        asset_id = file.removesuffix(".png")
        name = re.sub(r"-v\d+$", "", asset_id)
        runtime = RUNTIME / folder / f"{name}.png"
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, inbox_key
        meta = {"url": f"assets/wave41/{folder}/{name}.png", "folder": folder, "season": season, "repeat": repeat,
                "width": width, "height": height, "pivot": {"x": pivot_x, "y": pivot_y}}
        (ground if folder == "boundary" else fords)[f"boundary/{name}" if folder == "boundary" else name] = meta
        record = generations[asset_id]
        prompt = ROOT / "docs/provenance/prompts" / f"{name}-wave41.txt"
        prompt.write_text(record["prompt"].strip() + "\n")
        rows.append({"assetId": f"wave41/{name}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": record["tool"], "model": "not exposed",
                     "generatedAt": "2026-10-02", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": record["references"],
                     "seed": "not exposed", "candidates": "1", "manualEdits": record["edits"], "artBible": "ART_BIBLE_v2",
                     "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra", "usedIn": USED_IN[folder], "status": "runtime",
                     "notes": f"Astra wave41 additions {folder}/{name} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-10-02) installed by "
                              f"{INSTALLED_BY} on 2026-10-02 from {BATCH.relative_to(ROOT)}; no C2PA chunk, received bytes = runtime bytes. Season {season}, "
                              f"repeat {repeat}, pivot ({pivot_x}, {pivot_y}). The batch records give the delivery date, not a generation time."})
        installed.add(inbox_key)
    assert len(rows) == 6, len(rows)
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
            row["installed_by"] = INSTALLED_BY
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if raw.split("\n", 1)[0].endswith("\r") else "\n")
        writer.writeheader(); writer.writerows(inbox)
    body = lambda images: "\n".join(f"  {json.dumps(key)}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(images.items()))
    MANIFEST.write_text("// Generated by scripts/installWave41.py — the Wave 41 additions (NAT-4): the forest edge strip (WAVE41_GROUND, x: repeating\n"
                        "// along x; top the meadow, bottom the woodland floor) and the width-1 fords (WAVE41_FORDS, one picture each): url, folder,\n"
                        "// season, repeat, size and pivot of each picture.\n"
                        "export const WAVE41_GROUND = {\n" + body(ground) + "\n} as const;\n\nexport type Wave41GroundKey = keyof typeof WAVE41_GROUND;\n\n"
                        "export const WAVE41_FORDS = {\n" + body(fords) + "\n} as const;\n\nexport type Wave41FordKey = keyof typeof WAVE41_FORDS;\n")
    print(len(rows), "rows;", len(ground), "strips;", len(fords), "fords")


if __name__ == "__main__":
    main()
