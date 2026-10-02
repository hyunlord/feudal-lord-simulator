import numpy as np

from vision_check.lod import flat_facades


def scene(*, textured: bool = False) -> np.ndarray[tuple[int, ...], np.dtype[np.uint8]]:
    image = np.full((100, 180, 3), (105, 123, 65), dtype=np.uint8)
    rng = np.random.default_rng(7)
    for x in (15, 70, 125):
        image[30:40, x : x + 30] = (100, 78, 49)
        image[40:70, x + 3 : x + 27] = (222, 215, 188)
        if textured:
            texture = rng.integers(-30, 31, (30, 24, 1), dtype=np.int16)
            image[40:70, x + 3 : x + 27] = np.clip(
                image[40:70, x + 3 : x + 27].astype(np.int16) + texture,
                0,
                255,
            ).astype(np.uint8)
    return image


def test_repeated_flat_facades_warn() -> None:
    findings = flat_facades(scene(), 0.6)
    assert len(findings) == 3
    assert all(f.companion_count == 3 for f in findings)


def test_textured_plaster_abstains() -> None:
    assert flat_facades(scene(textured=True), 0.6) == []


def test_single_flat_wall_is_not_repeated_lod() -> None:
    image = scene()
    image[:, 65:] = (105, 123, 65)
    assert flat_facades(image, 0.6) == []


def test_normal_zoom_abstains() -> None:
    assert flat_facades(scene(), 1.0) == []
