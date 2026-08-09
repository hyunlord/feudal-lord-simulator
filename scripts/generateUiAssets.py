#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path, PureWindowsPath
from typing import Final

from PIL import Image, ImageDraw

AssetTargets = frozenset[str] | None

COMFY_ROOT: Final = Path(os.environ.get("COMFYUI_ROOT", str(Path.home() / "ComfyUI")))
COMFY_URL: Final = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")
COMFY_OUTPUT: Final = Path(os.environ.get("COMFYUI_OUTPUT", str(COMFY_ROOT / "output")))
STAGE_DIR: Final = Path(os.environ.get("UI_ASSET_STAGE_DIR", "/tmp/feudal-phase2-ui-candidates"))
REPO_ROOT: Final = Path(__file__).resolve().parents[1]
BEFORE_DIR: Final = REPO_ROOT / "docs" / "asset-evidence" / "before"
PHASE13_PREPARED_DIR: Final = REPO_ROOT / "docs" / "asset-evidence" / "phase13" / "prepared-ui"
UI_ASSET_DIR: Final = REPO_ROOT / "public" / "assets" / "ui"
UI_ASSET_MANIFEST: Final = REPO_ROOT / "docs" / "asset-evidence" / "uiAssetManifest.json"
CONTACT_DIR: Final = Path("/tmp/feudal-phase2-evidence/assets")
UI_IPADAPTER_PRESET: Final = "PLUS (high strength)"
BUILDING_REFERENCE_PATHS: Final = (
    Path("public/assets/buildings/candidates_v2/house_03.png"),
    Path("public/assets/buildings/candidates_v2/mill_02.png"),
    Path("public/assets/buildings/candidates_v2/granary_08.png"),
)
BUILDING_REFERENCE_NAMES: Final = (
    "phase4c_ref_house.png",
    "phase4c_ref_mill.png",
    "phase4c_ref_granary.png",
)
BUILDING_STYLE_REFERENCE_MODE: Final = "building-style reference batch from accepted house/mill/granary sprites"
COMMON_PROMPT: Final = (
    "living illuminated manuscript, hand-painted medieval court artifact, "
    "exact flat game UI surface, ink outlines, upper-left light, restrained gold leaf, "
    "muted parchment earth sage ultramarine vermilion, no text, no watermark, "
    "no modern UI, no photorealism, no gradients, no blur, no drop shadow"
)
NEGATIVE_PROMPT: Final = (
    "terrain, buildings, agents, roads, world objects, blurry, realistic, 3d render, "
    "photo, text, watermark, frame around picture, drop shadow, gradient, modern UI, "
    "high detail clutter, labels, letters, numbers"
)
SELECTED: Final = {
    "scroll_frame": 22,
    "wood_console": 10,
    "seal_slot": 2,
    "parchment_texture": 4,
    "illumination_corner": 5,
}
CROP_BOXES: Final = {
    "illumination_corner": (0, 0, 520, 520),
}
REFINEMENTS: Final = {
    "scroll_frame": {
        "start_index": 7,
        "seeds": (52013411, 52013412, 52013413),
        "prompt": (
            "tan parchment curled-edge HOLLOW border only, same flat saturated chroma-key cyan visible outside the frame "
            "and through the completely empty center, medieval scroll corners only, no blue frame, no metal frame, no page surface"
        ),
        "negative": (
            "blue frame, metal frame, picture frame, filled center, text, letters, numbers, handwriting, ruled lines, staff lines, "
            "parchment texture in the center, scene, landscape, icon, figure, document page, book spread, table, grid, background variation"
        ),
        "include_common": False,
    },
    "wood_console": {
        "start_index": 7,
        "seeds": (52023421, 52023422, 52023423),
        "prompt": (
            "single 12 to 1 full-width shallow oak bar, EXACTLY THREE large dark empty rectangular wells visible side-by-side in ONE row, "
            "each well separated by exactly two thick plain vertical timber posts, minimal horizontal wood grain, iron caps only on outer ends"
        ),
        "negative": (
            "two wells, four wells, five wells, extra wells, horizontal bands, multiple rows, windows, doors, icons, shields, gems, gold, "
            "gold leaf, vines, foliage, leaves, ornament, carving, repeating carvings, paper, parchment, scroll, book, text, letters, symbols, scene"
        ),
        "include_common": False,
    },
    "parchment_texture": {
        "seeds": (52041444, 52041445, 52041446),
        "prompt": "macro close-up uniform seamless aged parchment material, subtle fibers, barely visible mottling, empty texture swatch",
        "negative": "frame, border, ornament, medallion, grid, ruled lines, heraldry, book, page",
    },
    "illumination_corner": {
        "seeds": (52051454, 52051455, 52051456),
        "prompt": "single L-shaped top-left illuminated vine and gold corner ornament isolated on plain parchment, empty remaining field",
        "negative": "full frame, central medallion, bilateral symmetry, border on all edges, full tile pattern",
    },
}

