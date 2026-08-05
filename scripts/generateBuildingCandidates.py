#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path, PureWindowsPath
from typing import Final

from PIL import Image, ImageDraw

BuildingTargets = frozenset[str] | None

COMFY_ROOT: Final = Path(os.environ.get("COMFYUI_ROOT", str(Path.home() / "ComfyUI")))
COMFY_URL: Final = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")
COMFY_OUTPUT: Final = Path(os.environ.get("COMFYUI_OUTPUT", str(COMFY_ROOT / "output")))
COMFY_INPUT: Final = Path(os.environ.get("COMFYUI_INPUT", str(COMFY_ROOT / "input")))
DEFAULT_OUTPUT_ROOT: Final = Path(os.environ.get("BUILDING_CANDIDATE_OUTPUT_ROOT", "/tmp/feudal-phase4b-building-candidates"))
CHECKPOINT: Final = "sd_xl_base_1.0.safetensors"
BASE_PROMPT: Final = (
    "one single small humble painterly realistic medieval European building, object-only game sprite, "
    "Caesar III/Anno visual language, no settlement and no second structure, "
    "exact 2:1 isometric camera looking down from upper-left, upper-left light, "
    "visible material textures, walls predominantly plaster and timber with stone only on low foundations and slate only on roofs, "
    "isolated complete building, centered with generous padding, "
    "clean readable silhouette, perfectly flat uniform #00FFFF chroma field with no gradient or floor plane"
)
CYAN_RGB: Final = (0, 255, 255)
NEGATIVE_PROMPT: Final = (
    "ground, terrain, road, path, grass, dirt, contact shadow, cast shadow, drop shadow, "
    "ambient occlusion puddle, Roman architecture, columns, aqueduct, marble temple, "
    "fantasy, magic, glowing runes, text, letters, numbers, watermark, frame, people, animals, "
    "multi-storey, two-storey, townhouse, villa, mansion, hip roof, tiled roof, city, village"
)


@dataclass(frozen=True, slots=True)
class SubjectSpec:
    key: str
    subject_clause: str
    seeds: tuple[int, ...]


SUBJECTS: Final = (
    SubjectSpec(
        key="house",
        subject_clause="level-zero one-room single-storey thatched peasant hut with low timber frame, weathered plaster walls, small stone hearth chimney",
        seeds=(64040101, 64040102, 64040103, 64040104, 64040105, 64040106, 64040107, 64040108),
    ),
    SubjectSpec(
        key="mill",
        subject_clause="a wide short single-storey medieval workshop, the watermill beside the building has a timber wheel mounted in 2:1 perspective on the visible side face, the building body is about 1.2 tiles wide and no more than 2.2 tiles tall including its low thatched roof, timber-framed plaster walls on low stone footings",
        seeds=(64040201, 64040202, 64040203, 64040204, 64040205, 64040206, 64040207, 64040208),
    ),
    SubjectSpec(
        key="granary",
        subject_clause="a long rectangular medieval storage barn, timber-framed plaster walls, a curved barrel-vaulted thatch roof running the length of the building, wide double doors on the long side, raised on low stone footings",
        seeds=(64040301, 64040302, 64040303, 64040304, 64040305, 64040306, 64040307, 64040308),
    ),
)


def api_json(path: str, body: dict[str, object] | None = None) -> dict[str, object]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        f"{COMFY_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST" if body is not None else "GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            parsed = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Comfy API request failed for {path}: {exc}") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError(f"Comfy API returned non-object JSON for {path}")
    return parsed


def workflow_prompt(spec: SubjectSpec, seed: int, prefix: str) -> dict[str, dict[str, object]]:
    positive = f"{BASE_PROMPT}, {spec.subject_clause}"
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": positive}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": NEGATIVE_PROMPT}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
                "seed": seed,
                "steps": 30,
                "cfg": 6.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1,
            },
        },
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": prefix}},
    }


def rgb_to_mask_int(rgb: tuple[int, int, int]) -> int:
    return (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]


def build_guide(spec: SubjectSpec) -> Image.Image:
    image = Image.new("RGB", (1024, 1024), CYAN_RGB)
    draw = ImageDraw.Draw(image)
    dark = (70, 58, 46)
    wall = (166, 145, 112)
    roof = (111, 77, 43)
    if spec.key == "house":
        draw.polygon(((330, 545), (520, 455), (700, 545), (700, 690), (520, 775), (330, 690)), fill=wall)
        draw.polygon(((285, 550), (520, 350), (748, 550), (520, 625)), fill=roof)
        draw.rectangle((608, 340, 650, 470), fill=dark)
    elif spec.key == "mill":
        draw.polygon(((285, 530), (520, 420), (735, 520), (735, 690), (520, 795), (285, 690)), fill=wall)
        draw.polygon(((250, 530), (515, 340), (770, 520), (520, 625)), fill=roof)
        draw.ellipse((640, 535, 825, 755), fill=dark)
        draw.ellipse((680, 585, 785, 705), fill=CYAN_RGB)
        draw.line(((666, 552), (800, 735)), fill=dark, width=24)
        draw.line(((650, 690), (815, 590)), fill=dark, width=24)
    elif spec.key == "granary":
        draw.polygon(((200, 570), (400, 570), (400, 760), (200, 760)), fill=wall)
        draw.polygon(((400, 570), (800, 370), (800, 560), (400, 760)), fill=(151, 129, 96))
        near_arch = ((200, 570), (204, 535), (216, 504), (238, 478), (267, 460), (300, 452), (333, 460), (362, 478), (384, 504), (396, 535), (400, 570))
        far_arch = tuple((x + 400, y - 200) for x, y in near_arch)
        roof_bands = ((94, 65, 38), (103, 71, 40), (111, 77, 43), (126, 87, 47), (137, 96, 52), (137, 96, 52), (126, 87, 47), (111, 77, 43), (103, 71, 40), (94, 65, 38))
        for index, band in enumerate(roof_bands):
            draw.polygon((near_arch[index], near_arch[index + 1], far_arch[index + 1], far_arch[index]), fill=band)
        draw.polygon(near_arch, fill=roof)
        draw.polygon(((500, 540), (548, 516), (548, 646), (500, 670)), fill=dark)
        draw.polygon(((554, 513), (602, 489), (602, 619), (554, 643)), fill=dark)
        draw.rectangle((220, 742, 264, 760), fill=dark)
        draw.polygon(((420, 730), (464, 708), (464, 726), (420, 748)), fill=dark)
        draw.polygon(((756, 554), (800, 532), (800, 550), (756, 572)), fill=dark)
    else:
        raise ValueError(f"No guide shape for {spec.key}")
    return image


