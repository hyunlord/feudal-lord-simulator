"""Build the Wave7 autumn leaf old3 catalog bundle only.

This helper reads the canonical Wave7 candidates-v1 record rows for leaves_a/b/c,
verifies the current source and runtime files match their pinned bytes and native
sizes, and replaces only the `wave7-seasonal-ground-old3` bundle in
src/render/art/catalog.json. It never writes public assets, provenance, prompts,
ledgers, or the generated Wave7 manifest.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import struct
from pathlib import Path
from typing import Any, Final, TypedDict

ROOT: Final = Path(__file__).resolve().parent.parent
CATALOG: Final = ROOT / "src/render/art/catalog.json"
RECORDS: Final = ROOT / "assets-inbox/wave7/candidates-v1/records/assets.csv"
BUNDLE_ID: Final = "wave7-seasonal-ground-old3"
RULE_ID: Final = "wave7-seasonal-leaves-autumn"
LEAVES: Final = (
    ("leaves_a", "assets/season/leaves_a-v1.png", "95f8a92da9c6a7476666d70aaeac444005d50c6dcaced9740b92d3880b0cc0be"),
    ("leaves_b", "assets/season/leaves_b-v1.png", "46655eb8036284018d0e3b7a8e4250ef0408f604cb275c74bd3cfbe0d5975222"),
    ("leaves_c", "assets/season/leaves_c-v1.png", "ae47f56c0b476891280101cf0d3b9ca3aa2a46a72cfb644894ed0cbfb39ab84d"),
)


class Record(TypedDict):
    file: str
    sha256: str
    width: str
    height: str


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:24]
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Expected PNG: {path}")
    return struct.unpack(">II", data[16:24])


def records_by_file(records_path: Path) -> dict[str, Record]:
    rows: dict[str, Record] = {}
    with records_path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            file = row.get("file", "")
            if file in rows:
                raise ValueError(f"Duplicate Wave7 record file: {file}")
            rows[file] = Record(file=file, sha256=row.get("sha256", ""), width=row.get("width", ""), height=row.get("height", ""))
    return rows


def leaf_entry(root: Path, records: dict[str, Record], asset_id: str, record_file: str, expected_sha: str) -> dict[str, Any]:
    record = records.get(record_file)
    if record is None:
        raise ValueError(f"Missing canonical Wave7 record: {record_file}")
    if record["sha256"] != expected_sha:
        raise ValueError(f"Canonical record SHA mismatch for {record_file}")
    width = int(record["width"])
    height = int(record["height"])
    if (width, height) != (96, 48):
        raise ValueError(f"Canonical record dimensions mismatch for {record_file}: {width}x{height}")
    source = root / "assets-inbox/wave7/candidates-v1" / record_file
    runtime = root / "public/assets/wave7/season" / f"{asset_id}-v1.png"
    for label, path in (("source", source), ("runtime", runtime)):
        digest = sha256(path)
        if digest != expected_sha:
            raise ValueError(f"{label} SHA mismatch for {asset_id}: {digest}")
        if png_size(path) != (96, 48):
            raise ValueError(f"{label} native size mismatch for {asset_id}: {png_size(path)}")
    return {
        "id": asset_id,
        "kind": "ground-prop",
        "placement": "seasonal-ground",
        "season": "autumn",
        "image": {"url": f"assets/wave7/season/{asset_id}-v1.png", "width": 96, "height": 48},
        "provenance": {"inboxFile": f"assets-inbox/wave7/candidates-v1/{record_file}", "sourceSha256": expected_sha, "runtimeSha256": expected_sha},
        "geometry": {"pivot": {"x": 48, "y": 46}, "scale": 0.5, "allowMirror": False},
    }


def build_bundle(root: Path, records_path: Path) -> dict[str, Any]:
    records = records_by_file(records_path)
    entries = [leaf_entry(root, records, asset_id, record_file, expected_sha) for asset_id, record_file, expected_sha in LEAVES]
    return {
        "schemaVersion": 1,
        "bundleId": BUNDLE_ID,
        "entries": entries,
        "rules": [{
            "id": RULE_ID,
            "kind": "ground-prop",
            "slot": "seasonal-leaves",
            "priority": 0,
            "conditions": [
                {"op": "eq", "field": "season", "value": "autumn"},
                {"op": "eq", "field": "placement", "value": "seasonal-ground"},
            ],
            "variants": [{"assetId": asset_id, "weight": 1} for asset_id, _, _ in LEAVES],
            "fallback": "none",
        }],
    }


def update_catalog(catalog_path: Path, bundle: dict[str, Any]) -> bool:
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    if not isinstance(catalog, list):
        raise ValueError("Catalog must be a bundle array")
    output: list[Any] = []
    replaced = False
    for existing in catalog:
        if isinstance(existing, dict) and existing.get("bundleId") == BUNDLE_ID:
            if replaced:
                raise ValueError(f"Duplicate existing bundle {BUNDLE_ID}")
            output.append(bundle)
            replaced = True
        else:
            output.append(existing)
    if not replaced:
        output.append(bundle)
    rendered = json.dumps(output, indent=2, ensure_ascii=False) + "\n"
    changed = rendered != catalog_path.read_text(encoding="utf-8")
    if changed:
        catalog_path.write_text(rendered, encoding="utf-8")
    return changed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--records", type=Path, default=None)
    parser.add_argument("--catalog", type=Path, default=None)
    args = parser.parse_args()
    root = args.root.resolve()
    records = args.records.resolve() if args.records else root / RECORDS.relative_to(ROOT)
    catalog = args.catalog.resolve() if args.catalog else root / CATALOG.relative_to(ROOT)
    changed = update_catalog(catalog, build_bundle(root, records))
    print(json.dumps({"bundleId": BUNDLE_ID, "entries": len(LEAVES), "changed": changed}, separators=(",", ":")))


if __name__ == "__main__":
    main()
