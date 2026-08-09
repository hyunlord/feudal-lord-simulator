from __future__ import annotations

import json
import os
import shutil
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path, PureWindowsPath
from typing import Final

from walker_candidate_contract import (
    CHECKPOINT,
    RAW_SIZE,
    GeneratorContractError,
    JsonValue,
    Workflow,
    WalkerJob,
    dry_run_manifest,
    job_record,
    prompt_text,
    selected_jobs,
    source_path,
)

COMFY_ROOT: Final = Path(os.environ.get("COMFYUI_ROOT", str(Path.home() / "ComfyUI")))
COMFY_URL: Final = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")
COMFY_OUTPUT: Path = Path(os.environ.get("COMFYUI_OUTPUT", str(COMFY_ROOT / "output")))
DEFAULT_OUTPUT_ROOT: Final = Path(os.environ.get("WALKER_CANDIDATE_OUTPUT_ROOT", "/tmp/feudal-phase13-walker-candidates"))


def api_json(path: str, body: dict[str, JsonValue] | None = None) -> dict[str, JsonValue]:
    payload = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        f"{COMFY_URL}{path}",
        payload,
        {"Content-Type": "application/json"},
        "POST" if payload is not None else "GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            parsed: JsonValue = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise GeneratorContractError(f"Comfy API request failed for {path}: {exc}") from exc
    if not isinstance(parsed, dict):
        raise GeneratorContractError(f"Comfy API returned non-object JSON for {path}")
    return parsed


def workflow_prompt(job: WalkerJob) -> Workflow:
    positive, negative = prompt_text(job)
    prefix = f"phase13_walkers/{job.role.value}/{job.direction.value}/{job.role.value}_{job.direction.value}_01"
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": positive}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": negative}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": RAW_SIZE[0], "height": RAW_SIZE[1], "batch_size": 1}},
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
                "seed": job.seed,
                "steps": 30,
                "cfg": 6.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0,
            },
        },
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": prefix}},
    }


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
                paths = output_paths(outputs)
                if paths:
                    return paths
        time.sleep(2)
    raise TimeoutError(f"Timed out waiting for Comfy prompt {prompt_id}")


def output_paths(outputs: dict[str, JsonValue]) -> list[Path]:
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
    return paths


def generate(output_root: Path = DEFAULT_OUTPUT_ROOT, targets: frozenset[str] | None = None) -> None:
    output_root.mkdir(parents=True, exist_ok=True)
    started_wall = datetime.now(UTC)
    started_clock = time.monotonic()
    records: list[dict[str, JsonValue]] = []
    jobs = selected_jobs(targets)
    for job in jobs:
        job_started = time.monotonic()
        prompt_id = queue_prompt(workflow_prompt(job))
        outputs = wait_for_outputs(prompt_id)
        destination = output_root / source_path(job)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(outputs[0], destination)
        record = job_record(job)
        record["elapsedSeconds"] = round(time.monotonic() - job_started, 3)
        record["status"] = "completed"
        records.append(record)
    manifest: dict[str, JsonValue] = {
        "summary": {"queuedJobs": len(jobs), "completedJobs": len(records)},
        "settings": dry_run_manifest(targets)["settings"],
        "timing": {
            "startedAtUtc": started_wall.isoformat(),
            "finishedAtUtc": datetime.now(UTC).isoformat(),
            "elapsedSeconds": round(time.monotonic() - started_clock, 3),
        },
        "jobs": records,
    }
    (output_root / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
