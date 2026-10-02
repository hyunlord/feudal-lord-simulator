"""Precision must never infer labels or call empty predictions perfect."""

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from vision_check.cli import app
from vision_check.models import Box, Finding
from vision_check.review import HumanReview, markdown, review_files, summarize


def finding(identity: str) -> Finding:
    return Finding(
        id=identity,
        scene="scene",
        detector="straight_boundary",
        box=Box(x=0, y=0, width=10, height=10),
        score=0.8,
        reason="candidate",
    )


def test_precision_uses_actual_tp_fp_and_empty_detectors_are_not_demonstrated() -> None:
    report = summarize(
        [finding("one"), finding("two")],
        [
            HumanReview(id="one", verdict="TP", note="visible square edge"),
            HumanReview(id="two", verdict="FP", note="intended road"),
        ],
    )
    assert report.detectors[0].precision == 0.5
    assert report.detectors[0].target_status == "below_target"
    assert all(
        row.precision is None and row.target_status == "not_demonstrated"
        for row in report.detectors[1:]
    )
    assert len(report.detectors) == 6
    assert "| N/A | Not demonstrated |" in markdown(report)


@pytest.mark.parametrize("identities", [[], ["one", "one"], ["wrong"], ["one", "wrong"]])
def test_missing_duplicate_or_unknown_reviews_are_rejected(identities: list[str]) -> None:
    reviews = [HumanReview(id=identity, verdict="TP", note="manual") for identity in identities]
    with pytest.raises(ValueError, match="Review coverage invalid"):
        summarize([finding("one")], reviews)


def test_duplicate_finding_ids_are_rejected() -> None:
    with pytest.raises(ValueError, match="duplicate_findings"):
        summarize(
            [finding("one"), finding("one")], [HumanReview(id="one", verdict="TP", note="manual")]
        )


def test_json_round_trip_emits_all_six_rows(tmp_path: Path) -> None:
    candidates = tmp_path / "findings.json"
    reviews = tmp_path / "human-review.json"
    candidates.write_text(json.dumps([finding("one").model_dump()]))
    reviews.write_text('[{"id":"one","verdict":"FP","note":"natural edge"}]')
    output = tmp_path / "review"
    report = review_files(candidates, reviews, output)
    assert report.detectors[0].precision == 0
    assert (output / "precision.json").is_file()
    assert (output / "PRECISION.md").read_text().count("Not demonstrated") == 5


def test_zero_findings_remain_na_for_all_six() -> None:
    report = summarize([], [])
    assert all(row.precision is None for row in report.detectors)
    assert all(row.target_status == "not_demonstrated" for row in report.detectors)


def test_review_command_runs_end_to_end_on_empty_explicit_inputs(tmp_path: Path) -> None:
    findings = tmp_path / "findings.json"
    labels = tmp_path / "labels.json"
    findings.write_text("[]")
    labels.write_text("[]")
    output = tmp_path / "result"
    result = CliRunner().invoke(app, ["review", str(findings), str(labels), str(output)])
    assert result.exit_code == 0, result.output
    assert "Reviewed 0 candidates" in result.output
    assert (output / "PRECISION.md").read_text().count("| N/A |") == 6
