import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LORD_SLICE_SCENARIO_ID, PAUSE_REASONS, PAUSE_TEMPLATES, type PauseReason } from "../src/content/lordSliceConfig";
import { SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import type { PauseEvent } from "../src/engine/autoPause";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { AutoPauseNotice } from "../src/ui/hud/AutoPauseNotice";
import { AUTO_PAUSE_COPY } from "../src/ui/hud/autoPauseCopy.ko";
import { autoPauseLines, autoPauseMemory, autoPauseStep, pauseEventKey, type AutoPauseMemory } from "../src/ui/hud/autoPauseModel";
import { recordSentence } from "../src/ui/legacy/chapterRecords";
import { houseChangeView } from "../src/ui/results/houseChange";
import { INITIAL_UI_STATE, type UiState } from "../src/ui/stateMachine/uiStateMachine";
import { SURFACES } from "../src/ui/surfaces.registry";

// LM-R3 (lord slice LS-2): the lord-mode auto-pause, read as the store meets the game — after every command (the store's
// previous render state is then the new state) and after every tick batch (the previous is the state the batch started
// from). The lord bot plays seed 3 from the slice's start into its eighth year: a great person's death (1304), the
// lord's wardship (1305) and the counter that comes in the same tick as the offer (1307). AUTO_PAUSE_PAIRS=<dir> (the
// DGX's `scripts/autoPauseStates.ts` pairs, ~/fls-slice-end-states/pairs) also walks the first stop of every other reason.

type Stop = { readonly before: GameState; readonly after: GameState; readonly by: "tick" | "command"; readonly command?: string; readonly events: readonly PauseEvent[] };
const PLAY_UNTIL = 29_100;

const played = (() => {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 3 })!;
  let memory: AutoPauseMemory = autoPauseMemory(state);
  const stops: Stop[] = [];
  /** Ticks where the town finished a building or began a project of its own, with nothing else of note. */
  const quiet: { readonly before: GameState; readonly after: GameState }[] = [];
  const states: GameState[] = [];
  while (state.tick < PLAY_UNTIL) {
    for (const { command } of lordBotCommands(state)) {
      const next = gameReducer(state, command);
      const step = autoPauseStep(memory, next, next);
      memory = step.memory;
      if (step.fresh.length > 0) stops.push({ before: state, after: next, by: "command", command: command.type, events: step.fresh });
      state = next;
    }
    const before = state;
    state = advanceTick(state);
    const step = autoPauseStep(memory, state, before);
    memory = step.memory;
    if (step.fresh.length > 0) stops.push({ before, after: state, by: "tick", events: step.fresh });
    const built = state.buildings.length > before.buildings.length
      || (state.history?.records ?? []).some(record => record.tick === state.tick && record.template === "agency.project_started");
    const noted = (state.history?.records ?? []).some(record => record.tick === state.tick && PAUSE_TEMPLATES[record.template] !== undefined);
    if (built && !noted && quiet.length < 40) quiet.push({ before, after: state });
    if (state.tick % 4_000 === 0) states.push(state);
  }
  return { stops, quiet, states, last: state };
})();

const stopOf = (reason: PauseReason) => played.stops.find(stop => stop.events.some(event => event.reason === reason));
const roundTrip = (state: GameState): GameState =>
  decodeSave(encodeSave({ state, createdAt: "2026-10-09T00:00:00.000Z", savedAt: "2026-10-09T00:00:00.000Z" }).bytes).envelope.state as GameState;
const primaries = (markup: string) => markup.match(/ui-btn--primary/g)?.length ?? 0;
const notice = (state: GameState, events: readonly PauseEvent[], paused = true, ui: UiState = INITIAL_UI_STATE) =>
  renderToStaticMarkup(createElement(AutoPauseNotice, { state, events, paused, ui, onLord: () => {}, onModal: () => {} }));

test("a tick batch stops on a great person's death and on the lord's inheritance, from the bot's played game", () => {
  const death = stopOf("major_death");
  assert.ok(death !== undefined, "a faction's head died in the first seven years");
  assert.equal(death.by, "tick");
  assert.ok(death.events.some(event => event.template === "faction.leader_succeeded"));
  const inheritance = stopOf("inheritance");
  assert.ok(inheritance !== undefined, "the lord's wardship began");
  assert.equal(inheritance.by, "tick");
  // Every stop is read from a line of that very batch (the engine's reasons), never an older one.
  for (const stop of played.stops) for (const event of stop.events) assert.ok(event.tick > stop.before.tick || stop.by === "command", `${event.reason} at ${event.tick}`);
});