GUIDED: Final = {
    "wood_console": {
        "start_index": 10,
        "seeds": (52024421, 52024422, 52024423),
        "denoise": (0.28, 0.32, 0.36),
        "lora_strength": 0.45,
        "prompt": "pixel art medieval oak command bar preserving exact guide layout, exactly three dark empty wells in one row, two thick plain vertical timber posts, visible plank grain, raised upper-edge highlight and handmade material detail",
        "negative": "two wells, four wells, extra wells, horizontal bands, multiple rows, windows, doors, icons, shields, gems, gold, vines, ornament, carving, text, symbols, paper, parchment, scene",
    },
    "scroll_frame": {
        "start_index": 22,
        "seeds": (52018411, 52018412, 52018413),
        "denoise": (0.12, 0.18, 0.24),
        "lora_strength": 0.25,
        "prompt": "aged beige tan ochre parchment scroll border only, curled ribbon edges and four small illuminated corner medallions, restrained gold ultramarine vermilion border detail, hollow empty cyan center and flat cyan outside silhouette, warm natural parchment, restrained ink accents",
        "negative": "metal, picture frame, plastic, filled center, text, lines, parchment page, textured center, scene, icon, figure",
    },
}
PHASE13_FULL_COLOUR: Final = {
    "scroll_frame": {
        "start_index": 31,
        "seeds": (71310411, 71310412, 71310413),
        "prompt": (
            "full-colour parchment scroll frame, finer detail, lighter palette, curled warm ivory parchment, "
            "clear transparent centre and outside silhouette, small illuminated gold ultramarine vermilion accents, "
            "hand-painted 2d game UI frame, preserve exact geometry and same open center from the canonical guide"
        ),
        "negative": "pixelated, quantized, limited palette, dithered, chunky pixels, dark muddy parchment, filled centre, pseudo-text, two-page manuscript, double-panel layout",
        "denoise": 0.18,
    },
    "wood_console": {
        "start_index": 31,
        "seeds": (71320421, 71320422, 71320423),
        "prompt": (
            "full-colour medieval oak command console, finer detail, lighter palette, exactly three dark empty recessed panels, "
            "raised upper-edge highlight, visible layered wood grain, clean orthographic 2d game UI strip, preserve exact geometry and panel spacing from the canonical guide"
        ),
        "negative": "pixelated, quantized, limited palette, dithered, two panels, four panels, icons, text, pseudo-text, double-panel layout, dark muddy wood",
        "denoise": 0.18,
    },
    "seal_slot": {
        "start_index": 31,
        "seeds": (71331470, 71331471, 71331472),
        "prompt": (
            "full-colour wax seal panel slot, finer detail, lighter palette, blank recessed circular socket, "
            "transparent outside silhouette, hand-painted 2d game UI token, preserve exact geometry from the canonical guide"
        ),
        "negative": "pixelated, quantized, limited palette, dithered, symbol, letters, numbers, pseudo-text, jewel, building, scene",
        "denoise": 0.18,
    },
    "parchment_texture": {
        "start_index": 31,
        "seeds": (71340441, 71340442, 71340443),
        "prompt": (
            "full-colour seamless parchment panel texture, finer detail, lighter palette, subtle paper fibres, "
            "low contrast warm ivory surface, tileable empty UI panel material, preserve exact square texture framing from the canonical guide"
        ),
        "negative": "pixelated, quantized, limited palette, dithered, dark stains, frame, border, text, pseudo-text, grid, ornament",
        "denoise": 0.18,
    },
    "illumination_corner": {
        "start_index": 31,
        "seeds": (71350451, 71350452, 71350453),
        "prompt": (
            "full-colour illuminated manuscript corner ornament, finer detail, lighter palette, delicate vine leaves, "
            "restrained gold leaf, transparent outside silhouette, hand-painted 2d UI accent, preserve exact corner placement from the canonical guide"
        ),
        "negative": "pixelated, quantized, limited palette, dithered, full frame, text, pseudo-text, central medallion, dark background",
        "denoise": 0.18,
    },
}
DARK_WELL_RGB: Final = (42, 31, 24)
CYAN_RGB: Final = (0, 255, 255)
WOOD_BASE_RGB: Final = (142, 96, 54)
SCROLL_LIGHT_RGB: Final = (218, 181, 122)
SCROLL_DARK_RGB: Final = (114, 78, 45)
SCROLL_GOLD_RGB: Final = (201, 162, 39)
SCROLL_ULTRAMARINE_RGB: Final = (42, 74, 138)
SCROLL_VERMILION_RGB: Final = (168, 50, 50)
COMFY_INPUT_DIR: Final = Path(os.environ.get("COMFYUI_INPUT", str(COMFY_ROOT / "input")))
CANDIDATE_NAME_RE: Final = re.compile(r"^candidate_(?P<index>[1-9][0-9]*)_seed_(?P<seed>[1-9][0-9]*)\.png$")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

@dataclass(frozen=True, slots=True)
class AssetSpec:
    key: str
    width: int
    height: int
    latent_width: int
    latent_height: int
    seeds: tuple[int, int, int]
    prompt: str
    negative: str | None
    alpha: bool


ASSETS: Final = (
    AssetSpec(
        key="scroll_frame",
        width=512,
        height=512,
        latent_width=1024,
        latent_height=1024,
        seeds=(52010411, 52010412, 52010413),
        prompt=(
            "parchment scroll UI frame only, curled parchment edges, quiet corner medallions, thin ink border, "
            "completely empty transparent center opening, no writing surface texture inside the center, transparent outside silhouette"
        ),
        negative=(
            "text, letters, numbers, handwriting, ruled lines, map marks, filled interior, parchment texture in the center, "
            "solid background, scene, landscape, icon, figure, heraldic symbol"
        ),
        alpha=True,
    ),
    AssetSpec(
        key="wood_console",
        width=1920,
        height=160,
        latent_width=1536,
        latent_height=512,
        seeds=(52020421, 52020422, 52020423),
        prompt=(
            "plain flat horizontal aged oak plank command console, minimal wood grain, exactly three sunken rectangular recesses, "
            "upper recess edges subtly highlighted and lower recess edges softly shadowed, iron brackets only at far left and far right, "
            "clean orthographic 2d game UI strip"
        ),
        negative=(
            "vines, foliage, leaves, gold, gold leaf, repeating carvings, ornament, scroll, parchment, paper, book, page, text, "
            "letters, numbers, symbols, central emblem, clutter, modern UI, bevel glow"
        ),
        alpha=False,
    ),
    AssetSpec(
        key="seal_slot",
        width=64,
        height=64,
        latent_width=1024,
        latent_height=1024,
        seeds=(52031470, 52031471, 52031472),
        prompt=(
            "isolated circular wax seal slot for a game UI, one blank recessed ring only, "
            "plain empty center, quiet bevel, handmade wax rim, centered 64x64 inventory socket asset, "
            "transparent outside silhouette, no manuscript page, no panel, no ornament, no symbol"
        ),
        negative=(
            "architecture, shrine, window, arch, building, room, human, person, agent, character, face, body, "
            "terrain, road, book, manuscript page, document, scroll, full page scene, heraldic icon, medallion symbol, "
            "jewel, gem, flower emblem, compass rose, crosshair, letter, number, text, label, landscape, border frame, multiple objects"
        ),
        alpha=True,
    ),
    AssetSpec(
        key="parchment_texture",
        width=512,
        height=512,
        latent_width=1024,
        latent_height=1024,
        seeds=(52040441, 52040442, 52040443),
        prompt="seamless subtle parchment paper fibre and faint stains, low contrast, no border, no text, tileable background surface",
        negative=None,
        alpha=False,
    ),
    AssetSpec(
        key="illumination_corner",
        width=128,
        height=128,
        latent_width=1024,
        latent_height=1024,
        seeds=(52050451, 52050452, 52050453),
        prompt="vine leaf and gold-leaf corner flourish, asymmetrical hand-painted medieval ornament, transparent outside silhouette",
        negative=None,
        alpha=True,
    ),
)


def rgb_to_mask_int(rgb: tuple[int, int, int]) -> int:
    return (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]


def build_wood_console_guide() -> Image.Image:
    image = Image.new("RGB", (1920, 160), WOOD_BASE_RGB)
    draw = ImageDraw.Draw(image)
    for y, color in (
        (18, (128, 84, 49)),
        (24, (177, 128, 78)),
        (42, (105, 69, 41)),
        (64, (159, 111, 65)),
        (104, (121, 78, 45)),
        (140, (172, 119, 70)),
    ):
        draw.line((30, y, 1888, y), fill=color, width=2)
    for x in range(48, 1872, 96):
        draw.arc((x, 40, x + 58, 78), 190, 350, fill=(112, 73, 43), width=2)
        draw.arc((x + 12, 96, x + 76, 130), 15, 175, fill=(168, 117, 68), width=2)
    for index, x in enumerate(range(72, 1850, 40)):
        grain_color = ((118, 78, 46), (154, 103, 60), (92, 61, 38), (181, 126, 74))[index % 4]
        draw.line((x, 18, x + 28, 18), fill=grain_color, width=2)
    draw.line((30, 14, 1888, 14), fill=(198, 148, 94), width=4)
    draw.line((30, 20, 1888, 20), fill=(184, 135, 83), width=2)
    margin, gap, well_y0, well_y1 = 72, 44, 32, 128
    well_w = (1920 - margin * 2 - gap * 2) // 3
    for index in range(3):
        x0 = margin + index * (well_w + gap)
        x1 = x0 + well_w - 1
        draw.rectangle((x0, well_y0, x1, well_y1), fill=DARK_WELL_RGB)
        draw.line((x0, well_y0, x1, well_y0), fill=(183, 135, 83), width=4)
        draw.line((x0, well_y1, x1, well_y1), fill=(54, 38, 28), width=5)
    for x in (margin + well_w, margin + well_w + gap + well_w):
        draw.rectangle((x, 12, x + gap - 1, 147), fill=(111, 72, 42))
    draw.rectangle((0, 0, 28, 159), fill=(45, 39, 34))
    draw.rectangle((1891, 0, 1919, 159), fill=(45, 39, 34))
    return image


