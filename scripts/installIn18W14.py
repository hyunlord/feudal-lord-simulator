"""INSTALL-18 (Wave 14 leftovers, renderer A): the chronicle's faction panel and four faction-kind icons through renderer
B's art contract (src/render/art: the `ui-frame` and `ui-image` kinds; scripts/lmr2ArtBundle.ts puts the bundle in
catalog.json), and a ledger note on each Wave 14 leftover that is not installed (why).
- wave14/candidates-v1 (confirmed 2026-09-26 in assets-inbox/INBOX_LEDGER.csv; docs/ops/install-plan-20261003/SPECS/wave14-ui.md):
  frame_faction_panel (384 x 256, nine-slice t60 r20 b20 l20 from records/metadata-frames.json) around the faction tab's list;
  icon_faction_crown / church / merchant_elite / commune (96 x 96) beside a faction's name, by the engine's faction kind
  (src/ui/chronicle/factionArt.ts says which kind and why). Drawn at 24 (the tab's rows) and 32 (the faction page) CSS px.
Runtime paths: the install plan's targets (INVENTORY.csv target_path, public/assets/wave14/<group>/<file>). Screen art: no
pivot. The received files carry no C2PA chunk (asserted; the inventory's metadata-stripped SHA equals the source SHA):
received bytes = runtime bytes. The records give no content rect for the frame, so its content inset is the slice.
One docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths) from records/metadata-*.json, one
prompt file each. Every run writes the not-installed notes (NOT_INSTALLED: the ledger's verdict_note only, the reason
appended once). `--installed` also writes installed_by = the inventory's installed_by_proposed on the five installed rows
(only that field; CRLF kept); run it only after the consumer and the captures are confirmed (INSTALL_PROTOCOL 6).
Run: python3 scripts/installIn18W14.py [--installed]
"""
import csv
import hashlib
import io
import json
import shutil
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "assets-inbox/wave14/candidates-v1"
RUNTIME = ROOT / "public/assets/wave14"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
BUNDLE = ROOT / "scripts/in18W14Bundle.json"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
INSTALLED_BY = "INSTALL-WAVE14-20261003"  # INVENTORY.csv installed_by_proposed for these rows
USED_IN = "src/ui/chronicle/FactionTab.tsx; src/ui/chronicle/FactionPage.tsx; src/ui/chronicle/factionArt.ts (INSTALL-18: the chronicle's faction tab panel and faction-kind icons)"
# name: (group, file, width, height, record file, nine-slice t|r|b|l or None, ui kind fields) — sizes measured on the
# files, the slices from records/metadata-frames.json, the CSS widths the screens draw them at.
EXPECTED = {
    "frame_faction_panel": ("ui-frames", "frame_faction_panel-v1.png", 384, 256, "metadata-frames.json", (60, 20, 20, 20),
                            {"kind": "ui-frame", "scale": 1, "centre": "fill", "repeat": "stretch"}),
    "icon_faction_crown": ("ui-icons", "icon_faction_crown-v1.png", 96, 96, "metadata-icons.json", None, {"kind": "ui-image", "cssWidths": [24, 32]}),
    "icon_faction_church": ("ui-icons", "icon_faction_church-v1.png", 96, 96, "metadata-icons.json", None, {"kind": "ui-image", "cssWidths": [24, 32]}),
    "icon_faction_merchant_elite": ("ui-icons", "icon_faction_merchant_elite-v1.png", 96, 96, "metadata-icons.json", None, {"kind": "ui-image", "cssWidths": [24, 32]}),
    "icon_faction_commune": ("ui-icons", "icon_faction_commune-v1.png", 96, 96, "metadata-icons.json", None, {"kind": "ui-image", "cssWidths": [24, 32]}),
}
CATALOG_ID = {
    "frame_faction_panel": "wave14.faction.panel", "icon_faction_crown": "wave14.faction.crown", "icon_faction_church": "wave14.faction.church",
    "icon_faction_merchant_elite": "wave14.faction.merchant_elite", "icon_faction_commune": "wave14.faction.commune",
}
MARK = "미설치(INSTALL-18 2026-10-07)"
# Wave 14 leftovers not installed: the reason, appended to verdict_note (no commas: the ledger is split on them).
NOT_INSTALLED = {
    "wave14/candidates-v1/assets/ui-icons/icon_faction_lord_household-v1.png":
        "엔진 세력 종류(FACTION_KINDS)에 영주 자신의 가문이 없음 — 상위 영주·이웃 영주는 다른 가문이라 붙이지 않음",
    "wave14/candidates-v1/assets/ui-frames/frame_charter-v1.png":
        "문서는 도시에 넘어간 특허 권리(lordshipModel rightsTransfer)인데 512×640(원본 아래로 줄이지 않음) 칸을 가진 화면이 없음(장부 서랍 최대 높이 560 px) — 특허 화면은 판정 대기",
    **{f"wave14/candidates-v1/assets/seals/seal_town_{name}.png":
       "도시가 인장의 가운데 그림(성문·배·교회·다리)과 테두리(둥근·뾰족 타원)를 고르는 엔진 값도 seed 규칙도 없음 — 질문으로 넘김"
       for name in ("round", "pointed_oval", "center_gate", "center_ship", "center_church", "center_bridge")},
    "wave14/candidates-v1/assets/ui-frames/frame_grievance_ledger-v1.png": "원한 기록부 화면 없음",
    "wave14/texture-rework-20260926/assets/merchant/merchant_carved_texture.png":
        "조각된 간판 표면의 소비자 미정(월드일 수 있음) — 렌더 B 목록",
    "wave14/candidates-v1/assets/heraldry/ordinary_bordure.png": "별도 사양 SPECS/wave14-bordure.md(방패 UV 매핑) — 이번 범위 밖",
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


def edit_ledger(installed: set, notes: dict) -> tuple:
    """installed_by on exactly `installed` (the last field, empty or ours) and the reason once on `notes` rows' verdict_note."""
    lines = INBOX_LEDGER.read_bytes().decode("utf-8").split("\r\n")
    marked, noted = [], []
    for index, line in enumerate(lines):
        fields = line.split(",")
        if len(fields) < 3 or (fields[1] not in installed and fields[1] not in notes):
            continue
        assert len(fields) == 7, f"{fields[1]}: {len(fields)} fields"
        if fields[1] in installed:
            assert fields[6] in ("", INSTALLED_BY), f"{fields[1]} already installed by {fields[6]}"
            fields[6] = INSTALLED_BY
            marked.append(fields[1])
        else:
            assert fields[6] == "", f"{fields[1]} installed by {fields[6]}: no not-installed note"
            if MARK not in fields[5]:
                fields[5] = f"{fields[5]}; {MARK}: {notes[fields[1]]}"
            noted.append(fields[1])
        lines[index] = ",".join(fields)
    assert sorted(marked) == sorted(installed), f"rows not found: {sorted(set(installed) - set(marked))}"
    assert sorted(noted) == sorted(notes), f"rows not found: {sorted(set(notes) - set(noted))}"
    INBOX_LEDGER.write_bytes("\r\n".join(lines).encode("utf-8"))
    return marked, noted


BUNDLE_ID = "ui-wave14-factions"
CATALOG = ROOT / "src/render/art/catalog.json"
VALIDATE = ("import { readFileSync } from 'node:fs'; import { upsertCatalogBundle } from './scripts/lmr2ArtBundle';"
            "upsertCatalogBundle(process.cwd(), readFileSync('src/render/art/catalog.json', 'utf8'), JSON.parse(readFileSync(process.argv[1], 'utf8')));")


def splice_catalog(bundle: dict) -> None:
    """The bundle in catalog.json by text: replaces its own earlier text or goes last; every other bundle byte for byte."""
    text = CATALOG.read_text(encoding="utf-8")
    body = "\n".join("  " + line for line in json.dumps(bundle, ensure_ascii=False, indent=2).split("\n"))
    head = f'  {{\n    "schemaVersion": 1,\n    "bundleId": "{BUNDLE_ID}",'
    start = text.find(head)
    if start < 0:
        end = text.rstrip().rfind("]")
        before = text[:end].rstrip()
        text = f"{before},\n{body}\n]\n"
    else:
        depth, index = 0, start + 2
        while True:  # the bundle's closing brace (no braces inside its strings: ids, URLs, hashes)
            depth += {"{": 1, "}": -1}.get(text[index], 0)
            if depth == 0:
                break
            index += 1
        text = text[:start] + body + text[index + 1:]
    json.loads(text)
    CATALOG.write_text(text, encoding="utf-8")


def write_provenance(rows: list) -> None:
    """Our rows (one physical line each) replace their earlier lines or go last; every other line byte for byte."""
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    ours = {row["runtimePath"] for row in rows}
    others = [row for row in csv.DictReader(open(LEDGER, encoding="utf-8")) if row["runtimePath"] in ours and not row["assetId"].startswith("wave14/")]
    assert others == [], f"runtime paths already provenanced by others: {[row['assetId'] for row in others]}"
    prefixes = tuple(f"{row['assetId']},{row['version']},{row['runtimePath']}," for row in rows)
    lines = [line for line in LEDGER.read_bytes().decode("utf-8").split("\n") if not line.startswith(prefixes)]  # CRs kept
    while lines and lines[-1] == "":
        lines.pop()
    out = io.StringIO()
    csv.DictWriter(out, fieldnames=header, lineterminator="\n").writerows([{key: row.get(key, "") for key in header} for row in rows])
    LEDGER.write_bytes(("\n".join(lines) + "\n" + out.getvalue()).encode("utf-8"))


def main() -> None:
    mark = "--installed" in sys.argv[1:]
    inbox = {row["file"]: row for row in csv.DictReader(open(INBOX_LEDGER, encoding="utf-8"))}
    records = {name: {entry["id"].removesuffix("-v1"): entry for entry in json.loads((BATCH / "records" / name).read_text())}
               for name in ("metadata-frames.json", "metadata-icons.json")}
    rows, entries, keys = [], [], set()
    for name, (group, file, width, height, record_file, nine, ui) in EXPECTED.items():
        source = BATCH / "assets" / group / file
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
        record = records[record_file][name]
        assert (record["width"], record["height"]) == (width, height), name
        if nine is not None:
            assert tuple(record["nineSlice"]["insetsTopRightBottomLeft"]) == nine, name
        runtime = RUNTIME / group / file
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, inbox_key
        generation = record["generationRecords"][0]
        prompt = ROOT / "docs/provenance/prompts" / f"{name}-wave14.txt"
        prompt.write_text(generation["prompt"].strip() + "\n")
        url = runtime.relative_to(ROOT / "public").as_posix()
        catalog_id = CATALOG_ID[name]
        rows.append({"assetId": f"wave14/{group}/{name}", "version": "v1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": generation["tool"], "model": "not exposed",
                     "generatedAt": "", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": "; ".join(generation["referenceImages"]),
                     "seed": "not exposed", "candidates": "1", "manualEdits": json.dumps(record["processing"], ensure_ascii=False),
                     "artBible": "AB_2026-09-19_v1", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra wave14", "usedIn": USED_IN, "status": "runtime",
                     "notes": f"Astra wave14 {name} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-26) installed by INSTALL-18 (renderer A) "
                              f"on 2026-10-07 through the art contract (catalog bundle ui-wave14-factions, {ui['kind']} {catalog_id}); "
                              f"no C2PA chunk, received bytes = runtime bytes; {width} x {height}"
                              + (f", nine-slice t{nine[0]} r{nine[1]} b{nine[2]} l{nine[3]} (records/metadata-frames.json; no content rect in the records, so the content inset is the slice)" if nine is not None else "")
                              + ". The batch records give no generation time."})
        base = {"id": catalog_id, "kind": ui["kind"], "image": {"url": url, "width": width, "height": height},
                "provenance": {"inboxFile": f"assets-inbox/{inbox_key}", "sourceSha256": digest, "runtimeSha256": digest}}
        if ui["kind"] == "ui-frame":
            top, right, bottom, left = nine
            sides = {"top": top, "right": right, "bottom": bottom, "left": left}
            base.update({"slice": sides, "scale": ui["scale"], "contentInset": dict(sides), "centre": ui["centre"], "repeat": ui["repeat"]})
        else:
            base.update({"cssWidths": ui["cssWidths"], "derivatives": []})
        entries.append(base)
        keys.add(inbox_key)
    bundle = {"schemaVersion": 1, "bundleId": BUNDLE_ID, "entries": entries, "rules": []}
    BUNDLE.write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n")
    splice_catalog(bundle)
    # The whole catalog still builds a registry and this bundle's files match their contract (scripts/lmr2ArtBundle.ts).
    subprocess.run(["node_modules/.bin/tsx", "-e", VALIDATE, str(BUNDLE.relative_to(ROOT))], cwd=ROOT, check=True)
    write_provenance(rows)
    marked, noted = edit_ledger(keys if mark else set(), NOT_INSTALLED)
    print(json.dumps({"installed": sorted(keys), "ledgerMarked": sorted(marked), "notInstalledNoted": sorted(noted)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
