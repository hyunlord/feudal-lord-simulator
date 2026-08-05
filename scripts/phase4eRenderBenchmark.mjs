import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const playwrightCorePath = process.env.PLAYWRIGHT_CORE_PATH;
const chromePath = process.env.CHROME_PATH;
const baseUrl = process.env.BENCHMARK_URL ?? "http://127.0.0.1:3200";
const outputPath = process.env.BENCHMARK_OUTPUT;
const revision = process.env.BENCHMARK_REVISION ?? "unknown";

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

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const runs = [];
  for (const competition of ["1x", "5x"]) {
    const result = await page.evaluate(async (mode) => {
      const benchmark = await import("/scripts/phase4eBenchmarkFixture.ts");
      return benchmark.runPhase4eRenderBenchmark(mode);
    }, competition);
    runs.push(result);
  }
  const evidence = {
    schemaVersion: 1,
    revision,
    generatedAt: new Date().toISOString(),
    userAgent: await page.evaluate(() => navigator.userAgent),
    runs,
  };
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  if (outputPath === undefined) {
    process.stdout.write(serialized);
  } else {
    await writeFile(outputPath, serialized, "utf8");
    process.stdout.write(`${outputPath}\n`);
  }
} finally {
  await browser.close();
}