def build_scroll_frame_guide() -> Image.Image:
    image = Image.new("RGB", (512, 512), CYAN_RGB)
    draw = ImageDraw.Draw(image)
    tan, light, dark = (188, 139, 85), SCROLL_LIGHT_RGB, SCROLL_DARK_RGB
    draw.rounded_rectangle((70, 44, 442, 104), radius=24, fill=tan, outline=dark, width=5)
    draw.rounded_rectangle((70, 408, 442, 468), radius=24, fill=tan, outline=dark, width=5)
    draw.rounded_rectangle((44, 70, 104, 442), radius=24, fill=tan, outline=dark, width=5)
    draw.rounded_rectangle((408, 70, 468, 442), radius=24, fill=tan, outline=dark, width=5)
    for x0, y0, x1, y1 in ((78, 58, 434, 78), (78, 434, 434, 454), (58, 78, 78, 434), (434, 78, 454, 434)):
        draw.rounded_rectangle((x0, y0, x1, y1), radius=8, fill=light)
    for cx, cy in ((76, 76), (436, 76), (76, 436), (436, 436)):
        draw.ellipse((cx - 31, cy - 31, cx + 31, cy + 31), fill=light, outline=dark, width=5)
        draw.ellipse((cx - 14, cy - 14, cx + 14, cy + 14), fill=SCROLL_GOLD_RGB, outline=dark, width=4)
    draw.ellipse((62, 62, 90, 90), fill=SCROLL_GOLD_RGB, outline=SCROLL_VERMILION_RGB, width=4)
    draw.ellipse((422, 62, 450, 90), fill=SCROLL_ULTRAMARINE_RGB, outline=SCROLL_GOLD_RGB, width=4)
    draw.ellipse((62, 422, 90, 450), fill=SCROLL_VERMILION_RGB, outline=SCROLL_GOLD_RGB, width=4)
    draw.ellipse((422, 422, 450, 450), fill=SCROLL_GOLD_RGB, outline=SCROLL_ULTRAMARINE_RGB, width=4)
    for x0, y0, x1, y1 in ((120, 62, 392, 70), (120, 442, 392, 450)):
        for x in range(x0, x1, 48):
            draw.rectangle((x, y0, x + 12, y1), fill=SCROLL_ULTRAMARINE_RGB)
            draw.rectangle((x + 18, y0, x + 30, y1), fill=SCROLL_VERMILION_RGB)
    for cx, cy in ((116, 68), (396, 68), (116, 444), (396, 444)):
        draw.arc((cx - 22, cy - 16, cx + 22, cy + 16), 20, 340, fill=dark, width=4)
    draw.rectangle((108, 108, 404, 404), fill=CYAN_RGB)
    return image


def build_guide(asset: str) -> Image.Image:
    if asset == "wood_console": return build_wood_console_guide()
    if asset == "scroll_frame": return build_scroll_frame_guide()
    raise ValueError(f"No guided generation for {asset}")


def guide_metadata(
    asset: str,
    image: Image.Image,
    seed: int,
    denoise: float,
    guide_name: str,
    candidate_name: str,
    reference_names: tuple[str, str, str] = BUILDING_REFERENCE_NAMES,
) -> dict[str, object]:
    import hashlib
    return {
        "asset": asset,
        "guide": guide_name,
        "candidate": candidate_name,
        "guideSha256": hashlib.sha256(image.tobytes()).hexdigest(),
        "dimensions": [image.width, image.height],
        "mode": image.mode,
        "seed": seed,
        "denoise": denoise,
        "referenceMode": BUILDING_STYLE_REFERENCE_MODE,
        "buildingReferenceNames": list(reference_names),
        "buildingReferencePaths": [path.as_posix() for path in BUILDING_REFERENCE_PATHS],
    }


