// LM-R3 (lmr3-brand) evidence at 1280×800: the new game's loading screen with the logo, the pause menu's heading with the
// small seal, and the favicon (index.html's data URI) at 16/32/64 px on light and dark grounds. Writes JPEGs and
// brand.json (the window title, the logo's and seal's boxes, ids on the page and whether any repeats).
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/lmr3BrandCapture.mjs <outDir> --url <dev server>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/lmr3BrandCapture.mjs)", { remote: "scripts/remote/run.sh render-LMR3-brand-capture-<sha7> --light -- bash scripts/lmr3BrandCapture.sh", entry: import.meta.url });
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
const CAMPAIGN = ".welcome-parchment [data-scenario='core:campaign_market_town']";
const facts = page => page.evaluate(() => {
  const box = element => { if (element === null) return null; const rect = element.getBoundingClientRect(); return [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)]; };
  const ids = [...document.querySelectorAll("svg [id]")].map(element => element.id);
  return { title: document.title, logo: box(document.querySelector(".game-logo")), logoLabel: document.querySelector(".game-logo")?.getAttribute("aria-label") ?? null,
    seal: box(document.querySelector(".pause-menu h2 .seal-mark")), heading: box(document.querySelector(".pause-menu h2")),
    svgIds: ids.length, repeatedIds: ids.length - new Set(ids).size };
});
const shot = async (page, name) => { await page.screenshot({ path: join(outDir, name), type: "jpeg", quality: 72 }); return name; };
const rows = {};
const viewport = { width: 1280, height: 800 };

// 1. The loading screen: timers held and its fade stopped, so the 900 ms screen stays for the capture.
{
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.routeWebSocket("**", socket => socket.close());
  await page.goto(url);
  await page.locator(CAMPAIGN).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1_000);
  await page.clock.install(); await page.clock.pauseAt(Date.now() + 1_000);
  await page.addStyleTag({ content: ".chapter-loading { animation: none !important; }" });
  await page.locator(CAMPAIGN).click();
  await page.locator(".chapter-loading .game-logo").waitFor({ timeout: 10_000 });
  await page.waitForTimeout(400);
  rows.loading = { shot: await shot(page, "loading-1280x800.jpg"), ...(await facts(page)) };
  await context.close();
}

// 2. The pause menu in a started game (Escape).
{
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.routeWebSocket("**", socket => socket.close());
  await page.goto(url);
  await page.locator(CAMPAIGN).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1_000);
  await page.locator(CAMPAIGN).click();
  await page.locator(".welcome-parchment").waitFor({ state: "detached", timeout: 10_000 });
  await page.locator(".chapter-loading").waitFor({ state: "detached", timeout: 10_000 });
  await page.waitForTimeout(1_500);
  await page.keyboard.press("Escape");
  await page.locator(".pause-menu h2 .seal-mark").waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  rows.pause = { shot: await shot(page, "pause-1280x800.jpg"), ...(await facts(page)) };
  await context.close();
}

// 3. The favicon as the page ships it, drawn at tab sizes on a light and a dark ground.
{
  const context = await browser.newContext({ viewport: { width: 480, height: 240 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(url);
  const href = await page.evaluate(() => document.querySelector("link[rel='icon']")?.getAttribute("href") ?? null);
  if (href === null) throw new Error("no favicon link");
  const row = ground => `<div style="display:flex;gap:24px;align-items:center;padding:20px;background:${ground}">${[16, 32, 64].map(size => `<img src="${href.replace(/"/g, "%22")}" width="${size}" height="${size}">`).join("")}</div>`;
  await page.setContent(`<body style="margin:0">${row("#f3ebdd")}${row("#242a26")}</body>`);
  await page.waitForTimeout(300);
  rows.favicon = { shot: await shot(page, "favicon-16-32-64.jpg"), bytes: href.length, svgDataUri: href.startsWith("data:image/svg+xml,") };
  await context.close();
}

await browser.close();
await writeFile(join(outDir, "brand.json"), `${JSON.stringify(rows, null, 1)}\n`);
for (const [name, row] of Object.entries(rows)) console.log(name, JSON.stringify(row));
