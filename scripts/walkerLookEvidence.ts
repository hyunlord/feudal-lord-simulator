// V2 walker look evidence (gates 1, 2 and the season scenes for gate 4).
//   tsx scripts/walkerLookEvidence.ts [outDir=docs/verification/v2-walkers]
// Scene: the C3 seed 2 city (docs/verification/c3-labour/repro-seed2-348000.json.gz, tick 348,000, spring), run one
// calendar year without input (advanceTick only), sampled every SAMPLE_TICKS ticks.
//  - Gate 1: at every sample, the looks of the state equal the looks of the state after a save round trip
//    (encodeSave -> decodeSave), and of a structured clone.
//  - Gate 2: at every sample, pairs of walkers wearing the same sheet within 2 tiles (Euclidean, walker positions);
//    per class band, the share of the band's most worn sheet over the distinct walkers of the year.
//  - Gate 4 scenes: the first summer (season 1) and winter (season 3) sample are written as scene states.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { walkerCloak, walkerHeldProp, walkerLooks } from "../src/render/walkerLook";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SAMPLE_TICKS = 50;
const YEAR = 4_000;

export function loadSeed2City(): GameState {
  return JSON.parse(gunzipSync(readFileSync(join(ROOT, "docs/verification/c3-labour/repro-seed2-348000.json.gz"))).toString("utf8")) as GameState;
}

const lookKey = (state: GameState) => JSON.stringify([...walkerLooks(state)].sort(([a], [b]) => a.localeCompare(b)));

export function sameLooksAfterSave(state: GameState): boolean {
  const saved = decodeSave(encodeSave({ state, createdAt: "2026-09-25T00:00:00.000Z", savedAt: "2026-09-25T00:00:00.000Z" }).bytes).envelope.state as GameState;
  return lookKey(saved) === lookKey(state) && lookKey(structuredClone(state)) === lookKey(state);
}

export function adjacentSameSheetPairs(state: GameState): { readonly a: string; readonly b: string; readonly sheet: string; readonly distance: number }[] {
  const looks = walkerLooks(state);
  const pairs = [];
  for (let i = 0; i < state.walkers.length; i += 1) for (let j = i + 1; j < state.walkers.length; j += 1) {
    const a = state.walkers[i]!; const b = state.walkers[j]!;
    const distance = Math.hypot(a.position.tx - b.position.tx, a.position.ty - b.position.ty);
    if (distance <= 2 && looks.get(a.id)!.sheetId === looks.get(b.id)!.sheetId) pairs.push({ a: a.id, b: b.id, sheet: looks.get(a.id)!.sheetId, distance: Number(distance.toFixed(2)) });
  }
  return pairs;
}

function run(outDir: string) {
  let state = loadSeed2City();
  const samples = [];
  const worn = new Map<string, { sheet: string; band: string; sex: string; occupation: string }>();
  const scenes: Partial<Record<"summer" | "winter", GameState>> = {};
  let deterministic = 0; let checked = 0; let props = 0; let cloaks = 0;
  for (let step = 0; step <= YEAR; step += 1) {
    if (step % SAMPLE_TICKS === 0) {
      const looks = walkerLooks(state);
      const season = stateCalendar(state).season;
      checked += 1; if (sameLooksAfterSave(state)) deterministic += 1;
      for (const walker of state.walkers) {
        const look = looks.get(walker.id)!;
        worn.set(walker.id, { sheet: look.sheetId, band: look.band, sex: look.sex, occupation: look.occupation });
        if (walkerHeldProp(look, walker) !== null) props += 1;
        if (walkerCloak(state, look) !== null) cloaks += 1;
      }
      const pairs = adjacentSameSheetPairs(state);
      samples.push({ tick: state.tick, season, walkers: state.walkers.length, adjacentSameSheet: pairs });
      if (season === 1 && scenes.summer === undefined && state.walkers.length >= 15) scenes.summer = state;
      if (season === 3 && scenes.winter === undefined && state.walkers.length >= 15) scenes.winter = state;
    }
    state = advanceTick(state);
  }
  const bands = new Map<string, Map<string, number>>();
  for (const { sheet, band } of worn.values()) {
    const sheets = bands.get(band) ?? new Map<string, number>();
    sheets.set(sheet, (sheets.get(sheet) ?? 0) + 1);
    bands.set(band, sheets);
  }
  const bandShares = [...bands].map(([band, sheets]) => {
    const total = [...sheets.values()].reduce((sum, count) => sum + count, 0);
    const [top, topCount] = [...sheets].sort((a, b) => b[1] - a[1])[0]!;
    return { band, walkers: total, sheets: Object.fromEntries(sheets), topSheet: top, topShare: Number((topCount / total).toFixed(3)) };
  }).sort((a, b) => a.band.localeCompare(b.band));
  const sexes = [...worn.values()].reduce((counts, { sex }) => ({ ...counts, [sex]: (counts[sex] ?? 0) + 1 }), {} as Record<string, number>);
  const summary = {
    scene: "docs/verification/c3-labour/repro-seed2-348000.json.gz, one year without input (advanceTick), sampled every 50 ticks",
    samples: samples.length, distinctWalkers: worn.size, sexes,
    gate1: { samples: checked, sameAfterSaveRoundTripAndClone: deterministic },
    gate2: { adjacentSameSheetPairs: samples.reduce((sum, sample) => sum + sample.adjacentSameSheet.length, 0),
      samplesWithPairs: samples.filter(sample => sample.adjacentSameSheet.length > 0).length, bandShares },
    walkerSamplesWithProp: props, walkerSamplesWithCloak: cloaks,
    pairs: samples.filter(sample => sample.adjacentSameSheet.length > 0).map(sample => ({ tick: sample.tick, pairs: sample.adjacentSameSheet })),
    scenes: Object.fromEntries(Object.entries(scenes).map(([name, scene]) => [name, { tick: scene!.tick, season: stateCalendar(scene!).season, walkers: scene!.walkers.length }])),
  };
  mkdirSync(join(outDir, "scene"), { recursive: true });
  for (const [name, scene] of Object.entries(scenes)) writeFileSync(join(outDir, "scene", `seed2-${name}.json.gz`), gzipSync(JSON.stringify(scene)));
  writeFileSync(join(outDir, "looks-seed2.json"), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const summary = run(resolve(process.argv[2] ?? join(ROOT, "docs/verification/v2-walkers")));
  const { pairs, ...rest } = summary;
  console.log(JSON.stringify({ ...rest, pairs: pairs.slice(0, 5) }, null, 1));
}