def guided_workflow_prompt(
    spec: AssetSpec,
    seed: int,
    denoise: float,
    prefix: str,
    guide_name: str,
    reference_names: tuple[str, str, str] = BUILDING_REFERENCE_NAMES,
) -> dict[str, dict[str, object]]:
    guided = GUIDED[spec.key]
    lora_strength = float(guided["lora_strength"])
    is_scroll = spec.key == "scroll_frame"
    restore_color = CYAN_RGB if is_scroll else DARK_WELL_RGB
    latent_node = "8" if is_scroll else "7"
    pixel_source = "12" if is_scroll else "11"
    workflow: dict[str, dict[str, object]] = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"}},
        "2": {"class_type": "LoraLoader", "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": "pixel-art-xl.safetensors", "strength_model": lora_strength, "strength_clip": lora_strength}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 1], "text": str(guided["prompt"])}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 1], "text": f"{NEGATIVE_PROMPT}, {guided['negative']}"}},
        "5": {"class_type": "LoadImage", "inputs": {"image": guide_name}},
        "6": {"class_type": "ImageColorToMask", "inputs": {"image": ["5", 0], "color": rgb_to_mask_int(restore_color)}},
        "19": {"class_type": "IPAdapterUnifiedLoader", "inputs": {"model": ["2", 0], "preset": UI_IPADAPTER_PRESET}},
        "21": {"class_type": "LoadImage", "inputs": {"image": reference_names[0]}},
        "22": {"class_type": "LoadImage", "inputs": {"image": reference_names[1]}},
        "23": {"class_type": "LoadImage", "inputs": {"image": reference_names[2]}},
        "24": {"class_type": "ImageBatch", "inputs": {"image1": ["21", 0], "image2": ["22", 0]}},
        "25": {"class_type": "ImageBatch", "inputs": {"image1": ["24", 0], "image2": ["23", 0]}},
        "20": {
            "class_type": "IPAdapterAdvanced",
            "inputs": {
                "model": ["19", 0],
                "ipadapter": ["19", 1],
                "image": ["25", 0],
                "weight": 0.08,
                "start_at": 0.0,
                "end_at": 0.35,
                "weight_type": "style transfer precise",
                "combine_embeds": "average",
                "embeds_scaling": "K+V w/ C penalty",
            },
        },
        "9": {"class_type": "KSampler", "inputs": {"model": ["20", 0], "positive": ["3", 0], "negative": ["4", 0], "latent_image": [latent_node, 0], "seed": seed, "steps": 22, "cfg": 5.5, "sampler_name": "euler", "scheduler": "normal", "denoise": denoise}},
        "10": {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["1", 2]}},
        "11": {"class_type": "Pixelization", "inputs": {"image": ["10", 0], "pixel_size": 4, "upscale_after": True, "copy_hue": is_scroll, "copy_sat": is_scroll, "copy_val": False, "restore_dark": 15, "restore_bright": 1}},
        "13": {"class_type": "ImageCompositeMasked", "inputs": {"destination": [pixel_source, 0], "source": ["5", 0], "x": 0, "y": 0, "resize_source": False, "mask": ["6", 0]}},
        "14": {"class_type": "SaveImage", "inputs": {"images": ["13", 0], "filename_prefix": prefix}},
    }
    if is_scroll:
        workflow["7"] = {"class_type": "InvertMask", "inputs": {"mask": ["6", 0]}}
        workflow["8"] = {"class_type": "VAEEncodeForInpaint", "inputs": {"pixels": ["5", 0], "vae": ["1", 2], "mask": ["7", 0], "grow_mask_by": 6}}
        workflow["12"] = {"class_type": "ImageCompositeMasked", "inputs": {"destination": ["11", 0], "source": ["5", 0], "x": 0, "y": 0, "resize_source": False, "mask": ["6", 0]}}
        workflow["15"] = {"class_type": "ImageColorToMask", "inputs": {"image": ["5", 0], "color": rgb_to_mask_int(SCROLL_LIGHT_RGB)}}
        workflow["16"] = {"class_type": "ImageCompositeMasked", "inputs": {"destination": ["13", 0], "source": ["5", 0], "x": 0, "y": 0, "resize_source": False, "mask": ["15", 0]}}
        workflow["17"] = {"class_type": "ImageColorToMask", "inputs": {"image": ["5", 0], "color": rgb_to_mask_int(SCROLL_DARK_RGB)}}
        workflow["18"] = {"class_type": "ImageCompositeMasked", "inputs": {"destination": ["16", 0], "source": ["5", 0], "x": 0, "y": 0, "resize_source": False, "mask": ["17", 0]}}
        workflow["26"] = {"class_type": "ImageColorToMask", "inputs": {"image": ["5", 0], "color": rgb_to_mask_int(SCROLL_GOLD_RGB)}}
        workflow["27"] = {"class_type": "ImageCompositeMasked", "inputs": {"destination": ["18", 0], "source": ["5", 0], "x": 0, "y": 0, "resize_source": False, "mask": ["26", 0]}}
        workflow["28"] = {"class_type": "ImageColorToMask", "inputs": {"image": ["5", 0], "color": rgb_to_mask_int(SCROLL_ULTRAMARINE_RGB)}}
        workflow["29"] = {"class_type": "ImageCompositeMasked", "inputs": {"destination": ["27", 0], "source": ["5", 0], "x": 0, "y": 0, "resize_source": False, "mask": ["28", 0]}}
        workflow["30"] = {"class_type": "ImageColorToMask", "inputs": {"image": ["5", 0], "color": rgb_to_mask_int(SCROLL_VERMILION_RGB)}}
        workflow["31"] = {"class_type": "ImageCompositeMasked", "inputs": {"destination": ["29", 0], "source": ["5", 0], "x": 0, "y": 0, "resize_source": False, "mask": ["30", 0]}}
        workflow["14"]["inputs"]["images"] = ["31", 0]
    else:
        workflow["7"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["5", 0], "vae": ["1", 2]}}
    return workflow


def upload_building_reference_images(repo_root: Path = REPO_ROOT) -> tuple[str, str, str]:
    COMFY_INPUT_DIR.mkdir(parents=True, exist_ok=True)
    for relative, name in zip(BUILDING_REFERENCE_PATHS, BUILDING_REFERENCE_NAMES, strict=True):
        shutil.copyfile(repo_root / relative, COMFY_INPUT_DIR / name)
    return BUILDING_REFERENCE_NAMES


def generate_guided(targets: AssetTargets = None) -> None:
    STAGE_DIR.mkdir(parents=True, exist_ok=True); CONTACT_DIR.mkdir(parents=True, exist_ok=True); COMFY_INPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {"assets": []}
    reference_names = upload_building_reference_images(REPO_ROOT)
    for spec in selected_asset_specs(targets):
        if spec.key not in GUIDED: continue
        guided = GUIDED[spec.key]; asset_dir = STAGE_DIR / spec.key; asset_dir.mkdir(parents=True, exist_ok=True)
        guide = build_guide(spec.key); guide_name = f"phase2_5_{spec.key}_guide.png"; guide.save(COMFY_INPUT_DIR / guide_name)
        seeds = guided["seeds"]; denoises = guided["denoise"]; start_index = guided["start_index"]
        if not isinstance(seeds, tuple) or not isinstance(denoises, tuple) or not isinstance(start_index, int): raise RuntimeError(f"Invalid guided config for {spec.key}")
        candidates: list[dict[str, object]] = []; candidate_paths: list[Path] = []
        for offset, (seed, denoise) in enumerate(zip(seeds, denoises, strict=True), start=start_index):
            prefix = f"phase2_ui/{spec.key}/{spec.key}_guided_seed_{seed}"
            prompt_id = queue_prompt(guided_workflow_prompt(spec, int(seed), float(denoise), prefix, guide_name, reference_names))
            output_path = wait_for_outputs(prompt_id)[0]
            candidate_path = asset_dir / f"candidate_{offset}_seed_{seed}.png"
            Image.open(output_path).save(candidate_path)
            candidate_paths.append(candidate_path)
            candidates.append(guide_metadata(spec.key, guide, int(seed), float(denoise), guide_name, f"{spec.key}/{candidate_path.name}", reference_names))
        end_index = start_index + len(candidate_paths) - 1
        make_contact_sheet(spec, candidate_paths, sheet_name=f"guided_{start_index}_{end_index}_contact_sheet.png")
        manifest["assets"].append({"key": spec.key, "candidates": candidates})
    (STAGE_DIR / "guided_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

def api_json(path: str, payload: dict[str, object] | None = None) -> dict[str, object]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{COMFY_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="GET" if payload is None else "POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Comfy API request failed for {path}: {exc}") from exc


def workflow_prompt(
    spec: AssetSpec,
    seed: int,
    prefix: str,
    prompt: str | None = None,
    negative: str | None = None,
    include_common: bool = True,
) -> dict[str, dict[str, object]]:
    positive_text = spec.prompt if prompt is None else prompt
    full_positive_text = f"{COMMON_PROMPT}, {positive_text}" if include_common else positive_text
    negative_text = NEGATIVE_PROMPT if negative is None else f"{NEGATIVE_PROMPT}, {negative}"
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"}},
        "2": {
            "class_type": "LoraLoader",
            "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": "pixel-art-xl.safetensors", "strength_model": 0.8, "strength_clip": 0.8},
        },
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 1], "text": full_positive_text}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 1], "text": negative_text}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": spec.latent_width, "height": spec.latent_height, "batch_size": 1}},
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["2", 0],
                "positive": ["3", 0],
                "negative": ["4", 0],
                "latent_image": ["5", 0],
                "seed": seed,
                "steps": 25,
                "cfg": 7,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1,
            },
        },
        "7": {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
        "8": {
            "class_type": "Pixelization",
            "inputs": {
                "image": ["7", 0],
                "pixel_size": 4,
                "upscale_after": True,
                "copy_hue": False,
                "copy_sat": False,
                "copy_val": False,
                "restore_dark": 15,
                "restore_bright": 1,
            },
        },
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": prefix}},
    }


