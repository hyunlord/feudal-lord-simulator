const fs = require("node:fs");
const path = require("node:path");
let chromium;
for (const candidate of [
  "playwright",
  "playwright-core",
  "/opt/homebrew/lib/python3.14/site-packages/playwright/driver/package/index.js",
  "/opt/homebrew/lib/node_modules/openclaw/node_modules/playwright-core/index.js",
  "/opt/homebrew/lib/node_modules/clawdbot/node_modules/playwright-core/index.js",
]) {
  try {
    ({ chromium } = require(candidate));
    break;
  } catch {
    // Try the next installed Playwright surface.
  }
}
if (!chromium) {
  console.error("Unable to load Playwright chromium from local, global, or Homebrew driver paths");
  process.exit(2);
}

const baseUrl = process.env.QA_BASE_URL;
const outDir = process.env.QA_OUT_DIR;

if (!baseUrl || !outDir) {
  console.error("QA_BASE_URL and QA_OUT_DIR are required");
  process.exit(2);
}

fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  { id: "desktop-1280", width: 1280, height: 720 },
  { id: "tablet-768", width: 768, height: 1024 },
  { id: "mobile-375", width: 375, height: 812 },
];

const tolerance = 1;

function intersects(a, b) {
  if (!a || !b) return false;
  return !(
    a.right <= b.left + tolerance ||
    a.left >= b.right - tolerance ||
    a.bottom <= b.top + tolerance ||
    a.top >= b.bottom - tolerance
  );
}

function contains(outer, inner) {
  if (!outer || !inner) return false;
  return (
    inner.left >= outer.left - tolerance &&
    inner.right <= outer.right + tolerance &&
    inner.top >= outer.top - tolerance &&
    inner.bottom <= outer.bottom + tolerance
  );
}

function isHorizontallyClippedWithin(outer, inner) {
  if (!outer || !inner) return false;
  const verticallyContained = inner.top >= outer.top - tolerance && inner.bottom <= outer.bottom + tolerance;
  const horizontallyClipped = inner.left < outer.left - tolerance || inner.right > outer.right + tolerance;
  return verticallyContained && horizontallyClipped;
}

function rectText(rect) {
  return rect
    ? `x=${rect.left.toFixed(1)} y=${rect.top.toFixed(1)} w=${rect.width.toFixed(1)} h=${rect.height.toFixed(1)}`
    : "missing";
}

function writeBuildMenuHarness() {
  const htmlPath = path.resolve(outDir, "build-menu-harness.html");
  fs.writeFileSync(
    htmlPath,
    `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Build Menu Harness</title>
  <style>
    :root {
      --palette-ink: #2c1b13;
      --palette-ink-light: #6f5642;
      --palette-parchment: #e4cfa3;
      --palette-vellum: #eadbb7;
      --palette-gold: #c69232;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Georgia, "Times New Roman", serif;
      background: var(--palette-vellum);
    }
    .build-seal {
      position: relative;
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      place-items: center;
      width: 48px;
      height: 48px;
      min-width: 48px;
      min-height: 48px;
      padding: 4px;
      color: var(--palette-ink-light);
      cursor: default;
      appearance: none;
      background: var(--palette-parchment);
      border: 1px solid var(--palette-ink);
      opacity: 0.58;
    }
    .build-seal-label {
      max-width: 100%;
      overflow: hidden;
      color: var(--palette-ink);
      font-size: 10px;
      line-height: 1;
      text-overflow: ellipsis;
      white-space: nowrap;
      pointer-events: none;
    }
    .seal-tooltip {
      display: block;
      width: min(220px, calc(100vw - 24px));
      padding: 5px 9px;
      color: var(--palette-ink);
      font-size: 11px;
      line-height: 1.2;
      background: var(--palette-vellum);
      border: 1px solid var(--palette-ink);
    }
    .seal-tooltip span {
      display: block;
    }
    #state {
      margin-top: 12px;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <main>
    <button
      class="build-seal"
      type="button"
      aria-label="예배당"
      aria-describedby="chapel-tip"
      aria-disabled="true"
      aria-pressed="false"
      data-affordable="false"
    >
      <span aria-hidden="true">⌂</span>
      <span class="build-seal-label" aria-hidden="true">예배당</span>
    </button>
    <span id="chapel-tip" class="seal-tooltip" role="tooltip">
      <span>예배당</span>
      <span>비용 목재 40</span>
      <span>건설 불가 · 부족 40</span>
    </span>
    <p id="state" data-selected="none">selected:none</p>
  </main>
  <script>
    const seal = document.querySelector(".build-seal");
    const state = document.querySelector("#state");
    seal.addEventListener("click", () => {
      if (seal.dataset.affordable === "true") {
        seal.setAttribute("aria-pressed", "true");
        state.dataset.selected = seal.getAttribute("aria-label");
        state.textContent = "selected:" + state.dataset.selected;
      }
    });
  </script>
</body>
</html>
`,
  );
  return htmlPath;
}

