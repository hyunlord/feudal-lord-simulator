"""INSTALL-32: install Wave 32, the granary variants (26 confirmed files, verdict 2026-09-29) into
public/assets/wave32/granary: three granaries a (timber on staddle stones, thatch), b (braced timber, clay tile) and
c (stone, buttresses, stone slabs), each on the barn's own canvas (160 x 144, pivot (80, 128), alpha bounds identical
to barn.png, so the barn's R0-2 fit is theirs), and each one's own state layers full / half / empty (the stock at the
door: alternatives), snow, boarded and weathered (transparent, same canvas, source-over at (0, 0), never laid on
another variant); and the five shared props (pulley beam, rope and hook, one sack, small and large sack piles) on their
own canvases, registered only (Astra gave them no place on the building: props-review.md). Granary b's snow and boarded
are the rework's (assets-inbox/wave32/rework-20260929, the user's verdict 2026-09-29; the candidates' two are
superseded in the inbox ledger); every other file comes from assets-inbox/wave32/candidates-20260929. The proofs and
masks are records, not installed. No C2PA chunk (asserted): received bytes = runtime bytes, each checked against the
inbox ledger and its batch's records/manifest.json.
One docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths), one prompt file each (the
batch's own prompt for that file: records/manifest.json `prompt`, a native-text file or the text itself),
`installed_by` = INSTALL-32 in the inbox ledger, and src/render/wave32GranaryManifest.generated.ts: every picture's
url, size and pivot, the three paintings with their roof, and the props.
Run: python3 scripts/installWave32.py
"""
import csv
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CANDIDATES = ROOT / "assets-inbox/wave32/candidates-20260929"
REWORK = ROOT / "assets-inbox/wave32/rework-20260929"
REWORKED = {"granary_b_snow-v1", "granary_b_boarded-v1"}
RUNTIME = ROOT / "public/assets/wave32/granary"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
BARN = ROOT / "public/assets/buildings/barn.png"
MANIFEST = ROOT / "src/render/wave32GranaryManifest.generated.ts"
USED_IN = ("src/render/wave32GranaryManifest.generated.ts (INSTALL-32: the granary's three paintings a-c and their full / half / "
           "empty / snow / boarded / weathered layers; the five props registered only)")
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
STATES = ("full", "half", "empty", "snow", "boarded", "weathered")
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


def alpha_bounds(path: Path) -> tuple:
    return Image.open(path).convert("RGBA").getchannel("A").point(lambda a: 255 if a >= 128 else 0).getbbox()


def prompt_text(batch: Path, entry: dict) -> str:
    """records/manifest.json `prompt`: a native-text path (native/a/full-prompt.txt) or the prompt itself."""
    prompt = entry["prompt"]
    if prompt.endswith(".txt") and "\n" not in prompt:
        return (batch / "records/native-text" / prompt.removeprefix("native/")).read_text()
    return prompt


