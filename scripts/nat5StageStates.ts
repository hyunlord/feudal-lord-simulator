// NAT-5 stages gate states (Wave 42 land stages, docs/design/living-growth.md LG-3): the forest-edge town of the LAND-UI
// gate (scripts/landStates.ts grownLand: seed 1, the guardrail bot from a new game) to `ticks`, then mid-summer and
// mid-winter of `years` more years, so the engine's own felled trees (stump, sapling, grown), footpaths and fallow are
// on the map at each stage. At the first summer, when the town has fewer than FALLOW_WANTED abandoned cells, a field is
// painted (`zone_paint` arable) on open grass beyond every farmstead's tending reach — a field nobody tends, which the
// engine lists as fallow at the next year (grass, then scrub, then saplings); from then the town runs on without the bot
// (its builders would otherwise tend the field). Each state is a current-format bare state `<name>.json`; manifest.json
// lists per state its tick, season, the land's counts and the painted field.
//   npx tsx scripts/nat5StageStates.ts <out-dir> [ticks=30000] [years=3]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { ARABLE_CONFIG } from "../src/content/arableConfig";
import type { GameState } from "../src/engine/engine.types";
import { fallowStage, landOf, treeStage } from "../src/engine/land";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { createAutoplayTraceDriver } from "./economyHarnessAutoplay";
import { nextSeasonTick, SEASON_TICK, townCentre } from "./landStates";

const [out, ticksArg, yearsArg] = process.argv.slice(2);
if (out === undefined) throw new Error("usage: nat5StageStates.ts <out-dir> [ticks] [years]");
mkdirSync(out, { recursive: true });
const ticks = Number(ticksArg ?? 30_000);
const years = Number(yearsArg ?? 3);
const FALLOW_WANTED = 6;
const FIELD = { width: 6, height: 4 };

const started = Date.now();
let state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: "core:forest_edge", seed: 1 });
if (state === null) throw new Error("no new game on core:forest_edge");
const driver = createAutoplayTraceDriver();
let bot = true;
const runTo = (tick: number) => { while (state!.tick < tick) state = advanceTick(bot ? driver.apply(state!) : state!); };
const manifest: Record<string, unknown> = {};
let field: { readonly tx: number; readonly ty: number; readonly width: number; readonly height: number } | null = null;

/** An all-grass open box nearest the town centre, every cell beyond the farmsteads' tending reach (+2). */
function openField(at: GameState): typeof field {
  const centre = townCentre(at);
  const farmsteads = at.buildings.filter(building => building.kind === "farmstead");
  const zoned = new Set((at.zones ?? []).flatMap(zone => zone.membership));
  const candidates: { tx: number; ty: number; distance: number }[] = [];
  for (let ty = 2; ty + FIELD.height < at.height - 2; ty += 1) for (let tx = 2; tx + FIELD.width < at.width - 2; tx += 1) {
    let ok = true;
    for (let dy = -1; ok && dy <= FIELD.height; dy += 1) for (let dx = -1; ok && dx <= FIELD.width; dx += 1) {
      const cell = (ty + dy) * at.width + tx + dx; const tile = at.tiles[cell]!;
      if (tile.terrain !== "grass" || tile.hasRoad || tile.buildingId !== null || zoned.has(cell)) ok = false;
    }
    if (!ok || farmsteads.some(farm => Math.abs(farm.tx - tx) + Math.abs(farm.ty - ty) <= ARABLE_CONFIG.tendRadius + FIELD.width + 2)) continue;
    candidates.push({ tx, ty, distance: Math.hypot(tx - centre.tx, ty - centre.ty) });
  }
  const best = candidates.sort((a, b) => a.distance - b.distance || a.ty - b.ty || a.tx - b.tx)[0];
  return best === undefined ? null : { tx: best.tx, ty: best.ty, ...FIELD };
}

function save(name: string): void {
  const land = landOf(state!);
  const felled: Record<string, number> = {};
  for (const harvest of state!.forestHarvests ?? []) felled[treeStage(harvest, state!.tick)] = (felled[treeStage(harvest, state!.tick)] ?? 0) + 1;
  const fallow: Record<string, number> = {};
  for (const [, since] of land.fallow) fallow[fallowStage(since, state!.tick)] = (fallow[fallowStage(since, state!.tick)] ?? 0) + 1;
  const calendar = stateCalendar(state!);
  manifest[name] = { tick: state!.tick, year: calendar.year, season: calendar.season, footpaths: land.footpaths.length, fallow, felled,
    centre: townCentre(state!), field, bot };
  writeFileSync(join(out!, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name}: tick ${state!.tick} ${JSON.stringify(manifest[name])} (${Math.round((Date.now() - started) / 1000)} s)\n`);
}

runTo(nextSeasonTick(ticks, SEASON_TICK.summer));
save("forest-y0-summer");
if (landOf(state).fallow.length < FALLOW_WANTED) {
  field = openField(state);
  if (field !== null) {
    const { tx, ty, width, height } = field;
    const painted = gameReducer(state, { type: "zone_paint", kind: "arable",
      stroke: { tool: "polygon", points: [{ x: tx, y: ty }, { x: tx + width, y: ty }, { x: tx + width, y: ty + height }, { x: tx, y: ty + height }] } });
    if (painted === state) throw new Error(`zone_paint refused at ${tx},${ty}`);
    state = painted;
    bot = false;
  }
}
runTo(nextSeasonTick(state.tick, SEASON_TICK.winter));
save("forest-y0-winter");
for (let year = 1; year <= years; year += 1) {
  runTo(nextSeasonTick(state.tick, SEASON_TICK.summer));
  save(`forest-y${year}-summer`);
  runTo(nextSeasonTick(state.tick, SEASON_TICK.winter));
  save(`forest-y${year}-winter`);
}
writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
