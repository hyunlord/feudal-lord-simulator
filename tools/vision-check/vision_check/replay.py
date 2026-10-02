"""Replay an archived ordinary save against the caller's running historical server."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import subprocess
import time
from pathlib import Path
from typing import TYPE_CHECKING

from playwright.sync_api import sync_playwright

from .capture import PREFERENCES, ROOT, STATE, STRING, dismiss
from .contracts import Capture, Reading

if TYPE_CHECKING:
    from playwright.sync_api import Page


def _frames(page: Page, output: Path, name: str, zoom: float, gap: int = 100) -> Capture:
    folder = output / "raw" / name
    folder.mkdir(parents=True, exist_ok=True)
    frames: list[Reading] = []
    page.evaluate("window.__vision.input.emit({kind:'speed',value:1})")
    page.clock.run_for(200)
    start = time.perf_counter()
    for index in range(20):
        if index:
            page.clock.run_for(gap)
        reading = Reading.model_validate(page.evaluate(STATE))
        if reading.proof or "phase10-proof" in reading.url:
            message = "Proof mode forbidden"
            raise RuntimeError(message)
        data = STRING.validate_python(
            page.locator("canvas").first.evaluate("c=>c.toDataURL('image/png')")
        )
        image = folder / f"{index:02d}.png"
        image.write_bytes(base64.b64decode(data.split(",", 1)[1], validate=True))
        frames.append(
            reading.model_copy(
                update={
                    "index": index,
                    "elapsed_ms": index * gap,
                    "wall_elapsed_ms": (time.perf_counter() - start) * 1000,
                    "image": str(image.relative_to(output)),
                }
            )
        )
    page.evaluate("window.__vision.input.emit({kind:'speed',value:0})")
    overlay = page.locator(".qa-overlay")
    qa = (
        overlay.inner_text()
        if overlay.count()
        else "QA overlay absent; native camera transform recorded"
    )
    page.screenshot(path=str(folder / "qa.jpg"), type="jpeg", quality=80)
    capture = Capture(
        id=name,
        terrain="historical",
        season="saved",
        seed=1,
        zoom=zoom,
        cohort="benchmark",
        qa_text=qa,
        frames=tuple(frames),
        capture_notes=(
            "ordinary IndexedDB save load; no proof; native input only",
            f"20 frames; browser clock interval {gap} ms; wall time recorded separately",
            "camera observed from native world canvas transform",
        ),
    )
    (folder / "capture.json").write_text(capture.model_dump_json(ensure_ascii=False))
    return capture


def replay(  # noqa: PLR0913, PLR0917 -- explicit archived scene coordinates.
    repo: Path,
    save: Path,
    output: Path,
    name: str,
    zoom: float,
    center: tuple[int, int] | None = None,
    width: int = 1600,
    height: int = 1100,
    *,
    confirm: bool = False,
    interval_ms: int = 100,
    pan: tuple[float, float] | None = None,
) -> None:
    """Capture the save at 4470; optional second 20-frame sequence spans 11.4 seconds."""
    if name != Path(name).name or name in {".", ".."}:
        message = "Scene name must be a single path component"
        raise ValueError(message)
    if interval_ms <= 0:
        message = "Frame interval must be positive"
        raise ValueError(message)
    payload = save.read_bytes()
    if payload.startswith(b"\x1f\x8b"):
        payload = gzip.decompress(payload)
    commit = subprocess.run(
        ["git", "rev-parse", "HEAD"],  # noqa: S607 -- git resolved by the caller environment.
        cwd=repo,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    output.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(headless=True)
        try:
            context = browser.new_context(
                viewport={"width": width, "height": height}, device_scale_factor=1
            )
            page = context.new_page()
            page.add_init_script(PREFERENCES)
            page.add_init_script(path=ROOT / "browser.js")
            page.add_init_script(path=ROOT / "legacy_adapter.js")
            page.goto("http://127.0.0.1:4470/", wait_until="networkidle", timeout=90000)
            page.evaluate(
                """async encoded=>{
                const m=await import('/src/platform/indexedDbSaveStorage.ts');
                const db=await m.openSaveDatabase(indexedDB,5000);
                await new m.IndexedDbSaveStorage(db).write('manual',
                    Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)));db.close();
            }""",
                base64.b64encode(payload).decode(),
            )
            page.reload(wait_until="networkidle")
            page.get_by_role("button", name="이어하기", exact=True).click()
            page.wait_for_timeout(3000)
            page.evaluate("window.__visionLegacyAttach()")
            page.keyboard.press("Backquote")
            page.clock.install()
            page.clock.pause_at(int(time.time() * 1000) + 100)
            dismiss(page)
            page.evaluate(
                """({zoom,center})=>{
                const v=window.__vision,p=v.probe();
                v.input.emit({kind:'speed',value:0});
                v.input.emit({kind:'zoom',factor:zoom/p.camera().zoom,
                    anchor:{x:p.viewport().width/2,y:p.viewport().height/2}});
                if(center) v.input.emit({kind:'lookAt',tile:{tx:center[0],ty:center[1]}});
            }""",
                {"zoom": zoom, "center": center},
            )
            page.clock.run_for(500)
            if pan is not None:
                page.evaluate(
                    """pan=>{const v=window.__vision,c=v.probe().camera();
                    v.input.emit({kind:'pan',dx:pan[0]-c.panX,dy:pan[1]-c.panY});}""",
                    pan,
                )
                page.clock.run_for(100)
            capture = _frames(page, output, name, zoom, gap=interval_ms)
            provenance = {
                "repo": str(repo.resolve()),
                "commit": commit,
                "save": str(save.resolve()),
                "save_sha256": hashlib.sha256(payload).hexdigest(),
                "requested_camera": {"zoom": zoom, "center": center, "pan": pan},
                "observed_camera": capture.frames[0].camera.model_dump(),
                "observed_viewport": capture.frames[0].viewport.model_dump(),
                "wall_seconds": time.perf_counter() - started,
                "source_commit_verification": "caller must ensure port 4470 serves this repo",
            }
            (output / "raw" / name / "replay.json").write_text(json.dumps(provenance, indent=2))
            if confirm:
                _frames(page, output, name + "-confirm", zoom, gap=600)
        finally:
            browser.close()