test("a command stops too: the counter comes in the same tick as the offer the lord sent", () => {
  const counter = stopOf("counter_offer");
  assert.ok(counter !== undefined, "the bot proposed at 300d and was countered");
  assert.equal(counter.by, "command");
  assert.equal(counter.command, "propose_marriage");
  assert.equal(counter.after.tick, counter.before.tick, "no tick between the offer and the counter");
  assert.ok(counter.events.every(event => event.tick === counter.after.tick));
});

test("no stop for a house finished or a project begun: the town building itself is not the lord's matter", () => {
  assert.ok(played.quiet.length >= 10, `the town built in the bot's game (${played.quiet.length})`);
  for (const { before, after } of played.quiet) assert.deepEqual(autoPauseStep(autoPauseMemory(before), after, before).fresh, [], `tick ${after.tick}`);
});

test("a load, a new game or the tick going back is no turn: the baseline moves on and nothing stops", () => {
  const inheritance = stopOf("inheritance")!;
  const memory = autoPauseMemory(inheritance.before);
  // The same pair as the store would see it after a load: the state is not the batch's result from the baseline.
  assert.deepEqual(autoPauseStep(memory, inheritance.after, inheritance.after).fresh, []);
  const loaded = roundTrip(inheritance.after);
  const step = autoPauseStep(memory, loaded, loaded);
  assert.deepEqual(step.fresh, []);
  assert.equal(step.memory.baseline, loaded, "the loaded game is the next baseline");
  // A save of the same tick loaded over it (a command's tick, another object): nothing new in it either.
  assert.deepEqual(autoPauseStep(autoPauseMemory(inheritance.after), roundTrip(inheritance.after), inheritance.after).fresh, []);
  // A new game, and an earlier save: the tick goes back.
  const fresh = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 3 })!;
  assert.deepEqual(autoPauseStep(autoPauseMemory(played.last), fresh, fresh).fresh, []);
  assert.deepEqual(autoPauseStep(autoPauseMemory(played.last), played.states[0]!, played.states[0]!).fresh, []);
  // And the game after a load stops again on its own turns.
  assert.ok(autoPauseStep(autoPauseMemory(inheritance.before), inheritance.after, inheritance.before).fresh.length > 0);
});

test("once per record: the same stop never comes twice", () => {
  const death = stopOf("major_death")!;
  const first = autoPauseStep(autoPauseMemory(death.before), death.after, death.before);
  assert.ok(first.fresh.length > 0);
  assert.deepEqual(autoPauseStep(first.memory, death.after, death.before).fresh, [], "the same state again");
  // The baseline set back but the stop remembered (seen by its record): nothing.
  assert.deepEqual(autoPauseStep({ baseline: death.before, seen: first.memory.seen }, death.after, death.before).fresh, []);
  assert.deepEqual([...first.memory.seen], first.fresh.map(pauseEventKey));
  // Across the bot's whole game no record stopped twice.
  const keys = played.stops.flatMap(stop => stop.events.map(pauseEventKey));
  assert.equal(new Set(keys).size, keys.length);
});

test("lord mode only: the sandbox and the campaign never stop", () => {
  const inheritance = stopOf("inheritance")!;
  const { agency: _before, ...sandboxBefore } = inheritance.before;
  const { agency: _after, ...sandboxAfter } = inheritance.after;
  assert.deepEqual(autoPauseStep(autoPauseMemory(sandboxBefore as GameState), sandboxAfter as GameState, sandboxBefore).fresh, []);
  for (const scenarioId of [SANDBOX_SCENARIO_ID]) {
    let state = newGameState({ scenarioId })!; let memory = autoPauseMemory(state);
    for (let index = 0; index < 400; index += 1) { const before = state; state = advanceTick(state); const step = autoPauseStep(memory, state, before); memory = step.memory; assert.deepEqual(step.fresh, []); }
  }
});

