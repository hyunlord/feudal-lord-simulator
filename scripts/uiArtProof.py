"""UX-2 gates 3 and 4 from the installed art alone (no browser).

Gate 3 (9-slice): every frame is laid out at three sizes (its minimum, a card and a wide panel) the way CSS
`border-image` does it at DPR 2 (corners copied 1:1, edges and centre stretched), and each corner of each size is
compared with the source corner. Distortion = any corner pixel that differs; the sheet shows the three sizes.
Gate 4 (icons at 24 px): every icon at its 24 px copy on a light and a dark field, and the silhouette (alpha >= 50%)
overlap of each pair in the same sheet (intersection over union). A pair above 0.85 would read as one shape.
Run: python3 scripts/uiArtProof.py <outDir>
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "src/ui/uiArtManifest.generated.ts").read_text().split("UI_ART_MANIFEST = ", 1)[1].rsplit(" as const", 1)[0])


def nine_slice(source: Image.Image, slice_: dict, width: int, height: int) -> Image.Image:
    left, top, right, bottom = slice_["left"], slice_["top"], slice_["right"], slice_["bottom"]
    sw, sh = source.size
    xs, ys = [0, left, sw - right, sw], [0, top, sh - bottom, sh]
    dx, dy = [0, left, width - right, width], [0, top, height - bottom, height]
    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for row in range(3):
        for col in range(3):
            box = (xs[col], ys[row], xs[col + 1], ys[row + 1])
            size = (dx[col + 1] - dx[col], dy[row + 1] - dy[row])
            if size[0] <= 0 or size[1] <= 0 or box[2] <= box[0] or box[3] <= box[1]:
                continue
            piece = source.crop(box)
            out.paste(piece if piece.size == size else piece.resize(size, Image.Resampling.BILINEAR), (dx[col], dy[row]))
    return out


def gate3(out: Path) -> dict:
    rows, tiles = [], []
    for name, frame in sorted(MANIFEST["frames"].items()):
        source = Image.open(ROOT / "public" / frame["url"]).convert("RGBA")
        s = frame["slice"]
        minimum = (s["left"] + s["right"] + 2, s["top"] + s["bottom"] + 2)
        sizes = [minimum, (640, 256), (1280, 480)]
        corners_ok = True
        rendered = []
        for width, height in sizes:
            image = nine_slice(source, s, width, height)
            rendered.append(image)
            for (cx, cy, cw, ch) in ((0, 0, s["left"], s["top"]), (width - s["right"], 0, s["right"], s["top"]),
                                     (0, height - s["bottom"], s["left"], s["bottom"]),
                                     (width - s["right"], height - s["bottom"], s["right"], s["bottom"])):
                sx = 0 if cx == 0 else source.width - cw
                sy = 0 if cy == 0 else source.height - ch
                diff = ImageChops.difference(image.crop((cx, cy, cx + cw, cy + ch)), source.crop((sx, sy, sx + cw, sy + ch)))
                if diff.getbbox() is not None:
                    corners_ok = False
        rows.append({"frame": name, "slice": s, "sizes": [list(size) for size in sizes], "cornersIdentical": corners_ok})
        tiles.append((name, rendered))
    # Contact sheet at half size (CSS px): name, then the three sizes.
    sheet_w, y = 1100, 0
    layout = []
    for name, rendered in tiles:
        x, row_h = 0, 0
        placed = []
        for image in rendered:
            small = image.resize((max(1, image.width // 3), max(1, image.height // 3)), Image.Resampling.LANCZOS)
            placed.append((small, x))
            x += small.width + 12
            row_h = max(row_h, small.height)
        layout.append((name, placed, y))
        y += row_h + 26
    sheet = Image.new("RGB", (sheet_w, y + 8), (92, 116, 88))
    draw = ImageDraw.Draw(sheet)
    for name, placed, top in layout:
        draw.text((4, top), name, fill=(255, 255, 255))
        for small, x in placed:
            sheet.paste(small, (x + 4, top + 14), small)
    sheet.save(out / "nine-slice-sizes.jpg", quality=78)
    return {"frames": len(rows), "cornersIdentical": sum(row["cornersIdentical"] for row in rows), "rows": rows}


def gate4(out: Path) -> dict:
    result, strips = [], []
    for name, sheet in sorted(MANIFEST["iconSheets"].items()):
        image = Image.open(ROOT / "public" / sheet["sizes"]["24"]["url"]).convert("RGBA")
        cells = [image.crop((i * 24, 0, i * 24 + 24, 24)) for i in range(len(sheet["cells"]))]
        masks = [cell.getchannel("A").point(lambda a: 255 if a >= 128 else 0) for cell in cells]
        worst = (0.0, None)
        for i in range(len(masks)):
            for j in range(i + 1, len(masks)):
                inter = ImageChops.multiply(masks[i], masks[j]).histogram()[255]
                union = ImageChops.lighter(masks[i], masks[j]).histogram()[255]
                iou = inter / union if union else 0.0
                if iou > worst[0]:
                    worst = (iou, f"{sheet['cells'][i]}~{sheet['cells'][j]}")
        result.append({"sheet": name, "icons": len(cells), "maxSilhouetteIoU": round(worst[0], 3), "closestPair": worst[1]})
        strips.append((name, cells, masks, sheet["cells"]))
    width = 24 * 12 * 3 + 40
    sheet = Image.new("RGB", (width, len(strips) * 96 + 10), (240, 236, 226))
    draw = ImageDraw.Draw(sheet)
    for row, (name, cells, masks, ids) in enumerate(strips):
        top = row * 96 + 4
        draw.text((4, top), f"{name} ({len(cells)})", fill=(40, 30, 20))
        for i, (cell, mask) in enumerate(zip(cells, masks)):
            x = 4 + i * 28
            sheet.paste(cell, (x, top + 14), cell)                              # 24 px on vellum
            dark = Image.new("RGB", (24, 24), (81, 67, 52)); dark.paste(cell, (0, 0), cell)
            sheet.paste(dark, (x, top + 42))                                    # 24 px on oak
            sheet.paste(Image.new("RGB", (24, 24), (20, 16, 12)), (x, top + 70), mask)  # silhouette
    sheet.save(out / "icons-24px.jpg", quality=85)
    return {"icons": sum(row["icons"] for row in result), "maxIoU": max(row["maxSilhouetteIoU"] for row in result), "rows": result}


def main() -> None:
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    report = {"gate3": gate3(out), "gate4": gate4(out)}
    (out / "art-proof.json").write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n")
    print(json.dumps({"frames": report["gate3"]["frames"], "cornersIdentical": report["gate3"]["cornersIdentical"],
                      "icons": report["gate4"]["icons"], "maxIoU": report["gate4"]["maxIoU"],
                      "closest": max(report["gate4"]["rows"], key=lambda row: row["maxSilhouetteIoU"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
