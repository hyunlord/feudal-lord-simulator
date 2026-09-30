#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "scipy", "pillow"]
# ///
# ─── How to run ───
# Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh
# Run: uv run tools/validate_kit.py (root inferred from this file)
"""Independent offline numerical measurements; proxies never certify the pilot."""
from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Final

import numpy as np
from numpy.typing import NDArray
from PIL import Image
from scipy import ndimage as ndi

ROOT: Final = Path(__file__).resolve().parents[1]
BODIES: Final = ("body_vertical", "body_square", "body_curved")
ROOFS: Final = ("roof_thatch", "roof_tile", "roof_stone")
STATES: Final = ("roof_snow", "roof_moss", "roof_fresh", "roof_soot", "body_boarded", "body_cracked", "body_scaffold")
Pixels = NDArray[np.float64]


@dataclass(frozen=True, slots=True)
class Measurement:
    check: int
    scope: str
    metric: str
    value: float | None
    threshold: str
    status: str
    note: str = ""


def rgba(path: Path) -> Pixels:
    with Image.open(path) as image:
        return np.asarray(image.convert("RGBA"), dtype=np.float64)


def mask(name: str) -> NDArray[np.bool_]:
    with Image.open(ROOT / "masks" / f"{name}.png") as image:
        return np.asarray(image.convert("L")) > 0


def luma(pixels: Pixels) -> Pixels:
    return pixels[..., :3] @ np.array([0.2126, 0.7152, 0.0722])


def halo(pixels: Pixels, boundary_only: bool = True) -> tuple[int, int, float | None]:
    alpha = pixels[..., 3]
    edge = (alpha >= 1) & (alpha <= 250)
    if boundary_only:
        edge &= ndi.distance_transform_edt(alpha > 0) <= 2
    opaque = alpha >= 251
    if not np.any(opaque) or not np.any(edge):
        return 0, int(edge.sum()), None
    nearest = ndi.distance_transform_edt(~opaque, return_distances=False, return_indices=True)
    brightness = luma(pixels)
    bad = edge & (np.abs(brightness - brightness[tuple(nearest)]) > 40)
    return int(bad.sum()), int(edge.sum()), float(bad.sum() / edge.sum())


def dark_width(pixels: Pixels) -> float | None:
    dark = (luma(pixels) < 70) & (pixels[..., 3] >= 250)
    distance = ndi.distance_transform_edt(dark)
    ridge = dark & (distance == ndi.maximum_filter(distance, size=3))
    return float(np.median(2 * distance[ridge] - 1)) if ridge.any() else None


def shading(pixels: Pixels) -> tuple[float | None, float]:
    valid = ndi.binary_erosion(pixels[..., 3] >= 250, iterations=2)
    y, x = np.nonzero(valid)
    if len(x) < 10:
        return None, 0.0
    design = np.column_stack((x - x.mean(), y - y.mean(), np.ones(len(x))))
    coefficients = np.linalg.lstsq(design, luma(pixels)[valid], rcond=None)[0]
    strength = float(np.hypot(*coefficients[:2]))
    return (float(np.degrees(np.arctan2(coefficients[1], coefficients[0]))) if strength > 1e-6 else None), strength


def histogram(pixels: Pixels) -> Pixels:
    rgb = pixels[..., :3]
    saturation = (rgb.max(axis=2) - rgb.min(axis=2)) / np.maximum(rgb.max(axis=2), 1) * 255
    valid = pixels[..., 3] >= 250
    counts = [np.histogram(values[valid], bins=32, range=(0, 256))[0] for values in (luma(pixels), saturation)]
    return np.stack([values / max(float(values.sum()), 1) for values in counts])