test("the notice: the reason's word and the ledger's own sentence, a link where the screen answers it, one primary", () => {
  for (const reason of ["major_death", "inheritance", "counter_offer"] as const) {
    const stop = stopOf(reason)!;
    const events = stop.events.filter(event => event.reason === reason);
    const lines = autoPauseLines(stop.after, events);
    const record = stop.after.history!.records.find(entry => entry.id === events[0]!.recordId)!;
    assert.equal(lines[0]!.word, AUTO_PAUSE_COPY.reasons[reason]);
    assert.equal(lines[0]!.sentence, recordSentence(stop.after, record));
    assert.notEqual(lines[0]!.sentence, "");
    const markup = notice(stop.after, events);
    assert.equal(primaries(markup), 1, reason);
    assert.ok(markup.includes(AUTO_PAUSE_COPY.resume) && markup.includes(AUTO_PAUSE_COPY.title));
    assert.ok(markup.includes(lines[0]!.word) && markup.includes(escape(lines[0]!.sentence)), reason);
    if (reason === "major_death") assert.equal(lines[0]!.link, null, "a death has no screen to answer it");
    if (reason === "counter_offer") {
      assert.deepEqual(lines[0]!.link, { kind: "lord", screen: "marriage", focus: null });
      assert.ok(markup.includes(AUTO_PAUSE_COPY.links.marriage) && markup.includes("auto-pause-link"));
    }
    if (reason === "inheritance") assert.deepEqual(lines[0]!.link, houseChangeView(stop.after) === null ? null : { kind: "modal", modal: "house_change" });
  }
  const death = stopOf("major_death")!;
  assert.equal(notice(death.after, death.events, false), "", "only while time is stopped");
  assert.equal(notice(death.after, death.events, true, { ...INITIAL_UI_STATE, modals: [{ modal: "petition", under: "idle" }] }), "", "not under a modal");
  assert.equal(notice(death.after, death.events, true, { ...INITIAL_UI_STATE, mode: "lord" }), "", "not beside a panel in the slot");
  assert.equal(notice(death.after, []), "");
  // More than four reasons: four lines and the rest counted.
  const many = Array.from({ length: 6 }, (_, index) => ({ ...death.events[0]!, recordId: `${death.events[0]!.recordId}-${index}`, tick: death.events[0]!.tick + index }));
  assert.ok(notice(death.after, many).includes(AUTO_PAUSE_COPY.more(2)));
});

test("the geometry rows: the notice's states in the slice set, time run until it stops", () => {
  const rows = SURFACES.filter(row => row.root === ".auto-pause-notice");
  assert.deepEqual(rows.map(row => row.id), ["hud.auto-pause", "hud.auto-pause.link"]);
  for (const row of rows) {
    assert.ok(row.scene.kind === "state" && row.scene.set === "slice" && row.scene.run === true, row.id);
  }
});

const pairs = process.env.AUTO_PAUSE_PAIRS;
test("every reason's first stop in the bot's twenty years (AUTO_PAUSE_PAIRS)", { skip: pairs === undefined || !existsSync(pairs) ? "AUTO_PAUSE_PAIRS not set" : false }, () => {
  const read = (name: string) => JSON.parse(readFileSync(join(pairs!, name), "utf8")) as GameState;
  const seen: PauseReason[] = [];
  for (const reason of PAUSE_REASONS) {
    if (!existsSync(join(pairs!, `${reason}.json`))) continue;
    seen.push(reason);
    const { by } = JSON.parse(readFileSync(join(pairs!, `${reason}.json`), "utf8")) as { by: "tick" | "command" };
    const before = read(`${reason}.before.json`); const after = read(`${reason}.after.json`);
    const step = autoPauseStep(autoPauseMemory(before), after, by === "tick" ? before : after);
    const events = step.fresh.filter(event => event.reason === reason);
    assert.ok(events.length > 0, reason);
    if (by === "tick") assert.deepEqual(autoPauseStep(autoPauseMemory(before), after, after).fresh, [], `${reason}: as a load, no stop`);
    const line = autoPauseLines(after, events)[0]!;
    assert.equal(line.word, AUTO_PAUSE_COPY.reasons[reason]);
    assert.notEqual(line.sentence, "", reason);
    const record = after.history?.records.find(entry => entry.id === events[0]!.recordId);
    if (reason === "judgment") assert.deepEqual(line.link, { kind: "lord", screen: "ledger", focus: String(record!.params!.suit) });
    if (reason === "estate_gained" || reason === "estate_lost") assert.ok(line.link?.kind === "lord" && (line.link.screen === "ledger" || line.link.screen === "estates"), reason);
    if (reason === "rights_petition" && line.link !== null) assert.equal(line.link.kind, "modal");
    if (reason === "estate_crisis" || reason === "major_death") assert.equal(line.link, null);
    assert.equal(primaries(notice(after, events)), 1, reason);
  }
  process.stderr.write(`auto-pause pairs: ${seen.join(", ")}\n`);
  assert.ok(seen.length >= 7, `the bot's game reaches seven of the eight reasons (${seen.join(", ")})`);
});

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}
