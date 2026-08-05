#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow"]
# ///
# How to run: python3 scripts/generateWorldAssets.py --generate --repo-root . --output-root /tmp/phase4c-raw
# noqa: SIZE_OK — fixed 59-job contract and its ComfyUI adapter stay together for release auditability.
from __future__ import annotations

import argparse
import json
import os
import shutil
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path, PureWindowsPath
from typing import Final, NewType, assert_never

from PIL import Image, ImageDraw

Seed = NewType("Seed", int)
JsonScalar = str | int | float | bool | None
JsonValue = JsonScalar | list["JsonValue"] | dict[str, "JsonValue"]
Workflow = dict[str, dict[str, JsonValue]]


class Category(StrEnum):
    BUILDING = "building"
    FOLIAGE = "foliage"
    TERRAIN = "terrain"


@dataclass(frozen=True, slots=True)
class Job:
    category: Category
    key: str
    geometry: str
    seed: Seed
    candidate: int


COMFY_ROOT: Final = Path(os.environ.get("COMFYUI_ROOT", str(Path.home() / "ComfyUI")))
COMFY_URL: Final = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")
COMFY_OUTPUT: Final = Path(os.environ.get("COMFYUI_OUTPUT", str(COMFY_ROOT / "output")))
COMFY_INPUT: Final = Path(os.environ.get("COMFYUI_INPUT", str(COMFY_ROOT / "input")))
DEFAULT_OUTPUT_ROOT: Final = Path(os.environ.get("WORLD_ASSET_OUTPUT_ROOT", "/tmp/feudal-phase4c-world-assets"))
CHECKPOINT: Final = "sd_xl_base_1.0.safetensors"
IPADAPTER_PRESET: Final = "PLUS (high strength)"
IPADAPTER_MODEL: Final = "ip-adapter-plus_sdxl_vit-h.safetensors"
CLIP_VISION_MODEL: Final = "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"
CANVAS_SIZE: Final = (1024, 1024)
CYAN_RGB: Final = (0, 255, 255)
REFERENCE_PATHS: Final = (
    Path("public/assets/buildings/candidates_v2/house_03.png"),
    Path("public/assets/buildings/candidates_v2/mill_02.png"),
    Path("public/assets/buildings/candidates_v2/granary_08.png"),
)
BASE_PROMPT: Final = (
    "exactly one subject only, one isolated medieval European object, painterly pixel-art game asset, exact 2:1 isometric camera from upper-left, "
    "upper-left light, coherent muted plaster timber stone thatch slate material vocabulary, crisp readable silhouette, "
    "matching the supplied reference family, centered with generous padding"
)
FOLIAGE_PROMPT: Final = (
    "exactly one subject only, one isolated painterly pixel-art woodland game asset, exact 2:1 isometric camera from upper-left, "
    "upper-left light, organic foliage and timber material detail, crisp readable silhouette matching the supplied reference family's "
    "muted colour temperature and edge treatment, centered with generous padding"
)
NEGATIVE_PROMPT: Final = (
    "people, animals, text, letters, numbers, watermark, frame, modern object, fantasy glow, Roman columns, "
    "settlement, second structure, multiple objects, variants, grid, contact sheet, sprite sheet, asset collection, "
    "perspective mismatch, cast shadow, contact shadow, floor plane, gradient background"
)

