// Real-browser check after the trunk merge: the 목책 긋기 seal is present on the first screen and after 이어하기.
// Usage: B8_URL=http://127.0.0.1:4183/ node scripts/verifyBrowserDrawToolAfterContinue.mjs [outputDirectory]
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { byLabel, byText, CHROME, connect, openTab, readSlot, setOutputDirectory, sleep, URL_UNDER_TEST, waitForJson } from "./verifyBrowserContinue.mjs";

const OUT = resolve(process.argv[2] ?? "docs/verification/b8-save");
const drawSeal = `document.querySelector('[aria-label="목책 긋기"]')`;
const sealState = `(() => { const el = ${drawSeal}; if (!el) return null; const r = el.getBoundingClientRect();
  return { visible: r.width > 0 && r.height > 0, width: r.width, height: r.height, pressed: el.getAttribute("aria-pressed"), disabled: el.getAttribute("aria-disabled") }; })()`;

async function openDefence(page) {
  const tab = await page.evaluate(`${byText("button", "방어")} !== undefined`);
  if (tab) await page.click(byText("button", "방어"));
  await sleep(300);
}

mkdirSync(OUT, { recursive: true });
setOutputDirectory(OUT);
const profile = mkdtempSync(join(tmpdir(), "b8-chrome-draw-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9339", `--user-data-dir=${profile}`, "--window-size=1600,1100", "--no-first-run", "about:blank"], { stdio: "ignore" });
try {
  const version = await waitForJson("http://127.0.0.1:9339/json/version");
  const browser = connect(version.webSocketDebuggerUrl);
  await browser.opened;
  const page = await openTab(browser);
  await page.navigate(URL_UNDER_TEST);
  await page.click(`document.querySelector(".welcome-dismiss-layer")`);
  await openDefence(page);
  const firstScreen = await page.evaluate(sealState);
  await page.screenshot("sync-1-draw-tool-first-screen.jpg");
  await page.click(byLabel("1배속"));
  await sleep(20_000);
  await page.click(byLabel("일시 정지"));
  await sleep(1_500);
  const saved = await page.evaluate(readSlot(null));
  await page.reload();
  await page.waitFor(`${byText("button", "이어하기")} !== undefined`);
  await page.click(byText("button", "이어하기"));
  await page.waitFor(`document.querySelector(".welcome-parchment") === null`);
  await sleep(1_000);
  await openDefence(page);
  const afterContinue = await page.evaluate(sealState);
  await page.screenshot("sync-2-draw-tool-after-continue.jpg");
  const report = { url: URL_UNDER_TEST, savedTick: saved?.tick, firstScreen, afterContinue,
    passed: Boolean(firstScreen?.visible && afterContinue?.visible) };
  writeFileSync(join(OUT, "browser-draw-tool-after-continue.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report)}\n`);
  browser.close();
  if (!report.passed) process.exitCode = 1;
} finally {
  chrome.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}
