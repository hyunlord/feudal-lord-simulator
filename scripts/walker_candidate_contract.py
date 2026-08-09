from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Final, NewType

Seed = NewType("Seed", int)
JsonScalar = str | int | float | bool | None
JsonValue = JsonScalar | list["JsonValue"] | dict[str, "JsonValue"]
Workflow = dict[str, dict[str, JsonValue]]


class Role(StrEnum):
    BUILDER = "builder"
    FARMER = "farmer"
    LOGGER = "logger"
    CARTER = "carter"


class Direction(StrEnum):
    NE = "NE"
    SE = "SE"
    SW = "SW"
    NW = "NW"


@dataclass(frozen=True, slots=True)
class WalkerJob:
    role: Role
    direction: Direction
    role_clause: str
    seed: Seed
    candidate: int = 1


class GeneratorContractError(RuntimeError):
    pass


CHECKPOINT: Final = "sd_xl_base_1.0.safetensors"
RAW_SIZE: Final = (1024, 1024)
SPRITE_SIZE: Final = (32, 48)
CYAN_RGB: Final = (0, 255, 255)
BASE_PROMPT: Final = (
    "one isolated small medieval worker sprite, full-colour hand-painted game asset, rich local material colour variation, "
    "three-quarter 2:1 isometric camera, upper-left light, entire body visible head to boots, centered with generous padding, "
    "simple readable silhouette for a 32x48 final sprite, perfectly flat uniform #00FFFF chroma field"
)
NEGATIVE_PROMPT: Final = (
    "limited palette, palette reduction, indexed colour, pixelated, dithering, sprite sheet, animation strip, contact sheet, "
    "multiple people, crowd, animal, horse, ox, wagon team, giant cart, cropped body, close-up portrait, modern clothing, "
    "text, letters, numbers, watermark, frame, terrain, road, ground shadow, cast shadow, floor plane, mirror, mirrored"
)
ROLE_CLAUSES: Final = {
    Role.BUILDER: "a builder carrying timber planks and a compact tool belt, work sleeves rolled",
    Role.FARMER: "a farmer carrying a golden wheat sheaf and a small bread basket, field work clothes visible",
    Role.LOGGER: "a logger carrying a wood axe and a compact bundle of fresh-cut logs over one shoulder",
    Role.CARTER: "a carter labourer pushing a small wooden hand cart with visible handles and one compact load",
}
DIRECTION_CLAUSES: Final = {
    Direction.NE: "facing north-east, moving up-right, front and right side visible, feet aligned to a north-east stride",
    Direction.SE: "facing south-east, moving down-right, front and left side visible, feet aligned to a south-east stride",
    Direction.SW: "facing south-west, moving down-left, back and left side visible, feet aligned to a south-west stride",
    Direction.NW: "facing north-west, moving up-left, back and right side visible, feet aligned to a north-west stride",
}


def build_jobs() -> tuple[WalkerJob, ...]:
    jobs: list[WalkerJob] = []
    for role_index, role in enumerate(Role, start=1):
        for direction_index, direction in enumerate(Direction, start=1):
            jobs.append(WalkerJob(role, direction, ROLE_CLAUSES[role], Seed(73130000 + role_index * 100 + direction_index)))
    return tuple(jobs)


JOBS: Final = build_jobs()


def prompt_text(job: WalkerJob) -> tuple[str, str]:
    direction_clause = DIRECTION_CLAUSES[job.direction]
    positive = (
        f"{BASE_PROMPT}, {job.role_clause}, {direction_clause}, generated independently for this exact direction, "
        "not a mirrored copy and not reused from another facing"
    )
    return positive, NEGATIVE_PROMPT


def source_path(job: WalkerJob) -> Path:
    filename = f"{job.role.value}_{job.direction.value}_{job.candidate:02d}.png"
    return Path(job.role.value) / job.direction.value / filename


def selected_jobs(targets: frozenset[str] | None = None) -> tuple[WalkerJob, ...]:
    if targets is None:
        return JOBS
    valid = {f"{job.role.value}:{job.direction.value}" for job in JOBS}
    unknown = sorted(targets - valid)
    if unknown:
        raise GeneratorContractError(f"Unknown walker target(s): {', '.join(unknown)}")
    return tuple(job for job in JOBS if f"{job.role.value}:{job.direction.value}" in targets)


def job_record(job: WalkerJob) -> dict[str, JsonValue]:
    relative = source_path(job)
    positive, negative = prompt_text(job)
    return {
        "role": job.role.value,
        "direction": job.direction.value,
        "candidate": job.candidate,
        "seed": job.seed,
        "roleClause": job.role_clause,
        "facingClause": DIRECTION_CLAUSES[job.direction],
        "positivePrompt": positive,
        "negativePrompt": negative,
        "sourcePath": relative.as_posix(),
        "preparedPath": relative.as_posix(),
        "batchSize": 1,
    }


def dry_run_manifest(targets: frozenset[str] | None = None) -> dict[str, JsonValue]:
    jobs = selected_jobs(targets)
    return {
        "summary": {"roles": len(Role), "directions": len(Direction), "queuedJobs": len(jobs), "comfyuiRequests": 0},
        "settings": {
            "checkpoint": CHECKPOINT,
            "rawSize": [RAW_SIZE[0], RAW_SIZE[1]],
            "preparedSize": [SPRITE_SIZE[0], SPRITE_SIZE[1]],
            "backgroundPolicy": "alpha-or-cyan-key",
            "candidatePerRoleDirection": 1,
        },
        "jobs": [job_record(job) for job in jobs],
    }
