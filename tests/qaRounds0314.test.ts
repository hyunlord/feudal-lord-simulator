/** QA rounds 3–14, the engine's part (docs/qa/round03-14, triage 2026-10-01): QA030, QA032, QA010. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { GameState } from "../src/engine/engine.types";
import { personDisplayName, settlePairEpithets } from "../src/engine/persons";
import { markChapterPageSeen } from "../src/engine/politics";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { migrateV38ToV39 } from "../src/save/migrations/v38ToV39";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { gameReducer } from "../src/state/gameStore";
import { foodDays } from "../src/ui/hud/statusPillModel";

const load = (name: string, version = SAVE_SCHEMA_VERSION): GameState =>
  decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v${version}/${name}.save.json`))).envelope.state as GameState;
const at = "2026-10-01T00:00:00.000Z";

test("QA030 a save's round trip is exact in chapters 1–5: the state loaded is the state saved, and so are its food days", () => {
  for (const name of ["new-game", "chapter-two-town", "chapter-three-town", "chapter-four-town", "chapter-five-town"]) {
    let state = load(name);
    // Mid-season, with carts on the roads and bread on its way to the homes.
    for (let step = 0; step < 337; step += 1) state = advanceTick(state);
    const loaded = decodeSave(encodeSave({ state, createdAt: at, savedAt: at }).bytes).envelope.state as GameState;
    assert.deepStrictEqual(loaded, state, name);
    assert.equal(foodDays(loaded), foodDays(state), name);
    // And it goes on the same way.
    let a = state, b = loaded;
    for (let step = 0; step < 120; step += 1) { a = advanceTick(a); b = advanceTick(b); }
    assert.deepStrictEqual(b, a, `${name} 120 ticks on`);
  }
});

test("QA032 a chapter's page seen is kept in the save; a v38 save marks every chapter end before its own tick as seen", () => {
  const five = load("chapter-five-town");
  const ends = five.politics!.chapterEnds;
  assert.deepEqual(ends.map(end => end.seenTick === undefined), [false, false, false, true], "the ends before the save's tick are seen; the one on it is not");
  const seen = gameReducer(five, { type: "mark_chapter_page_seen", chapter: 4 });
  assert.equal(seen.politics!.chapterEnds.find(end => end.chapter === 4)!.seenTick, five.tick);
  assert.equal(markChapterPageSeen(seen, 4), seen, "once");
  const reloaded = decodeSave(encodeSave({ state: seen, createdAt: at, savedAt: at }).bytes).envelope.state as GameState;
  assert.equal(reloaded.politics!.chapterEnds.find(end => end.chapter === 4)!.seenTick, five.tick, "the save keeps it");
  const v38 = JSON.parse(readFileSync("fixtures/saves/v38/chapter-five-town.save.json", "utf8")) as { state: GameState };
  const migrated = (migrateV38ToV39(v38) as { state: GameState }).state;
  assert.deepEqual(migrated.politics!.chapterEnds.map(end => end.seenTick), [69_500, 160_000, 248_000, undefined]);
});

test("QA010 the namesakes' pair bynames: a lone survivor loses its byname, a pair out of age order is turned round, both read 큰/작은", () => {
  const town = load("chapter-five-town");
  const people = town.persons!.people;
  const old = people.find(person => person.birthYear < 1360 && person.epithet === undefined)!;
  const young = people.find(person => person.birthYear > old.birthYear + 20 && person.epithet === undefined && person.id !== old.id)!;
  // The 82-year-old "the younger" whose elder namesake is gone (QA010): no namesake left, no byname.
  const lone = { ...old, givenName: "Thomas", surname: "Qa-Miller", epithet: "the younger" };
  // A pair turned round: the older holds "the younger".
  const elder = { ...old, id: `${old.id}-x`, givenName: "John", surname: "Qa-Ward", epithet: "the younger" };
  const younger = { ...young, givenName: "John", surname: "Qa-Ward", epithet: "the elder" };
  const settled = settlePairEpithets([lone, elder, younger, ...people.filter(person => person.id !== old.id && person.id !== young.id)]);
  assert.equal(settled.find(person => person.id === lone.id)!.epithet, undefined);
  assert.equal(settled.find(person => person.id === elder.id)!.epithet, "the elder");
  assert.equal(settled.find(person => person.id === younger.id)!.epithet, "the younger");
  assert.match(personDisplayName(settled.find(person => person.id === elder.id)!), /^큰 /);
  assert.match(personDisplayName(settled.find(person => person.id === younger.id)!), /^작은 /);
  // The v39 migration settles a v38 save's people the same way.
  const v38 = JSON.parse(readFileSync("fixtures/saves/v38/chapter-five-town.save.json", "utf8")) as { state: GameState };
  const injected = { ...v38, state: { ...v38.state, persons: { ...v38.state.persons!, people: [lone, ...v38.state.persons!.people.filter(person => person.id !== old.id)] } } };
  const migrated = (migrateV38ToV39(injected) as { state: GameState }).state;
  assert.equal(migrated.persons!.people.find(person => person.id === lone.id)!.epithet, undefined);
});
