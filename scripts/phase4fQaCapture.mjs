import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const playwrightCorePath = process.env.PLAYWRIGHT_CORE_PATH;
const chromePath = process.env.CHROME_PATH;
const baseUrl = process.env.QA_URL ?? "http://127.0.0.1:3201";
const outputDirectory = process.env.QA_OUTPUT ?? "/tmp/phase4f-qa";

if (playwrightCorePath === undefined || chromePath === undefined) {
  throw new Error("PLAYWRIGHT_CORE_PATH and CHROME_PATH are required");
}

const importedPlaywright = await import(pathToFileURL(playwrightCorePath).href);
const playwright = importedPlaywright.default ?? importedPlaywright;
const browser = await playwright.chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--disable-dev-shm-usage", "--no-sandbox"],
});

await mkdir(outputDirectory, { recursive: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 768 } });
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const errorResponses = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push({ text: message.text(), location: message.location() });
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => requestFailures.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on("response", (response) => {
    if (response.status() >= 400) errorResponses.push({ url: response.url(), status: response.status() });
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${outputDirectory}/full-guidance.png` });

  const comparisonPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await comparisonPage.goto(baseUrl, { waitUntil: "networkidle" });
  await comparisonPage.screenshot({ path: `${outputDirectory}/visual-diff-1280x720.png` });

  const affordableSeal = page.locator('.build-seal[data-affordable="true"]').first();
  await affordableSeal.hover();
  await page.screenshot({ path: `${outputDirectory}/build-tooltip.png` });
  const tooltipText = await affordableSeal.locator(".seal-tooltip").textContent();
  await affordableSeal.click();
  const selectedBeforeEscape = await affordableSeal.getAttribute("aria-pressed");
  await page.keyboard.press("Escape");
  const selectedAfterEscape = await affordableSeal.getAttribute("aria-pressed");

  const sealHitTests = await page.locator(".build-seal").evaluateAll((buttons) =>
    buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        label: button.getAttribute("aria-label"),
        hitLabel: hit?.closest("button")?.getAttribute("aria-label") ?? null,
        selfHit: hit === button || button.contains(hit),
      };
    }),
  );

  await page.getByRole("button", { name: /Water overlay/ }).click();
  await page.screenshot({ path: `${outputDirectory}/console-overlay.png` });

  const canvas = page.locator("canvas.game-canvas");
  const canvasBox = await canvas.boundingBox();
  if (canvasBox === null) throw new Error("game canvas has no bounding box");
  await page.keyboard.press("Escape");
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.38);
  for (let index = 0; index < 5; index += 1) await page.mouse.wheel(0, -500);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outputDirectory}/world-zoom.png` });

  const buildingPage = await browser.newPage({ viewport: { width: 1280, height: 768 } });
  await buildingPage.goto(baseUrl, { waitUntil: "networkidle" });
  await buildingPage.keyboard.press("Escape");
  await buildingPage.mouse.move(640, 45);
  for (let index = 0; index < 4; index += 1) await buildingPage.mouse.wheel(0, -500);
  await buildingPage.keyboard.down("Space");
  await buildingPage.mouse.move(640, 45);
  await buildingPage.mouse.down();
  await buildingPage.mouse.move(640, 320, { steps: 12 });
  await buildingPage.mouse.up();
  await buildingPage.keyboard.up("Space");
  await buildingPage.waitForTimeout(250);
  await buildingPage.screenshot({
    path: `${outputDirectory}/building-shadow-closeup.png`,
    clip: { x: 430, y: 50, width: 420, height: 500 },
  });

  const treePage = await browser.newPage({ viewport: { width: 1280, height: 768 } });
  await treePage.goto(baseUrl, { waitUntil: "networkidle" });
  await treePage.keyboard.press("Escape");
  await treePage.mouse.move(770, 215);
  for (let index = 0; index < 4; index += 1) await treePage.mouse.wheel(0, -500);
  await treePage.waitForTimeout(250);
  await treePage.screenshot({
    path: `${outputDirectory}/tree-shadow-closeup.png`,
    clip: { x: 480, y: 0, width: 580, height: 560 },
  });

  const mobile = await browser.newPage({ viewport: { width: 375, height: 768 } });
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  await mobile.screenshot({ path: `${outputDirectory}/mobile-375.png` });
  const mobileOverflow = await mobile.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  const evidence = await page.evaluate(() => ({
    objective: document.querySelector('[aria-label="Population objective"]')?.textContent,
    status: document.querySelector('[aria-label="정착지 상태"]')?.textContent,
    consoleText: document.querySelector('[aria-label="영주 명령대"]')?.textContent,
    floatingElements: [...document.querySelectorAll("body *")]
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.position === "fixed" || style.position === "absolute";
      })
      .map((element) => ({ className: element.className, ariaLabel: element.getAttribute("aria-label") })),
  }));
  await writeFile(`${outputDirectory}/dom-evidence.json`, `${JSON.stringify({
    ...evidence,
    tooltipText,
    selectedBeforeEscape,
    selectedAfterEscape,
    sealHitTests,
    desktopOverflow: await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    })),
    mobileOverflow,
    consoleErrors,
    pageErrors,
    requestFailures,
    errorResponses,
  }, null, 2)}\n`, "utf8");
} finally {
  await browser.close();
}
