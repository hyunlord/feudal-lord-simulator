// Real-browser check: with a saved city, 새 게임 asks first, archives the city in the 이전 도시 slot,
// and that slot survives a full autosave rotation and loads back byte-identical state.
// Usage: B8_URL=http://127.0.0.1:4183/ node scripts/verifyBrowserNewGameArchive.mjs [outputDirectory=docs/verification/b8-save]
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { byLabel, byText, CHROME, connect, openTab, readSlot, setOutputDirectory, sleep, URL_UNDER_TEST, waitForJson } from "./verifyBrowserContinue.mjs";

const OUT = resolve(process.argv[2] ?? "docs/verification/b8-save");
const PORT = 9338;
const PREFIX = "newgame";

async function pauseAutosave(page, seconds) {
  await page.click(byLabel("1배속"));
  await sleep(seconds * 1_000);
  await page.click(byLabel("일시 정지"));
  await sleep(1_500);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  setOutputDirectory(OUT);
  const profile = mkdtempSync(join(tmpdir(), "b8-chrome-newgame-"));
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    "--window-size=1600,1100", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  try {
    const version = await waitForJson(`http://127.0.0.1:${PORT}/json/version`);
    const browser = connect(version.webSocketDebuggerUrl);
    await browser.opened;
    const page = await openTab(browser);
    const report = { url: URL_UNDER_TEST, chrome: version.Browser, startedAt: new Date().toISOString() };

    // City A: play with 자동 발전, pause (autosave).
    await page.navigate(URL_UNDER_TEST);
    await page.click(`document.querySelector(".welcome-dismiss-layer")`);
    await page.click(byText("summary", "설정"));
    await page.click(`document.querySelector(".autoplay-toggle[aria-pressed]")`);
    await page.click(byText("summary", "설정"));
    await pauseAutosave(page, 40);
    const cityA = await page.evaluate(readSlot(null));

    // Reload: a stray click on the backdrop must not start over; 새 게임 asks first.
    await page.reload();
    await page.waitFor(`${byText("button", "이어하기")} !== undefined`);
    await page.click(`document.querySelector(".welcome-dismiss-layer")`);
    report.strayClickKeptWelcome = await page.evaluate(`document.querySelector(".welcome-parchment") !== null`);
    await page.click(byText("button", "새 게임"));
    await page.waitFor(`${byText(".welcome-save p[role=status]", "이전 도시")} !== undefined`);
    report.notice = await page.evaluate(`document.querySelector(".welcome-save p[role=status]").textContent`);
    report.noticeButtons = await page.evaluate(`[...document.querySelectorAll(".welcome-save button")].map(b => ({ text: b.textContent, height: b.getBoundingClientRect().height, width: b.getBoundingClientRect().width }))`);
    report.noticeShot = await page.screenshot(`${PREFIX}-1-confirm.jpg`);
    await page.click(byText("button", "시작"));
    await page.waitFor(`document.querySelector(".welcome-parchment") === null`);
    await sleep(1_000);
    report.previousAfterStart = await page.evaluate(readSlot("previous"));

    // New game B: four pause autosaves rotate all three autosave slots.
    for (let index = 0; index < 4; index += 1) await pauseAutosave(page, 3);
    report.slotsAfterRotation = (await page.evaluate(readSlot(null))).slots;
    report.previousAfterRotation = await page.evaluate(readSlot("previous"));

    // Load 이전 도시 from the settings list and persist the loaded state through 지금 저장.
    await page.click(byText("summary", "설정"));
    report.loadListLabels = await page.evaluate(`[...document.querySelectorAll(".save-slot-button strong")].map(el => el.textContent)`);
    report.listShot = await page.screenshot(`${PREFIX}-2-load-list.jpg`);
    await page.click(byText(".save-slot-button", "이전 도시"));
    await sleep(1_500);
    await page.click(byText("summary", "설정"));
    await page.click(byText("button", "지금 저장"));
    await page.waitFor(`${byText(".save-controls span", "저장했습니다")} !== undefined`);
    report.loadedPrevious = await page.evaluate(readSlot("manual"));
    report.afterLoadShot = await page.screenshot(`${PREFIX}-3-previous-loaded.jpg`);

    report.cityA = cityA;
    report.checks = {
      strayClickKeptWelcome: report.strayClickKeptWelcome,
      noticeMentionsCity: report.notice.includes(`인구 ${cityA.population}`),
      buttons44px: report.noticeButtons.every(b => b.height >= 44 && b.width >= 44),
      archivedIsCityA: report.previousAfterStart?.stateSha256 === cityA.stateSha256,
      rotationReplacedAllAutos: report.slotsAfterRotation.filter(s => s.startsWith("auto-")).length === 3
        && report.slotsAfterRotation.filter(s => s.startsWith("auto-")).every(s => Number(s.split("@")[1]) < cityA.tick),
      previousSurvivedRotation: report.previousAfterRotation?.stateSha256 === cityA.stateSha256,
      listShowsPrevious: report.loadListLabels.includes("이전 도시"),
      loadedPreviousIsCityA: report.loadedPrevious?.stateSha256 === cityA.stateSha256,
    };
    report.passed = Object.values(report.checks).every(Boolean);
    writeFileSync(join(OUT, "browser-new-game-archive.json"), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report.checks)}\nnotice: ${report.notice}\npassed=${report.passed}\n`);
    browser.close();
    if (!report.passed) process.exitCode = 1;
  } finally {
    chrome.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true });
  }
}

await main();
