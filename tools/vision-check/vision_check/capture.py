"""Capture ordinary gameplay using native input and a controlled browser clock."""

from __future__ import annotations

import base64
import gzip
import time
from pathlib import Path
from typing import TYPE_CHECKING
from urllib.parse import unquote

from playwright.sync_api import sync_playwright
from pydantic import TypeAdapter, ValidationError

from .contracts import Capture, Reading

if TYPE_CHECKING:
    from playwright.sync_api import Browser, Page

ROOT = Path(__file__).parent
LANDS = {
    "river": "강가 시장도시",
    "coast": "해안 항구",
    "chalk": "백악 언덕 목양",
    "forest": "숲 가장자리 개척",
    "fen": "습지 간척",
}
PREFERENCES = """
localStorage.setItem('feudal-lord-simulator:tutorial:v1',
    JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));
localStorage.setItem('feudal.seasonLedgerAuto','0');
"""
STATE = (ROOT / "state.js").read_text()
INTEGER = TypeAdapter(int)
STRING = TypeAdapter(str)
MAX_STALE_READINGS = 8
MAX_LAND_SEED = 5
MAIN_CENTER = (32, 32)
CAMERA_TOLERANCE = 1.0
PROGRESS_TICKS = 500
SEASONS = (("summer", 1000), ("winter", 3000))
ZOOMS = (0.6, 1.0, 1.4)


def _progress(message: str) -> None:
    print(message, flush=True)  # noqa: T201 -- CLI collection progress, including long winter waits.


def _normal_url(url: str) -> None:
    if "phase10-proof" in unquote(url).casefold():
        message = "Proof mode is forbidden"
        raise ValueError(message)


def _tick(page: Page) -> int:
    return INTEGER.validate_python(page.evaluate("window.__vision.store.getState().tick"))


def dismiss(page: Page) -> None:
    """Dismiss narrative overlays through their normal controls."""
    for _ in range(5):
        dialogs = page.locator('[role="dialog"], .story-modal-backdrop, .season-ledger-backdrop')
        if not dialogs.count():
            return
        page.keyboard.press("Escape")
        page.clock.run_for(100)
        buttons = page.locator('[role="dialog"] button')
        if buttons.count():
            buttons.first.click(force=True)
            page.clock.run_for(100)