BUILDING_GEOMETRY: Final = {
    "house_l1": "a slightly larger timber-framed cottage, two windows, taller thatch roof, small chimney",
    "house_l2": "a two-storey timber-framed townhouse, plaster infill, shingle roof, upper-floor windows",
    "house_l3": "a large stone manor house, slate roof, a short square tower at one end, arched doorway",
    "well": "a low circular stone wellhead with a small timber roof on two posts, rope and bucket",
    "storehouse": "a rectangular open-fronted timber warehouse, plank walls, shallow shingle roof, stacked crates visible inside",
    "wheat_farm": "a farmyard, not a building — a small timber hut at one corner of a ploughed field, furrows running across the plot",
    "logging_camp": "an open-sided timber shelter with a stack of cut logs beside it, sawhorse, wood chips on the ground",
    "sawmill": "a low timber workshop with a large horizontal saw frame under a lean-to roof, plank stacks outside",
}
FOLIAGE_GEOMETRY: Final = {
    "tree_conifer_a": "one tall narrow evergreen tree",
    "tree_conifer_b": "one shorter broader evergreen tree",
    "tree_broadleaf_a": "one rounded deciduous tree canopy on a short trunk",
    "tree_broadleaf_b": "one smaller sparser deciduous tree canopy on a short trunk",
    "shrub_a": "one low dense woodland bush",
    "shrub_b": "one smaller sparse woodland bush",
}
TERRAIN_GEOMETRY: Final = {
    "grass": "seamless tileable muted meadow grass texture, low contrast, no objects",
    "forest_floor": "seamless tileable forest floor texture with restrained leaf litter, low contrast, no objects",
    "water": "seamless tileable calm shallow water texture with subtle ripples, low contrast, no shoreline",
    "rock": "seamless tileable weathered rock texture, low contrast, no loose objects",
    "packed_earth_road": "seamless tileable packed earth road texture, low contrast, no road edges or markings",
}


def _build_jobs() -> tuple[Job, ...]:
    jobs: list[Job] = []
    for subject_index, (key, geometry) in enumerate(BUILDING_GEOMETRY.items(), start=1):
        for candidate in range(1, 7):
            jobs.append(Job(Category.BUILDING, key, geometry, Seed(64050000 + subject_index * 100 + candidate), candidate))
    for index, (key, geometry) in enumerate(FOLIAGE_GEOMETRY.items(), start=1):
        jobs.append(Job(Category.FOLIAGE, key, geometry, Seed(64052000 + index), 1))
    for index, (key, geometry) in enumerate(TERRAIN_GEOMETRY.items(), start=1):
        jobs.append(Job(Category.TERRAIN, key, geometry, Seed(64053000 + index), 1))
    return tuple(jobs)


JOBS: Final = _build_jobs()


class GeneratorContractError(RuntimeError):
    readonly_name = "GeneratorContractError"


def api_json(path: str, body: dict[str, JsonValue] | None = None) -> dict[str, JsonValue]:
    payload = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        f"{COMFY_URL}{path}", payload, {"Content-Type": "application/json"}, "POST" if payload is not None else "GET"
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            parsed: JsonValue = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise GeneratorContractError(f"Comfy API request failed for {path}: {exc}") from exc
    if not isinstance(parsed, dict):
        raise GeneratorContractError(f"Comfy API returned non-object JSON for {path}")
    return parsed


def _prompt_text(job: Job) -> tuple[str, str]:
    match job.category:
        case Category.BUILDING:
            return f"{BASE_PROMPT}, {job.geometry}, perfectly flat uniform #00FFFF chroma field", NEGATIVE_PROMPT
        case Category.FOLIAGE:
            subject_constraint = (
                "one waist-high bush made only of a few connected leafy clumps, no ground beneath it"
                if job.key.startswith("shrub_")
                else "one standalone tree with one trunk and one connected canopy, no ground beneath it"
            )
            return (
                f"{FOLIAGE_PROMPT}, {job.geometry}, {subject_constraint}, foliage and timber colours only, "
                "perfectly flat uniform #00FFFF chroma field",
                f"{NEGATIVE_PROMPT}, architecture, building, stone, plaster, slate, forest scene, landscape, diorama, "
                "terrain island, cliff, ground, grass field, multiple trees",
            )
        case Category.TERRAIN:
            return (
                f"{job.geometry}, top-down orthographic material sample, periodic edges, matching the supplied muted reference family",
                "objects, buildings, trees, horizon, perspective, border, frame, text, high contrast, directional shadow",
            )
        case unreachable:
            assert_never(unreachable)


def _style_condition(category: Category) -> tuple[float, float]:
    match category:
        case Category.BUILDING:
            return 0.05, 0.3
        case Category.FOLIAGE:
            return 0.02, 0.3
        case Category.TERRAIN:
            return 0.01, 0.3
        case unreachable:
            assert_never(unreachable)