def guided_workflow_prompt(
    spec: SubjectSpec,
    seed: int,
    prefix: str,
    guide_name: str,
) -> dict[str, dict[str, object]]:
    positive = f"{BASE_PROMPT}, {spec.subject_clause}"
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": positive}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": NEGATIVE_PROMPT}},
        "4": {"class_type": "LoadImage", "inputs": {"image": guide_name}},
        "5": {"class_type": "ImageColorToMask", "inputs": {"image": ["4", 0], "color": rgb_to_mask_int(CYAN_RGB)}},
        "6": {"class_type": "InvertMask", "inputs": {"mask": ["5", 0]}},
        "7": {"class_type": "VAEEncodeForInpaint", "inputs": {"pixels": ["4", 0], "vae": ["1", 2], "mask": ["6", 0], "grow_mask_by": 6}},
        "8": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["7", 0],
                "seed": seed,
                "steps": 30,
                "cfg": 6.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 0.82,
            },
        },
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["1", 2]}},
        "10": {"class_type": "ImageCompositeMasked", "inputs": {"destination": ["9", 0], "source": ["4", 0], "x": 0, "y": 0, "resize_source": False, "mask": ["5", 0]}},
        "11": {"class_type": "SaveImage", "inputs": {"images": ["10", 0], "filename_prefix": prefix}},
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
                                raw_subfolder = image.get("subfolder")
                                subfolder = raw_subfolder if isinstance(raw_subfolder, str) else ""
                                paths.append(contained_output_path(subfolder, image["filename"]))
                if paths:
                    return paths
        time.sleep(2)
    raise TimeoutError(f"Timed out waiting for Comfy prompt {prompt_id}")


def selected_subjects(targets: BuildingTargets = None) -> tuple[SubjectSpec, ...]:
    if targets is None:
        return SUBJECTS
    valid_keys = {spec.key for spec in SUBJECTS}
    unknown = sorted(targets - valid_keys)
    if unknown:
        raise ValueError(f"Unknown target building(s): {', '.join(unknown)}")
    return tuple(spec for spec in SUBJECTS if spec.key in targets)


def save_candidate(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        if image.size != (1024, 1024):
            raise RuntimeError(f"Comfy candidate must be 1024x1024, got {image.size[0]}x{image.size[1]}")
        image.save(destination)


def generate(output_root: Path = DEFAULT_OUTPUT_ROOT, targets: BuildingTargets = None) -> None:
    output_root.mkdir(parents=True, exist_ok=True)
    COMFY_INPUT.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {
        "model": CHECKPOINT,
        "lora": None,
        "settings": {"width": 1024, "height": 1024, "steps": 30, "cfg": 6.0, "sampler": "dpmpp_2m", "scheduler": "karras", "denoise": 0.82, "workflow": "guided-inpaint"},
        "basePrompt": BASE_PROMPT,
        "negativePrompt": NEGATIVE_PROMPT,
        "assets": [],
    }
    for spec in selected_subjects(targets):
        subject_dir = output_root / spec.key
        guide_name = f"phase4b_{spec.key}_guide.png"
        build_guide(spec).save(COMFY_INPUT / guide_name)
        candidates: list[dict[str, object]] = []
        for index, seed in enumerate(spec.seeds, start=1):
            filename = f"{spec.key}_{index:02d}.png"
            prefix = f"phase4b_buildings/{spec.key}/{spec.key}_{index:02d}"
            prompt_id = queue_prompt(guided_workflow_prompt(spec, seed, prefix, guide_name))
            source = wait_for_outputs(prompt_id)[0]
            save_candidate(source, subject_dir / filename)
            candidates.append({
                "index": index,
                "seed": seed,
                "sourcePath": f"{spec.key}/{filename}",
                "releasePath": filename,
            })
        manifest["assets"].append({"key": spec.key, "subjectClause": spec.subject_clause, "guide": guide_name, "seeds": list(spec.seeds), "candidates": candidates})
    (output_root / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def parse_targets(values: list[str] | None) -> BuildingTargets:
    return None if values is None else frozenset(values)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate reproducible Phase 4B ComfyUI building candidates.")
    parser.add_argument("--generate", action="store_true", help="queue eight Comfy candidates for every selected building")
    parser.add_argument("--target", action="append", choices=sorted({spec.key for spec in SUBJECTS}), help="limit generation to one building; repeat for multiple buildings")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT, help="candidate output directory")
    args = parser.parse_args()
    if args.generate:
        generate(output_root=args.output_root, targets=parse_targets(args.target))


if __name__ == "__main__":
    main()
