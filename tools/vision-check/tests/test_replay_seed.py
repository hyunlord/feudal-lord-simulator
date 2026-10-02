"""Historical replay metadata must describe the loaded world, not a default seed."""

import pytest
from pydantic import ValidationError

from vision_check.save_seed import read_save_seed


def test_seed_two_comes_from_world_not_header() -> None:
    metadata = read_save_seed(b'{"schemaVersion":30,"seed":"1","state":{"seed":2}}')
    assert metadata.state.seed == 2
    assert metadata.schema_version == 30


def test_minimal_envelope_accepts_unrelated_game_fields() -> None:
    metadata = read_save_seed(
        b'{"schemaVersion":31,"state":{"seed":4,"tick":120000},"checksum":"opaque"}'
    )
    assert metadata.state.seed == 4


@pytest.mark.parametrize(
    "payload",
    [
        b"{}",
        b'{"schemaVersion":31,"seed":"2"}',
        b'{"schemaVersion":31,"state":{}}',
        b'{"schemaVersion":31,"state":{"seed":true}}',
        b'{"schemaVersion":31,"state":{"seed":"2"}}',
        b'{"schemaVersion":31,"state":{"seed":2.5}}',
        b'{"schemaVersion":0,"state":{"seed":2}}',
        b'{"schemaVersion":"31","state":{"seed":2}}',
        b'{"seed":2,"tick":320000}',
        b"not json",
    ],
)
def test_missing_or_invalid_envelope_does_not_default_to_one(payload: bytes) -> None:
    with pytest.raises(ValidationError):
        read_save_seed(payload)