def workflow_prompt(job: Job, reference_names: tuple[str, str, str], guide_name: str | None) -> Workflow:
    positive, negative = _prompt_text(job)
    style_weight, style_end = _style_condition(job.category)
    prefix = f"phase4c/{job.category.value}/{job.key}_{job.candidate:02d}"
    latent_node: JsonValue = ["8", 0]
    decoded_node: JsonValue = ["10", 0]
    workflow: Workflow = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "2": {"class_type": "IPAdapterUnifiedLoader", "inputs": {"model": ["1", 0], "preset": IPADAPTER_PRESET}},
        "3": {"class_type": "LoadImage", "inputs": {"image": reference_names[0]}},
        "4": {"class_type": "LoadImage", "inputs": {"image": reference_names[1]}},
        "5": {"class_type": "LoadImage", "inputs": {"image": reference_names[2]}},
        "11": {"class_type": "ImageBatch", "inputs": {"image1": ["3", 0], "image2": ["4", 0]}},
        "12": {"class_type": "ImageBatch", "inputs": {"image1": ["11", 0], "image2": ["5", 0]}},
        "13": {
            "class_type": "IPAdapterAdvanced",
            "inputs": {
                "model": ["2", 0], "ipadapter": ["2", 1], "image": ["12", 0], "weight": style_weight,
                "start_at": 0.0, "end_at": style_end, "weight_type": "style transfer precise",
                "combine_embeds": "average", "embeds_scaling": "K+V w/ C penalty",
            },
        },
        "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": positive}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": negative}},
        "8": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "9": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["13", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["8", 0],
                "seed": job.seed, "steps": 30, "cfg": 6.0, "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0,
            },
        },
        "10": {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["1", 2]}},
        "14": {"class_type": "SaveImage", "inputs": {"images": ["10", 0], "filename_prefix": prefix}},
    }
    if guide_name is not None:
        workflow["15"] = {"class_type": "LoadImage", "inputs": {"image": guide_name}}
        workflow["16"] = {"class_type": "ImageColorToMask", "inputs": {"image": ["15", 0], "color": 65535}}
        workflow["17"] = {"class_type": "InvertMask", "inputs": {"mask": ["16", 0]}}
        workflow["18"] = {
            "class_type": "VAEEncodeForInpaint",
            "inputs": {"pixels": ["15", 0], "vae": ["1", 2], "mask": ["17", 0], "grow_mask_by": 6},
        }
        workflow["19"] = {
            "class_type": "ImageCompositeMasked",
            "inputs": {"destination": ["10", 0], "source": ["15", 0], "x": 0, "y": 0, "resize_source": False, "mask": ["16", 0]},
        }
        latent_node = ["18", 0]
        decoded_node = ["19", 0]
        workflow["9"]["inputs"]["denoise"] = 0.72
    workflow["9"]["inputs"]["latent_image"] = latent_node
    workflow["14"]["inputs"]["images"] = decoded_node
    return workflow


