// LM-R1 (Astra B01) evidence: the three-mode welcome (campaign, sandbox, lord mode) at 1280×720 — a JPEG for the user,
// and where the parchment sits and what the viewport's centre point hits (LAND-UI's rule: the centre stays the keyart /
// dismiss layer, which the scene openers click; since 83d0fe28 they click the layer's corner). Normal and long copy.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/lmr1WelcomeCapture.mjs <outDir> --url <dev server>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/lmr1WelcomeCapture.mjs)", { remote: "scripts/remote/run.sh render-LMR1-welcome-<sha7> -- bash scripts/lmr1WelcomeCapture.sh", entry: import.meta.url });
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [outDir] = process.argv.slice(2);
const at = process.argv.indexOf("--url");
const url = at > 0 ? process.argv[at + 1] : "http://127.0.0.1:4213/";
for (let attempt = 0; ; attempt += 1) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  if (attempt > 120) throw new Error(`no server at ${url}`);
  await new Promise(resolve => setTimeout(resolve, 500));
}
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];
for (const [width, height, long] of [[1280, 720, false], [1280, 720, true], [1280, 800, false]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.routeWebSocket("**", socket => socket.close());
  await page.goto(long ? `${url}?pseudo-long=1` : url);
  await page.locator(".welcome-parchment").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1_500);
  const facts = await page.evaluate(() => {
    const box = element => { const rect = element.getBoundingClientRect(); return [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)]; };
    const parchment = document.querySelector(".welcome-parchment");
    const centre = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return { parchment: parchment === null ? null : box(parchment), scrolls: parchment === null ? null : parchment.scrollHeight > parchment.clientHeight + 1,
      modes: [...document.querySelectorAll(".welcome-modes [data-scenario]")].map(button => ({ id: button.getAttribute("data-scenario"), box: box(button), text: button.textContent })),
      centre: centre === null ? null : `${centre.tagName.toLowerCase()}.${[...centre.classList].join(".")}`, centreInParchment: parchment !== null && centre !== null && parchment.contains(centre) };
  });
  const name = `welcome-${width}x${height}${long ? "-long" : ""}.jpg`;
  if (!long && height === 720) await page.screenshot({ path: join(outDir, name), type: "jpeg", quality: 70 });
  rows.push({ viewport: `${width}x${height}`, copy: long ? "long" : "normal", shot: !long && height === 720 ? name : null, ...facts });
  await context.close();
}
await browser.close();
await writeFile(join(outDir, "welcome.json"), `${JSON.stringify(rows, null, 1)}\n`);
for (const row of rows) console.log(`${row.viewport} ${row.copy}: parchment ${row.parchment} scrolls=${row.scrolls} centre=${row.centre} inParchment=${row.centreInParchment}`);
