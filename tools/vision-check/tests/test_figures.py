import numpy as np

from vision_check.figures import FigureEvidence, detect_figures
from vision_check.models import Box, Draw, Frame, Scene


def evidence() -> FigureEvidence:
    sprite = np.full((20, 10, 4), 255, dtype=np.uint8)
    sprite[:, :, :3] = (160, 30, 90)
    return FigureEvidence(rgba={"/assets/walkers-v2/drinker.png": sprite}, roofs={})


def scene(span: int = 10000) -> Scene:
    draw = Draw(
        asset="/assets/walkers-v2/drinker.png", box=Box(x=30, y=20, width=10, height=20), order=2
    )
    return Scene(
        id="test",
        terrain="city",
        season="summer",
        seed=1,
        zoom=1,
        camera=(0, 0),
        viewport=(100, 100),
        tile_width=64,
        valid_motion=True,
        frames=tuple(
            Frame(image="", index=i, elapsed_ms=i * span / 19, tick=i, draws=(draw,))
            for i in range(20)
        ),
    )


def images() -> list[np.ndarray[tuple[int, ...], np.dtype[np.uint8]]]:
    image = np.zeros((100, 100, 3), dtype=np.uint8)
    image[20:40, 30:40] = (160, 30, 90)
    return [image.copy() for _ in range(20)]


def test_stationary_scene_figure_requires_ten_seconds() -> None:
    # Given a visible unassigned decorative human for ten seconds.
    # When diagnosed, then report the stable figure.
    findings = detect_figures(images(), scene(), evidence())
    assert [finding.detector for finding in findings] == ["stationary_person"]


def test_two_seconds_abstains_from_stationary_claim() -> None:
    # Given only two seconds of an otherwise identical capture.
    # When diagnosed, then avoid concluding a guest is stuck.
    assert detect_figures(images(), scene(2000), evidence()) == []


def test_occluded_provenance_does_not_become_visible_person() -> None:
    # Given metadata for a figure whose pixels are hidden by a foreground object.
    blank = [np.zeros((100, 100, 3), dtype=np.uint8) for _ in range(20)]
    # When diagnosed, then reject the invisible sprite.
    assert detect_figures(blank, scene(), evidence()) == []


def test_reasoned_petition_crowd_excluded() -> None:
    # Given a figure explicitly rendered by the petition-crowd callsite.
    original = evidence()
    sources = {(i, 2): "drawStoryProps>drawCell" for i in range(20)}
    # When diagnosed, then preserve the intended standing crowd.
    assert (
        detect_figures(images(), scene(), FigureEvidence(original.rgba, original.roofs, sources))
        == []
    )


def test_static_roof_person_detected_without_frame_difference() -> None:
    # Given an unchanged visible human drawn above an explicit roof mask.
    original = scene(2000)
    building = Draw(asset="roof", box=Box(x=10, y=10, width=60, height=60), order=1)
    frames = tuple(
        frame.model_copy(update={"draws": (building, *frame.draws)}) for frame in original.frames
    )
    masks = FigureEvidence(evidence().rgba, {"roof": np.full((60, 60), 255, dtype=np.uint8)})
    # When diagnosed, then RGB template visibility is enough despite zero difference.
    findings = detect_figures(images(), original.model_copy(update={"frames": frames}), masks)
    assert [finding.detector for finding in findings] == ["roof_overlap"]


def test_two_figures_cannot_share_one_later_match() -> None:
    # Given two overlapping provenance figures initially, but only one thereafter.
    original = scene()
    first = original.frames[0]
    second = first.draws[0].model_copy(update={"order": 3})
    frames = (first.model_copy(update={"draws": (*first.draws, second)}), *original.frames[1:])
    # When tracked, then one current draw cannot keep both tracks alive.
    findings = detect_figures(images(), original.model_copy(update={"frames": frames}), evidence())
    assert len(findings) == 1


def test_moving_figure_not_reported_as_stationary() -> None:
    # Given a human that travels farther than 0.15 tile across the capture.
    original = scene()
    changed_frames: list[Frame] = []
    changed_images: list[np.ndarray[tuple[int, ...], np.dtype[np.uint8]]] = []
    for frame in original.frames:
        draw = frame.draws[0].model_copy(
            update={"box": Box(x=30 + frame.index, y=20, width=10, height=20)}
        )
        changed_frames.append(frame.model_copy(update={"draws": (draw,)}))
        image = np.zeros((100, 100, 3), dtype=np.uint8)
        image[20:40, 30 + frame.index : 40 + frame.index] = (160, 30, 90)
        changed_images.append(image)
    # When diagnosed, then traversal is not a standing defect.
    assert (
        detect_figures(
            changed_images,
            original.model_copy(update={"frames": tuple(changed_frames)}),
            evidence(),
        )
        == []
    )


def test_direct_callsite_excludes_legitimate_crowd() -> None:
    # Given actual captured callsite metadata, with no external mapping.
    original = scene()
    frames = tuple(
        frame.model_copy(
            update={
                "draws": (
                    frame.draws[0].model_copy(update={"callsite": "drawStoryProps>drawCell"}),
                )
            }
        )
        for frame in original.frames
    )
    # When diagnosed, then explicit intended crowd context suppresses the candidate.
    assert (
        detect_figures(images(), original.model_copy(update={"frames": frames}), evidence()) == []
    )
