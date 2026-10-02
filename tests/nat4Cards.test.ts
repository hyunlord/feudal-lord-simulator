import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { GameState } from "../src/engine/engine.types";
import { MASTER_TRADES, personById } from "../src/engine/persons";
import type { Person } from "../src/engine/persons.types";
import { advanceTick } from "../src/engine/tick";
import { decodeSave } from "../src/save/saveCodec";
import { biographyView } from "../src/ui/chronicle/chronicleScreenModel";
import { CHRONICLE_SCREEN_COPY } from "../src/ui/chronicle/chronicleScreenCopy.ko";
import { EventCardDetail } from "../src/ui/hud/EventCards";
import { textCut } from "../src/ui/hud/textCut";
import { petitionPresentation } from "../src/ui/petitionPresentation";
import { personCardView, personRow, petitionerRows } from "../src/ui/persons/personModels";
import { PERSONS_COPY } from "../src/ui/persons/personsCopy.ko";
import type { StoryBeat } from "../src/ui/eventStory";
import { BALANCE } from "../src/content/balanceConfig";
import type { GameSpeed } from "../src/engine/engine.types";
import { SPEED_STEPS, speedStepOf } from "../src/input/inputIntent";

// NAT-4 cards: "더 보기" only when something is cut (QA-022), the population drawer's height (QA-028), the outside
// leaders' Korean titles (QA-014), a petition never showing a dead representative (QA-036).

const LATIN = /[A-Za-z]/;

test("QA-022 a clamped text is cut only when it holds more than its box shows (1 px of rounding is not a cut)", () => {
  assert.equal(textCut(null), false);
  assert.equal(textCut({ scrollHeight: 39, clientHeight: 39, scrollWidth: 300, clientWidth: 300 }), false, "one short sentence");
  assert.equal(textCut({ scrollHeight: 79, clientHeight: 78, scrollWidth: 300, clientWidth: 300 }), false, "sub-pixel line boxes");
  assert.equal(textCut({ scrollHeight: 117, clientHeight: 78, scrollWidth: 300, clientWidth: 300 }), true, "a body past four lines");
  assert.equal(textCut({ scrollHeight: 25, clientHeight: 25, scrollWidth: 412, clientWidth: 330 }), true, "an ellipsis title");
});

test("QA-022 the card shows no \"더 보기\" until a measure finds a cut (the first winter's one line had a button that did nothing)", () => {
  const beat: StoryBeat = { id: "first_winter", kind: "first_winter", illustration: "event_first_winter", title: "첫 겨울", line: "겨울이 옵니다.", facts: [], advice: "",
    tile: null, decision: null };
  const markup = renderToStaticMarkup(createElement(EventCardDetail, { open: beat, onDismiss: () => undefined, onDecide: () => undefined }));
  assert.match(markup, /event-card-line--clamped/);
  assert.doesNotMatch(markup, /event-card-more/);
});

test("QA-028 the HUD's population drawer has the slot's height: the court ledger's bottom rule is undone where the slot sets its top", () => {
  const css = readFileSync("src/styles/hudShell.css", "utf8");
  const rule = css.match(/\.app-shell \.ledger-population-drawer\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /top:\s*var\(--hud-right-top\)/);
  assert.match(rule, /bottom:\s*auto/, "top and the court ledger's bottom: calc(100% + 8px) left 0 px for the records (the 22 px band)");
});

