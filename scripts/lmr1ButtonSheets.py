"""LM-R1 buttons: compose the DGX clips of scripts/lmr1ButtonCaptures.mjs (.remote-runs/<run>/lmr1-buttons/) into a few
small JPEG sheets under docs/verification/lmr1/buttons/ (the evidence budget is 0.5 MB), and print the tabs' centre
brightness (selected vs hover vs unselected) read from the Wave 38 pictures and from the 1280 DPR 1 hover clip.
Run: python3 scripts/lmr1ButtonSheets.py <run-dir>/lmr1-buttons [<run-dir>/skin-audit]
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


def sheet(cells: list[tuple[str, Path | None]], columns: int, scale: float, title: str, max_width: int = 0) -> Image.Image:
    """A grid of the clips, each cut to its first `max_width` px (a row clip spans the gallery; its buttons sit at the left)."""
    images = [(name, Image.open(path).convert("RGB") if path is not None and path.exists() else None) for name, path in cells]
    images = [(name, image if image is None or max_width == 0 or image.width <= max_width else image.crop((0, 0, max_width, image.height))) for name, image in images]
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
    pixels = list(crop.get_flattened_data())
    return sum(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in pixels) / len(pixels)


def main() -> None:
    base = Path(sys.argv[1])
    after, before = base / "after", base / "before"
    for view, scale, cut in (("1280-dpr1", 1.0, 330), ("1024-dpr2", 0.5, 660), ("tablet", 0.5, 660)):
        cells = [(f"{family} {state[2:]}", after / view / f"{family}-{state}.png") for family in FAMILIES for state in STATES]
        save(sheet(cells, 4, scale, f"Wave 38 buttons, {view}: normal / hover / pressed / focus (row: the state's button, pressed-on, disabled)", cut), f"states-{view}.jpg", 48)
    for view, scale, cut in (("1280-dpr1", 0.8, 620), ("1024-dpr2", 0.4, 1240)):
        cells = [(name, after / view / f"{name}.png") for name in CONTROLS]
        save(sheet(cells, 3, scale, f"Wave 38 controls, {view}", cut), f"controls-{view}.jpg", 50)
    save(sheet([("before (trunk 5fb1aebf)", before / "1280-dpr1" / "page-top.png"), ("after", after / "1280-dpr1" / "page-top.png")], 2, 0.5,
               "Gallery top, 1280 x 800 DPR 1, before and after"), "before-after-gallery.jpg", 62)
    save(sheet([("P0 fallback: buttons (tab_hover refused)", after / "fallback" / "buttons-p0.png")], 1, 0.6, "Fallback"), "fallback.jpg")
    save(sheet([("welcome", after / "game" / "welcome.png"), ("build drawer (primary cards)", after / "game" / "build-drawer.png"),
                ("HUD top", after / "game" / "hud-top.png")], 1, 0.45, "Game, 1280 x 800"), "game.jpg", 50)
    if len(sys.argv) > 2:
        audit = Path(sys.argv[2])
        crops = []
        for name, file, box in (("selection: the slot panel close", "s06-selection.jpg", (960, 75, 1275, 480)),
                                ("ledger tabs and close", "s08-ledger.jpg", (795, 85, 1270, 330)),
                                ("chronicle: tabs, filters, select open", "s10-chronicle-select.jpg", (0, 0, 1000, 440)),
                                ("petition answers (primary)", "s13-petition.jpg", (350, 450, 970, 700)),
                                ("settings: toggle, sliders", "s12-pause-settings.jpg", (0, 220, 1280, 580))):
            path = audit / file
            if path.exists():
                cut = OUT / f".crop-{file}.png"
                Image.open(path).crop(box).save(cut)
                crops.append((name, cut))
        save(sheet(crops, 1, 0.5, "Skin audit states (DGX), crops"), "game-states.jpg", 50)
        for _, cut in crops:
            cut.unlink()
    art = {name: centre_luma(ROOT / f"public/assets/wave38/{name}.png") for name in ("tab_selected", "tab_hover", "tab_unselected")}
    print("tab centre luma (pictures):", json.dumps({key: round(value, 1) for key, value in art.items()}))
    # On screen (1280 DPR 1, the pointer over the second tab): the clip starts 12 px before the tablist; tabs are 4 px apart.
    numbers = json.loads((OUT / "captures-after.json").read_text()) if (OUT / "captures-after.json").exists() else None
    clip = after / "1280-dpr1" / "tabs-2-hover.png"
    if numbers is not None and clip.exists():
        tabs = numbers["views"]["1280-dpr1"]["controls"]["tabs"]
        image = Image.open(clip).convert("RGB")
        x, measured = 12.0, {}
        for name, width in (("selected", tabs["selected"]["w"]), ("hover", tabs["unselected"]["w"]), ("unselected", tabs["unselected"]["w"])):
            box = (round(x) + 6, 12 + 12, round(x + width) - 6, 12 + round(tabs["selected"]["h"]) - 12)
            pixels = list(image.crop(box).get_flattened_data())
            # The label's ink is the darkest quarter; the field is the rest.
            field = sorted(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in pixels)[len(pixels) // 4:]
            measured[name] = round(sum(field) / len(field), 1)
            x += width + 4
        print("tab field luma on screen (1280 DPR 1, hover on the second):", json.dumps(measured))


if __name__ == "__main__":
    main()
