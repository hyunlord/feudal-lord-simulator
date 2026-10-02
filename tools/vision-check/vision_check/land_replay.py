"""Recreate QA039/040 ordinary new-land scenes from archived camera records."""

import time
from pathlib import Path

from playwright.sync_api import sync_playwright

from .capture import LANDS, PREFERENCES, ROOT, advance, camera, capture_scene

CASES = (
    ("chalk", (51, 30), 1.332, 1004),
    ("forest", (44, 38), 1.001, 1006),
    ("river", (32, 32), 1.0, 1006),
)


def land_replay(output: Path) -> None:
    """Run actual ticks, preserving the native summer state and QA overlay."""
    with sync_playwright() as runtime, runtime.chromium.launch(headless=True) as browser:
        for terrain, center, zoom, tick in CASES:
            with browser.new_context(
                viewport={"width": 1600, "height": 1100}, device_scale_factor=1
            ) as context:
                page = context.new_page()
                page.add_init_script(PREFERENCES)
                page.add_init_script(path=ROOT / "browser.js")
                page.goto("http://127.0.0.1:4470/", wait_until="networkidle", timeout=90000)
                page.get_by_role("button", name=LANDS[terrain], exact=False).click()
                page.get_by_role("button", name="목표형으로 시작", exact=True).click()
                page.wait_for_timeout(1800)
                page.evaluate((ROOT / "adapter.js").read_text())
                page.keyboard.press("Backquote")
                page.clock.install()
                page.clock.pause_at(int(time.time() * 1000) + 100)
                advance(page, tick)
                camera(page, zoom, center)
                capture_scene(page, output, "current-" + terrain, terrain, "summer", zoom)
