"""NAT-5: install the Wave 42 land change stages (assets-inbox/wave42, confirmed 2026-10-02 in assets-inbox/INBOX_LEDGER.csv)
into public/assets/wave42/<folder>, the pictures the screen draws for LM-E5's living growth (docs/design/living-growth.md
LG-3; src/render/landStage*.ts, src/render/footpath*.ts):
- stumps/stump_{oak_large,ash_small}_{fresh,mossy}_{summer,winter}: a felled tree's stump stage (128 x 128, pivot (64, 108));
- regrowth/sapling_{1to3,4to8}_*, young_wood_{a,b}_*: its sapling stage (two heights) and the grown wood before the record
  goes (128 x 192, pivot (64, 172));
- paths/path_clear_{ne,nw}_*: the footpath strips (512 x 64 unwrapped UV, X repeat every 512, pivot (256, 32), ports (0, 32) / (512, 32));
- connections/path_clear_{corner,fork}_{ne,nw}_*: the joins (128 x 128, pivot (64, 80) on the cell centre, ports NW (32, 64),
  NE (96, 64), SW (32, 96), SE (96, 96); records/CONNECTIONS.md);
- abandoned/abandoned_{grass,overgrown_furrows,bramble,saplings}_*: fallow plots and strips (128 x 160, pivot (64, 120)).
The current file of each name is found by following the ledger's replaced_by from the first delivery
(wave42/candidates-20261002) — the rework (saplings, abandoned grass, wave42/rework-20261002) and the bramble v3
(wave42/bramble-v3-20261002) — and must be `confirmed` with no replacement; a superseded or rework_pending file is never
installed. Not installed (confirmed, but no engine stage draws them yet; NAT-5 report): log_stack_{a,b}, path_faint_*,
path_muddy_* (the engine keeps no wear class for a path; the connectors join clear only), abandoned_collapsed_fence.
Every file carries no_flip in the batch CSV: the screen never mirrors them. No C2PA chunk (asserted): received bytes =
runtime bytes. One docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths) built from the
batch's records (<category>-generations.json: tool, prompt, references, post-processing), one prompt file each,
`installed_by` = NAT-5 in the inbox ledger (these rows only), and src/render/wave42StageManifest.generated.ts: url,
folder, season, kind, size, pivot (and a connector's ports) of each picture.
Run: python3 scripts/installWave42.py
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
FIRST = "wave42/candidates-20261002"
RUNTIME = ROOT / "public/assets/wave42"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = INBOX / "INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/render/wave42StageManifest.generated.ts"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
INSTALLED_BY = "NAT-5"
SEASONS = ("summer", "winter")
# folder -> (names without season, kind, width, height, pivot x, pivot y)
WANTED = {
    "stumps": ([f"stump_{tree}_{age}" for tree in ("oak_large", "ash_small") for age in ("fresh", "mossy")], "single", 128, 128, 64, 108),
    "regrowth": (["sapling_1to3", "sapling_4to8", "young_wood_a", "young_wood_b"], "single", 128, 192, 64, 172),
    "paths": (["path_clear_ne", "path_clear_nw"], "strip", 512, 64, 256, 32),
    "connections": (["path_clear_corner_ne", "path_clear_corner_nw", "path_clear_fork_ne", "path_clear_fork_nw"], "connector", 128, 128, 64, 80),
    "abandoned": (["abandoned_grass", "abandoned_overgrown_furrows", "abandoned_bramble", "abandoned_saplings"], "single", 128, 160, 64, 120),
}
GENERATIONS = {"stumps": "stumps", "regrowth": "regrowth", "paths": "paths", "connections": "connections", "abandoned": "abandoned"}
PORTS = {"NW": [32, 64], "NE": [96, 64], "SW": [32, 96], "SE": [96, 96]}
CONNECTOR_PORTS = {"corner_ne": ("SW", "NW"), "corner_nw": ("SE", "NE"), "fork_ne": ("SW", "NE", "NW"), "fork_nw": ("SE", "NW", "NE")}
USED_IN = {
    "stumps": "src/render/wave42StageManifest.generated.ts (NAT-5: a felled tree's stump stage, LM-E5 treeStage; landStageItems.ts, object pass)",
    "regrowth": "src/render/wave42StageManifest.generated.ts (NAT-5: a felled tree's sapling and grown stages, LM-E5 treeStage; landStageItems.ts, object pass)",
    "paths": "src/render/wave42StageManifest.generated.ts (NAT-5: footpath strips, LM-E5 landOf(state).footpaths; footpathDraw.ts, ground chunks)",
    "connections": "src/render/wave42StageManifest.generated.ts (NAT-5: footpath corners and forks, records/CONNECTIONS.md; footpathDraw.ts, ground chunks)",
    "abandoned": "src/render/wave42StageManifest.generated.ts (NAT-5: fallow plots and strips, LM-E5 fallowStage; landStageItems.ts, object pass)",
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


def current(by_file: dict, key: str) -> dict:
    """The ledger row now standing for `key`: follow replaced_by to the confirmed file nothing replaces."""
    seen = set()
    row = by_file[key]
    while row["replaced_by"]:
        assert row["file"] not in seen, f"replacement loop at {row['file']}"
        seen.add(row["file"])
        row = by_file[row["replaced_by"]]
    assert row["status"] == "confirmed", f"{key} -> {row['file']} is {row['status']}"
    return row


def generation(batch: str, category: str, asset_id: str) -> dict:
    entries = json.loads((INBOX / batch / "records" / f"{GENERATIONS[category]}-generations.json").read_text())
    entry = next(item for item in entries if item["id"] == asset_id)
    references = entry.get("references") or [item["path"] for item in entry.get("inputs", []) if isinstance(item, dict)] \
        or entry.get("inputs") or ([entry["input"]] if "input" in entry else [])
    edits = entry.get("export") or entry.get("postprocess") or entry.get("transform")
    edits = json.dumps(edits, separators=(",", ":")) if isinstance(edits, (dict, list)) else (edits or f"records/{category}-export.cjs")
    return {"tool": entry.get("tool") or "not exposed", "prompt": entry["prompt"],
            "references": "; ".join(Path(str(ref)).name for ref in references), "edits": edits}


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    rows, installed, manifest = [], set(), {}
    for folder, (names, kind, width, height, pivot_x, pivot_y) in WANTED.items():
        batch_csvs = {}
        for base in names:
            for season in SEASONS:
                name = f"{base}_{season}"
                entry = current(by_file, f"{FIRST}/assets/{folder}/{name}.png")
                source = INBOX / entry["file"]
                batch = entry["file"].split("/assets/")[0]
                if batch not in batch_csvs:
                    batch_csvs[batch] = {row["asset_id"]: row for row in csv.DictReader(open(INBOX / batch / "records/assets.csv", encoding="utf-8"))}
                spec = batch_csvs[batch][name]
                assert spec["no_flip"] == "true", f"{name}: the batch allows a flip"
                assert (int(spec["width"]), int(spec["height"]), int(spec["pivot_x"]), int(spec["pivot_y"])) == (width, height, pivot_x, pivot_y), name
                digest = sha(source)
                assert digest == entry["sha256"], entry["file"]
                chunks, real_width, real_height = png_info(source.read_bytes())
                assert not C2PA_CHUNKS & chunks, f"{entry['file']} carries a C2PA chunk"
                assert (real_width, real_height) == (width, height), entry["file"]
                runtime = RUNTIME / folder / f"{name}.png"
                runtime.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, runtime)
                assert sha(runtime) == digest, entry["file"]
                meta = {"url": f"assets/wave42/{folder}/{name}.png", "folder": folder, "season": season, "kind": kind,
                        "width": width, "height": height, "pivot": {"x": pivot_x, "y": pivot_y}}
                if kind == "strip":
                    meta["ports"] = {"start": {"x": 0, "y": 32}, "end": {"x": 512, "y": 32}}
                    assert json.loads(spec["ports"]) == {"start": [0, 32], "end": [512, 32]}, name
                if kind == "connector":
                    meta["ports"] = {port: {"x": PORTS[port][0], "y": PORTS[port][1]} for port in CONNECTOR_PORTS[base.removeprefix("path_clear_")]}
                    assert json.loads(spec["ports"]) == {port: PORTS[port] for port in CONNECTOR_PORTS[base.removeprefix("path_clear_")]}, name
                manifest[name] = meta
                record = generation(batch, folder, name)
                prompt = ROOT / "docs/provenance/prompts" / f"{name}-wave42.txt"
                prompt.write_text(record["prompt"].strip() + "\n")
                rows.append({"assetId": f"wave42/{name}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                             "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": record["tool"], "model": "not exposed",
                             "generatedAt": "2026-10-02", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": record["references"],
                             "seed": "not exposed", "candidates": "1", "manualEdits": record["edits"], "artBible": "ART_BIBLE_v2",
                             "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra", "usedIn": USED_IN[folder], "status": "runtime",
                             "notes": f"Astra wave42 {folder}/{name} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-10-02) installed by "
                                      f"{INSTALLED_BY} on 2026-10-03 from {batch}; no C2PA chunk, received bytes = runtime bytes. Season {season}, "
                                      f"{kind}, pivot ({pivot_x}, {pivot_y}), no flip. The batch records give the delivery date, not a generation time."})
                installed.add(entry["file"])
    assert len(rows) == 36, len(rows)
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
    body = "\n".join(f"  {json.dumps(key)}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(manifest.items()))
    MANIFEST.write_text("// Generated by scripts/installWave42.py — the Wave 42 land change stages (NAT-5): stumps, saplings and young wood\n"
                        "// (single: the pivot on the cell's ground point), footpath strips (strip: 512 x 64 unwrapped UV, ports (0, 32) and\n"
                        "// (512, 32)), their corners and forks (connector: pivot on the cell centre, ports on the cell's edge midpoints) and the\n"
                        "// fallow pictures: url, folder, season, kind, size and pivot of each picture. Never mirrored (no_flip).\n"
                        "export const WAVE42_STAGES = {\n" + body + "\n} as const;\n\nexport type Wave42StageKey = keyof typeof WAVE42_STAGES;\n")
    print(len(rows), "rows;", len(manifest), "pictures")


if __name__ == "__main__":
    main()
