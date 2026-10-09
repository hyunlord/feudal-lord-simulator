import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LORD_SLICE_SCENARIO_ID, PAUSE_REASONS, PAUSE_TEMPLATES, type PauseReason } from "../src/content/lordSliceConfig";
import { SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { advanceTick } from "../src/engine/tick";
import { presentationPreference } from "../src/render/presentationPreferences";
import { PRESENTATION_PREFERENCE_COPY } from "../src/render/presentationPreferenceCopy.ko";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { AutoPauseNotice } from "../src/ui/hud/AutoPauseNotice";
import { AUTO_PAUSE_COPY } from "../src/ui/hud/autoPauseCopy.ko";
import { autoPauseLines } from "../src/ui/hud/autoPauseLines";
import { autoPauseMemory, autoPauseStep, seasonKey, seasonPutAway, seasonTurn, type AutoPauseItem, type AutoPauseMemory, type SeasonHold } from "../src/ui/hud/autoPauseModel";
import { recordSentence } from "../src/ui/legacy/chapterRecords";
import { houseChangeView } from "../src/ui/results/houseChange";
import { INITIAL_UI_STATE, type UiState } from "../src/ui/stateMachine/uiStateMachine";
import { SURFACES } from "../src/ui/surfaces.registry";

// LM-R3 (lord slice LS-2; the user's ruling 2026-10-09): the lord-mode auto-pause, read as the store meets the game —
// after every command (the store's previous render state is then the new state) and after every tick batch (the
// previous is the state the batch started from). It stops only for the engine's big events (`pauseReasons`) and new
// matters due (`lordMattersDue`), once a season. The lord bot plays seed 3 from the slice's start into its eighth year:
// a great person's death (1304), the lord's wardship (1305) and the counter that comes in the same tick as the offer
// (1307). AUTO_PAUSE_PAIRS=<dir> (the DGX's `scripts/autoPauseStates.ts` pairs, ~/fls-slice-end-states/pairs) also walks
// the first stop of every other reason the bot's twenty years reach.

type Stop = { readonly before: GameState; readonly after: GameState; readonly by: "tick" | "command"; readonly command?: string; readonly items: readonly AutoPauseItem[] };
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
      if (step.fresh.length > 0) stops.push({ before: state, after: next, by: "command", command: command.type, items: step.fresh });
      state = next;
    }
    const before = state;
    state = advanceTick(state);
    const step = autoPauseStep(memory, state, before);
    memory = step.memory;
    if (step.fresh.length > 0) stops.push({ before, after: state, by: "tick", items: step.fresh });
    const built = state.buildings.length > before.buildings.length
      || (state.history?.records ?? []).some(record => record.tick === state.tick && record.template === "agency.project_started");
    const noted = (state.history?.records ?? []).some(record => record.tick === state.tick && PAUSE_TEMPLATES[record.template] !== undefined);
    if (built && !noted && quiet.length < 40) quiet.push({ before, after: state });
    if (state.tick % 4_000 === 0) states.push(state);
  }
  return { stops, quiet, states, last: state };
})();

const eventsOf = (items: readonly AutoPauseItem[], reason?: PauseReason) =>
  items.flatMap(item => item.kind === "event" && (reason === undefined || item.event.reason === reason) ? [item] : []);
const stopOf = (reason: PauseReason) => played.stops.find(stop => eventsOf(stop.items, reason).length > 0);
const roundTrip = (state: GameState): GameState =>
  decodeSave(encodeSave({ state, createdAt: "2026-10-09T00:00:00.000Z", savedAt: "2026-10-09T00:00:00.000Z" }).bytes).envelope.state as GameState;
const primaries = (markup: string) => markup.match(/ui-btn--primary/g)?.length ?? 0;
const held = (items: readonly AutoPauseItem[], mode: SeasonHold["mode"] = "stopped"): SeasonHold => ({ season: "s", items, shown: items, mode });
const notice = (state: GameState, hold: SeasonHold | null, paused = true, ui: UiState = INITIAL_UI_STATE) =>
  renderToStaticMarkup(createElement(AutoPauseNotice, { state, hold, paused, ui, onLord: () => {}, onModal: () => {}, onDismiss: () => {} }));

