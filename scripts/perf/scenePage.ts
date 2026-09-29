// Opening a perf scene the way a player opens it (SMOOTH-1, shared by hitchAudit, perfGate and memoryHolders): a save
// file written into the game's IndexedDB slot `auto-1`, then 이어하기 on the title screen; without a save, a new game.
// The tutorial is off. The proof port (?phase10-proof=1) gives the tick, but it also installs recorders on the render
// path (render-stage timing, sprite-draw log); `proof: false` opens the page as a player gets it. No game code is changed.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { saveMetaFor } from "../../src/save/saveCodec";

// The page globals the perf scripts read (the proof port and their own recorders).
export type PageWindow = Record<string, any>;

export const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
// A modal open over the town (a story card saved open, the season ledger) blocks the speed buttons.
export const MODAL = '[role="dialog"], .story-modal-backdrop, .season-ledger-backdrop';
// The HUD's date pill ("1380년 봄 …"): without the proof port, its season word marks a season change.
export const SEASON_TEXT = '.status-pill-date-text';

// Playwright is not a dependency of the repository: PLAYWRIGHT_MODULE names a playwright-core index.mjs (as for the
// other browser scripts, docs/REMOTE_RUNS.md).
export async function loadChromium() {
  const module = process.env.PLAYWRIGHT_MODULE;
  if (module === undefined || module === "") throw new Error("PLAYWRIGHT_MODULE=/abs/path/playwright-core/index.mjs is required");
  return (await import(pathToFileURL(module).href)).chromium;
}

/** A save file's bytes: `.save.json` as is, `.save.json.gz` unzipped. */
export function readSave(path: string): Uint8Array {
  const bytes = readFileSync(path);
  return new Uint8Array(path.endsWith(".gz") ? gunzipSync(bytes) : bytes);
}

// Esc, and when the modal stays, its first button — what a player does to get on with the game.
export async function closeModals(page: any) {
  for (let attempt = 0; attempt < 4 && await page.locator(MODAL).count() > 0; attempt++) {
    await page.keyboard.press("Escape").catch(() => {}); await page.waitForTimeout(400);
    if (await page.locator(MODAL).count() > 0) await page.locator('[role="dialog"] button').first().click({ timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

/**
 * A headed run needs the window in front and focused: Chrome stops drawing a covered window (visibilityState "hidden"),
 * so a run behind another window records a paused game. Brings the page to front (and, best effort, Chrome's process
 * to the front of macOS), then waits up to `seconds` for a visible, focused page. Null when ready, else the reason.
 */
export async function windowReady(browser: any, page: any, seconds: number): Promise<string | null> {
  await page.bringToFront().catch(() => {});
  try {
    const session = await browser.newBrowserCDPSession();
    const processes = ((await session.send("SystemInfo.getProcessInfo")).processInfo ?? []) as { type: string; id: number }[];
    const pid = processes.find(process => process.type === "browser")?.id;
    if (pid !== undefined) spawnSync("osascript", ["-e", `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`], { timeout: 5_000 });
  } catch { /* the window may still come to front by itself */ }
  const deadline = Date.now() + seconds * 1000; let told = false; let state = { visible: false, focus: false };
  while (Date.now() < deadline) {
    state = await page.evaluate(() => new Promise<{ visible: boolean; focus: boolean }>(resolve => {
      // Drawing too: at least 20 frames in half a second (a sleeping display or another Space draws none).
      let frames = 0; const count = () => { frames += 1; requestAnimationFrame(count); }; requestAnimationFrame(count);
      setTimeout(() => resolve({ visible: document.visibilityState === "visible" && frames >= 20, focus: document.hasFocus() }), 500); }));
    if (state.visible && state.focus) return null;
    if (!told) { console.error(`창을 기다린다: ${state.visible ? "보이지만 초점이 없다" : "가려져 있다"} — 측정용 Chrome 창을 앞으로 가져와 클릭해 주세요(${seconds}초).`); told = true; }
    await page.waitForTimeout(1_000);
  }
  return state.visible ? `창에 초점이 없다(${seconds}초 기다림)` : `창이 가려졌거나 그려지지 않는다(${seconds}초 기다림)`;
}

/** Goes to the build, loads the scene (a save, or a new game), closes what covers the town and sets the speed. */
export async function openScene(page: any, input: { readonly url: string; readonly save?: string; readonly speed: number; readonly proof?: boolean }) {
  const proof = input.proof ?? true;
  await page.goto(proof ? `${input.url}?phase10-proof=1` : input.url, { waitUntil: "load" });
  if (input.save !== undefined) {
    const bytes = readSave(input.save); const meta = saveMetaFor("auto-1", bytes);
    if (meta === null) throw new Error(`${input.save}: not a save file`);
    await page.evaluate(async ({ base64, meta }: { base64: string; meta: unknown }) => {
      const data = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
      const db: IDBDatabase = await new Promise((resolve, reject) => { const request = indexedDB.open("feudal-lord-simulator-saves", 1);
        request.onupgradeneeded = () => { for (const store of ["slots", "meta"]) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store); };
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      await new Promise<void>((resolve, reject) => { const tx = db.transaction(["slots", "meta"], "readwrite");
        tx.objectStore("slots").put(data.buffer, "auto-1"); tx.objectStore("meta").put(meta, "auto-1");
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
      db.close();
    }, { base64: Buffer.from(bytes).toString("base64"), meta });
    await page.reload({ waitUntil: "load" });
    await page.getByRole("button", { name: "이어하기" }).first().click({ timeout: 60_000 });
  } else {
    for (const name of ["목표형으로 시작", "새 게임", "새 게임 시작"]) {
      const button = page.getByRole("button", { name, exact: true });
      if (await button.count() > 0 && await button.first().isVisible()) { await button.first().click(); break; }
    }
  }
  if (proof) await page.waitForFunction(() => (window as unknown as PageWindow).__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 90_000 });
  else await page.locator(SEASON_TEXT).first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(2_000);
  if (await page.locator(".welcome-dismiss-layer").count()) await page.locator(".welcome-dismiss-layer").click();
  if (await page.locator(".pause-menu").count()) await page.keyboard.press("Escape");
  await closeModals(page);
  await page.getByRole("button", { name: `${input.speed}배속`, exact: true }).click();
}
