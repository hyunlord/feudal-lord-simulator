"""INSTALL-18 (renderer A): install the Wave 18 HUD pictures (assets-inbox/wave18/candidates-v1, confirmed 2026-09-27 in
assets-inbox/INBOX_LEDGER.csv; docs/ops/install-plan-20261003/SPECS/wave18-hud.md) into public/assets/wave18/<group>/ and
the `hud-wave18` bundle of renderer B's art catalog (src/render/art/catalog.json, through scripts/lmr2ArtBundle.ts), in
the screen kinds LM-R2 added (`ui-image`; nothing added to the contract):
- main: dock_build / dock_ledger (32 css px, the action dock), pill_population / pill_food_days / pill_money (24, the
  status pill);
- reasons: no_road / overlap / water / wall_forbidden / zone_forbidden / material_shortage (20 on the map canvas,
  24 in the placement chip);
- zone: brush / polygon / erase / undo / redo (24 in the toolbar's icon box), size_small (18), size_large (14 and 18:
  the three brush sizes are small at 18, large at 14 and large at 18), paint_forbidden (14, the legend's barred land);
- crisis: six alert kinds at 36 (the crisis buttons stay 44 / 48 px);
- misc: layer_lock_badge (24), confirm_check_touch / cancel_touch (32, the tablet confirm bar), pulse_ring (288 x 96,
  three 96 px frames at x 0 / 96 / 192, each centred at 48,48 — records/assets.csv processing);
- patterns: pattern_ok / pattern_blocked_hatch / pattern_blocked_cross (64 x 32, one per tile, world px) and
  pattern_service_range_edge (128 x 16, laid along the service boundary).
Not installed (the user's decisions 2026-10-07 and pictures with no consumer or no visible change), each with the reason
in its ledger row's note (the note field only, CRLF kept): dock_steward, hud_hide, pill_season_* (pixel-identical to the
P0 cells the pill already draws — checked here), reason_tree, reason_slope_rock.
Screen art: no pivot; sizes measured on the files against records/assets.csv and the ledger SHA. The received files carry
no C2PA chunk (asserted; the install plan's INVENTORY gives metadata-stripped SHA = source SHA): received bytes = runtime
bytes. One docs/provenance/assets.csv row each (replacing earlier rows for these runtime paths) from records/assets.csv
(tool, prompts, references, processing), one prompt file each. `--installed` also writes installed_by = INSTALL-18 on the
installed rows seen in play (all but NOT_CAPTURED); run it only after the consumers and the captures are confirmed
(INSTALL_PROTOCOL 6). Rerunnable.
Run: python3 scripts/installWave18Hud.py [--installed]
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
BATCH = ROOT / "assets-inbox/wave18/candidates-v1"
RUNTIME = ROOT / "public/assets/wave18"
LEDGER = ROOT / "docs/provenance/assets.csv"
INBOX_LEDGER = ROOT / "assets-inbox/INBOX_LEDGER.csv"
BUNDLE = ROOT / "scripts/in18HudBundle.json"
CATALOG = ROOT / "src/render/art/catalog.json"
C2PA_CHUNKS = {b"caBX", b"jumb", b"c2pa"}
INSTALLED_BY = "INSTALL-18"
P0_RESOURCE_SHEET = ROOT / "public/assets/ui-p0/icon_resource_sheet.png"
USED = {
    "main": "src/ui/hud/HudShell.tsx StatusPill / ActionDock through src/ui/hud/hudArt.tsx",
    "reasons": "src/render/placementTileOverlay.ts (map canvas, via src/render/hudCanvasArt.ts); src/ui/PredictionPanel.tsx (placement chip)",
    "zone": "src/ui/hud/ZoneToolbar.tsx through src/ui/hud/hudArt.tsx",
    "crisis": "src/ui/hud/HudShell.tsx CrisisIcons (src/ui/alertStackModel.ts crisis kind) through src/ui/hud/hudArt.tsx",
    "misc": "src/ui/hud/HudShell.tsx LayerSwitch; src/ui/hud/PlacementConfirmBar.tsx; src/styles/tutorial.css pulse (src/ui/hud/hudArt.tsx)",
    "patterns": "src/render/placementTileOverlay.ts; src/render/placementPredictionOverlay.ts (via src/render/hudCanvasArt.ts)",
}
# name: (group, width, height, cssWidths) — sizes measured on the files; the CSS widths the HUD draws them at.
EXPECTED = {
    "dock_build": ("main", 96, 96, [32]), "dock_ledger": ("main", 96, 96, [32]),
    "pill_population": ("main", 96, 96, [24]), "pill_food_days": ("main", 96, 96, [24]), "pill_money": ("main", 96, 96, [24]),
    **{name: ("reasons", 96, 96, [20, 24]) for name in ("reason_no_road", "reason_overlap", "reason_water", "reason_wall_forbidden",
                                                        "reason_zone_forbidden", "reason_material_shortage")},
    **{name: ("zone", 96, 96, [24]) for name in ("zone_brush", "zone_polygon", "zone_erase", "zone_undo", "zone_redo")},
    "zone_size_small": ("zone", 96, 96, [18]), "zone_size_large": ("zone", 96, 96, [14, 18]), "zone_paint_forbidden": ("zone", 96, 96, [14]),
    **{name: ("crisis", 96, 96, [36]) for name in ("crisis_fire", "crisis_household_leaving", "crisis_construction_blocked",
                                                   "crisis_upkeep_unpaid", "crisis_storage_full", "crisis_food_shortage")},
    "layer_lock_badge": ("misc", 96, 96, [24]), "confirm_check_touch": ("misc", 96, 96, [32]), "cancel_touch": ("misc", 96, 96, [32]),
    "pulse_ring": ("misc", 288, 96, [288]),
    "pattern_ok": ("patterns", 64, 32, [64]), "pattern_blocked_hatch": ("patterns", 64, 32, [64]), "pattern_blocked_cross": ("patterns", 64, 32, [64]),
    "pattern_service_range_edge": ("patterns", 128, 16, [128]),
}
NOT_INSTALLED = {
    "main/dock_steward": "INSTALL-18 설치 안 함: 사용자 결정 2026-10-07 — 청지기는 사람이라 독은 그의 얼굴(P0 초상)을 유지한다(누구를 믿을지가 결정)",
    "misc/hud_hide": "INSTALL-18 설치 안 함: 사용자 결정 2026-10-07 — 버튼 없음(HUD 면적) · H 키 유지 · 일시 정지 메뉴에 'H: HUD 숨기기' 한 줄",
    "reasons/reason_tree": "INSTALL-18 설치 안 함: 배치 이유에 나무가 없음(숲은 지을 수 있는 땅 — src/render/placementTileMarks.ts)",
    "reasons/reason_slope_rock": "INSTALL-18 설치 안 함: 배치 이유에 경사·바위 막힘이 없음(바위는 '바위 옆이어야 함' 요구로만 나옴)",
    **{f"reused/pill_season_{season}": f"INSTALL-18 설치 안 함: 상태 알약이 이미 그리는 P0 셀(icon_resource_sheet 96px 셀 {cell})과 RGBA 픽셀 동일(해시 확인 2026-10-07) — 바뀌는 것 없음"
       for season, cell in (("spring", 5), ("summer", 6), ("autumn", 7), ("winter", 8))},
}
# Copied and wired, but not seen in play: the build menu disables a tool the town cannot pay for, so the canvas's
# materials mark only shows when the stock falls while the tool is armed — no capture yet, so no installed_by (protocol 6).
NOT_CAPTURED = {"reasons/reason_material_shortage"}
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


def season_cells_identical() -> None:
    """pill_season_*: the same RGBA pixels as the P0 sheet's cells the pill draws (so installing them changes nothing)."""
    from PIL import Image  # why: only this check decodes pixels; the copy itself is byte-for-byte
    sheet = Image.open(P0_RESOURCE_SHEET).convert("RGBA")
    for season, cell in (("spring", 5), ("summer", 6), ("autumn", 7), ("winter", 8)):
        reused = Image.open(BATCH / "assets/reused" / f"pill_season_{season}.png").convert("RGBA")
        assert reused.tobytes() == sheet.crop((cell * 96, 0, cell * 96 + 96, 96)).tobytes(), f"pill_season_{season} differs from P0 cell {cell}"


