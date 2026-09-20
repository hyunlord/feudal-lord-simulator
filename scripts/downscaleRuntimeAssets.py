"""Preserve authored registrations while deriving deterministic Lanczos runtime PNGs.

Run --capture once to archive new originals, then --write or --verify. Existing
archives are never replaced. Pillow must already be installed; no install occurs.
"""
from __future__ import annotations

import hashlib
import io
import json
import math
import sys
from pathlib import Path
from typing import Final, TypedDict, NotRequired

from PIL import Image

ROOT: Final = Path(__file__).resolve().parents[1]
ARCHIVE: Final = ROOT / "docs/asset-evidence/runtime-sources"
MANIFEST: Final = ARCHIVE / "derivatives.json"
FAMILIES: Final = (
    "buildings/historical-houses", "buildings/historical-facilities-v1",
    "buildings/historical-farm", "buildings/historical-gate",
    "buildings/historical-wall", "buildings/runtime-mill-v1",
    "complete-art-v1", "runtime-actors-v1", "runtime-construction-v1",
)

class Bounds(TypedDict):
    x: int
    y: int
    width: int
    height: int

class Frame(TypedDict):
    source: Bounds

class AuthoredAsset(TypedDict):
    url: str
    width: int
    alphaBounds: Bounds
    source: Bounds
    displayWidth: float
    frames: list[Frame]

class Manifest(TypedDict):
    filter: str
    assets: list[Derivative]

class Derivative(TypedDict):
    url: str
    source: str
    originalWidth: int
    originalHeight: int
    originalAlphaBounds: Bounds
    originalSha256: str
    width: int
    height: int
    alphaBounds: Bounds
    sha256: str
    targetCanvasWidth: int


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def bounds(image: Image.Image) -> Bounds:
    box = image.getchannel("A").getbbox()
    if box is None:
        return {"x": 0, "y": 0, "width": 0, "height": 0}
    x, y, right, bottom = box
    return {"x": x, "y": y, "width": right - x, "height": bottom - y}


def authored_array(filename: str) -> list[AuthoredAsset]:
    text = (ROOT / "src/render" / filename).read_text()
    start = text.index("= [") + 2
    end = text.rindex("]") + 1
    return json.loads(text[start:end])


def target_widths() -> dict[str, int]:
    targets: dict[str, int] = {}
    for filename, visible_width in (
        ("historicalHouseAssetManifest.generated.ts", 64 * 0.88),
        ("houseCompoundAssetManifest.generated.ts", 96 * 0.88),
    ):
        for asset in authored_array(filename):
            targets[asset["url"]] = math.ceil(asset["width"] * visible_width * 2 / asset["alphaBounds"]["width"])
    for asset in authored_array("historicalFacilityManifest.ts"):
        targets[asset["url"]] = math.ceil(asset["width"] * asset["displayWidth"] * 2 / asset["source"]["width"])
    for asset in authored_array("runtimeActorManifest.generated.ts"):
        # Full sheet preserves independent poses, feet and cart handles. 64px per
        # frame is twice nominal height before the existing 0.55 world scale.
        minimum_height = min(frame["source"]["height"] for frame in asset["frames"])
        targets[asset["url"]] = math.ceil(asset["width"] * 64 / minimum_height)
    return targets


def fallback_width(relative: str) -> int:
    if "runtime-mill-v1/mill_body" in relative:
        return 136
    if "runtime-mill-v1/mill_sails" in relative:
        return 104
    if "historical-farm/layers/" in relative:
        return 128  # Retain headroom for the existing 64px canopy source buffer.
    if "historical-farm" in relative:
        return 384  # 2x full plot canvas including authored transparent margin.
    if "historical-wall" in relative:
        return 512  # Stone material crop is magnified separately; preserve texture.
    if "historical-gate" in relative:
        return 512  # Stretched gate flanks share the same authored registration.
    return 512  # Registered multi-part sheets, including transparent gutters.


