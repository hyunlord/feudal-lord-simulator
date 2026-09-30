// NAT-2 (QA-013) check: an open HUD panel never covers the crisis icons or the event chips (Astra, round 2: "목표를
// 펼치면 오른쪽 사건 칩의 이름과 클릭 자리를 가려"). Opens a save with an event chip (the 1380 perf town has "인두세 징수")
// at 1600 × 1100, 1280 × 800 and the tablet's 1180 × 820 (touch); per state — the chapter goal chip unfolded, the goal
// log, the ledger, the population log, the inspector (from a crisis icon) — every chip's box must miss the panel's box,
// lie inside the view, and be the topmost element at its centre (document.elementFromPoint), and the panel's centre
// must be the panel's own. Writes <out.json> (boxes per state) and, with --shots, a JPEG per state.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/slotChipOverlapCheck.ts <out.json> --url <game> [--save <save>] [--shots <dir>]
// Exit 1 when a chip is covered, off the view or not clickable, or a state that should have chips has none.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadChromium, openScene, TUTORIAL_OFF } from "./perf/scenePage";

const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url") ?? "http://localhost:5400/";
const save = flag("save") ?? "fixtures/perf-gate/ch4-1380.save.json.gz";
const shots = flag("shots");
if (shots !== undefined) mkdirSync(shots, { recursive: true });

const VIEWS = [
  { name: "desktop-1600x1100", width: 1600, height: 1100, touch: false },
  { name: "desktop-1280x800", width: 1280, height: 800, touch: false },
  { name: "tablet-1180x820", width: 1180, height: 820, touch: true },
] as const;
const CHIPS = ".crisis-icon, .event-chip";
// Each state: how to open it, the panel's selector, how to close it.
const STATES = [
  { name: "goal-unfolded", open: ".goal-card-fold", panel: ".goal-chip-rail .goal-card", close: ".goal-card-fold" },
  { name: "goal-log", open: ".goal-drawer-toggle", panel: ".slot-panel.goal-slot", close: ".goal-drawer-toggle" },
  { name: "ledger", open: ".action-dock-button[aria-label*='장부'], .action-dock-button:has-text('장부')", panel: ".ledger-drawer", close: ".ledger-drawer .slot-panel-close" },
  { name: "population", open: ".status-pill-cell[aria-label*='인구']", panel: ".ledger-population-drawer", close: null },
  { name: "inspector", open: ".crisis-icon", panel: ".slot-panel.inspector-slot, .diagnostic-card-position", close: null },
] as const;

type Box = { x: number; y: number; width: number; height: number };
type Chip = { text: string; box: Box; topmost: boolean };
type Measure = { panel: Box | null; panelTopmost: boolean; chips: Chip[] };

// In the page, as source text (tsx's helper names do not exist there): the panel's box and each chip's.
const MEASURE = `({ panel, chips }) => {
  const rect = element => { const box = element.getBoundingClientRect(); return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) }; };
  const shown = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
  const top = element => { const box = element.getBoundingClientRect(); const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2); return hit !== null && element.contains(hit); };
  const panelElement = [...document.querySelectorAll(panel)].find(shown) ?? null;
  return {
    panel: panelElement === null ? null : rect(panelElement),
    panelTopmost: panelElement !== null && top(panelElement),
    chips: [...document.querySelectorAll(chips)].filter(shown).map(chip => ({ text: chip.textContent?.trim() || chip.getAttribute("aria-label") || "", box: rect(chip), topmost: top(chip) })),
  };
}`;
const measure = (page: { evaluate: (source: string) => Promise<unknown> }, arg: { panel: string; chips: string }) =>
  page.evaluate(`(${MEASURE})(${JSON.stringify(arg)})`) as Promise<Measure>;
const meets = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const failures: string[] = [];
const result: Record<string, Record<string, Measure | string>> = {};
for (const view of VIEWS) {
  const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 1, hasTouch: view.touch, isMobile: view.touch });
  await context.addInitScript(TUTORIAL_OFF);
  const page = await context.newPage();
  await openScene(page, { url, save, speed: 1, proof: false });
  await page.waitForTimeout(1_500);
  result[view.name] = {};
  const closed = await measure(page, { panel: "#none", chips: CHIPS });
  if (closed.chips.length === 0) failures.push(`${view.name}: no crisis icon or event chip to check`);
  for (const state of STATES) {
    const opener = page.locator(state.open).first();
    if (await opener.count() === 0) { result[view.name]![state.name] = "no opener"; if (state.name !== "inspector") failures.push(`${view.name} ${state.name}: no opener ${state.open}`); continue; }
    await opener.click({ timeout: 5_000 }); await page.waitForTimeout(600);
    const seen = await measure(page, { panel: state.panel, chips: CHIPS });
    result[view.name]![state.name] = seen;
    if (shots !== undefined) await page.screenshot({ path: join(shots, `${view.name}-${state.name}.jpg`), type: "jpeg", quality: 55 });
    if (seen.panel === null) failures.push(`${view.name} ${state.name}: panel ${state.panel} did not open`);
    else if (!seen.panelTopmost) failures.push(`${view.name} ${state.name}: the panel's centre is covered`);
    for (const chip of seen.chips) {
      const where = `${view.name} ${state.name}: "${chip.text}" at ${chip.box.x},${chip.box.y}`;
      if (seen.panel !== null && meets(chip.box, seen.panel)) failures.push(`${where} lies under the panel ${seen.panel.x},${seen.panel.y} ${seen.panel.width}x${seen.panel.height}`);
      if (chip.box.x < 0 || chip.box.y < 0 || chip.box.x + chip.box.width > view.width || chip.box.y + chip.box.height > view.height) failures.push(`${where} is off the view`);
      if (!chip.topmost) failures.push(`${where} is not the topmost element at its centre`);
    }
    if (state.close !== null && await page.locator(state.close).count() > 0) await page.locator(state.close).first().click({ timeout: 5_000 });
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  await context.close();
}
await browser.close();
writeFileSync(out!, `${JSON.stringify({ url, save, failures, result }, null, 1)}\n`);
console.log(failures.length === 0 ? "slot-chip overlap: passed" : `slot-chip overlap: ${failures.length} failures\n${failures.join("\n")}`);
process.exit(failures.length === 0 ? 0 : 1);
