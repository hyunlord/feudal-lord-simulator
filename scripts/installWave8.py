"""UI-3: install the 37 Wave 8 runtime files (the confirmed rows in assets-inbox/INBOX_LEDGER.csv: 36 from
candidates-20260925 and the plague loading screen v2 from plague-fix-20260926, whose v1 INBOX-1 set to `superseded`)
into public/assets/wave8/<group>, add one docs/provenance/assets.csv row each (replacing earlier UI-3 rows) with one
prompt file each, fill `installed_by` in the inbox ledger, and write src/ui/wave8ArtManifest.generated.ts: every image's
url and size, and for the six frames the 9-slice insets, content rects and minimum size of records/frames-contract.json
(source pixels; drawn at half size, sourceScale 2, as the UX-2 frames).
The received PNGs carry no C2PA caBX chunk: runtime bytes = received bytes = the Astra SHA.
Judgement 2026-09-26: the six keyart PNGs are not copied to public/; the game loads web derivatives made at build time
(scripts/keyartDerivatives.ts, KEYART_DERIVATIVES: JPEG for the screens, a half-size PNG for the emblem), so their
ledger rows point at the received inbox file and the manifest at the derivative's url and size.
Run: python3 scripts/installWave8.py
"""
import csv
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CANDIDATES = ROOT / "assets-inbox/wave8/candidates-20260925"
PLAGUE = ROOT / "assets-inbox/wave8/plague-fix-20260926"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
MANIFEST = ROOT / "src/ui/wave8ArtManifest.generated.ts"
# scripts/keyartDerivatives.ts KEYART_DERIVATIVES (url, and the derivative's size when it differs from the source).
DERIVED = {
    "keyart_title_bg": ("assets/wave8/keyart/keyart_title_bg.jpg", None),
    "keyart_mode_select": ("assets/wave8/keyart/keyart_mode_select.jpg", None),
    "keyart_title_emblem": ("assets/wave8/keyart/keyart_title_emblem.png", 0.5),
    "loading_1315_famine": ("assets/wave8/keyart/loading_1315_famine.jpg", None),
    "loading_1337_war": ("assets/wave8/keyart/loading_1337_war.jpg", None),
    "loading_1348_plague": ("assets/wave8/keyart/loading_1348_plague.jpg", None),
}
USED_IN = ("src/ui/wave8ArtManifest.generated.ts (UI-3: season ledger card, season strip, pause vignette and badge, title "
           "and mode select screens, chapter loading screens, overlay icons, alert bells; chronicle and petition art registered)")
csv.field_size_limit(sys.maxsize)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def chunks(path: Path) -> list[str]:
    data, offset, names = path.read_bytes(), 8, []
    while offset < len(data):
        length = struct.unpack(">I", data[offset:offset + 4])[0]
        names.append(data[offset + 4:offset + 8].decode("latin1"))
        offset += 12 + length
    return names


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    return struct.unpack(">II", data[16:24])


