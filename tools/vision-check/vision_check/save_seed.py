"""Read seed provenance from an ordinary versioned save without rewriting it."""

from typing import ClassVar

from pydantic import BaseModel, ConfigDict, Field, StrictInt


class SavedWorldSeed(BaseModel):
    """The actual world seed, deliberately independent of the summary header."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, extra="ignore")
    seed: StrictInt


class SaveSeed(BaseModel):
    """Minimal versioned-envelope boundary; game loading validates the remaining state."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, extra="ignore")
    schema_version: StrictInt = Field(alias="schemaVersion", ge=1)
    state: SavedWorldSeed


def read_save_seed(payload: bytes) -> SaveSeed:
    """Reject malformed envelopes or absent world seeds instead of inventing a default."""
    return SaveSeed.model_validate_json(payload)
