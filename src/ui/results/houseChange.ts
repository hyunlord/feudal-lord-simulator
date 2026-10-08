import { BALANCE } from "../../content/balanceConfig";
import type { GameState } from "../../engine/engine.types";
import type { HistoryRecord } from "../../engine/history.types";
import { lordHouse, lordshipOf } from "../../engine/lordshipState";
import { ageOf, currentYear, manorLord, personById, personDisplayName } from "../../engine/persons";
import { lordMode } from "../../engine/townAgency";
import { recordSentence } from "../legacy/chapterRecords";
import type { LordScreenId } from "../lord/screen/lordScreenTypes";
import { courtLine } from "../lordCardsModel";
import { perState } from "../perState";
import { wave40RecordArt, type Wave40ImageId } from "../wave40Art";
import { RESULTS_COPY } from "./resultsCopy.ko";

// DEC-CARD (Astra A3): a change in the lord's house comes before ordinary petitions, as ONE card — the lord's death, a new
// house, the heir seated, an estate inherited, a wardship begun or ended. Read from the ledger the engine already writes
// (DEC-CARD-2: the engine's succession, `house.succession`; lordshipDrafts' house and wardship lines, legacyDrafts' heir,
// diplomacyDrafts' inheritance) for
// the season after it, as the lord's moments are (lordMomentBeats); the records of one tick are one event, with what the
// same tick wrote about the rights and estates (titles, possessions, a decline, a stewardship begun) and the promises it
// brought. Who leads the house now is the succession's heir (else the engine's `manorLord`), with the wardship's guardian.
// Read once: the card's seen mark is the engine's (`storySeen("house:<id>")`, useStoryPresentation). Lord mode only.
// Its Wave 40 moments (the inheritance, the wardship) are this card's picture, not chips of their own (lordStoryBeats).

const SEASON = BALANCE.TICKS_PER_YEAR / 4;

export type HouseChangeKind = keyof typeof RESULTS_COPY.house.titles;

const HOUSE_TEMPLATES: Readonly<Record<string, HouseChangeKind>> = {
  "house.arrived": "house_changed", "legacy.heir_seated": "heir_seated", "marriage.inherited": "inherited",
  "lord.wardship_begun": "wardship_begun", "lord.wardship_ended": "wardship_ended",
};
/** The card's title is its weightiest change's. */
const WEIGHT: readonly HouseChangeKind[] = ["house_changed", "lord_died", "heir_seated", "inherited", "wardship_begun", "wardship_ended"];
/** The same tick's lines on what changed hands: titles, possessions, a decline, a stewardship begun, the house withdrawn. */
const RIGHTS: ReadonlySet<string> = new Set(["estate.title_changed", "estate.possession_changed", "decline.entered", "decline.recovered", "stewardship.began", "house.withdrew"]);
/** The same tick's lines on who died with it (an inheritance's old lord). */
const CONTEXT: ReadonlySet<string> = new Set(["marriage.father_died", "estate.person_died"]);

/** DEC-CARD-2: the engine's succession (DEC-TRACE §6, `house.succession`): the lord who died and the heir who took the
 * house at that tick, in one record — the lord's death when he died, else the heir seated. */
const SUCCESSION = "house.succession";
const houseKind = (record: HistoryRecord): HouseChangeKind | undefined =>
  record.template === SUCCESSION ? (Number(record.params?.died) === 1 ? "lord_died" : "heir_seated") : HOUSE_TEMPLATES[record.template];

export type HouseChange = Readonly<{
  /** The first house record's id: the event's key (`house:<id>`), never announced twice. */
  id: string;
  tick: number;
  kind: HouseChangeKind;
  /** The house records, and the same tick's lines about rights, estates, deaths and promises. */
  records: readonly HistoryRecord[];
  related: readonly HistoryRecord[];
}>;

/** The season's house changes, one per tick, oldest first (lord mode only). */
export const houseChanges = perState((state: GameState): readonly HouseChange[] => {
  if (!lordMode(state)) return [];
  const records = state.history?.records ?? [];
  const house = new Map<number, { kinds: Set<HouseChangeKind>; records: HistoryRecord[] }>();
  const sameTick = new Map<number, HistoryRecord[]>();
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index]!;
    if (state.tick - record.tick >= SEASON) break;
    const kind = houseKind(record);
    if (kind !== undefined) {
      const entry = house.get(record.tick) ?? { kinds: new Set<HouseChangeKind>(), records: [] };
      entry.kinds.add(kind); entry.records.unshift(record);
      house.set(record.tick, entry);
    } else if (RIGHTS.has(record.template) || CONTEXT.has(record.template) || record.template === "promise.made") {
      const list = sameTick.get(record.tick) ?? [];
      list.unshift(record);
      sameTick.set(record.tick, list);
    }
  }
  return [...house.entries()].sort(([a], [b]) => a - b).map(([tick, entry]) => ({
    id: entry.records[0]!.id, tick, kind: WEIGHT.find(kind => entry.kinds.has(kind))!, records: entry.records, related: sameTick.get(tick) ?? [],
  }));
});

