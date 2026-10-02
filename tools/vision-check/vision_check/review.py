"""Summarize explicit human labels without turning missing evidence into success."""

from collections import Counter
from pathlib import Path
from typing import ClassVar, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from .models import Detector, Finding

DETECTORS: tuple[Detector, ...] = (
    "straight_boundary",
    "tile_seam",
    "stationary_person",
    "roof_overlap",
    "scale_ratio",
    "repeat_density",
)
TARGET = 0.8


class HumanReview(BaseModel):
    """One explicit judgment made after inspecting the actual candidate image."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, extra="forbid")
    id: str
    verdict: Literal["TP", "FP"]
    note: str = Field(min_length=1)


class DetectorPrecision(BaseModel):
    """Candidate precision; no recall or independent-holdout claim is implied."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    detector: Detector
    tp: int
    fp: int
    reviewed: int
    precision: float | None
    target_status: Literal["met_on_reviewed_candidates", "below_target", "not_demonstrated"]


class ReviewReport(BaseModel):
    """All six detectors, including those with no reviewed positive predictions."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    target: float = TARGET
    total_findings: int
    total_reviewed: int
    detectors: tuple[DetectorPrecision, ...]
    limitations: tuple[str, ...] = (
        "Precision uses supplied human judgments; the tool does not invent or verify judgments.",
        "Zero candidates means N/A and target not demonstrated, never 100% precision.",
        "Repeated views may be correlated; this report does not establish independent validation.",
        "No recall estimate or confidence guarantee follows from candidate precision alone.",
    )


def summarize(findings: list[Finding], reviews: list[HumanReview]) -> ReviewReport:
    """Require exactly one human judgment per finding before calculating precision."""
    finding_counts = Counter(finding.id for finding in findings)
    review_counts = Counter(review.id for review in reviews)
    duplicate_findings = sorted(identity for identity, count in finding_counts.items() if count > 1)
    duplicate_reviews = sorted(identity for identity, count in review_counts.items() if count > 1)
    missing = sorted(finding_counts.keys() - review_counts.keys())
    unknown = sorted(review_counts.keys() - finding_counts.keys())
    if duplicate_findings or duplicate_reviews or missing or unknown:
        message = (
            f"Review coverage invalid: duplicate_findings={duplicate_findings}; "
            f"duplicate_reviews={duplicate_reviews}; missing={missing}; unknown={unknown}"
        )
        raise ValueError(message)
    labels = {review.id: review.verdict for review in reviews}
    rows: list[DetectorPrecision] = []
    for detector in DETECTORS:
        true_positive = sum(
            labels[finding.id] == "TP" for finding in findings if finding.detector == detector
        )
        false_positive = sum(
            labels[finding.id] == "FP" for finding in findings if finding.detector == detector
        )
        count = true_positive + false_positive
        precision = true_positive / count if count else None
        status: Literal["met_on_reviewed_candidates", "below_target", "not_demonstrated"] = (
            "not_demonstrated"
            if precision is None
            else "met_on_reviewed_candidates"
            if precision >= TARGET
            else "below_target"
        )
        rows.append(
            DetectorPrecision(
                detector=detector,
                tp=true_positive,
                fp=false_positive,
                reviewed=count,
                precision=precision,
                target_status=status,
            )
        )
    return ReviewReport(
        total_findings=len(findings), total_reviewed=len(reviews), detectors=tuple(rows)
    )


def markdown(report: ReviewReport) -> str:
    """Render explicit denominators and N/A for missing detection evidence."""
    lines = [
        "# Human-reviewed candidate precision",
        "",
        f"Reviewed {report.total_reviewed}/{report.total_findings} candidates; target ≥80%.",
        "",
        "| Detector | TP | FP | Reviewed | Precision | Target |",
        "| --- | ---: | ---: | ---: | ---: | --- |",
    ]
    statuses = {
        "met_on_reviewed_candidates": "Met on reviewed candidates",
        "below_target": "Below target",
        "not_demonstrated": "Not demonstrated",
    }
    for row in report.detectors:
        precision = "N/A" if row.precision is None else f"{row.precision:.1%}"
        counts = f"| {row.detector} | {row.tp} | {row.fp} | {row.reviewed} | "
        lines.append(counts + f"{precision} | {statuses[row.target_status]} |")
    lines.extend(("", *(f"- {limitation}" for limitation in report.limitations), ""))
    return "\n".join(lines)


def review_files(findings: Path, human_review: Path, output: Path) -> ReviewReport:
    """Validate JSON lists and emit precision.json plus PRECISION.md."""
    candidates = TypeAdapter(list[Finding]).validate_json(findings.read_text(encoding="utf-8"))
    reviews = TypeAdapter(list[HumanReview]).validate_json(human_review.read_text(encoding="utf-8"))
    report = summarize(candidates, reviews)
    output.mkdir(parents=True, exist_ok=True)
    (output / "precision.json").write_text(report.model_dump_json(indent=2), encoding="utf-8")
    (output / "PRECISION.md").write_text(markdown(report), encoding="utf-8")
    return report
