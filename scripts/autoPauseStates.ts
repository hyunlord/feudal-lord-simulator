// LM-R3 (lord slice LS-2) lord-mode states for the auto-pause's captures and geometry rows (set `slice`,
// src/ui/hud/surfaces.ts): the lord's slice as the lord bot plays it, the screen's auto-pause read after every tick and
// every command as the store does (src/ui/hud/autoPauseModel.ts `autoPauseStep`). Saved:
//  - `pause-due`: a few ticks before the game's first stop (the scene runs time and the game stops by itself);
//  - `pause-due-suit`: the same before the first judgment (its notice links to the suit), after the stop before it;
//  - `pairs/<reason>.before.json` and `.after.json`: the first stop of each reason as the screen met it (the state before
//    the tick or the command, and after; a matter due as `matter-<kind>`), for tests/lordAutoPause.test.ts
//    (AUTO_PAUSE_PAIRS=<out-dir>/pairs).
// The user's ruling (2026-10-09) measured: how often the screen's rule stops a year (once a season at most, the player
// going on at once), the reasons behind each stop, the years the slice covers (its own end) — pause-states.json `summary`.
// Each is checked as the browser plays it (ticks only, no bot): the expected reason must stop it within the window.
// Beside them pause-states.json: each state, and every stop of the bot's game (tick, reason, template), first per reason.
// `--check=<state.json>:<ticks>` (any number): a harness's lord-mode state that runs time — would the auto-pause stop it
// within that many ticks (the slice's live end, the steward's season close)? Written to pause-checks.json.
//   tsx scripts/autoPauseStates.ts <out-dir> [seed=3] [years=20] [--check=<file>:<ticks> …]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 모드 자동 일시정지 상태(scripts/autoPauseStates.ts)", { remote: "scripts/remote/run.sh render-PAUSE-states-<sha7> --light --keep -- node_modules/.bin/tsx scripts/autoPauseStates.ts \"$HOME/fls-slice-end-states\"", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { lordSliceOutcome } from "../src/engine/lordSlice";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { autoPauseMemory, autoPauseStep, seasonKey, seasonPutAway, seasonTurn, type AutoPauseItem, type AutoPauseMemory, type SeasonHold } from "../src/ui/hud/autoPauseModel";

/** How far before the stop a state is taken (at 1× ten ticks a second: the capture sees time run for a few seconds). */
const LEAD_TICKS = [30, 15, 5];
/** How long the check plays a saved state (ticks only, as the browser does). */
const WINDOW_TICKS = 120;

const args = process.argv.slice(2).filter(arg => !arg.startsWith("--check="));
const checks = process.argv.slice(2).filter(arg => arg.startsWith("--check=")).map(arg => arg.slice("--check=".length));
const outArg = args[0];
if (outArg === undefined) throw new Error("usage: tsx scripts/autoPauseStates.ts <out-dir> [seed] [years] [--check=<file>:<ticks>]");
const out: string = outArg;
const seed = Number(args[1] ?? 3);
const years = Number(args[2] ?? 20);
mkdirSync(out, { recursive: true });

// The harnesses' states first (quick): each played as the browser plays it.
const checked = checks.map(check => {
  const at = check.lastIndexOf(":"); const file = check.slice(0, at); const ticks = Number(check.slice(at + 1));
  // A saved envelope holds its state; anything else that is no game state (an index) is skipped.
  const read = JSON.parse(readFileSync(file, "utf8")) as { readonly state?: GameState; readonly buildings?: unknown };
  const game = Array.isArray(read.buildings) ? read as GameState : Array.isArray(read.state?.buildings) ? read.state! : null;
  if (game === null) { process.stderr.write(`check ${file}: not a game state\n`); return { file, ticks, stop: null, skipped: true }; }
  const stop = browserStop(game, ticks);
  process.stderr.write(`check ${file} over ${ticks} ticks: ${stop === null ? "runs on" : `stops at ${stop.tick} for ${stop.reasons.join(", ")}`}\n`);
  return { file, ticks, stop };
});
if (checks.length > 0) writeFileSync(join(out, "pause-checks.json"), JSON.stringify(checked, null, 1));

