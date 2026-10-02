#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy"]
# ///
# How to run: python3 records/assemble.py (existing Pillow and numpy environment)
from __future__ import annotations

import json
from pathlib import Path
from typing import TypeAlias

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont

Point: TypeAlias = tuple[float, float]
ROOT = Path(__file__).resolve().parents[1]
SIZE = (1024, 768)
PIVOT = (512, 544)
ZOOM = 8.0
ARMS: dict[str, tuple[Point, Point]] = {
    "south": ((-1, 0), (0, -1)), "north": ((1, 0), (0, 1)),
    "east": ((-1, 0), (0, 1)), "west": ((1, 0), (0, -1)),
}


def add(a: Point, b: Point, scale: float = 1) -> Point:
    return a[0] + b[0] * scale, a[1] + b[1] * scale


def project(p: Point, height: float = 0) -> Point:
    return PIVOT[0] + (p[0] - p[1]) * 32 * ZOOM, PIVOT[1] + ((p[0] + p[1]) * 16 - height) * ZOOM


def triangle(src: Image.Image, uv: list[Point], dst: list[Point]) -> Image.Image:
    matrix = np.array([[p[0], p[1], 1] for p in dst], dtype=float)
    coefficients = np.linalg.solve(matrix, np.array(uv, dtype=float)).T.ravel()
    transformed = src.transform(SIZE, Image.Transform.AFFINE, tuple(coefficients), Image.Resampling.BICUBIC)
    mask = Image.new("L", SIZE)
    ImageDraw.Draw(mask).polygon(dst, fill=255)
    transformed.putalpha(ImageChops.multiply(transformed.getchannel("A"), mask))
    return transformed


def quad(src: Image.Image, uv: list[Point], dst: list[Point]) -> Image.Image:
    result = Image.new("RGBA", SIZE)
    for indices in [(0, 1, 2), (0, 2, 3)]:
        result.alpha_composite(triangle(src, [uv[i] for i in indices], [dst[i] for i in indices]))
    return result


def clipped_strip(src: Image.Image, uv: list[Point], rectangle: list[Point], outline: list[Point]) -> Image.Image:
    matrix = np.array([[p[0], p[1], 1] for p in rectangle[:3]], dtype=float)
    coefficients = np.linalg.solve(matrix, np.array(uv[:3], dtype=float)).T.ravel()
    transformed = src.transform(SIZE, Image.Transform.AFFINE, tuple(coefficients), Image.Resampling.BICUBIC)
    mask = Image.new("L", SIZE)
    ImageDraw.Draw(mask).polygon(outline, fill=255)
    transformed.putalpha(ImageChops.multiply(transformed.getchannel("A"), mask))
    return transformed


def textures(material: str, winter: bool) -> tuple[Image.Image, Image.Image]:
    face_name, top_name = {
        "stone": ("stone_face_rubble_a-v2.png", "stone_top_a-v1.png"),
        "palisade": ("palisade_face_a-v2.png", "palisade_top-v1.png"),
    }[material]
    face = Image.open(ROOT / "references" / face_name).convert("RGBA")
    top = Image.open(ROOT / "references" / top_name).convert("RGBA")
    if winter:
        donor = Image.open(ROOT / "references/dry_stone_wall_winter.png").convert("RGBA")
        snow = donor.crop((0, 25, 512, 36))
        pixels = np.array(snow)
        valid = (pixels[:, :, 2] > 130) & (pixels[:, :, 2] > pixels[:, :, 0] * .90) & ((np.arange(512)[None, :] % 83) < 13)
        pixels[:, :, 3] = np.where(valid, pixels[:, :, 3], 0)
        pixels[pixels[:, :, 3] == 0] = 0
        snow = Image.fromarray(pixels)
        coat = Image.new("RGBA", top.size)
        coat.alpha_composite(snow, (0, {"stone": 23, "palisade": 12}[material]))
        coat.putalpha(ImageChops.multiply(coat.getchannel("A"), top.getchannel("A")))
        top.alpha_composite(coat)
    return face, top


