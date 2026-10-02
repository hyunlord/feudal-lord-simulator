"""Validated capture and diagnostic interchange contracts."""

from typing import ClassVar, Literal

from pydantic import BaseModel, ConfigDict, Field

Detector = Literal[
    "straight_boundary",
    "tile_seam",
    "stationary_person",
    "roof_overlap",
    "scale_ratio",
    "repeat_density",
]


class Box(BaseModel):
    """Axis-aligned bounds in screenshot pixels; x/y are the upper left."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    x: int
    y: int
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class Metric(BaseModel):
    """A numerical observation with an explicit unit."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    name: str
    value: float
    unit: str = "ratio"


class Finding(BaseModel):
    """A candidate, never automatically a human-confirmed defect."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    id: str
    scene: str
    detector: Detector
    box: Box
    score: float = Field(ge=0, le=1)
    reason: str
    metrics: tuple[Metric, ...] = ()


class Draw(BaseModel):
    """Read-only canvas provenance; actual pixels still validate visibility."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    asset: str
    box: Box
    order: int
    source: tuple[float, ...] = ()
    callsite: str = ""
    alpha: float = 1.0


class Frame(BaseModel):
    """One screenshot with observed game and capture clocks."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    image: str
    index: int
    elapsed_ms: float
    tick: int
    draws: tuple[Draw, ...] = ()


class Scene(BaseModel):
    """One fixed camera, season, zoom and world seed."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    id: str
    terrain: str
    season: str
    seed: int
    zoom: float = Field(gt=0)
    camera: tuple[float, float]
    viewport: tuple[int, int]
    tile_width: float = Field(gt=0)
    frames: tuple[Frame, ...]
    cohort: Literal["calibration", "holdout"] = "calibration"
    qa_text: str = ""
    valid_motion: bool = False
    capture_notes: tuple[str, ...] = ()


class Thresholds(BaseModel):
    """Versioned thresholds: explicit knobs, no scene-specific hidden exemptions."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    exclude_water: bool = False
    axis_boundary_length_tiles: float | None = None
    boundary_length_tiles: float = 1.8
    boundary_contrast: float = 10.0
    boundary_angle_degrees: float = 3.5
    seam_correlation: float = 0.5
    seam_min_periods: float = 3.0
    still_distance_px: float = 1.3
    still_min_tick_span: int = 25
    overlap_fraction: float = 0.2
    repeat_min_count: int = 6
    repeat_building_min_count: int = 6
    repeat_radius_tiles: float = 4.0
    repeat_similarity: float = 0.85
    max_per_detector: int = 12