def rewrite_ledger(installed: set, notes: dict) -> list:
    """installed_by on the installed rows (the last field, empty or ours) and a note on the skipped rows (the note field,
    appended once); every other byte of the file kept (CRLF line endings, the other rows' quoting)."""
    raw = INBOX_LEDGER.read_bytes().decode("utf-8")
    lines = raw.split("\r\n")
    changed = []
    for index, line in enumerate(lines):
        # Only this batch's lines are parsed (elsewhere the file mixes in LF-only lines, which stay as they are).
        if not line.startswith("wave18,wave18/candidates-v1/assets/"):
            continue
        fields = next(csv.reader([line]))
        if len(fields) != 7 or (fields[1] not in installed and fields[1] not in notes):
            continue
        if fields[1] in installed:
            assert fields[6] in ("", INSTALLED_BY), f"{fields[1]} already installed by {fields[6]}"
            fields[6] = INSTALLED_BY
        elif INSTALLED_BY not in fields[5]:
            fields[5] = f"{fields[5]} · {notes[fields[1]]}"
        buffer = io.StringIO()
        csv.writer(buffer, lineterminator="").writerow(fields)
        lines[index] = buffer.getvalue()
        changed.append(fields[1])
    INBOX_LEDGER.write_bytes("\r\n".join(lines).encode("utf-8"))
    return changed