async function collectViewport(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(baseUrl, { waitUntil: "load" });
  await page.evaluate(() =>
    localStorage.setItem("feudal-lord-simulator:welcome-dismissed:v1", "1"),
  );
  await page.reload({ waitUntil: "load" });
  await page.locator('[aria-label="Court console"]').waitFor({ state: "visible", timeout: 10_000 });
  await page.screenshot({
    path: path.join(outDir, `${viewport.id}.png`),
    fullPage: true,
  });

  const data = await page.evaluate(async () => {
    const rectOf = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };
    const allRects = (selector) =>
      Array.from(document.querySelectorAll(selector)).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: el.textContent?.replace(/\s+/g, " ").trim() ?? "",
          ariaLabel: el.getAttribute("aria-label"),
          ariaDisabled: el.getAttribute("aria-disabled"),
          ariaPressed: el.getAttribute("aria-pressed"),
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      });
    const styles = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        overflowX: s.overflowX,
        overflowY: s.overflowY,
        display: s.display,
        pointerEvents: s.pointerEvents,
      };
    };

    const buildSeals = document.querySelector(".build-seals");
    const snapshot = {
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      welcomeCount: document.querySelectorAll(".welcome-parchment").length,
      rects: {
        app: rectOf(".app-shell"),
        rail: rectOf(".right-info-rail"),
        console: rectOf(".court-console"),
        sealRecess: rectOf(".seal-recess"),
        buildSeals: rectOf(".build-seals"),
        ledgerRecess: rectOf(".ledger-recess"),
        ledger: rectOf(".court-ledger"),
        ledgerDrawer: rectOf("#population-ledger-drawer"),
        status: rectOf(".settlement-status"),
      },
      buildButtons: allRects(".build-seal"),
      speedButtons: allRects(".speed-seal"),
      tooltips: allRects(".seal-tooltip"),
      ledgerToggle: allRects(".ledger-population-toggle"),
      styles: {
        buildSeals: styles(".build-seals"),
        tooltip: styles(".seal-tooltip"),
      },
      bodyScrollWidth: document.documentElement.scrollWidth,
    };
    let beforeScroll = null;
    let afterScroll = null;
    if (buildSeals) {
      beforeScroll = buildSeals.scrollLeft;
      buildSeals.scrollLeft = 64;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      afterScroll = buildSeals.scrollLeft;
    }

    return {
      ...snapshot,
      buildSealsMetrics: buildSeals
        ? {
            clientWidth: buildSeals.clientWidth,
            scrollWidth: buildSeals.scrollWidth,
            beforeScroll,
            afterScroll,
            overflowX: getComputedStyle(buildSeals).overflowX,
          }
        : null,
    };
  });

  const tooltipProofs = [];
  async function recordTooltipProof(label, screenshotName) {
    const button = page.locator(`.build-seal[aria-label="${label}"]`).first();
    await button.scrollIntoViewIfNeeded();
    await button.hover({ force: true });
    await page.screenshot({
      path: path.join(outDir, screenshotName),
      fullPage: true,
    });
    const proof = await page.evaluate((buttonLabel) => {
      const button = Array.from(document.querySelectorAll(".build-seal")).find(
        (candidate) => candidate.getAttribute("aria-label") === buttonLabel,
      );
      const tooltipId = button?.getAttribute("aria-describedby");
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      const buttonRect = button?.getBoundingClientRect();
      const tooltipRect = tooltip?.getBoundingClientRect();
      const rect = (r) =>
        r
          ? {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
            }
          : null;
      return {
        label: buttonLabel,
        button: rect(buttonRect),
        tooltip: rect(tooltipRect),
        tooltipDisplay: tooltip ? getComputedStyle(tooltip).display : null,
        tooltipText: tooltip?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      };
    }, label);
    tooltipProofs.push(proof);
  }

  await recordTooltipProof("오두막", `${viewport.id}-first-hover.png`);
  await recordTooltipProof("길", `${viewport.id}-road-hover.png`);

  const failures = [];
  const warnings = [];
  const { rects } = data;
  const viewportRect = {
    left: 0,
    top: 0,
    right: viewport.width,
    bottom: viewport.height,
    width: viewport.width,
    height: viewport.height,
  };

  if (data.welcomeCount !== 0) {
    failures.push(`welcome still present after localStorage dismissal count=${data.welcomeCount}`);
  }
  for (const [name, rect] of Object.entries(rects)) {
    if (name === "ledgerDrawer" && !rect) continue;
    if (!rect) {
      failures.push(`${name} missing`);
      continue;
    }
    if (!contains(viewportRect, rect)) {
      failures.push(`${name} outside viewport: ${rectText(rect)}`);
    }
  }

  if (intersects(rects.rail, rects.console)) {
    failures.push(`right rail intersects court console: rail ${rectText(rects.rail)} console ${rectText(rects.console)}`);
  }
  if (intersects(rects.status, rects.console)) {
    failures.push(`status line intersects court console: status ${rectText(rects.status)} console ${rectText(rects.console)}`);
  }
  if (rects.ledger && rects.ledgerRecess && !contains(rects.ledgerRecess, rects.ledger)) {
    failures.push(`ledger not contained by ledger recess: ledger ${rectText(rects.ledger)} recess ${rectText(rects.ledgerRecess)}`);
  }
  if (rects.buildSeals && rects.sealRecess && !contains(rects.sealRecess, rects.buildSeals)) {
    failures.push(`build tray not contained by seal recess: tray ${rectText(rects.buildSeals)} recess ${rectText(rects.sealRecess)}`);
  }
  const mobileScrollable =
    viewport.width === 375 &&
    data.buildSealsMetrics &&
    data.buildSealsMetrics.scrollWidth > data.buildSealsMetrics.clientWidth;
  for (const button of data.buildButtons) {
    if (button.width < 48 - tolerance || button.height < 48 - tolerance) {
      failures.push(`button below 48px: ${button.ariaLabel || button.text} ${rectText(button)}`);
    }
    const scrollableClipped =
      mobileScrollable && rects.sealRecess && isHorizontallyClippedWithin(rects.sealRecess, button);
    if (rects.sealRecess && !scrollableClipped && !contains(rects.sealRecess, button)) {
      failures.push(`build button not contained by seal recess: ${button.ariaLabel || button.text} ${rectText(button)} recess ${rectText(rects.sealRecess)}`);
    }
  }
  for (const proof of tooltipProofs) {
    if (!proof.tooltip || proof.tooltip.width <= 0 || proof.tooltip.height <= 0 || proof.tooltipDisplay !== "block") {
      failures.push(`tooltip not visible for ${proof.label}: display=${proof.tooltipDisplay} rect=${rectText(proof.tooltip)}`);
      continue;
    }
    if (!contains(viewportRect, proof.tooltip)) {
      failures.push(`hover tooltip outside viewport for ${proof.label}: ${rectText(proof.tooltip)}`);
    }
    if (!proof.button || proof.button.width < 48 - tolerance || proof.button.height < 48 - tolerance) {
      failures.push(`hover target below 48px for ${proof.label}: ${rectText(proof.button)}`);
    }
  }
  for (const tip of data.tooltips) {
    if (tip.width > 0 && tip.height > 0 && !contains(viewportRect, tip)) {
      failures.push(`tooltip outside viewport: ${tip.text} ${rectText(tip)}`);
    }
  }
  if (viewport.width === 375) {
    const metrics = data.buildSealsMetrics;
    if (!metrics) {
      failures.push("mobile buildSeals metrics missing");
    } else {
      if (!(metrics.scrollWidth > metrics.clientWidth)) {
        failures.push(`mobile build tray not horizontally scrollable: scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth}`);
      }
      if (!(metrics.afterScroll > metrics.beforeScroll)) {
        failures.push(`mobile build tray scrollLeft did not change: before=${metrics.beforeScroll} after=${metrics.afterScroll}`);
      }
    }
  }
  if (data.bodyScrollWidth > viewport.width + 1) {
    warnings.push(`document horizontal overflow scrollWidth=${data.bodyScrollWidth} viewport=${viewport.width}`);
  }
  return { ...data, tooltipProofs, failures, warnings };
}

