// NAT-2 QA-003: crops of a town's designated gates at 1600×1100, DPR 1, paused. For the biggest town (the default save)
// first Astra's start camera (the gate and her NW corner as she saw them), then every gate centred (middle-button pan)
// at zoom 1.0 and 1.4 (wheel steps anchored on the gate, so it stays under the pointer).
//   PLAYWRIGHT_MODULE=... tsx scripts/nat2GateCapture.ts <url> <out dir> <label> [save]
import { mkdirSync } from "node:fs";
import { loadChromium, openScene, readSave, TUTORIAL_OFF, type PageWindow } from "./perf/scenePage";
import { decodeSave } from "../src/save/saveCodec";
import { wallGatePoints } from "../src/world/wallTraversal";
type Point = { readonly x: number; readonly y: number };
const [url, out, label] = [process.argv[2]!, process.argv[3]!, process.argv[4]!];
const save = process.argv[5] ?? "fixtures/perf-gate/ch4-1380.save.json.gz";
mkdirSync(out, { recursive: true });
const wall = (decodeSave(readSave(save)).envelope as unknown as { state: { palisade: { gate: Point; additionalGates?: readonly Point[] } } }).state.palisade;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
await context.addInitScript(TUTORIAL_OFF);
const page = await context.newPage();
await openScene(page, { url, speed: 1, proof: true, save });
await page.keyboard.press("Space"); await page.waitForTimeout(3_000);
// Edge point (x, y) is the corner of tile (x - 0.5, y - 0.5)'s centre in the proof port's terms.
const client = (point: Point) => page.evaluate(`window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({ tx: ${point.x - 0.5}, ty: ${point.y - 0.5} })`) as Promise<{ clientX: number; clientY: number }>;
const zoom = () => page.evaluate(() => (window as unknown as PageWindow).__FEUDAL_PHASE10_PROOF__.diagnosis().camera.zoom) as Promise<number>;
const crop = async (name: string, point: Point, size = { width: 520, height: 360 }) => {
  const at = await client(point);
  const x = Math.max(0, Math.min(1600 - size.width, Math.round(at.clientX - size.width / 2)));
  const y = Math.max(0, Math.min(1100 - size.height, Math.round(at.clientY - size.height * 0.6)));
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 82, clip: { x, y, ...size } });
  console.log(name, JSON.stringify({ zoom: Number((await zoom()).toFixed(3)), client: at }));
};
// Middle-button drags of at most 500 px (away from the edge-scroll band) until the point is at the view centre.
const centre = async (point: Point) => {
  for (let round = 0; round < 20; round += 1) {
    const at = await client(point);
    const dx = Math.max(-500, Math.min(500, 800 - at.clientX)); const dy = Math.max(-350, Math.min(350, 550 - at.clientY));
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    await page.mouse.move(800 - dx / 2, 550 - dy / 2); await page.mouse.down({ button: "middle" });
    await page.mouse.move(800 + dx / 2, 550 + dy / 2, { steps: 8 }); await page.mouse.up({ button: "middle" });
    await page.waitForTimeout(150);
  }
};
const zoomTo = async (target: number, point: Point) => {
  const at = await client(point);
  await page.mouse.move(at.clientX, at.clientY);
  const now = await zoom();
  const steps = Math.round(Math.log(target / now) / Math.log(target > now ? 1.1 : 1 / 0.9));
  for (let step = 0; step < Math.abs(steps); step += 1) { await page.mouse.wheel(0, steps > 0 ? -100 : 100); await page.waitForTimeout(120); }
};
if (process.argv[5] === undefined) {
  await crop(`${label}-start-gate`, wall.gate);
  await crop(`${label}-start-nw-corner`, { x: 39, y: 41 });
}
for (const [index, gate] of wallGatePoints(wall).entries()) {
  for (const target of [1.0, 1.4]) {
    await centre(gate); await zoomTo(target, gate);
    // Park the pointer away from the edges and the gate (no hover highlight, no edge scroll).
    await page.mouse.move(800, 200); await page.waitForTimeout(1_500);
    await crop(`${label}-gate${index}-zoom${target.toFixed(1)}`, gate, { width: 420, height: 300 });
  }
}
await browser.close();
