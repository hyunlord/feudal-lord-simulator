// NAT-2 (QA-002) standing-people check: the big town of 1380 (the perf fixture, loaded as a player loads it, 1600 × 1100,
// DPR 1, the start camera), played at 1x and at 5x. Every 0.5 s for 10 s one whole frame's people are recorded where
// they are drawn — every person figure the canvas gets, whatever draws it: the walkers (engine carts and carriers,
// the presentation residents) and the scene figures (story, chapter 4, the alehouse crowd) — by the draw call's image
// rectangle and the function that drew it (the stack; a Vite dev server, so the names are the source's). A walker "did
// not move for 10 s" when the proof port's walker of that id stays within STILL_TILES (0.15 tile) through every sample;
// a scene figure when one from the same source and sheet is drawn within 0.15 of a tile's width on screen of its foot
// in every sample (UI-9's drinkers swayed ±2 px, 0.06 tile; two alehouses' drinkers side by side stand 0.17 apart).
// Swaying or turning on the spot is not moving.
// Reasons shown: a builder at its construction site (the site shows the work), a petition crowd (FC-3, while a
// petition waits). The gate: still people without a shown reason ≤ 5 % of the people on screen.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/nat2Standing.ts <out-dir> <label> [--url http://localhost:5396/] [--speeds 1,5]
// Writes <out-dir>/standing-<label>.json and standing-<label>-<speed>x.jpg (the first sample: still people ringed).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { closeModals, loadChromium, openScene, TUTORIAL_OFF } from "./perf/scenePage";

const [out, label] = process.argv.slice(2) as [string, string];
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url") ?? "http://localhost:5396/";
const speeds = (flag("speeds") ?? "1,5").split(",").map(Number);
const SAVE = "fixtures/perf-gate/ch4-1380.save.json.gz";
const SAMPLES = 21; const SAMPLE_MS = 500; const STILL_TILES = 0.15; const TILE_W = 64; const GATE = 0.05;
/** Functions that draw a person figure (innermost first wins); carts, loads and icons are not people. */
const PERSON = ["drawComposedWalker", "drawRuntimeActor", "walkerCell", "drawCollector", "drawCell", "drawWalkerCell", "drawAleDrinker"];
const NOT_PERSON = ["drawRuntimeHandcart", "drawCartPayload", "drawCargoIcon"];
const WITH_REASON: Readonly<Record<string, string>> = { "drawStoryProps>drawCell": "petition crowd (FC-3)" };
mkdirSync(out, { recursive: true });

type Walker = { readonly id: string; readonly kind: string; readonly phase: string | null; readonly x: number; readonly y: number; readonly point: { readonly clientX: number; readonly clientY: number } };
/** The proof port's walkers (the simulation's and the presented residents) with their screen points. */
const WALKERS = `(() => { const port = window.__FEUDAL_PHASE10_PROOF__; return port.snapshot().walkers
  .map(w => ({ id: w.id, kind: w.kind, phase: w.phase, x: w.x, y: w.y, point: port.tileClientPoint({ tx: w.x, ty: w.y }) })); })()`;
