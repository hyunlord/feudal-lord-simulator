#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow", "numpy", "scipy"]
# ///
# Run with the existing environment (no installation):
# python3 register_assets.py --root /tmp/astra-landmark-growth-20261003-work
# Use --output-root /tmp/registration-test to isolate generated artifacts.
"""Register whole seasonal landmark paintings without altering their parts."""
from __future__ import annotations

import argparse  # Standard library CLI: no new dependencies are authorized.
import csv
import hashlib
import json
import math
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Final

import numpy as np
from numpy.typing import NDArray
from PIL import Image
from scipy.optimize import minimize

CANVAS: Final = 2048
PIVOT: Final = (768, 1536)
WORLD_SCALE: Final = 0.25
THRESHOLD: Final = 0.95


@dataclass(frozen=True, slots=True)
class Registration:
    family: str
    stage: int
    anchor_x: float
    anchor_y: float
    source_scale: float
    footprint_w: float
    footprint_d: float
    expansion_rule: str
    anchor_kind: str


@dataclass(frozen=True, slots=True)
class Transform:
    scale: float
    dx: float
    dy: float


@dataclass(frozen=True, slots=True)
class ContractError(Exception):
    detail: str

    def __str__(self) -> str:
        return self.detail


def registrations(path: Path, expected: int) -> list[Registration]:
    """Parse the bounded JSON contract before any image output is written."""
    data = json.loads(path.read_text())
    if not isinstance(data, list) or len(data) != expected:
        raise ContractError(f"Expected {expected} registration entries")
    result: list[Registration] = []
    for item in data:
        if not isinstance(item, dict) or set(item) != set(Registration.__annotations__):
            raise ContractError("Registration fields do not match the contract")
        entry = Registration(**item)
        if not isinstance(entry.family, str) or not re.fullmatch(r"[a-z][a-z0-9_]*", entry.family):
            raise ContractError("Unsafe family identifier")
        if type(entry.stage) is not int or not 0 <= entry.stage <= 9:
            raise ContractError("stage must be an integer from 0 through 9")
        for name in ("anchor_x", "anchor_y", "source_scale", "footprint_w", "footprint_d"):
            number = getattr(entry, name)
            if type(number) not in (int, float) or not math.isfinite(number):
                raise ContractError(f"{name} must be finite")
        if min(entry.source_scale, entry.footprint_w, entry.footprint_d) <= 0:
            raise ContractError("Scale and footprint must be positive")
        if min(entry.anchor_x, entry.anchor_y) < 0:
            raise ContractError("Anchor must be nonnegative")
        if not isinstance(entry.expansion_rule, str) or not isinstance(entry.anchor_kind, str):
            raise ContractError("Anchor and expansion descriptions must be strings")
        result.append(entry)
    if len({(r.family, r.stage) for r in result}) != expected:
        raise ContractError("Duplicate family/stage registration")
    return result


def source(path: Path) -> Image.Image:
    """Require a nonempty transparent PNG; never remove backgrounds."""
    with Image.open(path) as opened:
        if opened.format != "PNG" or "A" not in opened.getbands():
            raise ContractError(f"Expected alpha PNG: {path}")
        image = opened.convert("RGBA")
    alpha = np.asarray(image.getchannel("A"))
    if alpha.max() == 0 or alpha.min() > 0:
        raise ContractError(f"Empty or opaque-background input: {path}")
    if np.any(alpha[0] > 32) or np.any(alpha[-1] > 32) or np.any(alpha[:, 0] > 32) or np.any(alpha[:, -1] > 32):
        raise ContractError(f"Source alpha touches canvas boundary: {path}")
    return image


def warp(image: Image.Image, transform: Transform, size: int) -> Image.Image:
    """Apply one uniform affine map; use premultiplied color for clean alpha edges."""
    t = transform
    return image.transform((size, size), Image.Transform.AFFINE,
                           (1 / t.scale, 0, -t.dx / t.scale, 0, 1 / t.scale, -t.dy / t.scale),
                           resample=Image.Resampling.BICUBIC)


def fit_winter(summer: Image.Image, winter: Image.Image) -> Transform:
    """Fit winter to summer alpha with bounded scale/translation only, no rotation."""
    side = 256
    factors = [side / max(image.size) for image in (summer, winter)]
    masks = []
    for image, factor in zip((summer, winter), factors, strict=True):
        masks.append(warp(image.getchannel("A"), Transform(factor, 0, 0), side))
    a, b = masks
    ab, bb = a.getbbox(), b.getbbox()
    if ab is None or bb is None:
        raise ContractError("Empty alpha silhouette")
    scale = math.sqrt(((ab[2] - ab[0]) * (ab[3] - ab[1])) / ((bb[2] - bb[0]) * (bb[3] - bb[1])))
    initial = [scale, (ab[0] + ab[2] - scale * (bb[0] + bb[2])) / 2,
               (ab[1] + ab[3] - scale * (bb[1] + bb[3])) / 2]
    target = np.asarray(a, dtype=np.float64) / 255

    def loss(values: NDArray[np.float64]) -> float:
        transformed = np.asarray(warp(b, Transform(*map(float, values)), side), dtype=np.float64) / 255
        return 1 - float(np.minimum(target, transformed).sum() / np.maximum(target, transformed).sum())

    optimized = minimize(loss, initial, method="Powell", bounds=[(scale * .7, scale * 1.3),
                         (initial[1] - 40, initial[1] + 40), (initial[2] - 40, initial[2] + 40)],
                         options={"xtol": 1e-5, "ftol": 1e-7, "maxiter": 120})
    candidates = [np.array(initial), optimized.x]
    best = min(candidates, key=loss)
    return Transform(float(best[0]) * factors[1] / factors[0],
                     float(best[1]) / factors[0], float(best[2]) / factors[0])


