# /// script
# requires-python = ">=3.12"
# dependencies = ["playwright", "pydantic"]
# ///
# Run with existing tool venv and PYTHONPATH=report/holdout/frozen-tool.
"""Ordinary-UI holdout capture without importing any detector."""

from __future__ import annotations

import hashlib
import json
import subprocess
import time
from pathlib import Path
from typing import ClassVar

from playwright.sync_api import sync_playwright
from pydantic import BaseModel, ConfigDict
from vision_check.capture import (
    INTEGER,
    LANDS,
    PREFERENCES,
    ROOT,
    advance,
    camera,
    dismiss,
)
from vision_check.replay import _frames

BASE = Path("/Users/rexxa/fls-astra-vision")
REPO = BASE / "wt-current"
OUT = BASE / "report/holdout/new"
MANIFEST = OUT / "capture-plan.json"


class ActualStart(BaseModel):
    """Read-only runtime starting state boundary."""

    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)
    seed: int
    archetype: str | None
    tick: int


def main() -> None:  # noqa: PLR0915 -- one linear, audited capture protocol
    """Freeze scene plan, then capture native-input scenes in declared order."""
    commit = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=REPO, text=True  # noqa: S607 -- caller git
    ).strip()
    if not MANIFEST.exists():
        plan = {
            "frozen_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "game_commit": commit,
            "seeds": [3, 4, 5],
            "lands": list(LANDS),
            "season": "summer",
            "tick_target": 1010,
            "zoom": 1.0,
            "center": [32, 32],
            "viewport": [1600, 1100],
            "frames": 20,
            "interval_ms": 600,
            "detector_execution": "forbidden before truth freeze",
            "river_status": "blocked_native_UI_seed_locked_1",
            "river_source": "src/ui/landChoice.ts:26-43",
        }
        MANIFEST.write_text(json.dumps(plan, indent=2))
        MANIFEST.with_suffix(".sha256").write_text(
            hashlib.sha256(MANIFEST.read_bytes()).hexdigest() + "\n"
        )
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(headless=True)
        try:
            for seed in (3, 4, 5):
                for terrain in ("coast", "chalk", "forest", "fen"):
                    name = f"holdout-{terrain}-s{seed}-summer"
                    folder = OUT / "raw" / name
                    if (folder / "provenance.json").exists():
                        print(f"RESUME {name}", flush=True)  # noqa: T201 -- capture progress
                        continue
                    context = browser.new_context(
                        viewport={"width": 1600, "height": 1100}, device_scale_factor=1
                    )
                    try:
                        page = context.new_page()
                        page.add_init_script(PREFERENCES)
                        page.add_init_script(path=ROOT / "browser.js")
                        page.goto(
                            "http://127.0.0.1:4470/",
                            wait_until="networkidle",
                            timeout=90000,
                        )
                        page.get_by_role(
                            "button", name=LANDS[terrain], exact=False
                        ).click()
                        for _ in range(seed - 1):
                            page.get_by_role(
                                "button", name="지도 번호 높이기", exact=True
                            ).click()
                        selected = INTEGER.validate_python(
                            page.locator(".welcome-seed-value").inner_text()
                        )
                        if selected != seed:
                            message = f"UI seed mismatch: {selected} != {seed}"
                            raise RuntimeError(message)
                        page.get_by_role(
                            "button", name="목표형으로 시작", exact=True
                        ).click()
                        page.wait_for_timeout(2000)
                        page.evaluate((ROOT / "adapter.js").read_text())
                        actual = ActualStart.model_validate(
                            page.evaluate("""() => {
                            const s=window.__vision.store.getState();
                            return {seed:s.seed,archetype:s.archetypeId??null,tick:s.tick};}""")
                        )
                        if actual.seed != seed:
                            message = f"Actual seed mismatch: {actual.seed} != {seed}"
                            raise RuntimeError(message)
                        page.keyboard.press("Backquote")
                        page.wait_for_timeout(350)
                        page.clock.install()
                        page.clock.pause_at(int(time.time() * 1000) + 100)
                        dismiss(page)
                        advance(page, 1010)
                        camera(page, 1.0, (32, 32))
                        capture = _frames(page, OUT, name, 1.0, seed=seed, gap=600)
                        capture = capture.model_copy(
                            update={
                                "terrain": terrain,
                                "season": "summer",
                                "cohort": "holdout",
                                "capture_notes": (
                                    "native land picker; runtime seed verified; no proof",
                                    "20 frames at 600ms browser clock; not performance timing",
                                    ("frozen scenario manifest before collection; "
                                     "detectors not invoked"),
                                ),
                            }
                        )
                        (folder / "capture.json").write_text(
                            capture.model_dump_json(ensure_ascii=False)
                        )
                        provenance = {
                            "commit": commit,
                            "repo": str(REPO),
                            "actual_start": actual.model_dump(),
                            "manifest_sha256": hashlib.sha256(
                                MANIFEST.read_bytes()
                            ).hexdigest(),
                            "first_tick": capture.frames[0].tick,
                            "last_tick": capture.frames[-1].tick,
                            "observed_camera": capture.frames[0].camera.model_dump(),
                            "png_sha256": {
                                p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                                for p in sorted(folder.glob("*.png"))
                            },
                        }
                        (folder / "provenance.json").write_text(
                            json.dumps(provenance, indent=2)
                        )
                        print(  # noqa: T201 -- capture progress
                            f"COMPLETE {name}",
                            f"ticks {capture.frames[0].tick}..{capture.frames[-1].tick}",
                            flush=True,
                        )
                    finally:
                        context.close()
        finally:
            browser.close()


if __name__ == "__main__":
    main()
