"""Versioned semantic polygons in source-asset coordinates, never scene coordinates."""

from pathlib import Path
from typing import ClassVar, Literal

from pydantic import BaseModel, ConfigDict, Field


class Component(BaseModel):
    """One fully measurable upright object or wheel, excluding surrounding props."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, extra="forbid")
    id: str
    kind: Literal["barrel", "sack", "cart-wheel"]
    polygon: tuple[tuple[int, int], ...] = Field(min_length=3)
    note: str


class ComponentAsset(BaseModel):
    """Annotations apply only to this exact PNG revision and source dimensions."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, extra="forbid")
    path: str
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    parts: tuple[Component, ...]


class ComponentCatalog(BaseModel):
    """Portable asset metadata; exclusions document intentional abstention."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, extra="forbid")
    version: Literal[1] = 1
    annotation_basis: str
    exclusions: tuple[str, ...]
    assets: tuple[ComponentAsset, ...]


def load_catalog(path: Path) -> ComponentCatalog:
    """Parse the explicit catalogue at the file boundary."""
    return ComponentCatalog.model_validate_json(path.read_text())
