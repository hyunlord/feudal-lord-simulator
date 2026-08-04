#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Final

from PIL import Image, ImageDraw

AssetTargets = frozenset[str] | None

COMFY_ROOT: Final = Path(os.environ.get("COMFYUI_ROOT", str(Path.home() / "ComfyUI")))
COMFY_URL: Final = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")
COMFY_OUTPUT: Final = Path(os.environ.get("COMFYUI_OUTPUT", str(COMFY_ROOT / "output")))
STAGE_DIR: Final = Path(os.environ.get("UI_ASSET_STAGE_DIR", "/tmp/feudal-phase2-ui-candidates"))
REPO_ROOT: Final = Path(__file__).resolve().parents[1]
BEFORE_DIR: Final = REPO_ROOT / "docs" / "asset-evidence" / "before"
CONTACT_DIR: Final = Path("/tmp/feudal-phase2-evidence/assets")
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
    "scroll_frame": 19,
    "wood_console": 12,
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
        "prompt": "pixel art medieval oak command bar preserving exact guide layout, three dark empty wells in one row, two thick plain vertical timber posts, minimal generated oak grain only",
        "negative": "two wells, four wells, extra wells, horizontal bands, multiple rows, windows, doors, icons, shields, gems, gold, vines, ornament, carving, text, symbols, paper, parchment, scene",
    },
    "scroll_frame": {
        "start_index": 19,
        "seeds": (52017411, 52017412, 52017413),
        "denoise": (0.12, 0.18, 0.24),
        "lora_strength": 0.25,
        "prompt": "aged beige tan ochre parchment scroll border only, curled ribbon edges and four small medieval corner medallions, hollow empty cyan center, warm natural parchment, restrained ink accents",
        "negative": "red, orange, coral, vermilion, scarlet, pink, blue, ultramarine, metal, picture frame, plastic, filled center, text, lines, parchment page, textured center, scene, icon, figure",
    },
}
DARK_WELL_RGB: Final = (42, 31, 24)
CYAN_RGB: Final = (0, 255, 255)
SCROLL_LIGHT_RGB: Final = (218, 181, 122)
SCROLL_DARK_RGB: Final = (114, 78, 45)
COMFY_INPUT_DIR: Final = Path(os.environ.get("COMFYUI_INPUT", str(COMFY_ROOT / "input")))

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
    image = Image.new("RGB", (1920, 160), (142, 96, 54))
    draw = ImageDraw.Draw(image)
    for y in (28, 80, 132):
        draw.line((24, y, 1896, y), fill=(156, 108, 63), width=2)
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
        draw.ellipse((cx - 14, cy - 14, cx + 14, cy + 14), fill=tan, outline=dark, width=4)
    for cx, cy in ((116, 68), (396, 68), (116, 444), (396, 444)):
        draw.arc((cx - 22, cy - 16, cx + 22, cy + 16), 20, 340, fill=dark, width=4)
    draw.rectangle((108, 108, 404, 404), fill=CYAN_RGB)
    return image


def build_guide(asset: str) -> Image.Image:
    if asset == "wood_console": return build_wood_console_guide()
    if asset == "scroll_frame": return build_scroll_frame_guide()
    raise ValueError(f"No guided generation for {asset}")


def guide_metadata(asset: str, image: Image.Image, seed: int, denoise: float, guide_name: str, candidate_name: str) -> dict[str, object]:
    import hashlib
    return {"asset": asset, "guide": guide_name, "candidate": candidate_name, "guideSha256": hashlib.sha256(image.tobytes()).hexdigest(), "dimensions": [image.width, image.height], "mode": image.mode, "seed": seed, "denoise": denoise}


def guided_workflow_prompt(spec: AssetSpec, seed: int, denoise: float, prefix: str, guide_name: str) -> dict[str, dict[str, object]]:
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
        "9": {"class_type": "KSampler", "inputs": {"model": ["2", 0], "positive": ["3", 0], "negative": ["4", 0], "latent_image": [latent_node, 0], "seed": seed, "steps": 22, "cfg": 5.5, "sampler_name": "euler", "scheduler": "normal", "denoise": denoise}},
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
        workflow["14"]["inputs"]["images"] = ["18", 0]
    else:
        workflow["7"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["5", 0], "vae": ["1", 2]}}
    return workflow


def generate_guided(targets: AssetTargets = None) -> None:
    STAGE_DIR.mkdir(parents=True, exist_ok=True); CONTACT_DIR.mkdir(parents=True, exist_ok=True); COMFY_INPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {"assets": []}
    for spec in selected_asset_specs(targets):
        if spec.key not in GUIDED: continue
        guided = GUIDED[spec.key]; asset_dir = STAGE_DIR / spec.key; asset_dir.mkdir(parents=True, exist_ok=True)
        guide = build_guide(spec.key); guide_name = f"phase2_5_{spec.key}_guide.png"; guide.save(COMFY_INPUT_DIR / guide_name)
        seeds = guided["seeds"]; denoises = guided["denoise"]; start_index = guided["start_index"]
        if not isinstance(seeds, tuple) or not isinstance(denoises, tuple) or not isinstance(start_index, int): raise RuntimeError(f"Invalid guided config for {spec.key}")
        candidates: list[dict[str, object]] = []; candidate_paths: list[Path] = []
        for offset, (seed, denoise) in enumerate(zip(seeds, denoises, strict=True), start=start_index):
            prefix = f"phase2_ui/{spec.key}/{spec.key}_guided_seed_{seed}"
            prompt_id = queue_prompt(guided_workflow_prompt(spec, int(seed), float(denoise), prefix, guide_name))
            output_path = wait_for_outputs(prompt_id)[0]
            candidate_path = asset_dir / f"candidate_{offset}_seed_{seed}.png"
            Image.open(output_path).save(candidate_path)
            candidate_paths.append(candidate_path)
            candidates.append(guide_metadata(spec.key, guide, int(seed), float(denoise), guide_name, f"{spec.key}/{candidate_path.name}"))
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


def queue_prompt(prompt: dict[str, dict[str, object]]) -> str:
    response = api_json("/prompt", {"prompt": prompt})
    prompt_id = response.get("prompt_id")
    if not isinstance(prompt_id, str):
        raise RuntimeError(f"Comfy did not return a prompt_id: {response}")
    return prompt_id


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
                                paths.append(COMFY_OUTPUT / subfolder / image["filename"])
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
        prepared.save(BEFORE_DIR / f"{spec.key}.png")


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


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate and prepare ComfyUI manuscript UI assets.")
    parser.add_argument("--generate", action="store_true", help="queue three Comfy candidates for every asset")
    parser.add_argument("--generate-refinement", action="store_true", help="queue refinement candidates for weak asset groups")
    parser.add_argument("--generate-guided", action="store_true", help="queue guide-controlled candidates for scroll_frame and wood_console")
    parser.add_argument("--prepare-selected", action="store_true", help="crop/resize selected candidates into repo before assets")
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
    if args.prepare_selected:
        try:
            selection = parse_selection(args.selection)
        except ValueError as exc:
            parser.error(str(exc))
        prepare_selected(selection, targets)


if __name__ == "__main__":
    main()
