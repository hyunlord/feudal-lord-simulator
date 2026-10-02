"""Run all six image detectors and emit candidate evidence, never verdicts."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import TYPE_CHECKING

import typer

if TYPE_CHECKING:
    from collections.abc import Sequence

    from .masks import SceneMasks

import cv2
import numpy as np
from PIL import Image, ImageDraw

from .component_catalog import load_catalog
from .component_parts import ComponentEvidence, component_draws
from .contracts import Capture
from .figures import FigureEvidence, detect_figures
from .ground import detect_ground
from .inventory import inventory_skip_counts
from .masks import sprite_rgba
from .models import Draw, Finding, Scene, Thresholds
from .normalize import normalized
from .objects import detect_objects, rain_scale, stationary_metrics
from .parts import part_draws
from .rain import Pixels, detect_rain
from .rock import (
    MAX_SATURATION,
    MAX_VALUE,
    MAX_WARM_HUE,
    MIN_VALUE,
    detect_rock_cuts,
    detect_rock_seams,
)
from .seams import texture_seams
from .visibility import visible_part
from .wall_overlap import detect_wall_overlap

MIN_PERSON_ALPHA = 0.5
MASK_DIMENSIONS = 2


MIN_ROCK_CONTAINMENT = 0.9
MIN_STONE_PIXEL_FRACTION = 0.4


def consolidate_rock_boundaries(
    image: Pixels, generic: list[Finding], rock_cuts: list[Finding]
) -> list[Finding]:
    """Consolidate a generic edge inside a specialized stone-cut diagnosis.

    Require 90% box containment plus 40% stone-coloured pixels in the generic
    candidate. The pixel gate preserves grass/soil edges in the empty corners of
    a rock region's rectangular box. Separate cracks inside stone may still be
    consolidated; these are one region-level diagnosis, not an edge inventory.
    """
    kept: list[Finding] = []
    hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)
    for candidate in generic:
        box = candidate.box
        if candidate.detector != "straight_boundary":
            kept.append(candidate)
            continue
        contained = False
        for rock in rock_cuts:
            if rock.scene != candidate.scene or rock.detector != "straight_boundary":
                continue
            other = rock.box
            width = max(0, min(box.x + box.width, other.x + other.width) - max(box.x, other.x))
            height = max(0, min(box.y + box.height, other.y + other.height) - max(box.y, other.y))
            if width * height / (box.width * box.height) >= MIN_ROCK_CONTAINMENT:
                contained = True
                break
        patch = hsv[max(0, box.y) : box.y + box.height, max(0, box.x) : box.x + box.width]
        stone = (
            (patch[:, :, 1] < MAX_SATURATION)
            & (patch[:, :, 0] < MAX_WARM_HUE)
            & (patch[:, :, 2] > MIN_VALUE)
            & (patch[:, :, 2] < MAX_VALUE)
        )
        if not contained or not stone.size or float(np.mean(stone)) < MIN_STONE_PIXEL_FRACTION:
            kept.append(candidate)
    return [*kept, *rock_cuts]


def annotate(source: Path, findings: list[Finding], destination: Path) -> None:
    """Render deterministic red evidence boxes onto a captured image."""
    with Image.open(source) as original:
        canvas = original.convert("RGB")
    draw = ImageDraw.Draw(canvas)
    for i, finding in enumerate(findings):
        box = finding.box
        rect = (box.x, box.y, box.x + box.width, box.y + box.height)
        draw.rectangle(rect, outline=(255, 0, 0), width=3)
        draw.text(
            (max(0, box.x), max(0, box.y - 13)),
            f"{i + 1} {finding.detector}",
            fill=(255, 0, 0),
            stroke_width=1,
            stroke_fill=(255, 255, 255),
        )
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, quality=82, optimize=True)


def _annotate_frames(report: Path, result: Path, scene: Scene, found: list[Finding]) -> None:
    """Use the frame on which each detector measured its coordinates."""
    groups: dict[int, list[Finding]] = {}
    for finding in found:
        fallback = len(scene.frames) - 1 if (
            finding.detector == "roof_overlap" and ":figure:" not in finding.id
        ) else 0
        index = next(
            (int(metric.value) for metric in finding.metrics if metric.name == "measurement_frame"),
            fallback,
        )
        if not 0 <= index < len(scene.frames):
            message = f"Invalid measurement frame {index}: {finding.id}"
            raise ValueError(message)
        groups.setdefault(index, []).append(finding)
    for index, findings in groups.items():
        suffix = "" if index == 0 else f"-frame{index:02d}"
        annotate(
            report / scene.frames[index].image,
            findings,
            result / "annotated" / (scene.id + suffix + ".jpg"),
        )


def rain_findings(
    images: Sequence[Pixels], scene: Scene, masks: SceneMasks
) -> tuple[list[Finding], dict[str, object]]:
    """Wire temporal rain masks to actual first-frame human silhouette scale.

    Sampling is limited to eligible ground; masked roofs, trees and sprites cannot
    provide rain evidence. Opaque hats remain part of alpha-height references.
    """
    exclusion: Pixels = np.asarray(cv2.inRange(masks.ground, 0, 0), dtype=np.uint8)
    evidence = detect_rain(images, exclusion)
    heights: list[float] = []
    seen: set[str] = set()
    for draw in scene.frames[0].draws:
        if (
            not draw.asset.startswith("person:")
            or draw.asset in seen
            or draw.alpha < MIN_PERSON_ALPHA
        ):
            continue
        silhouette = masks.alpha.get(draw.asset)
        if silhouette is None or silhouette.ndim != MASK_DIMENSIONS:
            continue
        opaque = cv2.inRange(silhouette, 128, 255)
        rows: Pixels = np.asarray(cv2.reduce(opaque, 1, cv2.REDUCE_MAX), dtype=np.uint8)
        ys = np.flatnonzero(rows)
        if not ys.size:
            continue
        height = float((int(ys.max()) - int(ys.min()) + 1) / silhouette.shape[0] * draw.box.height)
        heights.append(height)
        seen.add(draw.asset)
    findings = [
        finding.model_copy(update={"id": "rain:" + finding.id})
        for finding in rain_scale(images[0], scene, evidence.mask, heights)
    ]
    coverage: dict[str, object] = {
        "first_frame_candidates": evidence.first_frame_candidates,
        "falling_tracks": evidence.falling_tracks,
        "accepted_mask_pixels": int(np.count_nonzero(evidence.mask)),
        "reason": evidence.reason,
        "human_height_references": len(heights),
        "human_alpha_heights_px": heights,
        "eligible_ground_fraction": float(np.count_nonzero(masks.ground) / masks.ground.size),
        "measurement_frame": 0,
        "scale_candidates": len(findings),
        "limits": "Ground-only rain sample; opaque hats included; no real rainy scene validated.",
    }
    return findings, coverage


def analyze(repo: Path, report: Path, config: Path | None = None, name: str = "baseline") -> None:
    """Analyze captures one at a time to bound memory use."""
    thresholds = (
        Thresholds.model_validate_json(config.read_text())
        if config
        else Thresholds(still_min_tick_span=18)
    )
    result = report / name
    result.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    all_findings: list[Finding] = []
    summaries: list[dict[str, object]] = []
    catalog = load_catalog(Path(__file__).resolve().parents[1] / "config/component-parts.json")
    for source in sorted((report / "raw").glob("*/capture.json")):
        capture = Capture.model_validate_json(source.read_text())
        scene, masks, expected = normalized(capture, repo / "public")
        images = [
            np.asarray(Image.open(report / frame.image).convert("RGB"), dtype=np.uint8)
            for frame in scene.frames
        ]
        parts: list[tuple[Draw, np.ndarray[tuple[int, ...], np.dtype[np.uint8]]]] = []
        component_evidence = ComponentEvidence(
            image=images[0], catalog=catalog, public_root=repo / "public"
        )
        hidden_scale_assets: set[tuple[str, int]] = set()
        for raw_draw in capture.frames[0].draws:
            rgba = sprite_rgba(raw_draw, repo / "public")
            if rgba is not None:
                components = component_draws(raw_draw, rgba, component_evidence)
                parts.extend(components)
                if any(word in raw_draw.asset for word in ("barrel", "sack")) and not visible_part(
                    images[0], raw_draw, rgba, raw_draw
                ):
                    hidden_scale_assets.add((raw_draw.asset, raw_draw.order))
                parts.extend(
                    (part, mask)
                    for part, mask in part_draws(raw_draw, rgba)
                    if visible_part(images[0], raw_draw, rgba, part)
                )
        if hidden_scale_assets:
            filtered = tuple(
                d
                for d in scene.frames[0].draws
                if (d.asset.split("#", 1)[0], d.order) not in hidden_scale_assets
            )
            scene = scene.model_copy(
                update={
                    "frames": (
                        scene.frames[0].model_copy(update={"draws": filtered}),
                        *scene.frames[1:],
                    )
                }
            )
        if parts:
            scene = scene.model_copy(
                update={
                    "frames": (
                        scene.frames[0].model_copy(
                            update={"draws": scene.frames[0].draws + tuple(d for d, _ in parts)}
                        ),
                        *scene.frames[1:],
                    )
                }
            )
            masks.alpha.update({d.asset: mask for d, mask in parts})
        if thresholds.exclude_water:
            hsv = cv2.cvtColor(images[0], cv2.COLOR_RGB2HSV)
            water = cv2.inRange(hsv, (75, 35, 20), (125, 255, 245))
            water = cv2.dilate(water, np.ones((15, 15), np.uint8))
            masks.ground[water > 0] = 0
        found = consolidate_rock_boundaries(
            images[0],
            detect_ground(images[0], scene, thresholds, masks.ground),
            detect_rock_cuts(images[0], scene, thresholds, masks.ground),
        )
        found.extend(detect_rock_seams(images[0], scene, thresholds, masks.ground))
        rgba_by_asset = {
            draw.asset: rgba
            for frame in scene.frames
            for draw in frame.draws
            if (rgba := sprite_rgba(draw, repo / "public")) is not None
        }
        found.extend(detect_figures(images, scene, FigureEvidence(rgba_by_asset, masks.roofs)))
        found.extend(detect_wall_overlap(images, capture, repo / "public"))
        found.extend(texture_seams(images[0], scene, thresholds, masks.ground))
        found.extend(
            detect_objects(
                images,
                scene,
                thresholds,
                silhouettes=masks.alpha,
                roof_masks=masks.roofs,
                expected_walking=expected,
                rgba_templates=rgba_by_asset,
            )
        )
        rain_candidates, rain_coverage = rain_findings(images, scene, masks)
        found.extend(rain_candidates)
        all_findings.extend(found)
        summaries.append(
            {
                "scene": scene.id,
                "cohort": scene.cohort,
                "tick_span": scene.frames[-1].tick - scene.frames[0].tick,
                "frames": len(scene.frames),
                "zoom": scene.zoom,
                "camera": scene.camera,
                "stationary": stationary_metrics(images, scene, thresholds).model_dump(),
                "matched_person_ids": len(expected),
                "alpha_masks": len(masks.alpha),
                "roof_masks": len(masks.roofs),
                "missing_assets": masks.missing_assets,
                "ground_fraction": float(np.count_nonzero(masks.ground) / masks.ground.size),
                "findings": len(found),
                "semantic_parts": len(parts),
                "catalog_components": sum("#component=" in draw.asset for draw, _ in parts),
                "normal_inventory_skipped_draw_calls": inventory_skip_counts(
                    scene.frames[0].draws
                ),
                "rain": rain_coverage,
                "notes": masks.notes,
            }
        )
        (result / (scene.id + ".json")).write_text(scene.model_dump_json())
        _annotate_frames(report, result, scene, found)
        typer.echo(f"ANALYZE {scene.id}: {len(found)} candidates")
    (result / "findings.json").write_text(
        json.dumps([f.model_dump() for f in all_findings], ensure_ascii=False, indent=2)
    )
    (result / "coverage.json").write_text(json.dumps(summaries, ensure_ascii=False, indent=2))
    (result / "run.json").write_text(
        json.dumps(
            {
                "seconds": time.perf_counter() - started,
                "thresholds": thresholds.model_dump(),
                "scenes": len(summaries),
                "candidates": len(all_findings),
            },
            indent=2,
        )
    )
