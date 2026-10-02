import pytest
from pydantic import ValidationError

from vision_check.benchmark import Annotation, Defect, evaluate
from vision_check.models import Box, Finding


def box(x: int = 10) -> Box:
    return Box(x=x, y=10, width=20, height=20)


def candidate(identity: str = "a", x: int = 10) -> Finding:
    return Finding(
        id=identity, scene="s", detector="roof_overlap", box=box(x), score=0.9, reason="test"
    )


def annotation() -> Annotation:
    return Annotation(
        scene="s", detector="roof_overlap", defects=(Defect(id="d", box=box(), note="visible"),)
    )


def test_matches_once_and_counts_duplicate_false_positive() -> None:
    # Given two candidates for one annotated defect.
    findings = [candidate(), candidate("b")]
    # When evaluated.
    row = evaluate(findings, [annotation()]).detectors[3]
    # Then duplicate predictions reduce precision.
    assert (row.tp, row.fp, row.fn, row.precision, row.recall) == (1, 1, 0, 0.5, 1.0)


def test_known_reproduced_defect_without_prediction_is_missed() -> None:
    # Given a reproduced annotation, when no prediction is made.
    row = evaluate([], [annotation()]).detectors[3]
    # Then recall is zero while precision remains undefined.
    assert (row.fn, row.recall, row.precision, row.target_status) == (1, 0.0, None, "below_target")


def test_negative_scene_has_false_positive_but_no_recall_denominator() -> None:
    # Given a fully inspected normal scene, when a candidate appears.
    row = evaluate([candidate()], [Annotation(scene="s", detector="roof_overlap")]).detectors[3]
    # Then the candidate is false, without inventing a positive target.
    assert (row.tp, row.fp, row.fn, row.recall, row.precision) == (0, 1, 0, None, 0.0)


def test_empty_evidence_is_not_demonstrated() -> None:
    # Given no annotations or candidates, when evaluated.
    rows = evaluate([], []).detectors
    # Then every detector remains unproven.
    assert all(
        row.recall is None and row.precision is None and row.target_status == "not_demonstrated"
        for row in rows
    )


def test_partial_roi_excludes_unknown_area() -> None:
    # Given one annotated ROI and a candidate outside it.
    truth = annotation().model_copy(update={"regions": (box(),)})
    # When evaluated.
    row = evaluate([candidate("outside", 100)], [truth]).detectors[3]
    # Then outside evidence is excluded, not called a false positive.
    assert (row.fn, row.fp, row.excluded_candidates) == (1, 0, 1)


def test_ineligible_annotation_does_not_create_false_negative() -> None:
    # Given a failed reproduction.
    truth = annotation().model_copy(
        update={"eligible": False, "exclusion_reason": "save unavailable"}
    )
    # When evaluated.
    row = evaluate([], [truth]).detectors[3]
    # Then coverage records the excluded case separately.
    assert (row.fn, row.excluded_annotations, row.excluded_defects) == (0, 1, 1)


def test_huge_detection_cannot_cover_every_target() -> None:
    # Given a screen-sized prediction enclosing a tiny annotated defect.
    finding = candidate().model_copy(update={"box": Box(x=0, y=0, width=1000, height=1000)})
    # When evaluated.
    row = evaluate([finding], [annotation()]).detectors[3]
    # Then oversized boxes do not count as matches.
    assert (row.tp, row.fp, row.fn) == (0, 1, 1)


def test_unreproduced_target_and_its_candidate_are_excluded() -> None:
    # Given an explicit uncertainty region that was not reproduced conclusively.
    truth = Annotation(
        scene="s",
        detector="roof_overlap",
        defects=(
            Defect(
                id="d",
                box=box(),
                note="uncertain",
                reproduced=False,
                exclusion_reason="insufficient frames",
            ),
        ),
    )
    # When a candidate occurs there.
    row = evaluate([candidate()], [truth]).detectors[3]
    # Then uncertainty is neither a miss nor an invented false alarm.
    assert (row.fn, row.fp, row.excluded_defects, row.excluded_candidates) == (0, 0, 1, 1)