def main() -> None:
    inbox = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    by_file = {row["file"]: row for row in inbox}
    entries = {entry["id"]: (CANDIDATES, entry) for entry in json.loads((CANDIDATES / "records/manifest.json").read_text())["assets"]}
    for entry in json.loads((REWORK / "records/manifest.json").read_text())["assets"]:
        if entry["id"] in REWORKED:
            entries[entry["id"]] = (REWORK, entry)
    barn_bounds = alpha_bounds(BARN)
    rows, installed, images, variants, props = [], set(), {}, [], []
    RUNTIME.mkdir(parents=True, exist_ok=True)
    for ident, (batch, entry) in sorted(entries.items()):
        source = batch / entry["file"]
        inbox_key = source.relative_to(ROOT / "assets-inbox").as_posix()
        digest = sha(source)
        assert digest == entry["sha256"], ident
        assert by_file[inbox_key]["sha256"] == digest and by_file[inbox_key]["status"] == "confirmed", inbox_key
        assert not C2PA_CHUNKS & png_chunks(source.read_bytes()), f"{ident} carries a C2PA chunk"
        state, variant = entry["state"], entry["variant"]
        width, height, pivot = int(entry["width"]), int(entry["height"]), entry["pivot"]
        with Image.open(source) as picture:
            assert picture.size == (width, height) and picture.mode == "RGBA", ident
        if state == "prop":
            assert variant == "shared" and pivot == {"x": width // 2, "y": height}, ident
        else:
            assert state in ("base", *STATES) and variant in "abc", ident
            # The barn's canvas and pivot: the paintings replace barn.png in its frame and fit.
            assert (width, height) == (160, 144) and pivot == {"x": 80, "y": 128}, ident
        if state == "base":
            assert alpha_bounds(source) == barn_bounds, f"{ident}: the barn's alpha bounds"
        key = ident.removesuffix("-v1")
        runtime = RUNTIME / f"{key}.png"
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, ident
        images[key] = {"url": f"assets/wave32/granary/{key}.png", "width": width, "height": height, "pivot": pivot}
        if state == "base":
            variants.append({"key": key, "variant": variant, "roof": entry["roof"]})
        if state == "prop":
            props.append(key)
        prompt = ROOT / "docs/provenance/prompts" / f"{key}-wave32.txt"
        prompt.write_text(prompt_text(batch, entry).strip() + "\n")
        reference = entry["ref"] if isinstance(entry["ref"], str) else ";".join(entry["ref"])
        method = entry.get("registration", {}).get("method") if isinstance(entry.get("registration"), dict) else None
        edits = ("standalone prop: alpha-only bounding crop, proportional Lanczos3 downsample, transparent padding (records/props.json)" if state == "prop"
                 else f"generated edit of barn.png on its canvas; contact band restored from barn.png (records/{variant}.json)" if state == "base"
                 else f"registered state layer: {method or 'state picture registered on the base, difference extracted'}; clipped to the base "
                      f"(outside base {entry.get('outsideBase', 0)}, contact mismatch {entry.get('contactMismatch', 0)})")
        coverage = entry.get("coverage")
        rows.append({"assetId": f"wave32/{key}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": "builtin imagegen", "model": "not exposed",
                     "generatedAt": "2026-09-29", "prompt": str(prompt.relative_to(ROOT)),
                     "referenceInputs": f"{reference}; records/{Path(entry['provenance']).name}", "seed": "not exposed", "candidates": "1",
                     "manualEdits": edits, "artBible": "Wave 32 records/README.md", "historicalProfile": "Southern England 1300-1450",
                     "owner": "Astra", "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave32 {ident} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-29) installed by INSTALL-32 on 2026-09-30 from "
                              f"{batch.relative_to(ROOT)}; no C2PA chunk, received bytes = runtime bytes. State {state}, roof {entry['roof']}"
                              + (f", roof snow cover {coverage['percent']:.2f} %" if isinstance(coverage, dict) else "")
                              + (" (rework, replaces the candidate's)" if ident in REWORKED else "") + "."})
        installed.add(inbox_key)
    assert len(images) == 26 and len(variants) == 3 and len(props) == 5, (len(images), len(variants), len(props))
    for entry in variants:
        assert all(f"{entry['key']}_{state}" in images for state in STATES), entry["key"]
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
            row["installed_by"] = "INSTALL-32"
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n" if "\r\n" in raw else "\n")
        writer.writeheader(); writer.writerows(inbox)
    body = "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(images.items()))
    listed = "\n".join(f"  {json.dumps(entry, separators=(', ', ': '))}," for entry in sorted(variants, key=lambda item: item["variant"]))
    MANIFEST.write_text(
        "// Generated by scripts/installWave32.py — Wave 32 granaries a-c, their state layers and the shared props (INSTALL-32): url,\n"
        "// size and pivot of each picture (the paintings and layers on the barn's canvas); the paintings with their roof; the props.\n"
        "export const WAVE32_GRANARY_IMAGES = {\n" + body + "\n} as const;\n\nexport type Wave32GranaryKey = keyof typeof WAVE32_GRANARY_IMAGES;\n\n"
        "export const WAVE32_GRANARY_VARIANTS = [\n" + listed + "\n] as const;\n\n"
        "/** Registered only: Astra gave the props no place on the building (records/props-review.md). */\n"
        f"export const WAVE32_GRANARY_PROPS = {json.dumps(sorted(props), separators=(', ', ': '))} as const;\n")
    print(len(rows), "rows;", len(images), "installed;", len(variants), "paintings;", len(props), "props")


if __name__ == "__main__":
    main()
