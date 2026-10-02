"""Evaluate annotated defects with maximum-cardinality one-to-one spatial matching.

A match requires prediction center inside ground truth, IoU >= 0.1, and >= 50%
of prediction area inside truth. The latter rejects oversized boxes; the low IoU
supports thin boundary proposals in annotated defect ROIs. Partial coverage scores
only predictions whose center is inside an annotated region. All other candidates
remain explicitly excluded. Repeated views are correlated observational units.
"""

from collections import Counter

from .benchmark_models import (
    DEFAULT_POLICY,
    EMPTY_REJECTIONS,
    Annotation,
    BenchmarkReport,
    Defect,
    DetectorResult,
    MatchPolicy,
    Observation,
    covered,
)
from .models import Box, Detector, Finding
from .review import DETECTORS

__all__ = [
    "DEFAULT_POLICY",
    "EMPTY_REJECTIONS",
    "Annotation",
    "BenchmarkReport",
    "Defect",
    "DetectorResult",
    "MatchPolicy",
    "Observation",
    "evaluate",
]


def _matches(prediction: Box, truth: Box, policy: MatchPolicy) -> bool:
    width = max(
        0, min(prediction.x + prediction.width, truth.x + truth.width) - max(prediction.x, truth.x)
    )
    height = max(
        0,
        min(prediction.y + prediction.height, truth.y + truth.height) - max(prediction.y, truth.y),
    )
    intersection = width * height
    area = prediction.width * prediction.height
    union = area + truth.width * truth.height - intersection
    return (
        covered(prediction, (truth,))
        and intersection / union >= policy.min_iou
        and intersection / area >= policy.min_prediction_coverage
    )


def _assign(
    candidates: list[Finding], defects: tuple[Defect, ...], policy: MatchPolicy
) -> tuple[tuple[int, int], ...]:
    """Augment paths to avoid greedy ordering changing the number of true positives."""
    edges = [
        [i for i, defect in enumerate(defects) if _matches(candidate.box, defect.box, policy)]
        for candidate in candidates
    ]
    owners: dict[int, int] = {}

    def augment(candidate: int, seen: set[int]) -> bool:
        for target in edges[candidate]:
            if target in seen:
                continue
            seen.add(target)
            if target not in owners or augment(owners[target], seen):
                owners[target] = candidate
                return True
        return False

    for index in range(len(candidates)):
        augment(index, set())
    return tuple((owner, target) for target, owner in sorted(owners.items()))


def _score(
    annotation: Annotation, candidates: list[Finding], policy: MatchPolicy
) -> list[Observation]:
    defects = tuple(defect for defect in annotation.defects if defect.reproduced)
    pairs = _assign(candidates, defects, policy)
    matched = dict(pairs)
    observations = [
        Observation(
            scene=annotation.scene,
            detector=annotation.detector,
            outcome="TP" if index in matched else "FP",
            candidate_id=candidate.id,
            defect_id=defects[matched[index]].id if index in matched else None,
            note="Spatial one-to-one match"
            if index in matched
            else "No unmatched annotated target",
        )
        for index, candidate in enumerate(candidates)
    ]
    found = set(matched.values())
    observations.extend(
        Observation(
            scene=annotation.scene,
            detector=annotation.detector,
            outcome="FN",
            defect_id=defect.id,
            note=defect.note,
        )
        for index, defect in enumerate(defects)
        if index not in found
    )
    return observations


def evaluate(
    findings: list[Finding],
    annotations: list[Annotation],
    policy: MatchPolicy = DEFAULT_POLICY,
    *,
    rejected_candidate_ids: frozenset[str] = EMPTY_REJECTIONS,
) -> BenchmarkReport:
    """Score only explicitly reviewed coverage; reject duplicate annotation keys/IDs."""
    keys: list[tuple[str, Detector]] = [
        (annotation.scene, annotation.detector) for annotation in annotations
    ]
    if len(set(keys)) != len(keys) or len({finding.id for finding in findings}) != len(findings):
        message = "Duplicate scene-detector annotation or finding ID"
        raise ValueError(message)
    if unknown := rejected_candidate_ids - {finding.id for finding in findings}:
        message = f"Unknown rejected candidate IDs: {sorted(unknown)}"
        raise ValueError(message)
    lookup = dict(zip(keys, annotations, strict=True))
    scored: dict[tuple[str, Detector], list[Finding]] = {key: [] for key in keys}
    observations: list[Observation] = []
    for finding in findings:
        annotation = lookup.get((finding.scene, finding.detector))
        if (
            annotation is not None
            and annotation.eligible
            and covered(finding.box, annotation.regions)
            and not any(
                not defect.reproduced and covered(finding.box, (defect.box,))
                for defect in annotation.defects
            )
        ):
            if finding.id in rejected_candidate_ids:
                observations.append(
                    Observation(
                        scene=finding.scene,
                        detector=finding.detector,
                        outcome="FP",
                        candidate_id=finding.id,
                        note="Human semantic rejection; spatial match forbidden",
                    )
                )
            else:
                scored[(finding.scene, finding.detector)].append(finding)
        else:
            observations.append(
                Observation(
                    scene=finding.scene,
                    detector=finding.detector,
                    outcome="excluded",
                    candidate_id=finding.id,
                    note="Outside eligible coverage or inside explicitly excluded target region",
                )
            )
    for annotation in annotations:
        if annotation.eligible:
            observations.extend(
                _score(annotation, scored[(annotation.scene, annotation.detector)], policy)
            )
    rows: list[DetectorResult] = []
    for detector in DETECTORS:
        detector_annotations = [item for item in annotations if item.detector == detector]
        excluded_targets = sum(
            not item.eligible or not defect.reproduced
            for item in detector_annotations
            for defect in item.defects
        )
        counts = Counter(
            observation.outcome for observation in observations if observation.detector == detector
        )
        tp, fp, fn = counts["TP"], counts["FP"], counts["FN"]
        precision, recall = tp / (tp + fp) if tp + fp else None, tp / (tp + fn) if tp + fn else None
        below = (precision is not None and precision < policy.precision_target) or (
            recall is not None and recall < policy.recall_target
        )
        rows.append(
            DetectorResult(
                detector=detector,
                tp=tp,
                fp=fp,
                fn=fn,
                precision=precision,
                recall=recall,
                eligible_annotations=sum(item.eligible for item in detector_annotations),
                excluded_annotations=sum(not item.eligible for item in detector_annotations),
                excluded_defects=excluded_targets,
                excluded_candidates=counts["excluded"],
                target_status="below_target"
                if below
                else "not_demonstrated"
                if precision is None or recall is None
                else "met",
            )
        )
    return BenchmarkReport(
        policy=policy,
        detectors=tuple(rows),
        observations=tuple(observations),
        rejected_candidate_ids=tuple(sorted(rejected_candidate_ids)),
    )
