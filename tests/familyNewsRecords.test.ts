/**
 * PLAY-2 §4 (renderer A's request docs/requests/engine-play2-reads.md §4, friction 9; the engine's GROW-BLOCK records):
 * the family news names the people the engine's records now give — a marriage's two (`person.married` spouseId), the
 * spouse a death leaves (`person.died` spouseId), the first child and its father (`marriage.child_born` child, father) —
 * on the lord bot's own game (seed 3 into its first child, 1308), and agrees with the engine's parents
 * (`persons.parents`) on Astra's lordplay2 saves. Records written before the ids name only what they gave.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import type { HistoryRecord } from "../src/engine/history.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { personById, personDisplayName } from "../src/engine/persons";
import { personParents } from "../src/engine/personsApi";
import { advanceTick } from "../src/engine/tick";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { biographyView } from "../src/ui/chronicle/chronicleScreenModel";
import { chronicleRecordCard } from "../src/ui/chronicle/decisionThreadModel";
import { timelineView } from "../src/ui/lord/negotiation/negotiationModel";
import { lordMomentBeats } from "../src/ui/lordMomentBeats";
import { familyPeople } from "../src/ui/persons/familyNews";

/** The lord bot's seed 3 played until the marriage's first child is recorded. */
const town = (() => {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 3 })!;
  while (state.tick < 40_000 && !(state.history?.records ?? []).some(record => record.template === "marriage.child_born")) {
    for (const { command } of lordBotCommands(state)) state = gameReducer(state, command);
    state = advanceTick(state);
  }
  return state;
})();

const records = (template: string) => (town.history?.records ?? []).filter(record => record.template === template);
const roles = (state: GameState, record: Pick<HistoryRecord, "template" | "params" | "tick" | "subject">) =>
  familyPeople(state, record).map(person => [person.role, person.personId]);
const name = (id: string) => personDisplayName(personById(town, id) ?? town.persons!.past.find(person => person.id === id)!);
const older = (record: HistoryRecord, ...keys: string[]): HistoryRecord =>
  ({ ...record, params: Object.fromEntries(Object.entries(record.params ?? {}).filter(([key]) => !keys.includes(key))) });

test("a marriage names its two, the groom first: the one married in and the household's head (person.married spouseId)", () => {
  const married = records("person.married").filter(record => record.params?.spouseId !== undefined);
  assert.ok(married.length > 0, "the town's weddings carry the head they married");
  for (const record of married) {
    const people = familyPeople(town, record);
    const ids = [record.subject!.id, String(record.params!.spouseId)];
    assert.deepEqual(people.map(person => person.personId).sort(), ids.filter(id => personById(town, id) !== undefined || town.persons!.past.some(person => person.id === id)).sort());
    assert.ok(people.every(person => person.role === "groom" || person.role === "bride"));
    assert.ok(people.length < 2 || (people[0]!.role === "groom" && people[1]!.role === "bride"), JSON.stringify(people));
  }
  const record = married.find(entry => familyPeople(town, entry).length === 2)!;
  const card = chronicleRecordCard(town, { key: record.id, tick: record.tick, record, bundle: null });
  const spouse = String(record.params!.spouseId);
  assert.ok(card.sentence.includes(name(spouse)), card.sentence);
  // An older record (no spouseId): the one married in alone, as before.
  assert.deepEqual(roles(town, older(record, "spouseId")), [["spouse", record.subject!.id]]);
});

test("a death names the spouse left (person.died spouseId): the chronicle's line ends with the spouse", () => {
  const died = records("person.died").filter(record => record.params?.spouseId !== undefined);
  assert.ok(died.length > 0, "a head or a spouse died in the bot's game");
  const record = died[0]!;
  const spouse = String(record.params!.spouseId);
  assert.deepEqual(roles(town, record), [["deceased", record.subject!.id], ["spouse", spouse]]);
  const card = chronicleRecordCard(town, { key: record.id, tick: record.tick, record, bundle: null });
  assert.ok(card.sentence.endsWith(`배우자 ${name(spouse)}`), card.sentence);
  assert.ok(!card.sentence.includes(`고인 `), "the card's own person is not named again");
  assert.deepEqual(roles(town, older(record, "spouseId")), [["deceased", record.subject!.id]]);
});

