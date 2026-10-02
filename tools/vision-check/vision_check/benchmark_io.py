"""Typed file boundary and Korean report for annotated naturalness benchmarks."""

from pathlib import Path
from typing import Final

from pydantic import TypeAdapter

from .benchmark import EMPTY_REJECTIONS, Annotation, BenchmarkReport, Observation, evaluate
from .models import Detector, Finding

LABELS: Final[dict[Detector, str]] = {
    "straight_boundary": "직각·직선 땅 경계",
    "tile_seam": "타일 이음새",
    "stationary_person": "멈춘 사람",
    "roof_overlap": "지붕 위 사람",
    "scale_ratio": "크기 비율",
    "repeat_density": "반복 밀도",
}
STATUS: Final = {
    "met": "관측 표본에서 달성",
    "below_target": "미달",
    "not_demonstrated": "미입증",
}


def _percentage(value: float | None) -> str:
    return "N/A" if value is None else f"{value:.1%}"


def markdown(report: BenchmarkReport) -> str:
    """Expose every denominator; absent evidence never becomes a passing score."""
    policy = report.policy
    lines = [
        "# 재현율·정밀도 시험 결과",
        "",
        f"목표: 재현율 ≥{policy.recall_target:.0%}, 정밀도 ≥{policy.precision_target:.0%}.",
        "",
        "| 검출기 | TP | FP | FN | 재현율 | 정밀도 | 목표 |",
        "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    lines.extend(
        " | ".join(
            (
                "",
                LABELS[row.detector],
                str(row.tp),
                str(row.fp),
                str(row.fn),
                _percentage(row.recall),
                _percentage(row.precision),
                STATUS[row.target_status],
                "",
            )
        )
        for row in report.detectors
    )
    lines.extend(
        (
            "",
            "## 검사 범위와 제외",
            "",
            "장면 수는 장면·검출기별 주석 단위이며 독립 결함 수와 같지 않습니다.",
            "",
            "| 검출기 | 유효 주석 | 제외 주석 | 제외 정답 | 제외 검출 |",
            "| --- | ---: | ---: | ---: | ---: |",
        )
    )
    lines.extend(
        " | ".join(
            (
                "",
                LABELS[row.detector],
                str(row.eligible_annotations),
                str(row.excluded_annotations),
                str(row.excluded_defects),
                str(row.excluded_candidates),
                "",
            )
        )
        for row in report.detectors
    )
    lines.extend(
        (
            "",
            "## 산식과 판정 기준",
            "",
            "- 재현율 = TP / (TP + FN), 정밀도 = TP / (TP + FP).",
            "- 분모가 0이면 JSON은 null, 표는 N/A입니다. 성공으로 세지 않습니다.",
            "- 관측 가능한 지표가 목표 미만이면 미달입니다. 두 지표가 모두 있어야 달성입니다.",
            "- 재현된 정답에 대응 검출이 없으면 FN이며 중복 검출은 FP입니다.",
            "- 미재현·검사 불가 정답은 FN이 아닙니다. 제외 사유는 입력 주석에 남깁니다.",
            "- 부분 주석은 지정 영역 안에 중심이 있는 검출만 평가합니다.",
            "- 미재현 정답 영역 안의 검출도 평가에서 제외합니다.",
            f"- 같은 장면·검출기 안에서 검출 중심이 정답 상자 내부이고 IoU ≥{policy.min_iou:g},",
            f"  검출 면적의 정답 내부 비율 ≥{policy.min_prediction_coverage:.0%}이어야 대응합니다.",
            "- 가능한 일대일 대응 수를 최대화합니다. 한 정답에 여러 TP를 부여하지 않습니다.",
            "- 반복 촬영·계절·줌은 상관된 관측이며 독립 표본이나 신뢰구간을 뜻하지 않습니다.",
            "- 모든 TP·FP·FN·제외 대응은 MATCHES.json에 기록했습니다.",
            "- 사람이 의미상 오탐으로 확정한 검출은 공간이 겹쳐도 TP가 될 수 없습니다.",
            "- 수동 오탐 ID는 metrics.json의 rejected_candidate_ids에 보존합니다.",
            "- 수동 오탐도 검사 ROI 밖에 있으면 제외하며 평가 범위를 넓히지 않습니다.",
            "",
        )
    )
    return "\n".join(lines)


def benchmark_files(
    findings_path: Path,
    annotations_path: Path,
    output: Path,
    *,
    human_rejections: Path | None = None,
    rejected_candidate_ids: frozenset[str] = EMPTY_REJECTIONS,
) -> BenchmarkReport:
    """Parse supplied JSON arrays and write metrics plus complete matching decisions."""
    findings = TypeAdapter(list[Finding]).validate_json(findings_path.read_bytes())
    annotations = TypeAdapter(list[Annotation]).validate_json(annotations_path.read_bytes())
    rejections = (
        TypeAdapter(list[str]).validate_json(human_rejections.read_bytes())
        if human_rejections is not None
        else []
    )
    report = evaluate(
        findings, annotations, rejected_candidate_ids=rejected_candidate_ids | frozenset(rejections)
    )
    output.mkdir(parents=True, exist_ok=True)
    (output / "metrics.json").write_text(report.model_dump_json(indent=2), encoding="utf-8")
    (output / "MATCHES.json").write_bytes(
        TypeAdapter(tuple[Observation, ...]).dump_json(report.observations, indent=2)
    )
    (output / "METRICS.md").write_text(markdown(report), encoding="utf-8")
    return report
