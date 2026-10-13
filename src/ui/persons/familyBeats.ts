import { BALANCE } from "../../content/balanceConfig";
import { SCENARIO_COPY } from "../../content/scenario/scenarioCopy.ko";
import type { GameState } from "../../engine/engine.types";
import type { HistoryRecord } from "../../engine/history.types";
import { lordHouse } from "../../engine/lordshipState";
import { currentYear, LORD_FAMILY_TAG } from "../../engine/persons";
import type { Person } from "../../engine/persons.types";
import { lordMode } from "../../engine/townAgency";
import type { StoryBeat } from "../eventStory";
import { recordSentence } from "../legacy/chapterRecords";
import { familyLine, familyPeople, type FamilyPerson } from "./familyNews";
import { FAMILY_NEWS_COPY as COPY } from "./familyNewsCopy.ko";

// LS1-6 (lord-screen-v1.md §3: "영주 집안 출생·사망·혼인 — ③ 가족 칩, 모든 출생·사망"; the user's ruling 2026-10-13): one
// chip for each birth, death and marriage in the lord's family, for the season after it (lord mode). The people are
// named by the ids the engine's records give (KIN-D1, familyNews.ts): `person.died` and `person.married` are read as
// written; the lord's own children have no `person.born` record (the engine's keepLordFamily makes them at the year's
// turn), so a child of the house born this year is read from the persons, its parents by its own ids. Not twice: the
// lord's death that a house change follows is the house card's (houseBeats), the first child of a marriage the lord
// arranged its Wave 40 moment's (lordMomentBeats).

const YEAR = BALANCE.TICKS_PER_YEAR;
const SEASON = YEAR / 4;
const TEMPLATES: ReadonlySet<string> = new Set(["person.born", "person.died", "person.married"]);

export function familyBeats(state: GameState): readonly StoryBeat[] {
  if (!lordMode(state)) return [];
  const houseTag = `lord-house:${lordHouse(state).order}`;
  const people = [...(state.persons?.people ?? []), ...(state.persons?.past ?? [])];
  const ofHouse = (id: string | undefined) => id !== undefined && people.some(person => person.id === id && person.tags.includes(LORD_FAMILY_TAG) && person.tags.includes(houseTag));
  const recent = (state.history?.records ?? []).filter(record => state.tick - record.tick < SEASON && record.tick <= state.tick);
  const succeeded = new Set(recent.filter(record => record.template === "house.succession").map(record => String(record.params?.deceasedId ?? "")));
  const arranged = new Set(recent.filter(record => record.template === "marriage.child_born").map(record => String(record.params?.child ?? "").replace(/^person:/, "")));
  const beats: StoryBeat[] = [];
  const told = new Set<string>();
  for (const record of recent) {
    const subject = record.subject?.type === "person" ? record.subject.id : undefined;
    if (!TEMPLATES.has(record.template) || !ofHouse(subject) || subject === undefined) continue;
    if (record.template === "person.died" && succeeded.has(subject)) continue;
    if (record.template === "person.born" && arranged.has(subject)) continue;
    told.add(subject);
    beats.push(recordBeat(state, record, subject, familyPeople(state, record)));
  }
  // The house's children born this year (at its turn), no record of their own.
  if (state.tick % YEAR < SEASON) {
    const year = currentYear(state);
    for (const child of people) {
      if (child.birthYear !== year || child.motherId === undefined || !ofHouse(child.id) || told.has(child.id) || arranged.has(child.id)) continue;
      beats.push(bornBeat(state, child, year));
    }
  }
  return beats;
}

function recordBeat(state: GameState, record: HistoryRecord, subject: string, people: readonly FamilyPerson[]): StoryBeat {
  const given = (role: FamilyPerson["role"]) => people.find(person => person.role === role)?.given ?? null;
  const first = people[0]?.given ?? "";
  const title = record.template === "person.died" ? COPY.chip.died(given("deceased") ?? first)
    : record.template === "person.married" ? COPY.chip.married(given("groom") ?? given("spouse") ?? first, given("bride"))
    : COPY.chip.born(given("child") ?? first);
  // The people beside the one the title names (the dead's spouse, the one married to).
  const line = familyLine(people, subject, true);
  return { id: `family:${record.id}`, kind: "family_news", illustration: null, tile: null, decision: null, title, line: recordSentence(state, record),
    facts: line === null ? [] : [line], advice: COPY.chip.advice, chronicle: { recordId: record.id, tick: record.tick, label: COPY.openLabel(title) } };
}

function bornBeat(state: GameState, child: Person, year: number): StoryBeat {
  // The child and its parents by the child's own ids (as a `person.born` record would give them).
  const people = familyPeople(state, { template: "person.born", tick: state.tick, subject: { type: "person", id: child.id },
    params: { motherId: child.motherId ?? "", ...(child.fatherId === undefined ? {} : { fatherId: child.fatherId }) } });
  const title = COPY.chip.born(people.find(person => person.role === "child")?.given ?? child.givenName);
  const line = familyLine(people, child.id, true);
  return { id: `family-born:${child.id}`, kind: "family_news", illustration: null, tile: null, decision: null, title,
    line: COPY.chip.bornLine(year, SCENARIO_COPY.seasons[0]), facts: line === null ? [] : [line], advice: COPY.chip.bornAdvice };
}