test("a tick batch stops on a great person's death and on the lord's inheritance, from the bot's played game", () => {
  const death = stopOf("major_death");
  assert.ok(death !== undefined, "a faction's head died in the first seven years");
  assert.equal(death.by, "tick");
  assert.ok(eventsOf(death.items).some(item => item.event.template === "faction.leader_succeeded"));
  const inheritance = stopOf("inheritance");
  assert.ok(inheritance !== undefined, "the lord's wardship began");
  assert.equal(inheritance.by, "tick");
  // Every reason is the engine's: an event of that very batch, or a matter due that the state before did not have.
  for (const stop of played.stops) for (const item of stop.items) {
    if (item.kind === "event") assert.ok(item.event.tick > stop.before.tick || stop.by === "command", `${item.event.reason} at ${item.event.tick}`);
    else assert.ok(!autoPauseMemory(stop.before).matters.has(item.key), item.key);
  }
});

test("a command stops too: the counter comes in the same tick as the offer the lord sent", () => {
  const counter = stopOf("counter_offer");
  assert.ok(counter !== undefined, "the bot proposed at 300d and was countered");
  assert.equal(counter.by, "command");
  assert.equal(counter.command, "propose_marriage");
  assert.equal(counter.after.tick, counter.before.tick, "no tick between the offer and the counter");
  assert.ok(eventsOf(counter.items).every(item => item.event.tick === counter.after.tick));
});

test("no stop for a house finished or a project begun: the town building itself is not the lord's matter", () => {
  assert.ok(played.quiet.length >= 10, `the town built in the bot's game (${played.quiet.length})`);
  for (const { before, after } of played.quiet) assert.deepEqual(autoPauseStep(autoPauseMemory(before), after, before).fresh, [], `tick ${after.tick}`);
});

test("a load, a new game or the tick going back is no turn: the baseline moves on, nothing stops, the season's stop is forgotten", () => {
  const inheritance = stopOf("inheritance")!;
  const memory = autoPauseMemory(inheritance.before);
  // The same pair as the store would see it after a load: the state is not the batch's result from the baseline.
  const asLoad = autoPauseStep(memory, inheritance.after, inheritance.after);
  assert.deepEqual(asLoad.fresh, []);
  assert.equal(asLoad.reset, true);
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
  assert.deepEqual(autoPauseStep({ ...autoPauseMemory(death.before), seen: first.memory.seen }, death.after, death.before).fresh, []);
  assert.deepEqual([...first.memory.seen], first.fresh.map(item => item.key));
  // Across the bot's whole game no record stopped twice.
  const keys = played.stops.flatMap(stop => stop.items.map(item => item.key));
  assert.equal(new Set(keys).size, keys.length);
});