def phase13_full_colour_workflow_prompt(
    spec: AssetSpec,
    seed: int,
    prefix: str,
    guide_name: str,
) -> dict[str, dict[str, object]]:
    config = PHASE13_FULL_COLOUR[spec.key]
    positive_text = (
        f"{COMMON_PROMPT}, {config['prompt']}, preserve full RGB colour depth, no quantization, no pixelization"
    )
    negative_text = f"{NEGATIVE_PROMPT}, {config['negative']}"
    denoise = float(config["denoise"])
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": positive_text}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": negative_text}},
        "5": {"class_type": "LoadImage", "inputs": {"image": guide_name}},
        "6": {"class_type": "VAEEncode", "inputs": {"pixels": ["5", 0], "vae": ["1", 2]}},
        "7": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["3", 0],
                "negative": ["4", 0],
                "latent_image": ["6", 0],
                "seed": seed,
                "steps": 20,
                "cfg": 4.5,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": denoise,
            },
        },
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["1", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": prefix}},
    }


def queue_prompt(prompt: dict[str, dict[str, object]]) -> str:
    response = api_json("/prompt", {"prompt": prompt})
    prompt_id = response.get("prompt_id")
    if not isinstance(prompt_id, str):
        raise RuntimeError(f"Comfy did not return a prompt_id: {response}")
    return prompt_id


def contained_output_path(subfolder: str, filename: str) -> Path:
    root = COMFY_OUTPUT.resolve()
    if any(Path(part).is_absolute() or PureWindowsPath(part).is_absolute() for part in (subfolder, filename)):
        raise RuntimeError("Comfy output path must be relative to COMFY_OUTPUT")
    candidate = (root / subfolder / filename).resolve()
    if root not in candidate.parents or candidate.suffix.lower() != ".png":
        raise RuntimeError("Comfy output path must be a PNG inside COMFY_OUTPUT")
    return candidate


def wait_for_outputs(prompt_id: str) -> list[Path]:
    deadline = time.monotonic() + 900
    while time.monotonic() < deadline:
        history = api_json(f"/history/{prompt_id}")
        item = history.get(prompt_id)
        if isinstance(item, dict):
            outputs = item.get("outputs")
            if isinstance(outputs, dict):
                paths: list[Path] = []
                for output in outputs.values():
                    if isinstance(output, dict) and isinstance(output.get("images"), list):
                        for image in output["images"]:
                            if isinstance(image, dict) and isinstance(image.get("filename"), str):
                                subfolder = image.get("subfolder") if isinstance(image.get("subfolder"), str) else ""
                                paths.append(contained_output_path(subfolder, image["filename"]))
                if paths:
                    return paths
        time.sleep(2)
    raise TimeoutError(f"Timed out waiting for Comfy prompt {prompt_id}")


def selected_asset_specs(targets: AssetTargets = None) -> tuple[AssetSpec, ...]:
    if targets is None:
        return ASSETS
    valid_keys = {spec.key for spec in ASSETS}
    unknown = sorted(targets - valid_keys)
    if unknown:
        raise ValueError(f"Unknown target asset(s): {', '.join(unknown)}")
    return tuple(spec for spec in ASSETS if spec.key in targets)


