"""Validated browser boundary; opaque JavaScript values stop here."""

from pydantic import BaseModel, Field

from .models import Draw


class Point(BaseModel):
    """Screen point."""

    x: float
    y: float


class Camera(BaseModel):
    """Native camera."""

    zoom: float
    panX: float  # noqa: N815 -- browser camera wire protocol.
    panY: float  # noqa: N815 -- browser camera wire protocol.


class Viewport(BaseModel):
    """Canvas dimensions."""

    width: int
    height: int


class Person(BaseModel):
    """Read-only simulation support for sprite matching."""

    id: str
    kind: str
    foot: Point
    pathRemaining: int  # noqa: N815 -- browser person wire protocol.
    cancelled: bool


class Tile(BaseModel):
    """Occupied tile used to exclude intended roads."""

    tx: int
    ty: int
    road: bool
    building: str | None


class Reading(BaseModel):
    """Actual frame provenance."""

    tick: int
    speed: int
    camera: Camera
    viewport: Viewport
    draws: tuple[Draw, ...]
    people: tuple[Person, ...]
    tiles: tuple[Tile, ...]
    url: str
    proof: bool
    index: int = 0
    elapsed_ms: float = 0
    wall_elapsed_ms: float = 0
    image: str = ""


class Capture(BaseModel):
    """A raw scene before image-based normalization."""

    id: str
    terrain: str
    season: str
    seed: int
    zoom: float
    cohort: str
    qa_text: str
    frames: tuple[Reading, ...] = Field(min_length=20, max_length=20)
    capture_notes: tuple[str, ...]