test("the marriage's first child: the child, the bride and the groom named, as the engine's parents of that child", () => {
  const [record] = records("marriage.child_born");
  assert.ok(record !== undefined, "the bot's marriage had its first child");
  const child = String(record.params!.child);
  const parents = personParents(town, child);
  assert.deepEqual(roles(town, record), [["child", child], ["mother", parents.mother!.id], ["father", parents.father!.id]]);
  assert.equal(parents.father!.id, String(record.params!.father));
  assert.equal(parents.mother!.id, String(record.params!.bride));
  // The lord's moment (its chip's card) names all three by their given names, the marriage's timeline by their whole names.
  const people = familyPeople(town, record);
  const beat = lordMomentBeats(town, null).find(entry => entry.id === `lord-moment:${record.id}`)!;
  assert.equal(beat.facts[0], `아이 ${people[0]!.given} · 어머니 ${people[1]!.given} · 아버지 ${people[2]!.given}`);
  assert.ok(people.every(person => person.given !== "" && name(person.personId).includes(person.given)));
  const timeline = timelineView(town, town.diplomacy!.marriage!).events.find(event => event.key === "child_born")!;
  assert.ok(timeline.text.endsWith(`아이 ${name(child)} · 어머니 ${name(parents.mother!.id)} · 아버지 ${name(parents.father!.id)}`), timeline.text);
  // The biography's parents are the same two.
  const lines = biographyView(town, child)!.relations.map(relation => relation.line);
  assert.ok(lines.includes(`아버지 ${name(parents.father!.id)}`) && lines.includes(`어머니 ${name(parents.mother!.id)}`), lines.join(" | "));
  // An older record names only the bride: no child, no father guessed.
  assert.deepEqual(roles(town, older(record, "child", "father")), [["mother", parents.mother!.id]]);
});

function astraSave(file: "manual-final.savebin" | "indexedDB-1306-recovery-source.json"): GameState {
  const raw = gunzipSync(readFileSync(`docs/qa/lordplay2-20261008/saves/${file}.gz`));
  const bytes = file.endsWith(".json")
    ? new Uint8Array(Buffer.from((JSON.parse(raw.toString("utf8")) as { stores: { name: string; records: { value: { data: string } }[] }[] }).stores.find(store => store.name === "slots")!.records[0]!.value.data, "base64"))
    : new Uint8Array(raw);
  return decodeSave(bytes).envelope.state as GameState;
}

test("Astra's lordplay2 saves (captures 070/127): every birth's news and every biography's parents are the engine's", () => {
  for (const file of ["indexedDB-1306-recovery-source.json", "manual-final.savebin"] as const) {
    const save = astraSave(file);
    const everyone = [...save.persons!.people, ...save.persons!.past];
    let births = 0;
    for (const record of save.history!.records) {
      if (record.template !== "person.born" || record.subject?.type !== "person") continue;
      births += 1;
      const parents = personParents(save, record.subject.id);
      const people = familyPeople(save, record);
      assert.equal(people.find(person => person.role === "mother")?.personId ?? null, parents.mother?.id ?? null, `${file} ${record.id}`);
      assert.equal(people.find(person => person.role === "father")?.personId ?? null, parents.father?.id ?? null, `${file} ${record.id}`);
    }
    assert.ok(births > 50, `${file}: ${births} births`);
    for (const person of everyone) {
      const view = biographyView(save, person.id);
      if (view === null) continue;
      const parents = personParents(save, person.id);
      const named = view.relations.filter(relation => /^(아버지|어머니|부모) /.test(relation.line)).map(relation => relation.id).sort();
      assert.deepEqual(named, [parents.father?.id, parents.mother?.id].filter((id): id is string => id !== undefined).sort(), `${file} ${person.id}`);
      // A sibling shares a parent with them (the engine's): the kinsman's son is not the lord's children's brother.
      for (const relation of view.relations.filter(entry => entry.line.startsWith("형제자매 "))) {
        const other = everyone.find(entry => entry.id === relation.id)!;
        assert.ok([other.fatherId, other.motherId].some(id => id !== undefined && (id === parents.father?.id || id === parents.mother?.id)), `${file} ${person.id} ${relation.line}`);
      }
    }
  }
  // Nicholas (capture 070's child, 127's tree): Adam's and Agnes's son on every screen.
  const final = astraSave("manual-final.savebin");
  const nicholas = biographyView(final, "m-000006")!;
  const parents = personParents(final, "m-000006");
  assert.deepEqual([parents.father?.id, parents.mother?.id], ["m-000005", "est-000002"]);
  assert.ok(!nicholas.relations.some(relation => relation.line.startsWith("형제자매 ")), nicholas.relations.map(relation => relation.line).join(" | "));
});
