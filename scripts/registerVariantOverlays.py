#!/usr/bin/env python3
"""Registers the house condition overlays (33 layers + fallback wear marks) on every Wave 2 house variant.

Each variant is painted in its base house's frame (same canvas, same ground pivot), but the main house body is
often scaled or moved to make room for a yard, stall or wing, so the base's overlay coordinates do not land on the
variant's roof and walls. For every variant this finds the similarity transform (uniform scale + offset) that best
maps the base's main roof onto the variant's main roof (largest roof-coloured component), searching scale in 1%
steps and offset by FFT cross-correlation, and records it in authored (base source) pixels:

    variant_point = scale * base_point + (dx, dy)

Usage: python3 scripts/registerVariantOverlays.py   (rewrites src/render/buildingVariantOverlay.generated.ts)
"""
import colorsys
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
VARIANTS = ROOT / "public/assets/buildings/variants-wave2"
OUT = ROOT / "src/render/buildingVariantOverlay.generated.ts"


def manifest(path: str) -> list:
    text = (ROOT / path).read_text()
    body = text[text.index("= [") + 2:]
    return json.JSONDecoder().raw_decode(body)[0]


def base_for(name: str, singles: list, pairs: list):
    single = re.match(r"house_l(\d)_", name)
    pair = re.match(r"house_pair_l(\d)_(horizontal|vertical)_", name)
    if pair:
        level, axis = int(pair.group(1)), pair.group(2)
        return next(m for m in pairs if m["level"] == level and m["axis"] == axis)
    if single:
        return next(m for m in singles if m["level"] == int(single.group(1)))
    return None


def roof_mask(image: Image.Image, thatch: bool, whole: bool = False) -> np.ndarray:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.float32) / 255
    height, width = rgba.shape[:2]
    mask = np.zeros((height, width), dtype=bool)
    for y in range(height):
        for x in range(width):
            r, g, b, a = rgba[y, x]
            if a < 0.5:
                continue
            hue, sat, val = colorsys.rgb_to_hsv(r, g, b)
            hue *= 360
            if thatch:
                mask[y, x] = 30 <= hue <= 52 and sat >= 0.30 and val >= 0.45
            else:
                mask[y, x] = (hue <= 28 or hue >= 350) and sat >= 0.45 and val >= 0.35
    return mask if whole else largest_component(mask)


def largest_component(mask: np.ndarray) -> np.ndarray:
    labels = np.zeros(mask.shape, dtype=np.int32)
    best, best_size, current = 0, 0, 0
    for y, x in zip(*np.nonzero(mask)):
        if labels[y, x]:
            continue
        current += 1
        stack, size = [(y, x)], 0
        labels[y, x] = current
        while stack:
            cy, cx = stack.pop()
            size += 1
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = current
                    stack.append((ny, nx))
        if size > best_size:
            best, best_size = current, size
    return labels == best


def fit(base: np.ndarray, variant: np.ndarray, scales):
    height, width = variant.shape
    best = (-1.0, 1.0, 0, 0)
    for scale in scales:
        scaled_w, scaled_h = max(1, round(base.shape[1] * scale)), max(1, round(base.shape[0] * scale))
        scaled = np.asarray(Image.fromarray(base.astype(np.uint8) * 255).resize((scaled_w, scaled_h), Image.NEAREST)) > 127
        pad_h, pad_w = height + scaled_h, width + scaled_w
        a = np.fft.rfft2(variant.astype(np.float32), s=(pad_h, pad_w))
        b = np.fft.rfft2(scaled.astype(np.float32), s=(pad_h, pad_w))
        correlation = np.fft.irfft2(a * np.conj(b), s=(pad_h, pad_w))
        index = np.unravel_index(np.argmax(correlation), correlation.shape)
        overlap = correlation[index]
        dy = index[0] if index[0] < height else index[0] - pad_h
        dx = index[1] if index[1] < width else index[1] - pad_w
        union = variant.sum() + scaled.sum() - overlap
        iou = float(overlap / union) if union > 0 else 0.0
        if iou > best[0]:
            best = (iou, float(scale), int(dx), int(dy))
    return best


def main() -> None:
    singles = manifest("src/render/historicalHouseAssetManifest.generated.ts")
    pairs = manifest("src/render/houseCompoundAssetManifest.generated.ts")
    rows = []
    for path in sorted(VARIANTS.glob("house_*.png")):
        meta = base_for(path.stem, singles, pairs)
        if meta is None:
            continue
        variant = Image.open(path).convert("RGBA")
        base = Image.open(ROOT / "public" / meta["url"]).convert("RGBA").resize(variant.size, Image.LANCZOS)
        thatch = meta.get("axis") is None and meta["level"] <= 1
        # Singles: the main roof alone (yards and lean-tos are separate components), scale 0.70-1.10.
        # Pairs: both houses' roofs together and a narrower scale range, since a pair keeps two bodies side by side.
        pair = meta.get("axis") is not None
        scales = np.arange(0.85, 1.051, 0.01) if pair else np.arange(0.70, 1.101, 0.01)
        iou, scale, dx, dy = fit(roof_mask(base, thatch, pair), roof_mask(variant, thatch, pair), scales)
        # Offsets were found in variant pixels; the overlay code works in authored (base source) pixels.
        k = variant.size[0] / meta["width"]
        rows.append({"url": f"assets/buildings/variants-wave2/{path.name}", "baseUrl": meta["url"],
                     "scale": round(scale, 3), "dx": round(dx / k, 1), "dy": round(dy / k, 1), "roofIou": round(iou, 3)})
        print(path.name, rows[-1])
    body = json.dumps(rows, indent=2)
    OUT.write_text("// Generated by scripts/registerVariantOverlays.py: per-variant registration of the house condition overlays.\n"
                   "// variant point = scale * base point + (dx, dy), in the base painting's authored pixels.\n"
                   f"export const BUILDING_VARIANT_OVERLAY_REGISTRATION = {body} as const;\n")


if __name__ == "__main__":
    main()