def generate(targets: AssetTargets = None) -> None:
    STAGE_DIR.mkdir(parents=True, exist_ok=True)
    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {"models": ["sd_xl_base_1.0.safetensors", "pixel-art-xl.safetensors"], "assets": []}
    for spec in selected_asset_specs(targets):
        asset_dir = STAGE_DIR / spec.key
        asset_dir.mkdir(parents=True, exist_ok=True)
        candidates: list[dict[str, object]] = []
        candidate_paths: list[Path] = []
        for index, seed in enumerate(spec.seeds, start=1):
            prefix = f"phase2_ui/{spec.key}/{spec.key}_seed_{seed}"
            prompt_id = queue_prompt(workflow_prompt(spec, seed, prefix, negative=spec.negative))
            output_path = wait_for_outputs(prompt_id)[0]
            candidate_path = asset_dir / f"candidate_{index}_seed_{seed}.png"
            Image.open(output_path).save(candidate_path)
            candidate_paths.append(candidate_path)
            candidates.append({"index": index, "seed": seed, "path": f"{spec.key}/{candidate_path.name}"})
        make_contact_sheet(spec, candidate_paths)
        manifest["assets"].append({"spec": asdict(spec), "candidates": candidates})
    (STAGE_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def generate_refinements(targets: AssetTargets = None) -> None:
    STAGE_DIR.mkdir(parents=True, exist_ok=True)
    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = STAGE_DIR / "refinement_manifest.json"
    manifest: dict[str, object] = {"assets": []}
    for spec in selected_asset_specs(targets):
        refinement = REFINEMENTS.get(spec.key)
        if refinement is None:
            continue
        asset_dir = STAGE_DIR / spec.key
        asset_dir.mkdir(parents=True, exist_ok=True)
        candidates: list[dict[str, object]] = []
        seeds = refinement["seeds"]
        if not isinstance(seeds, tuple):
            raise RuntimeError(f"Invalid refinement seeds for {spec.key}")
        start_index = refinement.get("start_index", 4)
        if not isinstance(start_index, int):
            raise RuntimeError(f"Invalid refinement start_index for {spec.key}")
        for offset, seed in enumerate(seeds, start=start_index):
            prefix = f"phase2_ui/{spec.key}/{spec.key}_refined_seed_{seed}"
            include_common = refinement.get("include_common", True)
            if not isinstance(include_common, bool):
                raise RuntimeError(f"Invalid refinement include_common for {spec.key}")
            prompt_id = queue_prompt(workflow_prompt(
                spec,
                seed,
                prefix,
                str(refinement["prompt"]),
                str(refinement["negative"]),
                include_common=include_common,
            ))
            output_path = wait_for_outputs(prompt_id)[0]
            candidate_path = asset_dir / f"candidate_{offset}_seed_{seed}.png"
            Image.open(output_path).save(candidate_path)
            candidates.append({"index": offset, "seed": seed, "path": f"{spec.key}/{candidate_path.name}", "refinement": True})
        make_contact_sheet(spec, [asset_dir / f"candidate_{candidate['index']}_seed_{candidate['seed']}.png" for candidate in candidates])
        manifest["assets"].append({"key": spec.key, "prompt": refinement["prompt"], "negative": refinement["negative"], "includeCommon": include_common, "candidates": candidates})
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def generate_phase13_full_colour(targets: AssetTargets = None) -> None:
    STAGE_DIR.mkdir(parents=True, exist_ok=True)
    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {
        "phase": "phase13-full-colour",
        "models": ["sd_xl_base_1.0.safetensors"],
        "palettePolicy": "full-rgb-no-quantization",
        "postprocess": "raw VAE decode saved without Pixelization, palette quantization, or pixel-grid processing",
        "assets": [],
    }
    for spec in selected_asset_specs(targets):
        config = PHASE13_FULL_COLOUR[spec.key]
        seeds = config["seeds"]
        start_index = config["start_index"]
        if not isinstance(seeds, tuple) or not isinstance(start_index, int):
            raise RuntimeError(f"Invalid Phase 13 full-colour config for {spec.key}")
        asset_dir = STAGE_DIR / spec.key
        asset_dir.mkdir(parents=True, exist_ok=True)
        guide_name = upload_phase13_guide_image(spec)
        candidates: list[dict[str, object]] = []
        candidate_paths: list[Path] = []
        for index, seed in enumerate(seeds, start=start_index):
            prefix = f"phase13_ui/{spec.key}/{spec.key}_full_colour_seed_{seed}"
            prompt_id = queue_prompt(phase13_full_colour_workflow_prompt(spec, int(seed), prefix, guide_name))
            output_path = wait_for_outputs(prompt_id)[0]
            candidate_path = asset_dir / f"candidate_{index}_seed_{seed}.png"
            with Image.open(output_path) as image:
                image.save(candidate_path)
                width, height = image.size
            candidate_paths.append(candidate_path)
            candidates.append({
                "index": index,
                "seed": seed,
                "path": f"{spec.key}/{candidate_path.name}",
                "width": width,
                "height": height,
                "palettePolicy": "full-rgb-no-quantization",
            })
        make_contact_sheet(spec, candidate_paths, sheet_name=f"phase13_full_colour_{start_index}_{start_index + len(candidate_paths) - 1}_contact_sheet.png")
        manifest["assets"].append({
            "key": spec.key,
            "releasePath": f"public/assets/ui/{spec.key}.png",
            "beforePath": f"docs/asset-evidence/before/{spec.key}.png",
            "guide": guide_name,
            "denoise": config["denoise"],
            "alpha": "transparent" if spec.alpha else "opaque",
            "prompt": config["prompt"],
            "negative": config["negative"],
            "candidates": candidates,
        })
    (STAGE_DIR / "phase13_full_colour_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def upload_phase13_guide_image(spec: AssetSpec) -> str:
    COMFY_INPUT_DIR.mkdir(parents=True, exist_ok=True)
    guide_name = f"phase13_{spec.key}_guide.png"
    source = BEFORE_DIR / f"{spec.key}.png"
    if not source.exists():
        source = UI_ASSET_DIR / f"{spec.key}.png"
    if not source.exists():
        raise RuntimeError(f"Phase 13 guide source is missing for {spec.key}")
    shutil.copyfile(source, COMFY_INPUT_DIR / guide_name)
    return guide_name


def crop_to_ratio(image: Image.Image, width: int, height: int) -> Image.Image:
    source_ratio = image.width / image.height
    target_ratio = width / height
    if source_ratio > target_ratio:
        new_width = int(image.height * target_ratio)
        left = (image.width - new_width) // 2
        return image.crop((left, 0, left + new_width, image.height))
    new_height = int(image.width / target_ratio)
    top = (image.height - new_height) // 2
    return image.crop((0, top, image.width, top + new_height))


def alpha_key(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    corner = rgba.getpixel((0, 0))
    data = bytearray(rgba.tobytes())
    for index in range(0, len(data), 4):
        distance = abs(data[index] - corner[0]) + abs(data[index + 1] - corner[1]) + abs(data[index + 2] - corner[2])
        if distance < 42:
            data[index + 3] = 0
    return Image.frombytes("RGBA", rgba.size, bytes(data))


def clear_scroll_perimeter(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    band_x = max(1, int(rgba.width * 0.04))
    band_y = max(1, int(rgba.height * 0.04))
    for y in range(rgba.height):
        for x in range(rgba.width):
            if x < band_x or x >= rgba.width - band_x or y < band_y or y >= rgba.height - band_y:
                red, green, blue, _alpha = pixels[x, y]
                pixels[x, y] = (red, green, blue, 0)
    return rgba


def prepare_selected(selection: dict[str, int], targets: AssetTargets = None) -> None:
    BEFORE_DIR.mkdir(parents=True, exist_ok=True)
    for spec in selected_asset_specs(targets):
        matches = sorted((STAGE_DIR / spec.key).glob(f"candidate_{selection[spec.key]}_seed_*.png"))
        if len(matches) != 1:
            raise RuntimeError(f"Expected one selected candidate for {spec.key} index {selection[spec.key]}, found {len(matches)}")
        source = matches[0]
        with Image.open(source) as image:
            source_image = image.convert("RGBA")
            crop_box = CROP_BOXES.get(spec.key)
            if spec.key == "wood_console":
                prepared = source_image.resize((spec.width, spec.height), Image.Resampling.LANCZOS)
            else:
                if crop_box is not None:
                    cropped = source_image.crop(crop_box)
                else:
                    cropped = crop_to_ratio(source_image, spec.width, spec.height)
                prepared = cropped.resize((spec.width, spec.height), Image.Resampling.LANCZOS)
            if spec.alpha:
                prepared = alpha_key(prepared)
            if spec.key == "scroll_frame":
                prepared = clear_scroll_perimeter(prepared)
        prepared.save(BEFORE_DIR / f"{spec.key}.png")


def prepare_phase13_selected(selection: dict[str, int], targets: AssetTargets = None) -> None:
    PHASE13_PREPARED_DIR.mkdir(parents=True, exist_ok=True)
    for spec in selected_asset_specs(targets):
        matches = sorted((STAGE_DIR / spec.key).glob(f"candidate_{selection[spec.key]}_seed_*.png"))
        if len(matches) != 1:
            raise RuntimeError(f"Expected one selected candidate for {spec.key} index {selection[spec.key]}, found {len(matches)}")
        source = matches[0]
        with Image.open(source) as image:
            source_image = image.convert("RGBA")
            crop_box = CROP_BOXES.get(spec.key)
            if spec.key == "wood_console":
                prepared = source_image.resize((spec.width, spec.height), Image.Resampling.LANCZOS)
            else:
                cropped = source_image.crop(crop_box) if crop_box is not None else crop_to_ratio(source_image, spec.width, spec.height)
                prepared = cropped.resize((spec.width, spec.height), Image.Resampling.LANCZOS)
            if spec.alpha:
                prepared = alpha_key(prepared)
            if spec.key == "scroll_frame":
                prepared = clear_scroll_perimeter(prepared)
        prepared.save(PHASE13_PREPARED_DIR / f"{spec.key}.png")


def phase13_candidate_manifest(spec: AssetSpec) -> list[dict[str, int | str]]:
    candidates: list[dict[str, int | str]] = []
    for path in sorted((STAGE_DIR / spec.key).glob("candidate_*_seed_*.png")):
        match = CANDIDATE_NAME_RE.match(path.name)
        if match is None:
            continue
        with Image.open(path) as image:
            width, height = image.size
        candidates.append({
            "index": int(match.group("index")),
            "seed": int(match.group("seed")),
            "path": f"{spec.key}/{path.name}",
            "width": width,
            "height": height,
            "sha256": sha256_file(path),
        })
    return candidates


def assert_phase13_scroll_layout(image: Image.Image) -> None:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    interior = (
        int(width * 0.25),
        int(height * 0.25),
        int(width * 0.75),
        int(height * 0.75),
    )
    pixels = rgba.load()
    interior_total = 0
    transparent_interior = 0
    for y in range(interior[1], interior[3]):
        for x in range(interior[0], interior[2]):
            interior_total += 1
            if pixels[x, y][3] == 0:
                transparent_interior += 1
    if transparent_interior / interior_total < 0.7:
        raise RuntimeError("Phase 13 scroll_frame layout drift: center is not open")

    band_x = max(1, int(width * 0.04))
    band_y = max(1, int(height * 0.04))
    for y in range(height):
        for x in range(width):
            exterior = x < band_x or x >= width - band_x or y < band_y or y >= height - band_y
            if exterior and pixels[x, y][3] != 0:
                raise RuntimeError("Phase 13 scroll_frame layout drift: outside perimeter is not transparent")


def assert_phase13_wood_layout(image: Image.Image) -> None:
    rgb = image.convert("RGB")
    pixels = rgb.load()
    scan_y = rgb.height // 2
    min_run = max(3, int(rgb.width * 0.1))
    row_lumas = [
        pixels[x, scan_y][0] * 0.299 + pixels[x, scan_y][1] * 0.587 + pixels[x, scan_y][2] * 0.114
        for x in range(rgb.width)
    ]
    low_recess_luma = sorted(row_lumas)[max(0, int(len(row_lumas) * 0.1))]
    dark_threshold = min(low_recess_luma + 18, 85)
    runs = 0
    run_start: int | None = None
    for x in range(rgb.width):
        dark = row_lumas[x] <= dark_threshold and row_lumas[x] < 85
        if dark and run_start is None:
            run_start = x
        if (not dark or x == rgb.width - 1) and run_start is not None:
            run_end = x + 1 if dark and x == rgb.width - 1 else x
            if run_end - run_start >= min_run:
                runs += 1
            run_start = None
    if runs != 3:
        raise RuntimeError(f"Phase 13 wood_console layout drift: expected 3 recesses, found {runs}")


def assert_phase13_prepared_layout(spec: AssetSpec, source: Path) -> None:
    with Image.open(source) as image:
        if image.size != (spec.width, spec.height):
            raise RuntimeError(
                f"Phase 13 {spec.key} layout drift: expected {spec.width}x{spec.height}, found {image.width}x{image.height}"
            )
        if spec.key == "scroll_frame":
            assert_phase13_scroll_layout(image)
        if spec.key == "wood_console":
            assert_phase13_wood_layout(image)


def release_prepared_phase13_assets(selection: dict[str, int], targets: AssetTargets = None) -> None:
    UI_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    UI_ASSET_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    assets: list[dict[str, object]] = []
    for spec in selected_asset_specs(targets):
        source = PHASE13_PREPARED_DIR / f"{spec.key}.png"
        if not source.exists():
            raise RuntimeError(f"Prepared asset is missing: {source}")
        assert_phase13_prepared_layout(spec, source)
        destination = UI_ASSET_DIR / f"{spec.key}.png"
        shutil.copyfile(source, destination)
        candidates = phase13_candidate_manifest(spec)
        if not any(candidate["index"] == selection[spec.key] for candidate in candidates):
            raise RuntimeError(f"Selected Phase 13 candidate {selection[spec.key]} is missing for {spec.key}")
        assets.append({
            "key": spec.key,
            "width": spec.width,
            "height": spec.height,
            "alpha": "transparent" if spec.alpha else "opaque",
            "beforePath": f"docs/asset-evidence/before/{spec.key}.png",
            "finalPath": f"public/assets/ui/{spec.key}.png",
            "selectedIndex": selection[spec.key],
            "candidates": candidates,
            "phase13Status": "accepted-generated",
            "phase13Source": "phase13-candidate",
            "selectedCandidateSha256": selected_candidate_sha(candidates, selection[spec.key], spec.key),
            "preparedPath": f"docs/asset-evidence/phase13/prepared-ui/{spec.key}.png",
            "beforeSha256": sha256_file(BEFORE_DIR / f"{spec.key}.png"),
            "preparedSha256": sha256_file(source),
            "finalSha256": sha256_file(destination),
        })
    UI_ASSET_MANIFEST.write_text(json.dumps({"assets": assets}, indent=2) + "\n", encoding="utf-8")


def selected_candidate_sha(candidates: list[dict[str, int | str]], selected_index: int, key: str) -> str:
    for candidate in candidates:
        if candidate["index"] == selected_index:
            value = candidate.get("sha256")
            if isinstance(value, str):
                return value
    raise RuntimeError(f"Selected Phase 13 candidate {selected_index} is missing for {key}")


def parse_accepted_phase13_selection(values: list[str]) -> dict[str, int]:
    if not values:
        raise ValueError("Accepted Phase 13 release requires at least one explicit --selection")
    selection: dict[str, int] = {}
    valid_keys = {spec.key for spec in ASSETS}
    for value in values:
        key, separator, raw_index = value.partition("=")
        if separator == "":
            raise ValueError(f"Selection must be ASSET=INDEX, got {value}")
        if key not in valid_keys:
            raise ValueError(f"Unknown selection asset {key}")
        if key in selection:
            raise ValueError(f"Duplicate selection asset {key}")
        try:
            index = int(raw_index)
        except ValueError as exc:
            raise ValueError(f"Selection index must be a positive integer for {key}") from exc
        if index <= 0:
            raise ValueError(f"Selection index must be positive for {key}")
        selection[key] = index
    return selection


def existing_ui_manifest_by_key() -> dict[str, dict[str, object]]:
    if not UI_ASSET_MANIFEST.exists():
        raise RuntimeError(f"Existing UI asset manifest is missing: {UI_ASSET_MANIFEST}")
    manifest = json.loads(UI_ASSET_MANIFEST.read_text(encoding="utf-8"))
    assets = manifest.get("assets")
    if not isinstance(assets, list):
        raise RuntimeError("Existing UI asset manifest must contain an assets array")
    by_key: dict[str, dict[str, object]] = {}
    for asset in assets:
        if not isinstance(asset, dict) or not isinstance(asset.get("key"), str):
            raise RuntimeError("Existing UI asset manifest contains an invalid asset entry")
        key = asset["key"]
        if key in by_key:
            raise RuntimeError(f"Existing UI asset manifest has duplicate asset {key}")
        by_key[key] = asset
    return by_key


def release_accepted_phase13_assets(values: list[str]) -> None:
    selection = parse_accepted_phase13_selection(values)
    accepted_targets = frozenset(selection)
    prepare_phase13_selected(selection, accepted_targets)
    UI_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    UI_ASSET_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    existing_manifest = existing_ui_manifest_by_key()
    assets: list[dict[str, object]] = []
    for spec in ASSETS:
        existing_asset = existing_manifest.get(spec.key)
        if existing_asset is None:
            raise RuntimeError(f"Existing UI asset manifest is missing {spec.key}")
        if spec.key in selection:
            source = PHASE13_PREPARED_DIR / f"{spec.key}.png"
            if not source.exists():
                raise RuntimeError(f"Prepared asset is missing: {source}")
            assert_phase13_prepared_layout(spec, source)
            destination = UI_ASSET_DIR / f"{spec.key}.png"
            shutil.copyfile(source, destination)
            candidates = phase13_candidate_manifest(spec)
            if not any(candidate["index"] == selection[spec.key] for candidate in candidates):
                raise RuntimeError(f"Selected Phase 13 candidate {selection[spec.key]} is missing for {spec.key}")
            assets.append({
                "key": spec.key,
                "width": spec.width,
                "height": spec.height,
                "alpha": "transparent" if spec.alpha else "opaque",
                "beforePath": f"docs/asset-evidence/before/{spec.key}.png",
                "finalPath": f"public/assets/ui/{spec.key}.png",
                "selectedIndex": selection[spec.key],
                "candidates": candidates,
                "phase13Status": "accepted-generated",
                "phase13Source": "phase13-candidate",
                "selectedCandidateSha256": selected_candidate_sha(candidates, selection[spec.key], spec.key),
                "preparedPath": f"docs/asset-evidence/phase13/prepared-ui/{spec.key}.png",
                "beforeSha256": sha256_file(BEFORE_DIR / f"{spec.key}.png"),
                "preparedSha256": sha256_file(source),
                "finalSha256": sha256_file(destination),
            })
        else:
            final_path = UI_ASSET_DIR / f"{spec.key}.png"
            before_path = BEFORE_DIR / f"{spec.key}.png"
            if not final_path.exists():
                raise RuntimeError(f"Published asset is missing for preserved Phase 13 key: {final_path}")
            if not before_path.exists():
                raise RuntimeError(f"Before snapshot is missing for preserved Phase 13 key: {before_path}")
            preserved = dict(existing_asset)
            candidates = phase13_candidate_manifest(spec)
            if candidates:
                preserved["candidates"] = candidates
            if candidates and not any(candidate["index"] == preserved["selectedIndex"] for candidate in candidates):
                preserved["selectedIndex"] = candidates[0]["index"]
            preserved["phase13Status"] = "preserved-existing"
            preserved["phase13Source"] = "public/assets/ui"
            preserved["beforeSha256"] = sha256_file(before_path)
            preserved["finalSha256"] = sha256_file(final_path)
            preserved.pop("selectedCandidateSha256", None)
            preserved.pop("preparedPath", None)
            preserved.pop("preparedSha256", None)
            assets.append(preserved)
    UI_ASSET_MANIFEST.write_text(json.dumps({"assets": assets}, indent=2) + "\n", encoding="utf-8")


def make_contact_sheet(spec: AssetSpec, paths: list[Path], sheet_name: str = "contact_sheet.png") -> None:
    thumbs = []
    for path in paths:
        image = Image.open(path).convert("RGBA")
        image.thumbnail((320, 320))
        thumb = Image.new("RGBA", (340, 370), (242, 233, 212, 255))
        thumb.alpha_composite(image, ((340 - image.width) // 2, 12))
        draw = ImageDraw.Draw(thumb)
        draw.text((12, 342), path.stem, fill=(58, 46, 31, 255))
        thumbs.append(thumb)
    sheet = Image.new("RGBA", (340 * len(thumbs), 370), (232, 220, 192, 255))
    for index, thumb in enumerate(thumbs):
        sheet.alpha_composite(thumb, (index * 340, 0))
    sheet.save(STAGE_DIR / spec.key / sheet_name)
    sheet.save(CONTACT_DIR / f"{spec.key}_{sheet_name}")


def parse_selection(values: list[str]) -> dict[str, int]:
    selection = dict(SELECTED)
    valid_keys = {spec.key for spec in ASSETS}
    for value in values:
        key, separator, raw_index = value.partition("=")
        if separator == "":
            raise ValueError(f"Selection must be ASSET=INDEX, got {value}")
        if key not in valid_keys:
            raise ValueError(f"Unknown selection asset {key}")
        try:
            index = int(raw_index)
        except ValueError as exc:
            raise ValueError(f"Selection index must be a positive integer for {key}") from exc
        if index <= 0:
            raise ValueError(f"Selection index must be positive for {key}")
        selection[key] = index
    return selection


def phase13_default_selection() -> dict[str, int]:
    return {
        key: int(config["start_index"])
        for key, config in PHASE13_FULL_COLOUR.items()
    }


def parse_phase13_selection(values: list[str]) -> dict[str, int]:
    selection = phase13_default_selection()
    valid_keys = {spec.key for spec in ASSETS}
    for value in values:
        key, separator, raw_index = value.partition("=")
        if separator == "":
            raise ValueError(f"Selection must be ASSET=INDEX, got {value}")
        if key not in valid_keys:
            raise ValueError(f"Unknown selection asset {key}")
        try:
            index = int(raw_index)
        except ValueError as exc:
            raise ValueError(f"Selection index must be a positive integer for {key}") from exc
        if index <= 0:
            raise ValueError(f"Selection index must be positive for {key}")
        selection[key] = index
    return selection


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate and prepare ComfyUI manuscript UI assets.")
    parser.add_argument("--generate", action="store_true", help="queue three Comfy candidates for every asset")
    parser.add_argument("--generate-refinement", action="store_true", help="queue refinement candidates for weak asset groups")
    parser.add_argument("--generate-guided", action="store_true", help="queue guide-controlled candidates for scroll_frame and wood_console")
    parser.add_argument("--phase13-full-colour", action="store_true", help="queue full-colour Phase 13 UI candidates without pixelization or palette quantization")
    parser.add_argument("--prepare-selected", action="store_true", help="crop/resize selected candidates into repo before assets")
    parser.add_argument("--release-prepared-phase13", action="store_true", help="copy prepared Phase 13 UI assets into public assets and write the UI manifest without quantization")
    parser.add_argument("--release-accepted-phase13", action="store_true", help="publish only explicit accepted Phase 13 selections while preserving rejected UI assets")
    parser.add_argument("--selection", action="append", default=[], help="override selected candidate as ASSET=INDEX")
    parser.add_argument("--target", action="append", choices=sorted({spec.key for spec in ASSETS}), help="limit generation or preparation to one asset; repeat for multiple assets")
    args = parser.parse_args()
    targets = None if args.target is None else frozenset(args.target)
    if args.generate:
        generate(targets)
    if args.generate_refinement:
        generate_refinements(targets)
    if args.generate_guided:
        generate_guided(targets)
    if args.phase13_full_colour:
        generate_phase13_full_colour(targets)
    if args.prepare_selected:
        try:
            selection = parse_phase13_selection(args.selection) if args.release_prepared_phase13 else parse_selection(args.selection)
        except ValueError as exc:
            parser.error(str(exc))
        prepare_selected(selection, targets)
    if args.release_prepared_phase13:
        try:
            selection = parse_phase13_selection(args.selection)
        except ValueError as exc:
            parser.error(str(exc))
        release_prepared_phase13_assets(selection, targets)
    if args.release_accepted_phase13:
        try:
            release_accepted_phase13_assets(args.selection)
        except ValueError as exc:
            parser.error(str(exc))


if __name__ == "__main__":
    main()