test("once a season: the season's first reasons stop; later ones join its list without a second stop, added while time runs", () => {
  const [a, b, c] = [stopOf("major_death")!, stopOf("inheritance")!, stopOf("counter_offer")!].map(stop => stop.items);
  const first = seasonTurn(null, "1304:1", a!);
  assert.equal(first.stop, true);
  assert.equal(first.hold?.mode, "stopped");
  // Still stopped (the player has not gone on): the next reason joins the notice.
  const joined = seasonTurn(first.hold, "1304:1", b!);
  assert.equal(joined.stop, false);
  assert.deepEqual(joined.hold?.shown.map(item => item.key), [...a!, ...b!].map(item => item.key));
  // The player went on (the notice put away); a later reason the same season: no stop, shown as the season's added lines.
  const added = seasonTurn(seasonPutAway(joined.hold), "1304:1", c!);
  assert.equal(added.stop, false);
  assert.equal(added.hold?.mode, "added");
  assert.deepEqual(added.hold?.shown.map(item => item.key), c!.map(item => item.key));
  assert.deepEqual(added.hold?.items.map(item => item.key), [...a!, ...b!, ...c!].map(item => item.key), "the season's list keeps them all");
  // The next season stops again.
  const next = seasonTurn(added.hold, "1304:2", a!);
  assert.equal(next.stop, true);
  assert.deepEqual(next.hold?.items.map(item => item.key), a!.map(item => item.key));
  assert.deepEqual(seasonTurn(next.hold, "1304:2", []), { hold: next.hold, stop: false }, "nothing new: nothing changes");
  // In the bot's game: every stop's season is the state's (the calendar's season), and the screen stops at most once a season.
  const seasons = played.stops.map(stop => seasonKey(stop.after));
  let hold: SeasonHold | null = null; const stopped: string[] = [];
  played.stops.forEach((stop, index) => { const turn = seasonTurn(hold, seasons[index]!, stop.items); hold = turn.stop ? seasonPutAway(turn.hold) : turn.hold; if (turn.stop) stopped.push(seasons[index]!); });
  assert.equal(new Set(stopped).size, stopped.length);
  assert.deepEqual(stopped, [...new Set(seasons)]);
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

test("the player's switch: on by default, beside the event cards' switch in the settings", () => {
  assert.equal(presentationPreference("lordAutoPause"), true);
  assert.notEqual(PRESENTATION_PREFERENCE_COPY.lordAutoPause.on, PRESENTATION_PREFERENCE_COPY.lordAutoPause.off);
  assert.match(readFileSync("src/ui/screens/AppModals.tsx", "utf8"), /<PresentationToggle preference="eventPause" \/><PresentationToggle preference="lordAutoPause" \/>/);
  // Off: the hook keeps reading (so turning it on later stops for nothing old) but neither stops nor shows.
  assert.match(readFileSync("src/ui/hud/useLordAutoPause.ts", "utf8"), /step\.fresh\.length > 0 && presentationPreference\("lordAutoPause"\)/);
});

test("the notice: the reason's word and the ledger's own sentence, a link where the screen answers it, one primary", () => {
  for (const reason of ["major_death", "inheritance", "counter_offer"] as const) {
    const stop = stopOf(reason)!;
    const items = eventsOf(stop.items, reason);
    const lines = autoPauseLines(stop.after, items);
    const record = stop.after.history!.records.find(entry => entry.id === items[0]!.event.recordId)!;
    assert.equal(lines[0]!.word, AUTO_PAUSE_COPY.reasons[reason]);
    assert.equal(lines[0]!.sentence, recordSentence(stop.after, record));
    assert.notEqual(lines[0]!.sentence, "");
    const markup = notice(stop.after, held(items));
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
  // A season's reasons together: one notice, a line each, one primary.
  const death = stopOf("major_death")!; const counter = stopOf("counter_offer")!;
  const together = notice(counter.after, held([...death.items, ...counter.items]));
  assert.equal(primaries(together), 1);
  assert.equal(together.match(/class="auto-pause-line"/g)?.length, death.items.length + counter.items.length);
  // The season's later lines while time runs: their own title, [확인] the one primary (no 계속: time already runs).
  const added = notice(counter.after, held(counter.items, "added"), false);
  assert.ok(added.includes(AUTO_PAUSE_COPY.addedTitle) && added.includes(AUTO_PAUSE_COPY.addedOk) && !added.includes(AUTO_PAUSE_COPY.title));
  assert.equal(primaries(added), 1);
  assert.equal(notice(death.after, held(death.items), false), "", "a stop's notice only while time is stopped");
  assert.equal(notice(death.after, held(death.items), true, { ...INITIAL_UI_STATE, modals: [{ modal: "petition", under: "idle" }] }), "", "not under a modal");
  assert.equal(notice(death.after, held(death.items), true, { ...INITIAL_UI_STATE, mode: "lord" }), "", "not beside a panel in the slot");
  assert.equal(notice(death.after, null), "");
  assert.equal(notice(death.after, seasonPutAway(held(death.items))), "", "put away");
  // More than four reasons: four lines and the rest counted.
  const one = eventsOf(death.items)[0]!;
  const many = Array.from({ length: 6 }, (_, index): AutoPauseItem => ({ kind: "event", key: `${one.key}-${index}`, event: { ...one.event, recordId: `${one.key}-${index}` } }));
  assert.ok(notice(death.after, held(many)).includes(AUTO_PAUSE_COPY.more(2)));
});

test("the geometry rows: the notice's states in the slice set, time run until it stops", () => {
  const rows = SURFACES.filter(row => row.root === ".auto-pause-notice");
  assert.deepEqual(rows.map(row => row.id), ["hud.auto-pause", "hud.auto-pause.link"]);
  for (const row of rows) assert.ok(row.scene.kind === "state" && row.scene.set === "slice" && row.scene.run === true, row.id);
});

const pairs = process.env.AUTO_PAUSE_PAIRS;
test("every reason's first stop in the bot's twenty years (AUTO_PAUSE_PAIRS)", { skip: pairs === undefined || !existsSync(pairs) ? "AUTO_PAUSE_PAIRS not set" : false }, () => {
  const read = (name: string) => JSON.parse(readFileSync(join(pairs!, name), "utf8")) as GameState;
  const seen: string[] = [];
  const names = [...PAUSE_REASONS, ...(["will_change", "contested", "suit_defence", "entry_threat"] as const).map(kind => `matter-${kind}`)];
  for (const name of names) {
    if (!existsSync(join(pairs!, `${name}.json`))) continue;
    seen.push(name);
    const { by } = JSON.parse(readFileSync(join(pairs!, `${name}.json`), "utf8")) as { by: "tick" | "command" };
    const before = read(`${name}.before.json`); const after = read(`${name}.after.json`);
    const step = autoPauseStep(autoPauseMemory(before), after, by === "tick" ? before : after);
    const items = step.fresh.filter(item => item.kind === "event" ? item.event.reason === name : `matter-${item.matter.kind}` === name);
    assert.ok(items.length > 0, name);
    if (by === "tick") assert.deepEqual(autoPauseStep(autoPauseMemory(before), after, after).fresh, [], `${name}: as a load, no stop`);
    const line = autoPauseLines(after, items)[0]!;
    assert.notEqual(line.sentence, "", name);
    const item = items[0]!;
    if (item.kind === "matter") {
      assert.equal(line.word, AUTO_PAUSE_COPY.matters[item.matter.kind]);
      const want = { will_change: "lord", contested: "modal", suit_defence: "lord", entry_threat: "lord", audit: "lord", estate_petition: "lord" }[item.matter.kind];
      assert.equal(line.link?.kind, want, name);
      if (item.matter.kind === "suit_defence" || item.matter.kind === "entry_threat") assert.deepEqual(line.link, { kind: "lord", screen: "ledger", focus: item.matter.id });
    } else {
      const reason = item.event.reason;
      assert.equal(line.word, AUTO_PAUSE_COPY.reasons[reason]);
      const record = after.history?.records.find(entry => entry.id === item.event.recordId);
      if (reason === "judgment") assert.deepEqual(line.link, { kind: "lord", screen: "ledger", focus: String(record!.params!.suit) });
      if (reason === "estate_gained" || reason === "estate_lost") assert.ok(line.link?.kind === "lord" && (line.link.screen === "ledger" || line.link.screen === "estates"), reason);
      if (reason === "rights_petition" && line.link !== null) assert.equal(line.link.kind, "modal");
      if (reason === "estate_crisis" || reason === "major_death") assert.equal(line.link, null);
    }
    assert.equal(primaries(notice(after, held(items))), 1, name);
  }
  process.stderr.write(`auto-pause pairs: ${seen.join(", ")}\n`);
  assert.ok(seen.filter(name => !name.startsWith("matter-")).length >= 7, `the bot's game reaches seven of the eight events (${seen.join(", ")})`);
});

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}