def build_subject_guide(job: Job) -> Image.Image:
    image = Image.new("RGB", CANVAS_SIZE, CYAN_RGB)
    draw = ImageDraw.Draw(image)
    dark, wall, roof, green, earth = (67, 54, 42), (174, 151, 112), (118, 82, 47), (80, 112, 55), (132, 96, 58)
    match job.category:
        case Category.FOLIAGE:
            if job.key.startswith("tree_"):
                draw.rectangle((480, 575, 545, 820), fill=dark)
                if "conifer" in job.key:
                    draw.polygon(((512, 175), (300, 700), (724, 700)), fill=green)
                else:
                    draw.ellipse((275, 180, 750, 690), fill=green)
            else:
                draw.ellipse((340, 545, 520, 735), fill=green)
                draw.ellipse((445, 485, 625, 735), fill=green)
                draw.ellipse((555, 550, 700, 735), fill=green)
                draw.rectangle((380, 655, 665, 750), fill=green)
        case Category.BUILDING:
            match job.key:
                case "well":
                    draw.ellipse((350, 570, 674, 790), fill=wall)
                    draw.rectangle((385, 320, 430, 650), fill=dark)
                    draw.rectangle((594, 320, 639, 650), fill=dark)
                    draw.polygon(((330, 380), (512, 230), (694, 380), (512, 480)), fill=roof)
                case "wheat_farm":
                    draw.polygon(((120, 600), (500, 410), (905, 610), (520, 820)), fill=earth)
                    draw.rectangle((155, 430, 330, 620), fill=wall)
                    draw.polygon(((125, 450), (245, 330), (365, 450), (245, 520)), fill=roof)
                case "house_l1" | "house_l2" | "house_l3" | "storehouse" | "logging_camp" | "sawmill":
                    wide = job.key in {"house_l3", "storehouse"}
                    tall = job.key in {"house_l2", "house_l3"}
                    left, right = (220, 804) if wide else (310, 714)
                    top = 330 if tall else 455
                    draw.polygon(((left, top + 160), (512, top), (right, top + 160), (right, 790), (512, 900), (left, 790)), fill=wall)
                    draw.polygon(((left - 45, top + 170), (512, top - 170), (right + 45, top + 170), (512, top + 300)), fill=roof)
                    if job.key == "house_l3":
                        draw.rectangle((665, 210, 820, 610), fill=wall)
                        draw.polygon(((630, 250), (742, 115), (855, 250), (742, 335)), fill=roof)
                    if job.key in {"logging_camp", "sawmill"}:
                        draw.ellipse((650, 650, 875, 740), fill=dark)
                case unreachable:
                    assert_never(unreachable)
        case Category.TERRAIN:
            image.paste((128, 128, 128), (0, 0, *CANVAS_SIZE))
        case unreachable:
            assert_never(unreachable)
    return image


def build_reference_atlas(repo_root: Path) -> Image.Image:
    atlas = Image.new("RGB", CANVAS_SIZE, (45, 38, 31))
    slots = ((64, 112, 320, 432), (352, 112, 672, 432), (704, 96, 960, 448))
    for relative, (left, top, right, bottom) in zip(REFERENCE_PATHS, slots, strict=True):
        with Image.open(repo_root / relative) as source:
            sprite = source.convert("RGBA")
            sprite.thumbnail((right - left, bottom - top), Image.Resampling.LANCZOS)
            x = left + (right - left - sprite.width) // 2
            y = bottom - sprite.height
            atlas.paste(sprite, (x, y), sprite)
    return atlas


def upload_reference_atlas(repo_root: Path) -> str:
    COMFY_INPUT.mkdir(parents=True, exist_ok=True)
    name = "phase4c_reference_atlas.png"
    build_reference_atlas(repo_root).save(COMFY_INPUT / name)
    return name


def upload_reference_images(repo_root: Path) -> tuple[str, str, str]:
    COMFY_INPUT.mkdir(parents=True, exist_ok=True)
    names = ("phase4c_ref_house.png", "phase4c_ref_mill.png", "phase4c_ref_granary.png")
    for relative, name in zip(REFERENCE_PATHS, names, strict=True):
        shutil.copyfile(repo_root / relative, COMFY_INPUT / name)
    upload_reference_atlas(repo_root)
    return names


def upload_subject_guide(job: Job) -> str | None:
    if job.category is Category.TERRAIN:
        return None
    COMFY_INPUT.mkdir(parents=True, exist_ok=True)
    name = f"phase4c_guide_{job.key}_{job.candidate:02d}.png"
    build_subject_guide(job).save(COMFY_INPUT / name)
    return name


def queue_prompt(prompt: Workflow) -> str:
    response = api_json("/prompt", {"prompt": prompt})
    prompt_id = response.get("prompt_id")
    if not isinstance(prompt_id, str):
        raise GeneratorContractError("Comfy did not return a string prompt_id")
    return prompt_id