const load = (name: string) => decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v43/${name}.save.json`))).envelope.state as GameState;

test("QA-014 every occupation the engine gives a person, and the outside leaders' card and biography roles, are Korean", () => {
  const occupations = new Set(["king", "earl", "bishop", "lord", "lady", "steward", ...Object.values(MASTER_TRADES).map(trade => trade.occupation)]);
  for (const occupation of occupations) {
    assert.doesNotMatch(PERSONS_COPY.occupation(occupation), LATIN, occupation);
    assert.doesNotMatch(CHRONICLE_SCREEN_COPY.role("head", PERSONS_COPY.occupation(occupation)), LATIN, occupation);
  }
  const state = load("chapter-five-town");
  const everyone: readonly Person[] = [...state.persons!.people, ...state.persons!.past, ...(state.factions?.people ?? [])];
  const king = state.factions!.people.find(person => person.occupation === "king")!;
  assert.equal(personCardView(state, king.id)!.role, "국왕", "an outsider by his title alone, not 가구주 · 국왕");
  assert.equal(biographyView(state, king.id)!.role, "국왕");
  for (const person of everyone) {
    assert.doesNotMatch(personCardView(state, person.id)!.role, LATIN, `${person.id} ${person.occupation}`);
    assert.doesNotMatch(personRow(state, person).line, LATIN, `${person.id} ${person.occupation}`);
  }
  // The biography reads the history per person: one of each occupation (the outsiders all).
  const sample = [...new Map(everyone.map(person => [person.householdId.startsWith("faction:") ? person.id : person.occupation, person])).values()];
  for (const person of sample) {
    const biography = biographyView(state, person.id);
    if (biography !== null) assert.doesNotMatch(biography.role, LATIN, `${person.id} ${person.occupation}`);
  }
});

/** QA-036's save (round 16): chapter 3 at 1348, played on to the 1349 wage petition (196000) and two ticks past. */
function wages(): { readonly state: GameState; readonly petition: NonNullable<GameState["politics"]>["petitions"][number] } {
  let state = decodeSave(gunzipSync(readFileSync("docs/qa/round16/repro/saves/chapter3-plague1348.json.gz"))).envelope.state;
  while (state.tick < 196002) state = advanceTick(state);
  return { state, petition: state.politics!.petitions.find(entry => entry.defId === "wages" && entry.response === undefined)! };
}

const living = (state: GameState, id: string) => { const person = personById(state, id); return person !== undefined && person.alive && person.leftYear === undefined; };
const kill = (state: GameState, id: string): GameState => {
  const person = state.persons!.people.find(entry => entry.id === id)!;
  return { ...state, persons: { ...state.persons!, people: state.persons!.people.filter(entry => entry.id !== id),
    past: [...state.persons!.past, { ...person, alive: false, deathYear: 1349, deathCause: "plague" }] } };
};
const withLeader = (state: GameState, factionId: string, leaderId: string): GameState =>
  ({ ...state, factions: { ...state.factions!, factions: state.factions!.factions.map(entry => entry.id === factionId ? { ...entry, leaderId } : entry) } });

test("QA-036 the 1349 wage petition shows only the living: its sender's leader and every representative", () => {
  const { state, petition } = wages();
  const from = petitionPresentation(state, petition).from!;
  assert.ok(from.leader !== null && living(state, from.leader.id), "the commons' leader lives");
  assert.ok(petitionerRows(state, petition).every(row => living(state, row.id)));
});

test("QA-036 a dead leader the faction still names is followed through FIX-12's faction.leader_succeeded line to his successor", () => {
  const { state, petition } = wages();
  const from = petitionPresentation(state, petition).from!;
  const line = state.history!.records.filter(record => record.template === "faction.leader_succeeded" && record.params?.faction === from.factionId).at(-1)!;
  const predecessor = String(line.params!.predecessorId);
  assert.ok(!living(state, predecessor), "the predecessor died on the death day");
  // The round 16 head (before FIX-12) still named him at 196002.
  const stale = withLeader(state, from.factionId, predecessor);
  assert.equal(petitionPresentation(stale, petition).from!.leader!.id, String(line.params!.leaderId));
});

test("QA-036 a leader dead before the engine names a successor shows no chip; a dead representative's id shows no row", () => {
  const { state, petition } = wages();
  const leaderId = petitionPresentation(state, petition).from!.leader!.id;
  const dead = kill(state, leaderId);
  assert.equal(petitionPresentation(dead, petition).from!.leader, null);
  const first = petition.petitionerIds![0]!;
  const gone = kill(state, first);
  const rows = petitionerRows(gone, petition);
  assert.ok(!rows.some(row => row.id === first), "a representative dead before the engine names the next is not shown");
  assert.ok(rows.every(row => living(gone, row.id)));
});

test("NAT-4 (FIX-13) every game speed has its step, 10x the last: its seal sets 10x, not 1x (an unknown speed's step)", () => {
  const speeds: readonly GameSpeed[] = [0, 1, 3, 5, 10];
  assert.deepEqual([...SPEED_STEPS], speeds);
  for (const speed of speeds) assert.equal(SPEED_STEPS[speedStepOf(speed)], speed);
  assert.equal(BALANCE.TICKS_PER_SECOND * SPEED_STEPS.at(-1)!, 100, "10x is 100 ticks a second");
});
