# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.2.0", "numpy==2.4.3"]
# ///
# How to run: python3 scripts/phase16Art.py --check (or --write).
# Uses already installed image tools; does not install project dependencies.
"""Reproduce Phase 16 registered overlays and landscape PNGs from hydrated sources."""
from __future__ import annotations

import hashlib
import io
import json
import sys
from pathlib import Path
from typing import Final

import numpy as np
from PIL import Image, ImageChops

ROOT: Final = Path(__file__).resolve().parents[1]
SOURCE: Final = ROOT / "docs/asset-evidence/phase16-sources"


def rgba(path: Path) -> Image.Image:
    """Copy decoded pixels so the input file is closed immediately."""
    with Image.open(path) as image:
        return image.convert("RGBA")


def clean(image: Image.Image) -> Image.Image:
    """Remove low-alpha presentation halos using the recorded transfer curve."""
    image.putalpha(image.getchannel("A").point(
        lambda value: max(0, min(255, round((value - 185) * 255 / 65))),
    ))
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise RuntimeError(f"No visible pixels after alpha cleanup: {image.size}")
    return image.crop(bounds)


def png(image: Image.Image) -> bytes:
    """Use the same lossless encoding settings as the first derived outputs."""
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def emit(path: Path, image: Image.Image, expected: str, write: bool) -> None:
    """Verify exact reproducibility before optionally replacing a derived file."""
    content = png(image)
    actual = hashlib.sha256(content).hexdigest()
    if actual != expected:
        raise RuntimeError(f"Reproduction mismatch for {path}: {actual} != {expected}")
    if write:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    elif path.read_bytes() != content:
        raise RuntimeError(f"Installed output differs: {path}")


def place(image: Image.Image, motif: Image.Image, center: list[int], width: int, opacity: float) -> None:
    """Place a generated motif in approved source-canvas coordinates."""
    motif = motif.resize((width, max(1, round(width * motif.height / motif.width))), Image.Resampling.LANCZOS)
    motif.putalpha(motif.getchannel("A").point(lambda value: round(value * opacity)))
    image.alpha_composite(motif, (round(center[0] - motif.width / 2), round(center[1] - motif.height / 2)))


def shutter(image: Image.Image, motif: Image.Image, quad: list[list[int]]) -> None:
    """Project the front-on generated shutter to the painted shop aperture."""
    corners = [(0, 0), (motif.width, 0), (motif.width, motif.height), (0, motif.height)]
    matrix: list[list[float]] = []
    target: list[float] = []
    for (x, y), (u, v) in zip(quad, corners, strict=True):
        matrix.extend([[x, y, 1, 0, 0, 0, -u*x, -u*y], [0, 0, 0, x, y, 1, -v*x, -v*y]])
        target.extend([u, v])
    coefficients = np.linalg.solve(np.array(matrix), np.array(target))
    image.alpha_composite(motif.transform(image.size, Image.Transform.PERSPECTIVE, coefficients, Image.Resampling.BICUBIC))


def body_path(name: str, expected_sha: str) -> Path:
    """Find a hydrated original even after B replaces public files with derivatives."""
    candidates = [ROOT / "public/assets/buildings/historical-houses" / name]
    candidates.extend((ROOT / "docs/asset-evidence").rglob(name))
    for candidate in candidates:
        if candidate.is_file() and hashlib.sha256(candidate.read_bytes()).hexdigest() == expected_sha:
            return candidate
    raise FileNotFoundError(f"Hydrate original body {name} with SHA {expected_sha}")


def regenerate(write: bool) -> None:
    """Rebuild all 33 full-canvas layers and 36 runtime PNGs from source art."""
    wear, roof, board = [clean(rgba(SOURCE / "generated" / f"condition-{name}-v1.png"))
                         for name in ("wear", "roof", "shutter")]
    records = json.loads((ROOT / "public/assets/phase16-house-condition/registration.json").read_text())
    for record in records:
        body = rgba(body_path(record["bodySource"], record["bodySha256"]))
        image = Image.new("RGBA", body.size)
        marks = record["registration"]
        mild = record["condition"] == "strained"
        place(image, wear, marks["wall"], 64 if mild else 95, .58 if mild else .85)
        if not mild:
            place(image, roof, marks["roof"], 130 if record["level"] >= 2 else 105, .92)
        if record["condition"] == "vacant":
            shutter(image, board, marks["opening"])
        image.putalpha(ImageChops.multiply(image.getchannel("A"), body.getchannel("A")))
        filename = Path(record["url"]).name
        emit(SOURCE / "registered" / filename, image, record["originalSha256"], write)
        runtime = image.resize((record["width"], record["height"]), Image.Resampling.LANCZOS)
        emit(ROOT / "public" / record["url"].lstrip("/"), runtime, record["runtimeSha256"], write)
    fields = ("assetId", "level", "lot", "condition", "url", "width", "height")
    entries = [{key: record[key] for key in fields} for record in records]
    generated = "// Generated from registered Phase 16 condition layers. Do not trim canvases.\nexport const HOUSE_CONDITION_ART = " + json.dumps(entries, indent=2) + " as const;\n"
    generated_path = ROOT / "src/render/houseConditionArt.generated.ts"
    if write:
        generated_path.write_text(generated)
    elif generated_path.read_text() != generated:
        raise RuntimeError(f"Generated manifest differs: {generated_path}")
    manifest = json.loads((ROOT / "public/assets/phase16-landscape/manifest.json").read_text())
    for record in manifest:
        source = SOURCE / "generated" / record["source"]
        if hashlib.sha256(source.read_bytes()).hexdigest() != record["sourceSha256"]:
            raise RuntimeError(f"Source changed: {source}")
        image = clean(rgba(source))
        maximum = (round(record["displayWidth"] * 3),
                   round(record["displayWidth"] * 3 * record["sourceSize"][1] / record["sourceSize"][0]))
        image.thumbnail(maximum, Image.Resampling.LANCZOS)
        emit(ROOT / "public" / record["url"].lstrip("/"), image, record["runtimeSha256"], write)
    print("Verified 33 registered layers and 36 runtime PNGs: exact SHA matches.")


if __name__ == "__main__":
    if sys.argv[1:] not in (["--check"], ["--write"]):
        raise SystemExit("Usage: python3 scripts/phase16Art.py --check|--write")
    regenerate(sys.argv[1] == "--write")