async function collectUnaffordableHarness(page) {
  const harnessPath = writeBuildMenuHarness();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`file://${harnessPath}`, { waitUntil: "load" });
  await page.screenshot({
    path: path.join(outDir, "unaffordable-build-menu-harness.png"),
    fullPage: true,
  });
  const before = await page.evaluate(() => ({
    pressed: document.querySelector(".build-seal")?.getAttribute("aria-pressed") ?? null,
    selected: document.querySelector("#state")?.getAttribute("data-selected") ?? null,
  }));
  await page.locator(".build-seal").click({ force: true });
  await page.locator(".build-seal").focus();
  await page.keyboard.press("Enter");
  const after = await page.evaluate(() => {
    const seal = document.querySelector(".build-seal");
    const tooltip = document.querySelector(".seal-tooltip");
    const state = document.querySelector("#state");
    const sealRect = seal?.getBoundingClientRect();
    return {
      ariaDisabled: seal?.getAttribute("aria-disabled") ?? null,
      ariaPressed: seal?.getAttribute("aria-pressed") ?? null,
      dataAffordable: seal?.getAttribute("data-affordable") ?? null,
      label: seal?.getAttribute("aria-label") ?? null,
      selected: state?.getAttribute("data-selected") ?? null,
      tooltipText: tooltip?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      button: sealRect
        ? {
            left: sealRect.left,
            right: sealRect.right,
            top: sealRect.top,
            bottom: sealRect.bottom,
            width: sealRect.width,
            height: sealRect.height,
          }
        : null,
    };
  });
  const failures = [];
  if (before.pressed !== "false" || before.selected !== "none") {
    failures.push(`fixture initial state wrong: pressed=${before.pressed} selected=${before.selected}`);
  }
  if (after.ariaDisabled !== "true") failures.push(`disabled seal aria-disabled=${after.ariaDisabled}`);
  if (after.dataAffordable !== "false") failures.push(`disabled seal data-affordable=${after.dataAffordable}`);
  if (after.ariaPressed !== "false") failures.push(`disabled seal activated: aria-pressed=${after.ariaPressed}`);
  if (after.selected !== "none") failures.push(`disabled seal changed selected=${after.selected}`);
  if (!after.tooltipText.includes("건설 불가 · 부족 40")) {
    failures.push(`shortfall copy missing from tooltip: ${after.tooltipText}`);
  }
  if (!after.button || after.button.width < 48 - tolerance || after.button.height < 48 - tolerance) {
    failures.push(`disabled seal below 48px: ${rectText(after.button)}`);
  }
  return { harnessPath, before, after, failures, warnings: [] };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => {
    pageErrors.push({ message: err.message, stack: err.stack });
  });
  page.on("requestfailed", (req) => {
    consoleMessages.push({
      type: "requestfailed",
      text: `${req.url()} ${req.failure()?.errorText ?? ""}`.trim(),
    });
  });
  const results = [];
  for (const viewport of viewports) {
    results.push(await collectViewport(page, viewport));
  }
  const unaffordableHarness = await collectUnaffordableHarness(page);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(baseUrl, { waitUntil: "load" });
  await page.evaluate(() =>
    localStorage.setItem("feudal-lord-simulator:welcome-dismissed:v1", "1"),
  );
  await page.reload({ waitUntil: "load" });
  await page.locator(".build-seal").first().focus();
  await page.keyboard.press("Enter");
  await page.screenshot({
    path: path.join(outDir, "keyboard-build-arm.png"),
    fullPage: true,
  });
  const interaction = await page.evaluate(() => {
    const firstBuild = document.querySelector(".build-seal");
    const disabled = document.querySelector('.build-seal[aria-disabled="true"]');
    const status = document.querySelector(".settlement-status");
    return {
      keyboardFocusedLabel: firstBuild?.getAttribute("aria-label") ?? null,
      keyboardPressed: firstBuild?.getAttribute("aria-pressed") ?? null,
      statusText: status?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      disabledBuildLabel: disabled?.getAttribute("aria-label") ?? null,
      disabledBuildText: disabled?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    };
  });

  await browser.close();

  const fatalConsole = consoleMessages.filter(
    (msg) =>
      msg.type === "error" ||
      msg.type === "requestfailed" ||
      /maximum update depth|max update|uncaught|exception/i.test(msg.text),
  );
  const result = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    results,
    interaction,
    consoleMessages,
    pageErrors,
    fatalConsole,
    verdict:
      results.every((item) => item.failures.length === 0) &&
      interaction.keyboardPressed === "true" &&
      unaffordableHarness.failures.length === 0 &&
      pageErrors.length === 0 &&
      fatalConsole.length === 0
        ? "PASS"
        : "FAIL",
    unaffordableHarness,
  };
  if (interaction.keyboardPressed !== "true") {
    result.results.push({
      viewport: { width: 1280, height: 720 },
      failures: [
        `keyboard Enter did not arm focused build seal: pressed=${interaction.keyboardPressed}`,
      ],
      warnings: [],
    });
  }
  if (unaffordableHarness.failures.length > 0) {
    result.results.push({
      viewport: { width: 1280, height: 720, fixture: "unaffordable-build-menu-harness" },
      failures: unaffordableHarness.failures,
      warnings: [],
    });
  }
  fs.writeFileSync(path.join(outDir, "ui-playwright-result.json"), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(outDir, "browser-geometry.json"), JSON.stringify(result, null, 2));
  if (result.verdict !== "PASS") {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