def generate(runtime: Path, capture: bool, verify: bool, targets: dict[str, int]) -> Derivative:
    relative = runtime.relative_to(ROOT / "public/assets")
    source = ARCHIVE / relative
    if not source.exists():
        if not capture:
            raise RuntimeError(f"Missing immutable original: {source}; use --capture before any resizing")
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_bytes(runtime.read_bytes())
    original = source.read_bytes()
    with Image.open(io.BytesIO(original)) as opened:
        image = opened.convert("RGBA")
    url = f"assets/{relative.as_posix()}"
    target = min(image.width, targets.get(url, fallback_width(relative.as_posix())))
    size = (target, max(1, round(image.height * target / image.width)))
    resized = image.resize(size, Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    resized.save(buffer, format="PNG", optimize=False, compress_level=9)
    data = buffer.getvalue()
    if verify:
        if runtime.read_bytes() != data:
            raise RuntimeError(f"Non-reproducible derivative: {runtime}")
    else:
        runtime.write_bytes(data)
    return {
        "url": url, "source": source.relative_to(ROOT).as_posix(),
        "originalWidth": image.width, "originalHeight": image.height,
        "originalAlphaBounds": bounds(image), "originalSha256": digest(original),
        "width": resized.width, "height": resized.height,
        "alphaBounds": bounds(resized), "sha256": digest(data), "targetCanvasWidth": target,
    }


def main() -> None:
    argv = sys.argv[1:]
    family = None
    if "--family" in argv:
        index = argv.index("--family")
        family = argv[index + 1]
        del argv[index:index + 2]
        if family not in FAMILIES:
            raise RuntimeError(f"Unknown asset family: {family}")
    args = set(argv)
    if not args or args - {"--capture", "--write", "--verify"} or ("--write" in args and "--verify" in args):
        raise RuntimeError("Usage: python3 scripts/downscaleRuntimeAssets.py [--capture] --write|--verify")
    verify = "--verify" in args
    targets = target_widths()
    families = (family,) if family else FAMILIES
    previous: Manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"filter": "", "assets": []}
    for entry in previous["assets"]:
        if digest((ROOT / entry["source"]).read_bytes()) != entry["originalSha256"]:
            raise RuntimeError(f"Immutable source changed: {entry['source']}")
    files = sorted(path for item in families for path in (ROOT / "public/assets" / item).rglob("*.png"))
    replacements = [generate(path, "--capture" in args, verify, targets) for path in files]
    replaced = {row["url"] for row in replacements}
    rows = sorted([row for row in previous["assets"] if row["url"] not in replaced] + replacements, key=lambda row: row["url"])
    payload = json.dumps({"filter": "Pillow LANCZOS RGBA PNG compression=9", "assets": rows}, indent=2) + "\n"
    runtime_rows = [{key: row[key] for key in ("url", "originalWidth", "originalHeight", "width", "height", "originalSha256", "sha256")} for row in rows]
    generated = "// Generated by scripts/downscaleRuntimeAssets.py; authored coordinates remain unchanged.\n"
    generated += "export type RuntimeAssetDerivative = Readonly<{ url: string; originalWidth: number; originalHeight: number; width: number; height: number; originalSha256: string; sha256: string }>;\n"
    generated += "export const runtimeAssetDerivatives: readonly RuntimeAssetDerivative[] = " + json.dumps(runtime_rows, separators=(",", ":")) + ";\n"
    generated_path = ROOT / "src/render/runtimeAssetDerivatives.generated.ts"
    for path, text in ((MANIFEST, payload), (generated_path, generated)):
        if verify:
            if path.read_text() != text:
                raise RuntimeError(f"Stale generated metadata: {path}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
    print(json.dumps({"files": len(rows), "sourceBytes": sum((ROOT / row["source"]).stat().st_size for row in rows), "runtimeBytes": sum((ROOT / "public" / row["url"]).stat().st_size for row in rows), "verified": verify}))


if __name__ == "__main__":
    main()
