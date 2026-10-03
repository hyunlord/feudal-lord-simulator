"""LM-R1 buttons: compose the DGX clips of scripts/lmr1ButtonCaptures.mjs (.remote-runs/<run>/lmr1-buttons/) into a few
small JPEG sheets under docs/verification/lmr1/buttons/ (the evidence budget is 0.5 MB), and print the tabs' centre
brightness (selected vs hover vs unselected) read from the Wave 38 pictures and from the 1280 DPR 1 hover clip.
Run: python3 scripts/lmr1ButtonSheets.py <run-dir>/lmr1-buttons
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/verification/lmr1/buttons"
FAMILIES = ["primary", "secondary", "danger", "icon", "close"]
STATES = ["1-normal", "2-hover", "3-pressed", "4-focus"]
CONTROLS = ["choices", "radio", "chips", "number-1-normal", "number-2-focus", "select-1-closed", "select-2-open", "slider-1-min",
            "slider-2-max", "scrollbar", "tabs-1-normal", "tabs-2-hover", "long-labels"]


def font(size: int):
    for path in ("/System/Library/Fonts/AppleSDGothicNeo.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def sheet(cells: list[tuple[str, Path | None]], columns: int, scale: float, title: str) -> Image.Image:
    images = [(name, Image.open(path).convert("RGB") if path is not None and path.exists() else None) for name, path in cells]
    images = [(name, None if image is None else image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)) for name, image in images]
    width = max((image.width for _, image in images if image is not None), default=100)
    height = max((image.height for _, image in images if image is not None), default=40)
    rows = (len(images) + columns - 1) // columns
    canvas = Image.new("RGB", (columns * (width + 8) + 8, rows * (height + 22) + 30), (60, 56, 50))
    draw = ImageDraw.Draw(canvas)
    draw.text((8, 6), title, fill=(240, 228, 200), font=font(15))
    for index, (name, image) in enumerate(images):
        x, y = 8 + (index % columns) * (width + 8), 30 + (index // columns) * (height + 22)
        draw.text((x, y), name, fill=(230, 220, 190), font=font(12))
        if image is not None:
            canvas.paste(image, (x, y + 16))
        else:
            draw.text((x, y + 20), "(none)", fill=(200, 120, 100), font=font(12))
    return canvas


def save(image: Image.Image, name: str, quality: int = 72) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    image.save(OUT / name, "JPEG", quality=quality, optimize=True)
    print(f"{name}: {image.width}x{image.height} {(OUT / name).stat().st_size // 1024} KiB")


def centre_luma(path: Path) -> float:
    image = Image.open(path).convert("RGB")
    crop = image.crop((20, 14, image.width - 20, image.height - 14))
    pixels = list(crop.getdata())
    return sum(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in pixels) / len(pixels)


def main() -> None:
    base = Path(sys.argv[1])
    after, before = base / "after", base / "before"
    for view, scale in (("1280-dpr1", 1.0), ("1024-dpr2", 0.5), ("tablet", 0.5)):
        cells = [(f"{family} {state[2:]}", after / view / f"{family}-{state}.png") for family in FAMILIES for state in STATES]
        save(sheet(cells, 4, scale, f"Wave 38 buttons, {view}: normal / hover / pressed / keyboard focus (each row: the state's button first, then pressed-on and disabled)"), f"states-{view}.jpg")
    for view, scale in (("1280-dpr1", 1.0), ("1280-dpr2", 0.5), ("1024-dpr1", 1.0)):
        cells = [(name, after / view / f"{name}.png") for name in CONTROLS]
        save(sheet(cells, 3, scale, f"Wave 38 controls, {view}"), f"controls-{view}.jpg")
    save(sheet([("before (trunk 5fb1aebf)", before / "1280-dpr1" / "page-top.png"), ("after", after / "1280-dpr1" / "page-top.png")], 2, 0.5,
               "Gallery top, 1280 x 800 DPR 1, before and after"), "before-after-gallery.jpg")
    save(sheet([("P0 fallback: buttons (tab_hover refused)", after / "fallback" / "buttons-p0.png")], 1, 0.6, "Fallback"), "fallback.jpg")
    save(sheet([("welcome", after / "game" / "welcome.png"), ("build drawer (primary cards)", after / "game" / "build-drawer.png"),
                ("HUD top", after / "game" / "hud-top.png")], 1, 0.6, "Game, 1280 x 800"), "game.jpg", 68)
    art = {name: centre_luma(ROOT / f"public/assets/wave38/{name}.png") for name in ("tab_selected", "tab_hover", "tab_unselected")}
    print("tab centre luma (pictures):", json.dumps({key: round(value, 1) for key, value in art.items()}))


if __name__ == "__main__":
    main()