def splice_bundle(text: str, bundle: dict) -> str:
    """The catalog text with `bundle` in place of its namesake's block (a top-level array element: from its "  {" line to
    its "  }" line), or appended as the last element, in the tool's layout (JSON.stringify, two-space indent)."""
    block = "\n".join("  " + line for line in json.dumps(bundle, ensure_ascii=False, indent=2).split("\n"))
    marker = f'\n    "bundleId": "{bundle["bundleId"]}",'
    at = text.find(marker)
    if at < 0:
        assert text.endswith("\n  }\n]\n"), "catalog layout changed"
        return text[:-len("\n]\n")] + ",\n" + block + "\n]\n"
    start = text.rindex("\n  {\n", 0, at) + 1
    end = text.index("\n  }", at) + len("\n  }")
    return text[:start] + block + text[end:]


def prompt_text(records: list) -> str:
    if len(records) == 1:
        return records[0]["prompt"].strip() + "\n"
    return "".join(f"[{step + 1}/{len(records)} {record['rawFile']}]\n{record['prompt'].strip()}\n\n" for step, record in enumerate(records)).rstrip() + "\n"


def main() -> None:
    mark = "--installed" in sys.argv[1:]
    season_cells_identical()
    inbox = {row["file"]: row for row in csv.DictReader(open(INBOX_LEDGER, encoding="utf-8"))}
    records = {row["asset_id"]: row for row in csv.DictReader(open(BATCH / "records/assets.csv", encoding="utf-8-sig"))}
    assert len(EXPECTED) + len(NOT_INSTALLED) == len(records) == 41
    rows, entries, keys = [], [], set()
    for name, (group, width, height, css_widths) in EXPECTED.items():
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
        record = records[name]
        assert (real_width, real_height) == (width, height) == (int(record["width"]), int(record["height"])), inbox_key
        assert record["sha256"] == digest and record["file"] == f"assets/{group}/{name}.png", inbox_key
        runtime = RUNTIME / group / f"{name}.png"
        runtime.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, runtime)
        assert sha(runtime) == digest, inbox_key
        generation = json.loads(record["generation_records"])
        prompt = ROOT / "docs/provenance/prompts" / f"{name}-wave18.txt"
        prompt.write_text(prompt_text(generation))
        references = sorted({reference for step in generation for reference in step["referenceImages"]})
        processing = record["processing"]
        try:
            processing = json.dumps(json.loads(processing), ensure_ascii=False) if processing.startswith("{") else json.loads(processing)
        except json.JSONDecodeError:
            pass
        url = runtime.relative_to(ROOT / "public").as_posix()
        rows.append({"assetId": f"wave18/{group}/{name}", "version": "1", "runtimePath": str(runtime.relative_to(ROOT)), "runtimeSha256": digest,
                     "sourcePath": str(source.relative_to(ROOT)), "sourceSha256": digest, "tool": "; ".join(sorted({step["tool"] for step in generation})),
                     "model": "not exposed", "generatedAt": "2026-09-27", "prompt": str(prompt.relative_to(ROOT)), "referenceInputs": "; ".join(references),
                     "seed": "not exposed", "candidates": "1", "manualEdits": f"at delivery: {processing}",
                     "artBible": "ART_BIBLE_v2", "historicalProfile": "S_England_1300_1450_v1", "owner": "Astra", "usedIn": USED[group], "status": "runtime",
                     "notes": f"Astra wave18 {group}/{name} (confirmed in assets-inbox/INBOX_LEDGER.csv, verdict 2026-09-27) installed by "
                              f"{INSTALLED_BY} on 2026-10-07 through the art contract (catalog bundle hud-wave18, ui-image hud.{group}.{name}, css widths "
                              f"{'/'.join(str(width) for width in css_widths)}); no C2PA chunk, received bytes = runtime bytes; {width} x {height}. "
                              "The batch records give the verdict date, not a generation time."})
        entries.append({"id": f"hud.{group}.{name}", "kind": "ui-image", "image": {"url": url, "width": width, "height": height},
                        "provenance": {"inboxFile": f"assets-inbox/{inbox_key}", "sourceSha256": digest, "runtimeSha256": digest},
                        "cssWidths": css_widths, "derivatives": []})
        keys.add(inbox_key)
    notes = {f"wave18/candidates-v1/assets/{name}.png": note for name, note in NOT_INSTALLED.items()}
    for key in notes:
        assert inbox[key]["status"] == "confirmed" and inbox[key]["installed_by"] == "", key
    bundle = {"schemaVersion": 1, "bundleId": "hud-wave18", "entries": entries, "rules": []}
    BUNDLE.write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n")
    before = CATALOG.read_bytes().decode("utf-8")
    # The tool validates the whole catalog with this bundle (schema, registry, files) and writes it re-serialised; the
    # catalog then keeps every other bundle's bytes as they were, with only this bundle's block replaced or appended.
    subprocess.run(["node_modules/.bin/tsx", "scripts/lmr2ArtBundle.ts", str(BUNDLE.relative_to(ROOT))], cwd=ROOT, check=True)
    validated = json.loads(CATALOG.read_text())
    CATALOG.write_bytes(splice_bundle(before, bundle).encode("utf-8"))
    assert json.loads(CATALOG.read_text()) == validated, "spliced catalog differs from the validated one"
    header = next(csv.reader(open(LEDGER, encoding="utf-8")))
    # Only this batch's rows (assetId wave18/…) are replaced; every other line keeps its bytes.
    kept = [line for line in LEDGER.read_bytes().decode("utf-8").splitlines(keepends=True) if not line.startswith("wave18/")]
    buffer = io.StringIO()
    csv.DictWriter(buffer, fieldnames=header, lineterminator="\n").writerows([{key: row.get(key, "") for key in header} for row in rows])
    LEDGER.write_bytes(("".join(kept) + buffer.getvalue()).encode("utf-8"))
    captured = {key for key in keys if key.removeprefix("wave18/candidates-v1/assets/").removesuffix(".png") not in NOT_CAPTURED}
    changed = rewrite_ledger(captured if mark else set(), notes)
    print(json.dumps({"installed": len(keys), "ledgerChanged": sorted(changed)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