def main() -> None:
    confirmed = {row["file"]: row for row in csv.DictReader(open(INBOX_LEDGER, encoding="utf-8"))
                 if row["wave"] == "wave8" and row["status"] == "confirmed" and "/assets/" in row["file"]}
    records = {row["runtimePath"]: (CANDIDATES, row) for row in csv.DictReader(open(CANDIDATES / "records/assets.csv", encoding="utf-8-sig"))}
    plague = next(csv.DictReader(open(PLAGUE / "records/assets.csv", encoding="utf-8-sig")))
    contract = {asset["id"]: asset for asset in json.load(open(CANDIDATES / "records/frames-contract.json"))["assets"]}
    rows, installed, images, frames = [], set(), {}, {}
    for file, inbox_row in sorted(confirmed.items()):
        source = ROOT / "assets-inbox" / file
        digest = sha(source)
        assert digest == inbox_row["sha256"], file
        assert "caBX" not in chunks(source), file
        if file.startswith("wave8/plague-fix-20260926/"):
            batch, record, group = PLAGUE, plague, "keyart"
        else:
            relative = source.relative_to(CANDIDATES / "assets").as_posix()
            batch, record = records[relative]
            group = relative.split("/")[0]
        assert record["runtimeSha256"] == digest, file
        asset_id, name = record["assetId"], source.name
        runtime_dir = f"public/assets/wave8/{group}"
        derived = DERIVED.get(asset_id)
        if derived is None:
            runtime = ROOT / runtime_dir / name
            runtime.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, runtime)
            assert sha(runtime) == digest, name
        prompt = ROOT / "docs/provenance/prompts" / f"{asset_id}-wave8.txt"
        prompt.write_text((record["prompt"] or "(no prompt recorded)").strip() + "\n")
        runtime_path = str(source.relative_to(ROOT)) if derived is not None else f"{runtime_dir}/{name}"
        rows.append({**record, "runtimePath": runtime_path, "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "prompt": str(prompt.relative_to(ROOT)), "usedIn": USED_IN,
                     "status": "runtime",
                     "notes": (f"Astra Wave 8 {asset_id} {record['version']} (confirmed in assets-inbox/INBOX_LEDGER.csv) installed "
                               f"by UI-3 on 2026-09-26 from {batch.relative_to(ROOT)}; received bytes = runtime bytes (no caBX); Astra's native "
                               f"generation source SHA {record['sourceSha256']}. "
                               + (f"Runtime is the web derivative {derived[0]} made at build time from this received file by "
                                  f"scripts/keyartDerivatives.ts (judgement 2026-09-26; the PNG stays in assets-inbox only). " if derived is not None else "") +
                               f"Astra note: {record['notes'][:300]}")})
        installed.add(file)
        width, height = png_size(source)
        entry = {"url": f"assets/wave8/{group}/{name}", "width": width, "height": height}
        if derived is not None:
            scale = derived[1] or 1
            entry = {"url": derived[0], "width": int(width * scale), "height": int(height * scale)}
        images[asset_id] = entry
        if asset_id in contract:
            frame = contract[asset_id]
            left, top, right, bottom = frame["insets"]
            assert [width, height] == frame["size"], asset_id
            frames[asset_id] = {**entry, "slice": {"left": left, "top": top, "right": right, "bottom": bottom},
                                "content": [{"x": x, "y": y, "width": w, "height": h} for x, y, w, h in frame["contentRects"]],
                                "minSize": {"width": frame["minSize"][0], "height": frame["minSize"][1]}, "sourceScale": 2}
    assert len(rows) == 37, len(rows)
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    kept = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if not row["runtimePath"].startswith("public/assets/wave8/")]
    with open(LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header, lineterminator="\n")
        writer.writeheader(); writer.writerows(kept + [{key: row.get(key, "") for key in header} for row in rows])
    inbox_rows = list(csv.DictReader(open(INBOX_LEDGER, encoding="utf-8")))
    fields = list(inbox_rows[0].keys())
    marked = 0
    for row in inbox_rows:
        if row["file"] in installed:
            row["installed_by"] = "UI-3"; marked += 1
    with open(INBOX_LEDGER, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n")
        writer.writeheader(); writer.writerows(inbox_rows)
    body = lambda table: "\n".join(f"  {key}: {json.dumps(value, separators=(', ', ': '))}," for key, value in sorted(table.items()))
    MANIFEST.write_text("// Generated by scripts/installWave8.py — Wave 8 runtime art (UI-3): every image's url and size; the frames' 9-slice\n"
                        "// insets, content rects and minimum size in source pixels (sourceScale 2: drawn at half size).\n"
                        "export const WAVE8_IMAGES = {\n" + body(images) + "\n} as const;\n\n"
                        "export const WAVE8_FRAMES = {\n" + body(frames) + "\n} as const;\n")
    print(len(rows), "installed;", marked, "inbox rows marked;", len(images), "images;", len(frames), "frames")


if __name__ == "__main__":
    main()