def seam_runs(pixels: Pixels, roof: NDArray[np.bool_]) -> tuple[int, int]:
    """Count repeated dark runs along sampled local normals at the lower roof edge."""
    boundary = [(x, int(np.flatnonzero(roof[:, x])[-1])) for x in range(roof.shape[1]) if roof[:, x].any()]
    brightness = luma(pixels)
    repeated = sampled = 0
    for index in range(1, len(boundary) - 1):
        x, y = boundary[index]
        dx = boundary[index + 1][0] - boundary[index - 1][0]
        dy = boundary[index + 1][1] - boundary[index - 1][1]
        norm = np.hypot(dx, dy)
        positions = [(round(y + t * dx / norm), round(x - t * dy / norm)) for t in range(-3, 4)]
        if any(a < 0 or b < 0 or a >= roof.shape[0] or b >= roof.shape[1] for a, b in positions):
            continue
        dark = [brightness[a, b] < 70 and pixels[a, b, 3] >= 250 for a, b in positions]
        runs = sum(value and (i == 0 or not dark[i - 1]) for i, value in enumerate(dark))
        repeated += int(runs >= 2)
        sampled += 1
    return repeated, sampled


def main() -> None:
    rows: list[Measurement] = []
    reference = rgba(ROOT / "references" / "house_l2-v2.png")
    assets = {path.stem: rgba(path) for path in sorted((ROOT / "assets").glob("*.png"))}
    if len(assets) != 24:
        raise RuntimeError(f"Expected 24 assets, found {len(assets)}")
    for name, pixels in assets.items():
        same = pixels.shape == reference.shape
        rows.append(Measurement(1, name, "canvas_matches_reference", float(same), "1", "PASS" if same else "FAIL"))
        bad, edge, ratio = halo(pixels)
        rows.append(Measurement(4, name, "halo_ratio", ratio, "<=0.01", "NOT_VERIFIED" if ratio is None else ("PASS" if ratio <= .01 else "FAIL"), f"bad={bad}; edge={edge}; support EDT<=2px; nearest alpha>=251; no opaque/edge means undefined"))
        all_bad, all_partial, all_ratio = halo(pixels, boundary_only=False)
        rows.append(Measurement(4, name, "all_partial_alpha_difference_ratio", all_ratio, "diagnostic only", "DIAGNOSTIC", f"bad={all_bad}; partial={all_partial}; includes translucent interiors; excluded from gate"))
        angle, strength = shading(pixels)
        rows.append(Measurement(7, name, "brightness_gradient_degrees", angle, "pairwise<=15 conditional proxy", "PROXY", f"slope_luma_per_px={strength}; image x-right/y-down; upper-left=-135deg; material and geometry confounded"))
    rows.append(Measurement(1, "all", "engine_pivot", None, "same as source engine pivot", "NOT_VERIFIED", "Engine pivot metadata not supplied; full inherited image coordinates only."))
    legacy_hull = ndi.binary_erosion(ndi.binary_fill_holes(reference[..., 3] >= 250), iterations=1)
    expected = ndi.binary_erosion(ndi.binary_fill_holes(reference[..., 3] > 0), iterations=2) & (reference[..., 3] >= 250)
    canonical_roof = mask("roof_canonical")
    ref_depth = ndi.distance_transform_edt(ndi.binary_fill_holes(reference[..., 3] >= 250))
    with (ROOT / "qa" / "auto_gap_pixels.csv").open("w", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(("body", "roof", "x", "y", "reference_boundary_distance", "reference_alpha", "body_alpha", "roof_alpha", "current_domain_included", "geometric_location"))
        for body in BODIES:
            for roof in ROOFS:
                ys, xs = np.nonzero((expected | legacy_hull) & ((assets[body][..., 3] + assets[roof][..., 3]) < 250))
                for y, x in zip(ys, xs, strict=True):
                    location = "reference_near_outline_le3px" if ref_depth[y, x] <= 3 else "reference_deep_interior_gt3px"
                    writer.writerow((body, roof, x, y, float(ref_depth[y, x]), reference[y, x, 3], assets[body][y, x, 3], assets[roof][y, x, 3], bool(expected[y, x]), location))
    with (ROOT / "records" / "combinations.csv").open(newline="") as stream:
        combinations = list(csv.DictReader(stream))
    if len(combinations) != 216 or len({row["id"] for row in combinations}) != 216:
        raise RuntimeError("Expected 216 unique combination records")
    unique_factors = {(row["body"], row["roof"], row["color"], row["addition"]) for row in combinations}
    factor_counts = [len({row[key] for row in combinations}) for key in ("body", "roof", "color", "addition")]
    if len(unique_factors) != 216 or factor_counts != [3, 3, 4, 6]:
        raise RuntimeError("Combination table is not the full 3x3x4x6 Cartesian product")
    for combo in combinations:
        identity, body, roof = combo["id"], combo["body"], combo["roof"]
        image = rgba(ROOT / "renders" / "base" / f"{identity}.png")
        gaps = int((expected & ((assets[body][..., 3] + assets[roof][..., 3]) < 250)).sum())
        rows.append(Measurement(2, identity, "uncovered_reference_interior_px", float(gaps), "0", "PASS" if gaps == 0 else "FAIL", f"reference alpha>0 hull eroded2px AND refalpha>=250; {int(expected.sum())}px; alpha sum, no shadow/addition"))
        double, sampled = seam_runs(image, canonical_roof)
        rows.append(Measurement(3, identity, "double_dark_run_samples", float(double), "not supplied", "NOT_VERIFIED", f"{sampled} normals; ±3px; luma<70; repeated run proxy not literal doubled-outline pixels"))
    for state in STATES:
        region = canonical_roof if state.startswith("roof_") else mask("body_canonical")
        for phase, path in (("final", ROOT / "assets" / f"{state}.png"), ("preclip", ROOT / "sources" / "preclip" / f"{state}.png")):
            overflow = int(((rgba(path)[..., 3] > 0) & ~region).sum())
            rows.append(Measurement(5, f"{state}:{phase}", "overflow_px", float(overflow), "0", "PASS" if overflow == 0 else "FAIL"))
    for roof in ROOFS:
        support = assets[roof][..., 3] > 0
        cover = float(((assets["roof_snow"][..., 3] > 0) & support).sum() / support.sum())
        rows.append(Measurement(6, roof, "snow_support_coverage", cover, "0.60..0.80", "PASS" if .6 <= cover <= .8 else "FAIL", "Any nonzero snow alpha; not material-white classification"))
        effective = (assets["roof_snow"][..., 3] >= 128) & (luma(assets["roof_snow"]) >= 180)
        coverage = float((effective & support).sum() / support.sum())
        rows.append(Measurement(6, roof, "effective_bright_snow_coverage", coverage, "0.60..0.80", "PASS" if .6 <= coverage <= .8 else "FAIL", "Operational snow proxy: alpha>=128 AND luma>=180; thresholds define bright visible paint, not physical snow identification."))
    parts = [name for name in assets if name not in STATES and name != "shadow"]
    for index, left in enumerate(parts):
        for right in parts[index + 1:]:
            first, second = assets[left], assets[right]
            angle_a, _ = shading(first)
            angle_b, _ = shading(second)
            delta = None if angle_a is None or angle_b is None else abs((angle_a - angle_b + 180) % 360 - 180)
            rows.append(Measurement(7, f"{left}:{right}", "gradient_angle_difference", delta, "<=15 proxy only", "NOT_VERIFIED" if delta is None else ("PROXY_PASS" if delta <= 15 else "PROXY_FAIL")))
            distance = np.abs(histogram(first) - histogram(second)).sum(axis=1)
            for channel, value in zip(("luma", "saturation"), distance, strict=True):
                rows.append(Measurement(8, f"{left}:{right}", f"{channel}_histogram_L1", float(value), "not supplied", "NOT_VERIFIED"))
            width_a, width_b = dark_width(first), dark_width(second)
            deviation = None if width_a is None or width_b is None else abs(width_a - width_b)
            rows.append(Measurement(8, f"{left}:{right}", "dark_line_width_difference_px", deviation, "<=1 proxy only", "NOT_VERIFIED" if deviation is None else ("PROXY_PASS" if deviation <= 1 else "PROXY_FAIL"), "Median local DT ridge diameter 2d-1 of luma<70; includes non-timber dark shapes."))
    tint_checks(rows)
    rows.append(Measurement(9, "all", "semantic_window_timber_protection", None, "0 recolored semantic window/timber pixels", "NOT_VERIFIED", "Supplied color masks use brightness/chroma selection, not independent semantic window/timber labels."))
    anchor_checks(rows)
    with (ROOT / "qa" / "auto_measurements.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(asdict(rows[0])))
        writer.writeheader()
        writer.writerows(asdict(row) for row in rows)
    summary = []
    for check in range(1, 11):
        selected = [row for row in rows if row.check == check]
        counts = {status: sum(row.status == status for row in selected) for status in sorted({row.status for row in selected if row.status != "DIAGNOSTIC"})}
        verdict = "FAIL" if counts.get("FAIL", 0) or counts.get("PROXY_FAIL", 0) else ("NOT_VERIFIED" if any(status != "PASS" for status in counts) else "PASS")
        summary.append({"check": check, "verdict": verdict, "rows": len(selected), "counts": counts})
    (ROOT / "qa" / "auto_summary.json").write_text(json.dumps({"pilot_auto_gate": "FAIL_NOT_ALL_VERIFIED", "checks": summary}, indent=2) + "\n")
    print(json.dumps(summary, indent=2))


def tint_checks(rows: list[Measurement]) -> None:
    paths = sorted((ROOT / "renders" / "tinted").glob("*.png"))
    if len(paths) != 12:
        raise RuntimeError(f"Expected 12 tinted body images, found {len(paths)}")
    for path in paths:
        body = path.stem.rsplit("_", 1)[0]
        original = rgba(ROOT / "assets" / f"{body}.png")
        changed = rgba(path)
        wall = mask(f"wall_{body}")
        inner = ndi.binary_erosion(wall, iterations=2)
        before = luma(original) - ndi.gaussian_filter(luma(original), sigma=1)
        after = luma(changed) - ndi.gaussian_filter(luma(changed), sigma=1)
        rms = float(np.sqrt(np.mean(before[inner] ** 2))) if inner.any() else 0.0
        ratio = float(np.sqrt(np.mean(after[inner] ** 2)) / rms) if rms > 1e-6 else None
        bleed = int((np.any(original != changed, axis=2) & ~wall).sum())
        rows.append(Measurement(9, path.stem, "wall_highpass_RMS_ratio", ratio, ">=0.8", "NOT_VERIFIED" if ratio is None else ("PASS" if ratio >= .8 else "FAIL"), "Gaussian sigma1; wall erosion2px; original body baseline; ratio not perceptual texture equivalence"))
        rows.append(Measurement(9, path.stem, "nonwall_changed_px", float(bleed), "0", "PASS" if bleed == 0 else "FAIL"))


def anchor_checks(rows: list[Measurement]) -> None:
    with (ROOT / "records" / "anchors.csv").open(newline="") as stream:
        anchors = list(csv.DictReader(stream))
    if len(anchors) != 30 or len({(entry["asset"], entry["body"]) for entry in anchors}) != 30:
        raise RuntimeError("Expected 30 unique body/attachment anchor records")
    for entry in anchors:
        displacement = max(abs(float(entry["measured_x"]) - float(entry["target_x"])), abs(float(entry["measured_y"]) - float(entry["target_y"])))
        uncertainty = float(entry["uncertainty_px"])
        status = "PASS" if displacement + uncertainty <= 1 else ("FAIL" if displacement - uncertainty > 1 else "NOT_VERIFIED")
        rows.append(Measurement(10, f"{entry['asset']}:{entry['body']}", "semantic_anchor_chebyshev_px", displacement, "<=1 including uncertainty", status, f"Manual supplied coordinates; uncertainty=±{uncertainty}px; upper_bound={displacement + uncertainty}; not independent engine attachment proof."))


if __name__ == "__main__":
    main()
