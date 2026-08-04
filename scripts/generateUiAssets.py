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


COMFY_ROOT: Final = Path(os.environ.get("COMFYUI_ROOT", str(Path.home() / "ComfyUI")))
COMFY_URL: Final = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")
COMFY_OUTPUT: Final = Path(os.environ.get("COMFYUI_OUTPUT", str(COMFY_ROOT / "output")))
STAGE_DIR: Final = COMFY_OUTPUT / "phase2_ui"
REPO_ROOT: Final = Path(__file__).resolve().parents[1]
BEFORE_DIR: Final = REPO_ROOT / "docs" / "asset-evidence" / "before"
CONTACT_DIR: Final = Path("/tmp/feudal-phase2-evidence/assets")
WORKFLOW_PATH: Final = Path(
    os.environ.get(
        "COMFYUI_WORKFLOW",
        str(COMFY_ROOT / "user" / "default" / "workflows" / "building_pixelate.json"),
    )
)
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
    "scroll_frame": 3,
    "wood_console": 4,
    "seal_slot": 2,
    "parchment_texture": 4,
    "illumination_corner": 5,
}
CROP_BOXES: Final = {
    "illumination_corner": (0, 0, 520, 520),
}
REFINEMENTS: Final = {
    "wood_console": {
        "seeds": (52021424, 52021425, 52021426),
        "prompt": "long horizontal aged oak timber beam, one continuous carved medieval command console, three shallow recessed compartments",
        "negative": "paper, parchment, book, page, scroll, white panel, vertical document",
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
        prompt="parchment scroll frame, curled ends, ink and gold ornament, usable blank centre, irregular handmade edges, transparent outside silhouette",
        negative=None,
        alpha=True,
    ),
    AssetSpec(
        key="wood_console",
        width=1920,
        height=160,
        latent_width=1536,
        latent_height=512,
        seeds=(52020421, 52020422, 52020423),
        prompt="one continuous aged oak medieval court command console band, iron and gold details, three understated recessed zones, horizontal continuity, orthographic flat game UI strip",
        negative=None,
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


def generate() -> None:
    STAGE_DIR.mkdir(parents=True, exist_ok=True)
    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {"workflow": str(WORKFLOW_PATH), "models": ["sd_xl_base_1.0.safetensors", "pixel-art-xl.safetensors"], "assets": []}
    for spec in ASSETS:
        asset_dir = STAGE_DIR / spec.key
        asset_dir.mkdir(parents=True, exist_ok=True)
        candidates: list[dict[str, object]] = []
        for index, seed in enumerate(spec.seeds, start=1):
            prefix = f"phase2_ui/{spec.key}/{spec.key}_seed_{seed}"
            prompt_id = queue_prompt(workflow_prompt(spec, seed, prefix, negative=spec.negative))
            output_path = wait_for_outputs(prompt_id)[0]
            candidate_path = asset_dir / f"candidate_{index}_seed_{seed}.png"
            Image.open(output_path).save(candidate_path)
            candidates.append({"index": index, "seed": seed, "prompt_id": prompt_id, "path": str(candidate_path)})
        make_contact_sheet(spec, [Path(str(candidate["path"])) for candidate in candidates])
        manifest["assets"].append({"spec": asdict(spec), "candidates": candidates})
    (STAGE_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def generate_refinements() -> None:
    STAGE_DIR.mkdir(parents=True, exist_ok=True)
    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = STAGE_DIR / "refinement_manifest.json"
    manifest: dict[str, object] = {"workflow": str(WORKFLOW_PATH), "assets": []}
    for spec in ASSETS:
        refinement = REFINEMENTS.get(spec.key)
        if refinement is None:
            continue
        asset_dir = STAGE_DIR / spec.key
        asset_dir.mkdir(parents=True, exist_ok=True)
        candidates: list[dict[str, object]] = []
        seeds = refinement["seeds"]
        if not isinstance(seeds, tuple):
            raise RuntimeError(f"Invalid refinement seeds for {spec.key}")
        for offset, seed in enumerate(seeds, start=4):
            prefix = f"phase2_ui/{spec.key}/{spec.key}_refined_seed_{seed}"
            prompt_id = queue_prompt(workflow_prompt(spec, seed, prefix, str(refinement["prompt"]), str(refinement["negative"])))
            output_path = wait_for_outputs(prompt_id)[0]
            candidate_path = asset_dir / f"candidate_{offset}_seed_{seed}.png"
            Image.open(output_path).save(candidate_path)
            candidates.append({"index": offset, "seed": seed, "prompt_id": prompt_id, "path": str(candidate_path), "refinement": True})
        all_candidates = sorted(asset_dir.glob("candidate_*.png"))
        make_contact_sheet(spec, all_candidates)
        manifest["assets"].append({"key": spec.key, "prompt": refinement["prompt"], "negative": refinement["negative"], "candidates": candidates})
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


def prepare_selected(selection: dict[str, int]) -> None:
    BEFORE_DIR.mkdir(parents=True, exist_ok=True)
    for spec in ASSETS:
        matches = sorted((STAGE_DIR / spec.key).glob(f"candidate_{selection[spec.key]}_seed_*.png"))
        if len(matches) != 1:
            raise RuntimeError(f"Expected one selected candidate for {spec.key} index {selection[spec.key]}, found {len(matches)}")
        source = matches[0]
        with Image.open(source) as image:
            source_image = image.convert("RGBA")
            crop_box = CROP_BOXES.get(spec.key)
            cropped = source_image.crop(crop_box) if crop_box is not None else crop_to_ratio(source_image, spec.width, spec.height)
            prepared = cropped.resize((spec.width, spec.height), Image.Resampling.LANCZOS)
        if spec.alpha:
            prepared = alpha_key(prepared)
        prepared.save(BEFORE_DIR / f"{spec.key}.png")


def make_contact_sheet(spec: AssetSpec, paths: list[Path]) -> None:
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
    sheet.save(STAGE_DIR / spec.key / "contact_sheet.png")
    sheet.save(CONTACT_DIR / f"{spec.key}_contact_sheet.png")


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
    parser.add_argument("--generate-refinement", action="store_true", help="queue refinement candidates 4-6 for weak asset groups")
    parser.add_argument("--prepare-selected", action="store_true", help="crop/resize selected candidates into repo before assets")
    parser.add_argument("--selection", action="append", default=[], help="override selected candidate as ASSET=INDEX")
    args = parser.parse_args()
    if args.generate:
        generate()
    if args.generate_refinement:
        generate_refinements()
    if args.prepare_selected:
        try:
            selection = parse_selection(args.selection)
        except ValueError as exc:
            parser.error(str(exc))
        prepare_selected(selection)


if __name__ == "__main__":
    main()