def clipped(image: Image.Image, transform: Transform) -> bool:
    """Detect lost source support analytically, including bicubic filter allowance."""
    bbox = image.getchannel("A").point(lambda value: 255 if value > 32 else 0).getbbox()
    if bbox is None:
        return True
    x0, y0, x1, y1 = bbox
    return min(x0 * transform.scale + transform.dx, y0 * transform.scale + transform.dy) < 2 or max(
        x1 * transform.scale + transform.dx, y1 * transform.scale + transform.dy) > CANVAS - 2


def run(root: Path, output: Path, expected: int) -> bool:
    """Produce fixed-canvas PNGs, manifest, and honest per-pair residual measurements."""
    entries = registrations(root / "records/registration.json", expected)
    assets, records = output / "assets", output / "records"
    assets.mkdir(parents=True, exist_ok=True)
    records.mkdir(parents=True, exist_ok=True)
    rows = []
    results = []
    passed = True
    for entry in entries:
        prefix = f"{entry.family}_s{entry.stage:02d}"
        paths = [root / "raw" / f"{prefix}_{season}.png" for season in ("summer", "winter")]
        summer, winter = (source(path) for path in paths)
        if entry.anchor_x > summer.width or entry.anchor_y > summer.height:
            raise ContractError(f"Anchor outside summer source: {prefix}")
        correction = fit_winter(summer, winter)
        base = Transform(entry.source_scale, PIVOT[0] - entry.source_scale * entry.anchor_x,
                         PIVOT[1] - entry.source_scale * entry.anchor_y)
        winter_transform = Transform(base.scale * correction.scale, base.dx + base.scale * correction.dx,
                                     base.dy + base.scale * correction.dy)
        transforms = (base, winter_transform)
        images = [warp(image.convert("RGBa"), transform, CANVAS).convert("RGBA")
                  for image, transform in zip((summer, winter), transforms, strict=True)]
        masks = [np.asarray(image.getchannel("A")) >= 128 for image in images]
        union = int(np.logical_or(*masks).sum())
        iou = float(np.logical_and(*masks).sum() / union) if union else 0.0
        clipping = [clipped(image, transform) for image, transform in zip((summer, winter), transforms, strict=True)]
        pair_pass = iou >= THRESHOLD and not any(clipping)
        passed = passed and pair_pass
        for index, season in enumerate(("summer", "winter")):
            filename = f"{prefix}_{season}.png"
            images[index].save(assets / filename)
            rows.append(dict(filename=filename, family=entry.family, stage=entry.stage, season=season,
                             canvas_width=CANVAS, canvas_height=CANVAS, pivot_x=PIVOT[0], pivot_y=PIVOT[1],
                             world_scale=WORLD_SCALE, footprint_w=entry.footprint_w, footprint_d=entry.footprint_d,
                             expansion_rule=entry.expansion_rule, anchor_kind=entry.anchor_kind))
        results.append(dict(family=entry.family, stage=entry.stage, winter_to_summer=asdict(correction),
                            source_to_registered=[asdict(t) for t in transforms], silhouette_iou=iou,
                            silhouette_residual=1 - iou, silhouette_pass=iou >= THRESHOLD,
                            clipping=clipping, passed=pair_pass,
                            source_sizes=[list(image.size) for image in (summer, winter)],
                            source_sha256=[hashlib.sha256(path.read_bytes()).hexdigest() for path in paths]))
    with (assets / "manifest.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    report = dict(passed=passed, expected_pairs=expected, asset_count=len(rows), iou_threshold=THRESHOLD,
                  canvas=[CANVAS, CANVAS], pivot=list(PIVOT), world_scale=WORLD_SCALE, pairs=results)
    (records / "registration-result.json").write_text(json.dumps(report, indent=2) + "\n")
    return passed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("/tmp/astra-landmark-growth-20261003-work"))
    parser.add_argument("--output-root", type=Path)
    parser.add_argument("--expected-count", type=int, default=22)
    args = parser.parse_args()
    if args.expected_count < 1:
        raise ContractError("expected-count must be positive")
    raise SystemExit(0 if run(args.root, args.output_root or args.root, args.expected_count) else 2)


if __name__ == "__main__":
    main()
