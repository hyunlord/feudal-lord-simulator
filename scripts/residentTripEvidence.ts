// MOVE-1 resident movement evidence (gate 3 and the capture scenes).
//   tsx scripts/residentTripEvidence.ts [outDir=docs/verification/move1-residents]
// Scene: V2's C3 seed 2 city (docs/verification/c3-labour/repro-seed2-348000.json.gz), run one calendar year without
// input (advanceTick only), sampled every SAMPLE_TICKS ticks. At each sample the drawn walkers are the simulation's
// walkers plus the residents (`withResidentWalkers`, the store's published state).
//  - Screen: 1280 x 800 CSS px at zoom 1 centred on the market / mill quarter (48,35), the V2 street view; a walker is
//    on screen when its foot anchor (`walkerVisualAnchor`) is inside.
//  - Per sample: walkers on screen, distinct sheets (kinds), women's share; visitors on market days.
//  - Year: sheets, bands, occupations and purposes worn by the residents and all walkers.
//  - Scenes: the first weekday, market day (with visitors on screen) and winter samples are written for the captures.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { walkerVisualAnchor } from "../src/render/walkerAnchor";
import { walkerLook } from "../src/render/walkerLook";
import { withResidentWalkers } from "../src/state/residentWalkerState";
import { isMarketDay, isResidentWalker } from "../src/ui/residentTrips";
import { loadSeed2City } from "./walkerLookEvidence";
import { tileToScreen } from "../src/render/iso";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SAMPLE_TICKS = 50;
const YEAR = 4_000;
const SCREEN = { width: 1280, height: 800, centre: { tx: 48, ty: 35 } } as const;

const count = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
const sorted = (map: Map<string, number>) => Object.fromEntries([...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
const median = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

export function onScreen(position: { readonly tx: number; readonly ty: number }): boolean {
  const centre = tileToScreen(SCREEN.centre.tx, SCREEN.centre.ty);
  const anchor = walkerVisualAnchor(position);
  return Math.abs(anchor.sx - centre.sx) <= SCREEN.width / 2 && Math.abs(anchor.sy - centre.sy) <= SCREEN.height / 2;
}

function run(outDir: string) {
  let state = loadSeed2City();
  const samples = [];
  const year = { sheets: new Map<string, number>(), bands: new Map<string, number>(), occupations: new Map<string, number>(), purposes: new Map<string, number>(),
    residentSheets: new Map<string, number>(), ages: new Map<string, number>() };
  const scenes: Partial<Record<"weekday" | "marketday" | "winter", GameState>> = {};
  for (let step = 1; step <= YEAR; step += 1) {
    state = advanceTick(state);
    if (step % SAMPLE_TICKS !== 0) continue;
    const display = withResidentWalkers(state);
    const visible = display.walkers.filter(walker => onScreen(walker.position));
    const looks = visible.map(walker => ({ walker, look: walkerLook(display, walker) }));
    const kinds = new Set(looks.map(({ look }) => look.sheetId)).size;
    const women = looks.filter(({ look }) => look.sex === "female").length;
    const residents = looks.filter(({ walker }) => isResidentWalker(walker));
    const visitors = residents.filter(({ walker }) => isResidentWalker(walker) && walker.resident.purpose === "visit").length;
    const calendar = stateCalendar(state);
    const marketDay = isMarketDay(state.tick);
    samples.push({ tick: state.tick, season: calendar.season, dayOfYear: calendar.dayOfYear, marketDay, onScreen: visible.length,
      residentsOnScreen: residents.length, kinds, womenShare: visible.length === 0 ? null : Number((women / visible.length).toFixed(3)), visitors });
    for (const { walker, look } of looks) {
      count(year.sheets, look.sheetId); count(year.bands, look.band); count(year.occupations, look.occupation);
      if (isResidentWalker(walker)) { count(year.purposes, walker.resident.purpose); count(year.residentSheets, look.sheetId); count(year.ages, walker.resident.ageBand); }
    }
    if (scenes.weekday === undefined && !marketDay && calendar.season === 1 && residents.length >= 8) scenes.weekday = state;
    if (scenes.marketday === undefined && marketDay && calendar.season === 1 && visitors >= 3) scenes.marketday = state;
    if (scenes.winter === undefined && calendar.season === 3 && residents.length >= 8) scenes.winter = state;
  }
  const seen = samples.filter(sample => sample.onScreen > 0);
  const women = seen.reduce((sum, sample) => sum + (sample.womenShare ?? 0) * sample.onScreen, 0) / seen.reduce((sum, sample) => sum + sample.onScreen, 0);
  const marketDays = samples.filter(sample => sample.marketDay);
  const gate3 = {
    screen: SCREEN, samples: samples.length,
    kindsPerScreen: { min: Math.min(...samples.map(sample => sample.kinds)), median: median(samples.map(sample => sample.kinds)),
      samplesAtLeast12: samples.filter(sample => sample.kinds >= 12).length },
    womenShareOfWalkersOnScreen: Number(women.toFixed(3)),
    womenSharePerScreen: { min: Math.min(...seen.map(sample => sample.womenShare ?? 1)), median: median(seen.map(sample => sample.womenShare ?? 0)) },
    marketDaySamples: marketDays.length, marketDaySamplesWithVisitorsOnScreen: marketDays.filter(sample => sample.visitors > 0).length,
    otherDaySamplesWithVisitorsOnScreen: samples.filter(sample => !sample.marketDay && sample.visitors > 0).length,
    residentsOnScreen: { max: Math.max(...samples.map(sample => sample.residentsOnScreen)), median: median(samples.map(sample => sample.residentsOnScreen)) },
  };
  const distribution = { sheets: sorted(year.sheets), bands: sorted(year.bands), occupations: sorted(year.occupations), residentPurposes: sorted(year.purposes),
    residentSheets: sorted(year.residentSheets), residentAgeBands: sorted(year.ages) };
  mkdirSync(join(outDir, "scene"), { recursive: true });
  writeFileSync(join(outDir, "residents-seed2.json"), `${JSON.stringify({ source: "docs/verification/c3-labour/repro-seed2-348000.json.gz", sampleTicks: SAMPLE_TICKS, gate3, distribution,
    scenes: Object.fromEntries(Object.entries(scenes).map(([name, scene]) => [name, scene?.tick ?? null])), samples }, null, 1)}\n`);
  for (const [name, scene] of Object.entries(scenes)) if (scene !== undefined) writeFileSync(join(outDir, "scene", `seed2-${name}.json.gz`), gzipSync(JSON.stringify(scene)));
  return { gate3, scenes: Object.fromEntries(Object.entries(scenes).map(([name, scene]) => [name, scene?.tick ?? null])) };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(run(resolve(ROOT, process.argv[2] ?? "docs/verification/move1-residents")), null, 1)}\n`);
}
