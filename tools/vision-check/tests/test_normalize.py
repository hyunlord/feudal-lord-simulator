"""Person identity matching must neither reuse actors nor label unrelated props."""


from vision_check.contracts import Camera, Person, Point, Reading, Viewport
from vision_check.models import Box, Draw
from vision_check.normalize import person_draws


def reading(draws: tuple[Draw, ...], people: tuple[Person, ...]) -> Reading:
    return Reading(
        tick=10,
        speed=1,
        camera=Camera(zoom=1, panX=0, panY=0),
        viewport=Viewport(width=200, height=200),
        draws=draws,
        people=people,
        tiles=(),
        url="http://127.0.0.1:4470/",
        proof=False,
    )


def person(identity: str, x: float, y: float) -> Person:
    return Person(
        id=identity, kind="walker", foot=Point(x=x, y=y), pathRemaining=5, cancelled=False
    )


def test_nearest_actor_assignments_are_one_to_one_and_preserve_crop() -> None:
    first = Draw(
        asset="/assets/walkers-v2/walker.png",
        box=Box(x=10, y=10, width=8, height=20),
        order=1,
        source=(0, 0, 16, 32),
    )
    second = Draw(
        asset="/assets/workers/wk_farmer.png", box=Box(x=50, y=10, width=8, height=20), order=2
    )
    draws, aliases = person_draws(
        reading((second, first), (person("a", 14, 30), person("b", 54, 30), person("c", 14, 30)))
    )
    assert tuple(draw.asset for draw in draws) == ("person:b", "person:a")
    assert aliases == {"person:a": first.asset + "#crop=0,0,16,32", "person:b": second.asset}


def test_unrelated_prop_or_distant_actor_cannot_match() -> None:
    prop = Draw(asset="/assets/props/barrel.png", box=Box(x=10, y=10, width=8, height=20), order=1)
    actor = Draw(
        asset="/assets/walkers-v2/walker.png", box=Box(x=100, y=100, width=8, height=20), order=2
    )
    draws, aliases = person_draws(reading((prop, actor), (person("a", 14, 30),)))
    assert draws == (prop, actor)
    assert aliases == {}
