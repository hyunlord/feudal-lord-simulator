"""Frozen annotation, matching-policy and benchmark-result contracts."""

from typing import ClassVar, Final, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .models import Box, Detector


class Defect(BaseModel):
    """A visually judged defect; an unreproduced target is not a false negative."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, extra="forbid")
    id: str = Field(min_length=1)
    box: Box
    note: str = Field(min_length=1)
    reproduced: bool = True
    exclusion_reason: str = ""

    @model_validator(mode="after")
    def validate_exclusion(self) -> Self:
        """Require an explanation for every excluded target."""
        if not self.reproduced and not self.exclusion_reason.strip():
            message = "Unreproduced defects require exclusion_reason"
            raise ValueError(message)
        return self


class Annotation(BaseModel):
    """One scene-detector review; empty regions mean full-scene annotation coverage."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, extra="forbid")
    scene: str = Field(min_length=1)
    detector: Detector
    defects: tuple[Defect, ...] = ()
    regions: tuple[Box, ...] = ()
    eligible: bool = True
    exclusion_reason: str = ""

    @model_validator(mode="after")
    def validate_coverage(self) -> Self:
        """Reject contradictory or ambiguous benchmark denominators."""
        if not self.eligible and not self.exclusion_reason.strip():
            message = "Ineligible annotation requires exclusion_reason"
            raise ValueError(message)
        ids = [defect.id for defect in self.defects]
        if len(set(ids)) != len(ids):
            message = "Defect IDs must be unique within each annotation"
            raise ValueError(message)
        if any(
            defect.reproduced and not covered(defect.box, self.regions) for defect in self.defects
        ):
            message = "Reproduced defect center must lie within annotation coverage"
            raise ValueError(message)
        return self


class MatchPolicy(BaseModel):
    """Spatial matching and performance targets fixed before evaluation."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, extra="forbid")
    min_iou: float = Field(default=0.1, gt=0, le=1)
    min_prediction_coverage: float = Field(default=0.5, gt=0, le=1)
    recall_target: float = Field(default=0.7, gt=0, le=1)
    precision_target: float = Field(default=0.8, gt=0, le=1)


DEFAULT_POLICY: Final = MatchPolicy()
EMPTY_REJECTIONS: Final[frozenset[str]] = frozenset()


class Observation(BaseModel):
    """Auditable per-candidate or missed-target classification."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    scene: str
    detector: Detector
    outcome: Literal["TP", "FP", "FN", "excluded"]
    candidate_id: str | None = None
    defect_id: str | None = None
    note: str


class DetectorResult(BaseModel):
    """Separate performance denominators from annotation and reproduction coverage."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    detector: Detector
    tp: int
    fp: int
    fn: int
    precision: float | None
    recall: float | None
    eligible_annotations: int
    excluded_annotations: int
    excluded_defects: int
    excluded_candidates: int
    target_status: Literal["met", "below_target", "not_demonstrated"]


class BenchmarkReport(BaseModel):
    """Six detector rows plus all matching decisions."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    policy: MatchPolicy
    detectors: tuple[DetectorResult, ...]
    observations: tuple[Observation, ...]
    rejected_candidate_ids: tuple[str, ...] = ()


def covered(box: Box, regions: tuple[Box, ...]) -> bool:
    """Test box center against explicit review regions; an empty tuple means full scene."""
    x, y = box.x + box.width / 2, box.y + box.height / 2
    return not regions or any(
        region.x <= x < region.x + region.width and region.y <= y < region.y + region.height
        for region in regions
    )
