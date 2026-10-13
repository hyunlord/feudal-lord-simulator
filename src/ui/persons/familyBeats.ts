import { BALANCE } from "../../content/balanceConfig";
import type { GameState } from "../../engine/engine.types";
import type { HistoryRecord } from "../../engine/history.types";
import { lordHouse } from "../../engine/lordshipState";
import { LORD_FAMILY_TAG } from "../../engine/persons";
import { lordMode } from "../../engine/townAgency";
import type { StoryBeat } from "../eventStory";
import { recordSentence } from "../legacy/chapterRecords";
import { familyLine, familyPeople, type FamilyPerson } from "./familyNews";
import { FAMILY_NEWS_COPY as COPY } from "./familyNewsCopy.ko";

// LS1-6 (lord-screen-v1.md §3: "영주 집안 출생·사망·혼인 — ③ 가족 칩, 모든 출생·사망"; the user's ruling 2026-10-13): one
// chip for each birth, death and marriage in the lord's family, for the season after it (lord mode) — the engine's
// `person.born`, `person.died` and `person.married` records, their people named by the ids the records give (KIN-D1,
// familyNews.ts). Not twice: the lord's death that a house change follows is the house card's (houseBeats), the first
// child of a marriage the lord arranged its Wave 40 moment's (lordMomentBeats).

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
  for (const record of recent) {
    const subject = record.subject?.type === "person" ? record.subject.id : undefined;
    if (!TEMPLATES.has(record.template) || !ofHouse(subject) || subject === undefined) continue;
    if (record.template === "person.died" && succeeded.has(subject)) continue;
    if (record.template === "person.born" && arranged.has(subject)) continue;
    beats.push(recordBeat(state, record, subject, familyPeople(state, record)));
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