def advance(page: Page, target: int) -> None:
    """Run actual fixed-loop ticks; never rewrite the calendar or simulation state."""
    stale = 0
    previous = -1
    next_progress = (_tick(page) // PROGRESS_TICKS + 1) * PROGRESS_TICKS
    start = time.perf_counter()
    while True:
        tick = _tick(page)
        if tick >= next_progress:
            _progress(f"ADVANCE tick {tick}/{target} wall {time.perf_counter() - start:.1f}s")
            next_progress = (tick // PROGRESS_TICKS + 1) * PROGRESS_TICKS
        if tick >= target:
            break
        stale = stale + 1 if tick == previous else 0
        if stale > MAX_STALE_READINGS:
            message = f"Game stopped advancing at {tick}, target {target}"
            raise RuntimeError(message)
        previous = tick
        dismiss(page)
        page.evaluate("window.__vision.input.emit({kind:'speed',value:3})")
        page.clock.run_for(min(2000, max(100, (target - tick) * 20)))
    page.evaluate("window.__vision.input.emit({kind:'speed',value:0})")
    page.clock.run_for(100)


def camera(page: Page, zoom: float, center: tuple[int, int]) -> None:
    """Set exact zoom through the same intent bus used by mouse/touch input."""
    page.evaluate(
        """({zoom,center})=>{const v=window.__vision,p=v.probe();
          v.input.emit({kind:'zoom',factor:zoom/p.camera().zoom,
            anchor:{x:p.viewport().width/2,y:p.viewport().height/2}});
          v.input.emit({kind:'lookAt',tile:{tx:center[0],ty:center[1]}});}
        """,
        {"zoom": zoom, "center": center},
    )
    page.clock.run_for(400)
    reading = Reading.model_validate(page.evaluate(STATE))
    observed_x = (reading.viewport.width / 2 - reading.camera.panX) / reading.camera.zoom
    observed_y = (reading.viewport.height / 2 - reading.camera.panY) / reading.camera.zoom
    expected_x, expected_y = (center[0] - center[1]) * 32, (center[0] + center[1]) * 16
    if max(abs(observed_x - expected_x), abs(observed_y - expected_y)) > CAMERA_TOLERANCE:
        message = f"Camera clamped away from requested {center}: world ({observed_x},{observed_y})"
        raise RuntimeError(message)


def capture_scene(  # noqa: PLR0913, PLR0917 -- explicit scene coordinates remain API-compatible.
    page: Page, output: Path, name: str, terrain: str, season: str, zoom: float, *, seed: int = 1
) -> None:
    """Save lossless world pixels and metadata at exactly 100 ms browser intervals."""
    folder = output / "raw" / name
    folder.mkdir(parents=True, exist_ok=True)
    frames: list[Reading] = []
    page.evaluate("window.__vision.input.emit({kind:'speed',value:1})")
    page.clock.run_for(200)
    start = time.perf_counter()
    for index in range(20):
        if index:
            page.clock.run_for(100)
        reading = Reading.model_validate(page.evaluate(STATE))
        _normal_url(reading.url)
        if reading.proof:
            message = "Forbidden proof port detected"
            raise RuntimeError(message)
        data_url = STRING.validate_python(
            page.locator("canvas").first.evaluate("c=>c.toDataURL('image/png')")
        )
        image = folder / f"{index:02d}.png"
        image.write_bytes(base64.b64decode(data_url.split(",", 1)[1], validate=True))
        frames.append(
            reading.model_copy(
                update={
                    "index": index,
                    "elapsed_ms": index * 100,
                    "wall_elapsed_ms": (time.perf_counter() - start) * 1000,
                    "image": str(image.relative_to(output)),
                }
            )
        )
    page.evaluate("window.__vision.input.emit({kind:'speed',value:0})")
    qa = page.locator(".qa-overlay").inner_text()
    page.screenshot(path=str(folder / "qa.jpg"), type="jpeg", quality=78)
    meta = Capture(
        id=name,
        terrain=terrain,
        season=season,
        seed=seed,
        zoom=zoom,
        cohort="holdout" if seed > 1 else "calibration",
        qa_text=qa,
        frames=tuple(frames),
        capture_notes=(
            "normal URL; native clock/ticks; no proof",
            "world PNG excludes DOM HUD; qa.jpg preserves HUD",
            "canvas provenance instrumentation; not a performance benchmark",
        ),
    )
    (folder / "capture.json").write_text(meta.model_dump_json(ensure_ascii=False))
    elapsed = time.perf_counter() - start
    _progress(f"CAPTURE {name} ticks {frames[0].tick}..{frames[-1].tick} wall {elapsed:.1f}s")


def _complete_terrain(output: Path, terrain: str, seed: int) -> bool:
    for season, _offset in SEASONS:
        for zoom in ZOOMS:
            name = f"{terrain}-{season}-z{zoom:.1f}" + (f"-s{seed}" if seed > 1 else "")
            try:
                capture = Capture.model_validate_json(
                    (output / "raw" / name / "capture.json").read_text()
                )
                if capture.id != name or capture.terrain != terrain or capture.season != season:
                    return False
                if (
                    capture.zoom != zoom
                    or capture.seed != seed
                    or not (output / "raw" / name / "qa.jpg").stat().st_size
                ):
                    return False
                for index, reading in enumerate(capture.frames):
                    _normal_url(reading.url)
                    image = (output / reading.image).resolve()
                    if (
                        reading.proof
                        or reading.index != index
                        or not image.is_relative_to(output.resolve())
                        or not image.stat().st_size
                    ):
                        return False
            except (OSError, ValueError, ValidationError):
                return False
    return True


def _collect_terrain(  # noqa: PLR0913, PLR0917 -- collection context and chosen land.
    browser: Browser, repo: Path, output: Path, url: str, terrain: str, seed: int
) -> None:
    context = browser.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
    try:
        page = context.new_page()
        page.add_init_script(PREFERENCES)
        page.add_init_script(path=ROOT / "browser.js")
        page.goto(url, wait_until="networkidle", timeout=90000)
        _normal_url(page.url)
        if terrain == "city":
            source = repo / "fixtures/perf-gate/ch4-1380.save.json.gz"
            encoded = base64.b64encode(gzip.decompress(source.read_bytes())).decode()
            page.evaluate(
                """async encoded=>{
                const m=await import('/src/platform/indexedDbSaveStorage.ts');
                const db=await m.openSaveDatabase(indexedDB,5000);
                await new m.IndexedDbSaveStorage(db).write('manual',
                  Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)));db.close();}
                """,
                encoded,
            )
            page.reload(wait_until="networkidle")
            _normal_url(page.url)
            page.get_by_role("button", name="이어하기", exact=True).click()
        else:
            page.get_by_role("button", name=LANDS[terrain], exact=False).click()
            for _ in range(seed - 1):
                page.get_by_role("button", name="지도 번호 높이기", exact=True).click()
            observed_seed = INTEGER.validate_python(
                page.locator(".welcome-seed-value").inner_text()
            )
            if observed_seed != seed:
                message = f"Requested land seed {seed}, UI selected {observed_seed}"
                raise RuntimeError(message)
            page.get_by_role("button", name="목표형으로 시작", exact=True).click()
        page.wait_for_timeout(2000)
        page.evaluate((ROOT / "adapter.js").read_text())
        page.keyboard.press("Backquote")
        page.wait_for_timeout(350)
        page.clock.install()
        page.clock.pause_at(int(time.time() * 1000) + 100)
        dismiss(page)
        year = _tick(page) // 4000 * 4000
        for season, offset in SEASONS:
            advance(page, year + offset + 10)
            for zoom in ZOOMS:
                camera(page, zoom, MAIN_CENTER)
                name = f"{terrain}-{season}-z{zoom:.1f}" + (f"-s{seed}" if seed > 1 else "")
                capture_scene(page, output, name, terrain, season, zoom, seed=seed)

    finally:
        context.close()


def collect(  # noqa: PLR0913 -- backward-compatible optional resume and seed.
    repo: Path, output: Path, url: str, terrains: list[str], *, resume: bool = False, seed: int = 1
) -> None:
    """Run five new lands plus the unmodified large-city save; optionally skip complete lands."""
    _normal_url(url)
    if not 1 <= seed <= MAX_LAND_SEED or (
        seed > 1 and any(t in ("river", "city") for t in terrains)
    ):
        message = "Seeds must be 1-5; river and saved city accept only seed 1"
        raise ValueError(message)
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(headless=True)
        try:
            for terrain in terrains:
                if resume and _complete_terrain(output, terrain, seed):
                    _progress(f"RESUME skip complete terrain {terrain}")
                    continue
                _collect_terrain(browser, repo, output, url, terrain, seed)
        finally:
            browser.close()