/** The records the house cards stand for (their Wave 40 moments are not chips of their own). */
export const houseRecordIds = perState((state: GameState): ReadonlySet<string> =>
  new Set(houseChanges(state).flatMap(change => change.records.map(record => record.id))));

export type HouseNextAction =
  | Readonly<{ kind: "screen"; screen: LordScreenId; focus: string; label: string }>
  | Readonly<{ kind: "person"; personId: string; label: string }>;

export type HouseChangeView = Readonly<{
  id: string;
  kind: HouseChangeKind;
  title: string;
  court: string;
  illustration: Wave40ImageId | null;
  /** What happened: the deaths, the house's change, the ledger's sentences. */
  happened: readonly string[];
  /** Who leads the house now (the engine's `manorLord`), with the guardian under a wardship. */
  heir: string;
  heirId: string | null;
  /** The rights and estates that changed hands in the same tick, or the line that none did. */
  rights: readonly string[];
  promises: readonly string[];
  next: HouseNextAction | null;
}>;

/** The ledger's sentences, the same one once with its count ("약속을 했다 … (5건)"). */
function counted(state: GameState, records: readonly HistoryRecord[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const record of records) { const line = recordSentence(state, record); counts.set(line, (counts.get(line) ?? 0) + 1); }
  return [...counts].map(([line, count]) => RESULTS_COPY.year.times(line, count));
}

function viewOf(state: GameState, change: HouseChange): HouseChangeView {
  const copy = RESULTS_COPY.house;
  const year = currentYear(state);
  const happened = [
    ...change.related.filter(record => CONTEXT.has(record.template) && (record.template !== "estate.person_died" || record.params?.role === "head"))
      .map(record => recordSentence(state, record)),
    ...change.records.map(record => recordSentence(state, record)),
  ];
  // The heir the succession names (the engine's own reading at that tick), else who leads the manor now.
  const succession = change.records.find(record => record.template === SUCCESSION);
  const named = succession === undefined ? undefined : personById(state, String(succession.params?.heirId ?? ""));
  const lord = named ?? (state.persons === undefined ? undefined : manorLord(state.persons.people, lordHouse(state).order, year));
  const wardship = lordshipOf(state).wardship;
  const guardian = wardship === undefined ? null : wardship.guardianId === null ? copy.guardianOverlord
    : (() => { const person = personById(state, wardship.guardianId); return person === undefined ? copy.guardianOverlord : copy.guardian(personDisplayName(person)); })();
  const heir = lord === undefined ? copy.noLord : guardian === null ? copy.lordNow(personDisplayName(lord), ageOf(lord, year))
    : `${copy.lordNow(personDisplayName(lord), ageOf(lord, year))} · ${guardian}`;
  const rights = counted(state, change.related.filter(record => RIGHTS.has(record.template)));
  // The next act: an estate that changed hands opens the estates screen on it; otherwise the house's lord's card.
  const estate = [...change.records, ...change.related].map(record => record.params?.estate).find((id): id is string => typeof id === "string" && id !== "");
  const next: HouseNextAction | null = estate !== undefined ? { kind: "screen", screen: "estates", focus: estate, label: copy.toEstate }
    : lord === undefined ? null : { kind: "person", personId: lord.id, label: copy.toPerson(personDisplayName(lord)) };
  return {
    id: change.id, kind: change.kind, title: copy.titles[change.kind], court: courtLine(state),
    illustration: change.records.map(record => wave40RecordArt(record)).find((art): art is Wave40ImageId => art !== null) ?? null,
    happened, heir, heirId: lord?.id ?? null,
    rights: rights.length === 0 ? [copy.noRights] : rights,
    promises: counted(state, change.related.filter(record => record.template === "promise.made")),
    next,
  };
}

/** The season's house cards, oldest first; once per state (the chips and the card read the same). */
export const houseChangeViews = perState((state: GameState): readonly HouseChangeView[] => houseChanges(state).map(change => viewOf(state, change)));

/** The card up: the season's latest house change, or null. */
export const houseChangeView = (state: GameState): HouseChangeView | null => houseChangeViews(state).at(-1) ?? null;