/** A reason's name: the engine event's reason, or the matter's kind. */
const nameOf = (item: AutoPauseItem): string => item.kind === "event" ? item.event.reason : `matter:${item.matter.kind}`;
const templateOf = (item: AutoPauseItem): string => item.kind === "event" ? item.event.template ?? "petition" : `lordMattersDue.${item.matter.kind}`;
type Stop = { readonly tick: number; readonly reason: string; readonly template: string; readonly by: "tick" | "command"; readonly season: string };
const stops: Stop[] = [];
const found: Record<string, Record<string, unknown>> = {};
const kept: GameState[] = [];
let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed })!;
let memory: AutoPauseMemory = autoPauseMemory(state);
// The screen's season rule (seasonTurn), the player going on at once after each stop (later reasons: added, no stop).
let hold: SeasonHold | null = null;
const screenStops: { readonly tick: number; readonly season: string; readonly year: number; readonly reasons: readonly string[] }[] = [];
let endTick: number | null = null;
mkdirSync(join(out, "pairs"), { recursive: true });
const paired = new Set<string>();
const note = (fresh: readonly AutoPauseItem[], by: Stop["by"], before: GameState, after: GameState) => {
  if (fresh.length === 0) return;
  const season = seasonKey(after);
  const turn = seasonTurn(hold, season, fresh);
  hold = turn.stop ? seasonPutAway(turn.hold) : turn.hold;
  if (turn.stop) screenStops.push({ tick: after.tick, season, year: stateCalendar(after).year, reasons: fresh.map(nameOf) });
  for (const item of fresh) {
    const name = nameOf(item);
    stops.push({ tick: after.tick, reason: name, template: templateOf(item), by, season });
    if (paired.has(name)) continue;
    paired.add(name);
    const file = name.replace(":", "-");
    writeFileSync(join(out, "pairs", `${file}.before.json`), JSON.stringify(before));
    writeFileSync(join(out, "pairs", `${file}.after.json`), JSON.stringify(after));
    writeFileSync(join(out, "pairs", `${file}.json`), JSON.stringify({ by, tick: after.tick, item }));
  }
};
const end = state.tick + years * 4_000;
const started = Date.now();
while (state.tick < end) {
  for (const { command } of lordBotCommands(state)) {
    const next = gameReducer(state, command);
    const step = autoPauseStep(memory, next, state); memory = step.memory; note(step.fresh, "command", state, next);
    state = next;
  }
  const before = state;
  state = advanceTick(state);
  const step = autoPauseStep(memory, state, before); memory = step.memory; note(step.fresh, "tick", before, state);
  kept.push(state); if (kept.length > 40) kept.shift();
  if (endTick === null && lordSliceOutcome(state)?.ended === true) endTick = state.tick;
  if (step.fresh.length > 0) process.stderr.write(`${stateCalendar(state).year} tick ${state.tick}: ${step.fresh.map(item => `${nameOf(item)} (${templateOf(item)})`).join(", ")}\n`);
  if (step.fresh.length > 0) consider(state.tick, step.fresh.map(nameOf));
}

/** The browser's play from a saved state: ticks only; the first stop's reasons, or null. */
function browserStop(from: GameState, ticks = WINDOW_TICKS): { readonly tick: number; readonly reasons: readonly string[] } | null {
  let current = from; let mind = autoPauseMemory(from);
  for (let index = 0; index < ticks; index += 1) {
    const before = current; current = advanceTick(current);
    const step = autoPauseStep(mind, current, before); mind = step.memory;
    if (step.fresh.length > 0) return { tick: current.tick, reasons: step.fresh.map(nameOf) };
  }
  return null;
}
function consider(tick: number, reasons: readonly string[]) {
  const wanted: readonly [string, (reasons: readonly string[]) => boolean][] = [["pause-due", () => true], ["pause-due-suit", list => list.includes("judgment")]];
  const previous = stops.filter(stop => stop.tick < tick).at(-1)?.tick ?? -1;
  for (const [name, wants] of wanted) {
    if (found[name] !== undefined || !wants(reasons)) continue;
    for (const lead of LEAD_TICKS) {
      const candidate = kept.find(entry => entry.tick === tick - lead && entry.tick > previous);
      if (candidate === undefined) continue;
      const stop = browserStop(candidate);
      if (stop === null || !wants(stop.reasons)) continue;
      writeFileSync(join(out, `${name}.json`), JSON.stringify(candidate));
      found[name] = { seed, tick: candidate.tick, year: stateCalendar(candidate).year, stopTick: stop.tick, reasons: stop.reasons };
      process.stderr.write(`${name}: tick ${candidate.tick}, the browser stops at ${stop.tick} for ${stop.reasons.join(", ")}\n`);
      break;
    }
  }
}

// Per year: the screen's stops (at most one a season), the reasons behind them and the later ones added without a stop.
const startYear = stateCalendar(newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed })!).year;
const perYear = Array.from({ length: years }, (_, index) => {
  const year = startYear + index;
  const reasons: Record<string, number> = {};
  for (const stop of stops.filter(entry => Number(entry.season.split(":")[0]) === year)) reasons[stop.reason] = (reasons[stop.reason] ?? 0) + 1;
  return { year, stops: screenStops.filter(stop => stop.year === year).length, reasons, inSlice: endTick === null || year < stateCalendar({ ...state, tick: endTick }).year };
});
const median = (values: readonly number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length === 0 ? 0 : sorted.length % 2 === 1 ? sorted[(sorted.length - 1) / 2]! : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2; };
const slice = perYear.filter(entry => entry.inSlice);
const summary = {
  seed, years, endTick, endYear: endTick === null ? null : stateCalendar({ ...state, tick: endTick }).year, sliceYears: slice.length,
  stops: screenStops.length, reasons: stops.length,
  slice: { median: median(slice.map(entry => entry.stops)), max: Math.max(0, ...slice.map(entry => entry.stops)) },
  all: { median: median(perYear.map(entry => entry.stops)), max: Math.max(0, ...perYear.map(entry => entry.stops)) },
  byReason: stops.reduce<Record<string, number>>((count, stop) => ({ ...count, [stop.reason]: (count[stop.reason] ?? 0) + 1 }), {}),
  byTemplate: stops.reduce<Record<string, number>>((count, stop) => ({ ...count, [stop.template]: (count[stop.template] ?? 0) + 1 }), {}),
};
if (years > 0) writeFileSync(join(out, "pause-states.json"), JSON.stringify({ summary, perYear, screenStops, found, stops, ms: Date.now() - started }, null, 1));
process.stderr.write(`seed ${seed}: ${JSON.stringify(summary)}, ${Date.now() - started} ms\n`);
// years 0: the checks alone.
const missing = years === 0 ? [] : ["pause-due", "pause-due-suit"].filter(name => found[name] === undefined);
if (missing.length > 0) { process.stderr.write(`missing: ${missing.join(", ")}\n`); process.exit(1); }