def test_assignment_recovers_competing_targets() -> None:
    # Given overlapping targets, one candidate fits both and the other fits only one.
    truth = Annotation(
        scene="s",
        detector="roof_overlap",
        defects=(
            Defect(id="left", box=Box(x=0, y=0, width=40, height=40), note="left"),
            Defect(id="right", box=Box(x=20, y=0, width=40, height=40), note="right"),
        ),
    )
    # When the flexible candidate appears first.
    row = evaluate([candidate("flexible", 20), candidate("left-only", 0)], [truth]).detectors[3]
    # Then reassignment achieves two genuine matches rather than greedy undercounting.
    assert (row.tp, row.fp, row.fn) == (2, 0, 0)


def test_wrong_detector_does_not_match_target() -> None:
    # Given a box at the right position but from the wrong detector.
    wrong = candidate().model_copy(update={"detector": "tile_seam"})
    # When evaluated against roof-overlap annotations.
    report = evaluate([wrong], [annotation()])
    # Then the target is missed and unannotated detector output is excluded.
    assert report.detectors[3].fn == 1
    assert report.detectors[1].excluded_candidates == 1


def test_exclusions_require_reason() -> None:
    # Given an annotation marked ineligible without explanation.
    # When parsed, then fail closed instead of silently removing a denominator.
    with pytest.raises(ValidationError, match="exclusion_reason"):
        Annotation(scene="s", detector="roof_overlap", eligible=False)


def test_duplicate_annotation_rejected() -> None:
    # Given duplicated scene-detector coverage.
    # When evaluated, then fail instead of double-counting targets.
    with pytest.raises(ValueError, match="Duplicate"):
        evaluate([], [annotation(), annotation()])


def test_ground_truth_outside_partial_coverage_rejected() -> None:
    # Given a defect outside the declared reviewed region.
    # When parsed, then reject contradictory ground truth.
    with pytest.raises(ValidationError, match="coverage"):
        Annotation(
            scene="s", detector="roof_overlap", regions=(box(100),), defects=annotation().defects
        )


def test_semantic_rejection_cannot_steal_spatial_match() -> None:
    # Given two spatial matches, one manually confirmed to show the wrong object.
    findings = [candidate("wrong-object"), candidate("real-object")]
    # When only the wrong object is rejected semantically.
    report = evaluate(findings, [annotation()], rejected_candidate_ids=frozenset({"wrong-object"}))
    # Then the real object matches and the rejected object remains an explicit FP.
    row = report.detectors[3]
    assert (row.tp, row.fp, row.fn) == (1, 1, 0)
    assert report.rejected_candidate_ids == ("wrong-object",)
    assert any(
        item.candidate_id == "wrong-object" and item.outcome == "FP" and "semantic" in item.note
        for item in report.observations
    )


def test_only_rejected_match_leaves_target_missed() -> None:
    # Given only a semantically wrong candidate at the target position.
    # When rejected, then retain both the false alarm and true missed defect.
    row = evaluate(
        [candidate()], [annotation()], rejected_candidate_ids=frozenset({"a"})
    ).detectors[3]
    assert (row.tp, row.fp, row.fn) == (0, 1, 1)


def test_unknown_rejection_id_is_rejected() -> None:
    # Given a stale manual rejection from a different detector run.
    # When evaluated, then fail instead of silently applying incomplete review.
    with pytest.raises(ValueError, match="Unknown rejected"):
        evaluate([candidate()], [annotation()], rejected_candidate_ids=frozenset({"stale"}))


def test_rejection_does_not_expand_annotation_coverage() -> None:
    # Given a rejected candidate outside the inspected ROI.
    truth = annotation().model_copy(update={"regions": (box(),)})
    # When evaluated, then preserve the coverage exclusion rather than inventing FP evidence.
    row = evaluate(
        [candidate("outside", 100)], [truth], rejected_candidate_ids=frozenset({"outside"})
    ).detectors[3]
    assert (row.fp, row.fn, row.excluded_candidates) == (0, 1, 1)
