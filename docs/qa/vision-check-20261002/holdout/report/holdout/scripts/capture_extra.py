# /// script
# requires-python = ">=3.12"
# dependencies = ["playwright", "pydantic"]
# ///
# Run with existing tool venv and PYTHONPATH=report/holdout/frozen-tool.
"""Capture the predeclared temporal river and two ordinary archived cities."""

import hashlib
import json
import time
from pathlib import Path

from playwright.sync_api import sync_playwright
from vision_check.capture import PREFERENCES, ROOT, advance, camera, dismiss
from vision_check.replay import _frames, replay

BASE = Path("/Users/rexxa/fls-astra-vision")
OUT = BASE / "report/holdout/new"
REPO = BASE / "wt-current"
MANIFEST = OUT / "capture-extra-plan.json"


def main() -> None:
    """Freeze additional scenarios before collecting the first additional pixel."""
    scenarios = [
        {
            "id": "holdout-river-s1-year1301",
            "kind": "temporal_only_same_map",
            "seed": 1,
            "tick": 5010,
            "zoom": 1.0,
            "center": [32, 32],
        },
        {
            "id": "holdout-city-year1407",
            "save": "docs/qa/round15/repro/saves/normal-ui-1407.json.gz",
            "zoom": 1.3,
            "center": [46, 37],
        },
        {
            "id": "holdout-city-year1362",
            "save": "docs/qa/round03-14/repro/saves/natural1362-ch4-start.json.gz",
            "zoom": 1.3,
            "center": [46, 37],
        },
    ]
    if not MANIFEST.exists():
        MANIFEST.write_text(
            json.dumps(
                {
                    "frozen_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "scenarios": scenarios,
                    "frames": 20,
                    "interval_ms": 600,
                    "viewport": [1600, 1100],
                },
                indent=2,
            )
        )
        MANIFEST.with_suffix(".sha256").write_text(
            hashlib.sha256(MANIFEST.read_bytes()).hexdigest() + "\n"
        )
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(headless=True)
        try:
            context = browser.new_context(
                viewport={"width": 1600, "height": 1100}, device_scale_factor=1
            )
            page = context.new_page()
            page.add_init_script(PREFERENCES)
            page.add_init_script(path=ROOT / "browser.js")
            page.goto("http://127.0.0.1:4470/", wait_until="networkidle", timeout=90000)
            page.get_by_role("button", name="목표형으로 시작", exact=True).click()
            page.wait_for_timeout(2000)
            page.evaluate((ROOT / "adapter.js").read_text())
            page.keyboard.press("Backquote")
            page.clock.install()
            page.clock.pause_at(int(time.time() * 1000) + 100)
            dismiss(page)
            advance(page, 5010)
            camera(page, 1.0, (32, 32))
            cap = _frames(page, OUT, "holdout-river-s1-year1301", 1.0, seed=1, gap=600)
            cap = cap.model_copy(
                update={
                    "terrain": "river",
                    "season": "summer",
                    "cohort": "temporal-holdout",
                    "capture_notes": (
                        "normal native UI seed1; advanced to next year via native clock",
                        "same map as calibration; only temporal holdout",
                        "20 frames at 600ms",
                    ),
                }
            )
            (OUT / "raw" / cap.id / "capture.json").write_text(
                cap.model_dump_json(ensure_ascii=False)
            )
            print("COMPLETE " + cap.id, flush=True)  # noqa: T201 -- capture progress
        finally:
            browser.close()
    for name, save in (
        ("holdout-city-year1407", "docs/qa/round15/repro/saves/normal-ui-1407.json.gz"),
        (
            "holdout-city-year1362",
            "docs/qa/round03-14/repro/saves/natural1362-ch4-start.json.gz",
        ),
    ):
        replay(REPO, BASE / save, OUT, name, 1.3, (46, 37), confirm=True)
        print("COMPLETE " + name + "-confirm", flush=True)  # noqa: T201 -- capture progress


if __name__ == "__main__":
    main()