type Person = { readonly source: string; readonly image: string; readonly x: number; readonly y: number; readonly rect: readonly number[] };
// The in-page recorder, as a string (tsx names the functions it compiles, and the page has no `__name`): the game
// canvas's own drawImage (the proof port wraps it on the context) is wrapped once; `__nat2Sample()` records one frame.
const RECORDER = `(() => {
  if (window.__nat2Sample) return;
  const context = document.querySelector("canvas.game-canvas").getContext("2d");
  const inner = context.drawImage; let recording = null;
  const person = ${JSON.stringify(PERSON)}; const notPerson = ${JSON.stringify(NOT_PERSON)};
  context.drawImage = function () {
    if (recording !== null) {
      const names = (new Error().stack || "").split("\\n").slice(2, 14).map(line => (/at (?:[\\w$]+\\.)*([\\w$<>]+) \\(/.exec(line) || [])[1] || "");
      const index = names.findIndex(name => person.includes(name));
      if (index >= 0 && !names.some(name => notPerson.includes(name))) {
        const a = arguments; const n = a.length; const dx = n === 9 ? a[5] : a[1], dy = n === 9 ? a[6] : a[2], dw = n === 9 ? a[7] : a[3], dh = n === 9 ? a[8] : a[4];
        const t = this.getTransform(); const x0 = t.a * dx + t.c * dy + t.e, y0 = t.b * dx + t.d * dy + t.f, x1 = t.a * (dx + dw) + t.c * (dy + dh) + t.e, y1 = t.b * (dx + dw) + t.d * (dy + dh) + t.f;
        const caller = names[index + 1] || "";
        const image = a[0] && a[0].src ? a[0].src.split("/").pop().split("?")[0] : "canvas";
        recording.push({ source: (caller ? caller + ">" : "") + names[index], image, x: (x0 + x1) / 2, y: Math.max(y0, y1), rect: [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)] });
      }
    }
    return inner.apply(this, arguments);
  };
  window.__nat2Sample = () => new Promise(resolve => requestAnimationFrame(() => { recording = []; requestAnimationFrame(() => { const got = recording; recording = null; resolve(got); }); }));
})()`;

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
await context.addInitScript(TUTORIAL_OFF);
const page = await context.newPage();
await openScene(page, { url, save: SAVE, speed: 1 });
await page.mouse.move(800, 600);
await closeModals(page);
await page.evaluate(RECORDER);
const report: Record<string, unknown> = {};
let passed = true;
for (const speed of speeds) {
  await closeModals(page);
  await page.getByRole("button", { name: `${speed}배속`, exact: true }).click();
  await page.waitForTimeout(1_500);
  const samples: Person[][] = []; const ticks: number[] = []; const walkerSamples: Walker[][] = [];
  let shot: Buffer | null = null;
  for (let index = 0; index < SAMPLES; index += 1) {
    const started = Date.now();
    const people = (await page.evaluate("window.__nat2Sample()") as Person[]).filter(p => p.x >= 0 && p.x < 1600 && p.y >= 0 && p.y < 1100);
    samples.push(people);
    walkerSamples.push(await page.evaluate(WALKERS) as Walker[]);
    ticks.push(await page.evaluate("window.__FEUDAL_PHASE10_PROOF__.snapshot().tick") as number);
    if (index === 0) shot = await page.screenshot({ type: "png" }) as Buffer;
    await page.waitForTimeout(Math.max(0, SAMPLE_MS - (Date.now() - started)));
  }
  const zoom = await page.evaluate("window.__FEUDAL_PHASE10_PROOF__.diagnosis().camera.zoom") as number;
  const stillPx = STILL_TILES * TILE_W * zoom;
  // Walkers by id (a busy road puts some figure on the same spot in every sample): on screen in the first sample,
  // present in all, never STILL_TILES from where they were.
  const onView = (w: Walker) => w.point.clientX >= 0 && w.point.clientX < 1600 && w.point.clientY >= 0 && w.point.clientY < 1100;
  const stillWalkers = walkerSamples[0]!.filter(onView).filter(first => walkerSamples.every(sample => {
    const now = sample.find(w => w.id === first.id); return now !== undefined && Math.hypot(now.x - first.x, now.y - first.y) < STILL_TILES; }));
  // Scene figures (no walker behind them) by where they are drawn: the same source and sheet within STILL_TILES.
  const walkerDrawn = (person: Person) => person.source.endsWith("drawComposedWalker") || person.source.endsWith("drawRuntimeActor");
  const near = (a: Person, b: Person) => a.source === b.source && a.image === b.image && Math.hypot(a.x - b.x, a.y - b.y) <= stillPx;
  const stillScene = samples[0]!.filter(person => !walkerDrawn(person) && samples.every(sample => sample.some(other => near(person, other))));
  type Still = { readonly source: string; readonly x: number; readonly y: number; readonly h: number; readonly reason: string | null; readonly walker?: Walker };
  const still: Still[] = [
    // A builder of the simulation stands at its construction site, which shows the work.
    ...stillWalkers.map(w => ({ source: `walker:${w.kind}${w.id.startsWith("resident-") ? ":resident" : ""}`, x: w.point.clientX, y: w.point.clientY + 8 * zoom, h: 36 * zoom,
      reason: w.kind === "builder" && !w.id.startsWith("resident-") ? "builder at its site" : null, walker: w })),
    ...stillScene.map(p => ({ source: p.source, x: p.x, y: p.y, h: p.rect[3]!, reason: WITH_REASON[p.source] ?? null })),
  ];
  const withoutReason = still.filter(person => person.reason === null);
  const onScreen = samples.reduce((sum, sample) => sum + sample.length, 0) / samples.length;
  const bySource = (list: readonly { readonly source: string }[]) => list.reduce<Record<string, number>>((map, person) => { map[person.source] = (map[person.source] ?? 0) + 1; return map; }, {});
  const share = onScreen === 0 ? 0 : withoutReason.length / onScreen;
  passed &&= share <= GATE;
  report[`${speed}x`] = { ticks: [ticks[0], ticks.at(-1)], zoom, stillPx, samples: SAMPLES, spanMs: (SAMPLES - 1) * SAMPLE_MS, peopleOnScreenMean: Number(onScreen.toFixed(1)),
    peopleBySource: bySource(samples[0]!), still10s: still.length, stillBySource: bySource(still), stillWithReason: still.filter(p => p.reason !== null).map(p => ({ source: p.source, reason: p.reason })),
    stillWithoutReason: withoutReason.length, share: Number(share.toFixed(4)), gate: GATE, pass: share <= GATE,
    stillAt: withoutReason.map(p => ({ source: p.source, foot: [Math.round(p.x), Math.round(p.y)], walker: p.walker })) };
  // The first sample with the still people ringed (red: no reason shown, amber: a reason shown), as JPEG.
  const marked = await page.evaluate(`(async (png, still) => {
    const image = await new Promise(resolve => { const img = new Image(); img.onload = () => resolve(img); img.src = "data:image/png;base64," + png; });
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height; const paint = canvas.getContext("2d");
    paint.drawImage(image, 0, 0); paint.lineWidth = 3;
    for (const p of still) { paint.strokeStyle = p.reason ? "orange" : "red"; paint.beginPath(); paint.arc(p.x, p.y - p.h / 2, Math.max(12, p.h / 2), 0, Math.PI * 2); paint.stroke(); }
    return canvas.toDataURL("image/jpeg", 0.72).split(",")[1];
  })(${JSON.stringify(shot!.toString("base64"))}, ${JSON.stringify(still.map(p => ({ x: p.x, y: p.y, h: p.h, reason: p.reason })))})`) as string;
  writeFileSync(join(out, `standing-${label}-${speed}x.jpg`), Buffer.from(marked, "base64"));
}
writeFileSync(join(out, `standing-${label}.json`), JSON.stringify({ label, save: SAVE, viewport: "1600x1100 DPR 1, start camera", stillTiles: STILL_TILES, ...report, pass: passed }, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(report).map(([key, value]) => {
  const v = value as { peopleOnScreenMean: number; still10s: number; stillWithoutReason: number; share: number; stillBySource: unknown };
  return [key, { people: v.peopleOnScreenMean, still: v.still10s, withoutReason: v.stillWithoutReason, share: v.share, bySource: v.stillBySource }];
}))));
console.log(passed ? "nat2Standing: passed" : "nat2Standing: FAILED");
await browser.close();
process.exitCode = passed ? 0 : 1;