def render(material: str, winter: bool, direction: str, length: float = 1) -> Image.Image:
    face, top = textures(material, winter)
    ray_a, ray_b = ARMS[direction]
    a = (ray_a[0] * length, ray_a[1] * length)
    b = (ray_b[0] * length, ray_b[1] * length)
    d1, d2 = (-ray_a[0], -ray_a[1]), ray_b
    n1, n2 = (-d1[1], d1[0]), (-d2[1], d2[0])
    half = {"stone": .15, "palisade": .08}[material]
    ml = ((n1[0] + n2[0]) * half, (n1[1] + n2[1]) * half)
    mr = (-ml[0], -ml[1])
    polys = [[add(a, n1, half), ml, mr, add(a, n1, -half)],
             [ml, add(b, n2, half), add(b, n2, -half), mr]]
    result = Image.new("RGBA", SIZE)
    top_parts: list[tuple[float, Image.Image]] = []
    face_parts: list[tuple[float, Image.Image]] = []
    for index, (poly, normal) in enumerate(zip(polys, [n1, n2], strict=True)):
        front_left = sum(normal) >= 0
        front = [poly[0], poly[1]] if front_left else [poly[3], poly[2]]
        back = [poly[3], poly[2]] if front_left else [poly[0], poly[1]]
        u0, u1 = index * 205, (index + 1) * 205
        if index == 0:
            u0 = 205 - length * 205
        else:
            u1 = 205 + length * 205
        phase = 19 if material == "stone" else 0
        u0, u1 = u0 + phase, u1 + phase
        uv = [(u0, 0), (u1, 0), (u1, 128), (u0, 128)]
        dest = [project(front[0], 20), project(front[1], 20), project(front[1]), project(front[0])]
        start, end = (a, (0, 0)) if index == 0 else ((0, 0), b)
        visible_normal = normal if front_left else (-normal[0], -normal[1])
        standard_front = [add(p, visible_normal, half) for p in [start, end]]
        standard_back = [add(p, visible_normal, -half) for p in [start, end]]
        rectangle = [project(standard_front[0], 20), project(standard_front[1], 20), project(standard_front[1]), project(standard_front[0])]
        if sum(n1) * sum(n2) < 0:
            joint = 1 if index == 0 else 0
            dest[joint] = project(front[joint], 23.75)
        padded_face = Image.new("RGBA", (face.width, face.height * 2))
        padded_face.paste(face, (0, 0))
        padded_face.paste(face, (0, face.height))
        face_piece = clipped_strip(padded_face, [(u, v + 128) for u, v in uv], rectangle, dest)
        # Same directional wash as drawWallFaces, applied to source texels only.
        axis_y = abs((d1 if index == 0 else d2)[1])
        if axis_y:
            pixels = np.array(face_piece)
            pixels[:, :, :3] = (pixels[:, :, :3] * .78 + np.array([42,33,24]) * .22).astype(np.uint8)
            face_piece = Image.fromarray(pixels)
        depth = sum(project(p)[1] for p in front) / 2
        if material == "palisade":
            back_outline = [project(back[0], 23.75), project(back[1], 23.75), project(back[1]), project(back[0])]
            back_rectangle = [project(standard_back[0], 23.75), project(standard_back[1], 23.75), project(standard_back[1]), project(standard_back[0])]
            backing = clipped_strip(face, uv, back_rectangle, back_outline)
            back_pixels = np.array(backing)
            back_pixels[:, :, :3] = (back_pixels[:, :, :3] * .78 + np.array([42, 33, 24]) * .22).astype(np.uint8)
            face_parts.append((depth - 1000, Image.fromarray(back_pixels)))
        face_parts.append((depth, face_piece))
        uv = [(u0, 0), (u1, 0), (u1, top.height), (u0, top.height)]
        rise, front_rise = {"stone": (27.5, 20), "palisade": (27.5, 20)}[material]
        ground_points = [back[0], back[1], front[1], front[0]]
        dest = [project(ground_points[k], rise if k < 2 else front_rise) for k in range(4)]
        if sum(n1) * sum(n2) < 0:
            for k in ([1, 2] if index == 0 else [0, 3]):
                dest[k] = project(ground_points[k], (rise + front_rise) / 2)
        rectangle = [project(standard_back[0], rise), project(standard_back[1], rise), project(standard_front[1], front_rise), project(standard_front[0], front_rise)]
        top_parts.append((depth, clipped_strip(top, uv, rectangle, dest)))
    for _, part in sorted(face_parts, key=lambda part: part[0]):
        result.alpha_composite(part)
    for _, part in sorted(top_parts, key=lambda part: part[0]):
        result.alpha_composite(part)
    pixels = np.array(result)
    distance = np.abs(np.arange(SIZE[0]) - PIVOT[0]) / ZOOM
    fade = np.clip((36.8 - distance) / 12.8, 0, 1)
    pixels[:, :, 3] = np.rint(pixels[:, :, 3] * fade[None, :]).astype(np.uint8)
    pixels[pixels[:, :, 3] == 0] = 0
    return Image.fromarray(pixels)


def main() -> None:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
    board = Image.new("RGB", (1536, 1152), "#455142")
    rows: list[dict[str, str | int | float | list[int]]] = []
    for row, (material, winter) in enumerate([(m, w) for m in ["stone", "palisade"] for w in [False, True]]):
        for col, direction in enumerate(ARMS):
            season = "winter" if winter else "summer"
            name = f"corner_{material}_{direction}_{season}-v3"
            im = render(material, winter, direction)
            im.save(ROOT / "assets" / f"{name}.png")
            small = im.resize((384, 288), Image.Resampling.LANCZOS)
            board.paste(small, (col*384, row*288), small)
            ImageDraw.Draw(board).text((col*384+10, row*288+10), f"{material} {direction} {season}", font=font, fill="white")
            rows.append({"id": name, "canvas": [1024, 768], "pivot": [512, 544], "scale": .125, "joinU": 224 if material == "stone" else 205})
    board.save(ROOT / "proofs/01-all-16.jpg", quality=94)
    (ROOT / "manifest.json").write_text(json.dumps(rows, indent=2))


if __name__ == "__main__":
    main()
