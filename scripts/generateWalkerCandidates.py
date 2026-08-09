#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow"]
# ///
# --- How to run ---
# 1. Install uv (if not installed):
#      curl -LsSf https://astral.sh/uv/install.sh | sh
# 2. Run directly:
#      uv run scripts/generateWalkerCandidates.py --dry-run
#      uv run scripts/generateWalkerCandidates.py --generate --output-root /tmp/phase13-walker-raw
#      uv run scripts/generateWalkerCandidates.py --prepare --source-root /tmp/phase13-walker-raw --prepared-root /tmp/phase13-walker-prepared
# 3. Or make executable and run:
#      chmod +x scripts/generateWalkerCandidates.py && ./scripts/generateWalkerCandidates.py --dry-run
# ------------------
from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from datetime import UTC, datetime
from pathlib import Path, PureWindowsPath

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from walker_candidate_comfy import (  # noqa: E402
    COMFY_OUTPUT,
    DEFAULT_OUTPUT_ROOT,
    api_json,
    workflow_prompt,
)
from walker_candidate_contract import (  # noqa: E402
    CYAN_RGB,
    JOBS,
    GeneratorContractError,
    JsonValue,
    Workflow,
    dry_run_manifest,
    job_record,
    selected_jobs,
    source_path,
)
from walker_candidate_prepare import (  # noqa: E402
    DEFAULT_PREPARED_ROOT,
    prepare,
    prepare_candidate,
    rgba_with_background_key,
)


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


def parse_targets(values: list[str] | None) -> frozenset[str] | None:
    return None if values is None else frozenset(values)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate deterministic Phase 13 full-colour walker candidates through ComfyUI.")
    parser.add_argument("--dry-run", action="store_true", help="print the deterministic 16-job manifest without contacting ComfyUI")
    parser.add_argument("--generate", action="store_true", help="queue ComfyUI raw 1024x1024 walker candidates")
    parser.add_argument("--prepare", action="store_true", help="prepare generated raw candidates into 32x48 transparent PNGs")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT, help="raw candidate output directory")
    parser.add_argument("--source-root", type=Path, default=DEFAULT_OUTPUT_ROOT, help="raw candidate input directory for --prepare")
    parser.add_argument("--prepared-root", type=Path, default=DEFAULT_PREPARED_ROOT, help="prepared 32x48 output directory")
    parser.add_argument("--target", action="append", help="role:direction, for example builder:SW; repeat to select multiple jobs")
    args = parser.parse_args()
    targets = parse_targets(args.target)
    if args.dry_run:
        print(json.dumps(dry_run_manifest(targets), indent=2, ensure_ascii=False))
        return
    if args.generate:
        generate(args.output_root, targets)
    if args.prepare:
        prepare(args.source_root, args.prepared_root)


if __name__ == "__main__":
    main()