def contained_output_path(subfolder: str, filename: str) -> Path:
    root = COMFY_OUTPUT.resolve()
    if any(Path(value).is_absolute() or PureWindowsPath(value).is_absolute() for value in (subfolder, filename)):
        raise GeneratorContractError("Comfy output path must be relative to COMFY_OUTPUT")
    candidate = (root / subfolder / filename).resolve()
    if root not in candidate.parents or candidate.suffix.lower() != ".png":
        raise GeneratorContractError("Comfy output path must be a PNG inside COMFY_OUTPUT")
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
                    if not isinstance(output, dict):
                        continue
                    images = output.get("images")
                    if not isinstance(images, list):
                        continue
                    for image in images:
                        if isinstance(image, dict) and isinstance(image.get("filename"), str):
                            subfolder = image.get("subfolder") if isinstance(image.get("subfolder"), str) else ""
                            paths.append(contained_output_path(subfolder, image["filename"]))
                if paths:
                    return paths
        time.sleep(2)
    raise TimeoutError(f"Timed out waiting for Comfy prompt {prompt_id}")


def selected_jobs(targets: frozenset[str] | None) -> tuple[Job, ...]:
    if targets is None:
        return JOBS
    valid = {f"{job.category.value}:{job.key}" for job in JOBS}
    unknown = sorted(targets - valid)
    if unknown:
        raise GeneratorContractError(f"Unknown target(s): {', '.join(unknown)}")
    return tuple(job for job in JOBS if f"{job.category.value}:{job.key}" in targets)


def _release_name(job: Job) -> str:
    return f"{job.key}_{job.candidate:02d}.png" if job.category is Category.BUILDING else f"{job.key}.png"


def generate(output_root: Path, repo_root: Path, targets: frozenset[str] | None = None) -> None:
    output_root.mkdir(parents=True, exist_ok=True)
    reference_names = upload_reference_images(repo_root)
    started_wall = datetime.now(UTC)
    started_clock = time.monotonic()
    records: list[dict[str, JsonValue]] = []
    jobs = selected_jobs(targets)
    for job in jobs:
        job_started = time.monotonic()
        guide_name = upload_subject_guide(job)
        prompt_id = queue_prompt(workflow_prompt(job, reference_names, guide_name))
        outputs = wait_for_outputs(prompt_id)
        relative = Path(job.category.value) / _release_name(job)
        destination = output_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(outputs[0], destination)
        records.append({
            "category": job.category.value, "key": job.key, "candidate": job.candidate, "seed": job.seed,
            "geometry": job.geometry, "sourcePath": relative.as_posix(), "elapsedSeconds": round(time.monotonic() - job_started, 3), "status": "completed",
        })
    finished_wall = datetime.now(UTC)
    manifest: dict[str, JsonValue] = {
        "models": {"checkpoint": CHECKPOINT, "ipadapter": IPADAPTER_MODEL, "clipVision": CLIP_VISION_MODEL, "preset": IPADAPTER_PRESET},
        "settings": {
            "width": 1024, "height": 1024, "steps": 30, "cfg": 6.0, "sampler": "dpmpp_2m", "scheduler": "karras",
            "ipadapterWeights": {"building": 0.05, "foliage": 0.02, "terrain": 0.01},
        },
        "references": [path.as_posix() for path in REFERENCE_PATHS],
        "summary": {"catalogJobs": len(JOBS), "queuedJobs": len(jobs), "completedJobs": len(records)},
        "timing": {"startedAtUtc": started_wall.isoformat(), "finishedAtUtc": finished_wall.isoformat(), "elapsedSeconds": round(time.monotonic() - started_clock, 3)},
        "jobs": records,
    }
    (output_root / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the deterministic Phase 4C world-asset batch through ComfyUI IPAdapter.")
    parser.add_argument("--generate", action="store_true")
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--target", action="append", help="category:key; repeat to select multiple subjects")
    args = parser.parse_args()
    if args.generate:
        targets = None if args.target is None else frozenset(args.target)
        generate(args.output_root, args.repo_root.resolve(), targets)


if __name__ == "__main__":
    main()
