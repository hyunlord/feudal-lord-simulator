// NAT-2 (QA-001) forest captures: the big town of 1380 (the perf fixture, loaded as a player loads it), the camera on
// its densest forest, 20 frames 0.1 s apart at 5x and paused (Astra's burst), the forest ROI of each frame side by side
// in one JPEG sheet, and the frame-to-frame change: the mean RGB difference of the ROI between frames 0 and 19 and
// between neighbouring frames (0–255). The motion after NAT-2 is slow (3–6 s) and small, and goes on while paused.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/nat2ForestCaptures.ts <out-dir> <label> [--url http://localhost:5396/]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { closeModals, loadChromium, openScene, TUTORIAL_OFF } from "./perf/scenePage";

const [out, label] = process.argv.slice(2) as [string, string];
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url") ?? "http://localhost:5396/";
const SAVE = "fixtures/perf-gate/ch4-1380.save.json.gz";
// The densest 10 × 10 forest window of the map (every tile forest), at the start camera's zoom.
const FOREST = { tx: 47, ty: 11 }; const ZOOM = 2; const WIDTH = 1600; const HEIGHT = 1100;
const ROI = { x: 650, y: 390, width: 300, height: 320 }; // inside the forest (Astra: 300 × 320 at her forest camera)
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
await context.addInitScript(TUTORIAL_OFF);
const page = await context.newPage();
const camera = { zoom: ZOOM, panX: WIDTH / 2 - (FOREST.tx - FOREST.ty) * 32 * ZOOM, panY: HEIGHT / 2 - (FOREST.tx + FOREST.ty) * 16 * ZOOM };
await page.route("**/src/render/canvasRuntime.ts*", async (route: any) => {
  const response = await route.fetch(); const text = await response.text(); const anchor = "const house = startingHouse(state.buildings);";
  if (!text.includes(anchor)) throw new Error("camera anchor changed");
  await route.fulfill({ response, body: text.replace(anchor, `return ${JSON.stringify(camera)};` + anchor) });
});
await openScene(page, { url, save: SAVE, speed: 5 });
await page.mouse.move(WIDTH / 2, HEIGHT / 2);
const result: Record<string, unknown> = {};
for (const mode of ["5x", "paused"] as const) {
  await closeModals(page);
  await page.getByRole("button", { name: mode === "5x" ? "5배속" : "일시 정지", exact: true }).click();
  await page.waitForTimeout(1_000);
  const frames: string[] = [];
  for (let index = 0; index < 20; index += 1) {
    frames.push((await page.screenshot({ clip: ROI, type: "png" }) as Buffer).toString("base64"));
    await page.waitForTimeout(100);
  }
  // The sheet and the differences, computed in the page (no image library in the repository).
  // (A string: tsx names the functions it compiles, and the page has no `__name`.)
  const measured = await page.evaluate(`(async (frames, roi) => {
    const images = await Promise.all(frames.map(data => new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image); image.src = "data:image/png;base64," + data; })));
    const pixels = images.map(image => { const canvas = document.createElement("canvas"); canvas.width = roi.width; canvas.height = roi.height;
      const paint = canvas.getContext("2d"); paint.drawImage(image, 0, 0); return paint.getImageData(0, 0, roi.width, roi.height).data; });
    const diff = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return sum / (a.length / 4 * 3); };
    const neighbours = pixels.slice(1).map((frame, index) => diff(pixels[index], frame));
    const sheet = document.createElement("canvas"); const cols = 5; const scale = 0.5;
    sheet.width = cols * roi.width * scale; sheet.height = Math.ceil(images.length / cols) * roi.height * scale;
    const paint = sheet.getContext("2d");
    images.forEach((image, index) => paint.drawImage(image, (index % cols) * roi.width * scale, Math.floor(index / cols) * roi.height * scale, roi.width * scale, roi.height * scale));
    return { first19: diff(pixels[0], pixels[19]), neighbourMean: neighbours.reduce((a, b) => a + b, 0) / neighbours.length, neighbourMax: Math.max(...neighbours),
      sheet: sheet.toDataURL("image/jpeg", 0.8).split(",")[1] };
  })(${JSON.stringify(frames)}, ${JSON.stringify(ROI)})`) as { first19: number; neighbourMean: number; neighbourMax: number; sheet: string };
  writeFileSync(join(out, `forest-${mode}-${label}.jpg`), Buffer.from(measured.sheet, "base64"));
  result[mode] = { first19: Number(measured.first19.toFixed(2)), neighbourMean: Number(measured.neighbourMean.toFixed(2)), neighbourMax: Number(measured.neighbourMax.toFixed(2)) };
}
writeFileSync(join(out, `forest-${label}.json`), JSON.stringify({ label, save: SAVE, camera, roi: ROI, frames: "20 × 0.1 s", ...result }, null, 1));
console.log(label, JSON.stringify(result));
await browser.close();
