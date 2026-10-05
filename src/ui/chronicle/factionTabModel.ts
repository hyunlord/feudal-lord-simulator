import { FACTION_AFFAIR_LINES, FACTION_KIND_NAMES, FACTION_LEADER_LINES, factionDisplayName, WORLD_EVENT_LINES } from "../../content/factionCopy.ko";
import type { FactionId } from "../../content/factionConfig";
import type { GameState } from "../../engine/engine.types";
import type { FactionTimelineEntry, FactionView } from "../../engine/faction.types";
import { factionChronicle, factionsList, worldTimeline } from "../../engine/factions";
import { history } from "../../engine/history";
import { lordSliceFactionsMet } from "../../engine/lordSlice";
import { ageOf, currentYear, personById, personDisplayName, personPortrait } from "../../engine/persons";
import { factionInfluence } from "../../engine/reorganisation";
import { lordMode } from "../../engine/townAgency";
import type { EmblemSpec } from "../heraldry/EmblemImage";
import { drawnPortraitId } from "../portraitArt";
import { PERSON_STATE_COPY } from "../persons/personStateCopy.ko";
import { personOrnament, type PersonStateId } from "../persons/personStates";
import { chronicleDate, factionEmblem } from "./chronicleScreenModel";
import { CHRONICLE_SCREEN_COPY as COPY, DEMAND_NAMES, LEADER_ROLES, RELATION_BANDS } from "./chronicleScreenCopy.ko";
// UI-9: imports for chapter 4 influence and revolt pressure.
import { revoltPressureSection, type RevoltPressureSection } from "./factionInfluenceModel";

// UI-6 faction tab (CHRONICLE_DESIGN 2.3, FACTION-0 FX-6): the chronicle's "세력" view — the nine factions (their arms
// from the engine's heraldry seed, their name, their leader with the pool portrait, where they stand on the Wave 19
// relation scale), a faction's page (its open demands, its promises, the ledger records it remembers — each a link into
// the chronicle — and its own timeline) and the world's events up to this year. Names only through
// `factionDisplayName` and `GENTRY_NAMES_KO` (FIX-5): an engine proper noun never reaches the screen as it is stored.
// Pure: the screen renders what these return.

/** `ornament` (INSTALL-23 ④): the leader's state ornament (`personStates.ts`; a town person as the commons' reeve wears theirs). */
export type FactionLeaderView = Readonly<{ id: string; name: string; role: string; line: string; portraitId: string; ornament?: PersonStateId | null }>;
export type FactionRow = Readonly<{
  id: FactionId; name: string; kind: string; emblem: EmblemSpec; emblemLabel: string; leader: FactionLeaderView | null;
  relation: number; relationX: number; relationText: string; demands: number; promises: number; memory: number; label: string;
  /** UI-9: RG-4 influence 0–100, or null for factions without one or before chapter 4. */
  influence: number | null;
}>;
// UI-9: re-export so FactionPage can import the type from a single place.
export type { RevoltPressureSection };
export type FactionRecordLink = Readonly<{ recordId: string; tick: number; date: string; line: string }>;
export type FactionLine = Readonly<{ key: string; date: string; line: string }>;
export type FactionPageView = Readonly<{
  id: FactionId; name: string; kind: string; emblem: EmblemSpec; emblemLabel: string; leader: FactionLeaderView | null;
  relation: number; relationX: number; relationText: string;
  demands: readonly FactionLine[]; promises: readonly FactionLine[]; memory: readonly FactionRecordLink[]; timeline: readonly FactionLine[];
  /** UI-9: RG-8 revolt pressure section shown on the commons page from chapter 4 (null for other factions or before ch4). */
  revoltPressure: RevoltPressureSection | null;
}>;
export type WorldLine = Readonly<{ id: string; year: number; line: string }>;

/** FX-4: the relation is −100…100; a value outside (an old or hand-made save) is held at the ends. */
export const clampRelation = (value: number) => Math.max(-100, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
/** Where the pin sits along the scale (0 hostile … 1 friendly). */
export const relationX = (value: number) => (clampRelation(value) + 100) / 200;
export function relationBand(value: number): string {
  const relation = clampRelation(value);
  return (RELATION_BANDS.find(band => relation >= band.from) ?? RELATION_BANDS[RELATION_BANDS.length - 1]!).label;
}

function leaderView(state: GameState, faction: FactionView): FactionLeaderView | null {
  if (faction.leaderId === null) return null;
  const person = personById(state, faction.leaderId);
  if (person === undefined) return null;
  const role = person.householdId.startsWith("faction:") ? LEADER_ROLES[person.occupation] ?? FACTION_KIND_NAMES[faction.kind] ?? ""
    : faction.kind === "commons" && person.tags.includes("reeve") ? LEADER_ROLES.reeve! : LEADER_ROLES[faction.kind] ?? "";
  const year = currentYear(state);
  const age = person.alive ? ageOf(person, year) : null;
  return { id: person.id, name: personDisplayName(person), role, line: COPY.leaderLine(role, age),
    portraitId: drawnPortraitId(person, personPortrait(state, person).portraitId), ornament: personOrnament(state, person) };
}

/** The leader's name as a screen reader hears it: with the portrait's state when it wears one. */
export const leaderName = (leader: FactionLeaderView) => leader.ornament === undefined || leader.ornament === null ? leader.name
  : PERSON_STATE_COPY.withState(leader.name, PERSON_STATE_COPY.label(leader.ornament));

const nameOf = (faction: Pick<FactionView, "id" | "name">) => factionDisplayName(faction.id, faction.name);

/** FX-6 `factionsList`: the nine rows of the tab, in the engine's order (overlord, Crown, neighbours, bishop, the town's). */
export function factionRows(state: GameState): readonly FactionRow[] {
  // LM-R1 (FIX-14, decision LM8-1): lord mode lists the five its start introduces and those the lord has since dealt with.
  const met = lordMode(state) ? new Set<string>(lordSliceFactionsMet(state)) : null;
  return factionsList(state).filter(faction => met === null || met.has(faction.id)).map(faction => {
    const name = nameOf(faction);
    const leader = leaderView(state, faction);
    const relation = clampRelation(faction.relation);
    const relationText = COPY.relationText(relationBand(relation), relation);
    // UI-9: RG-4 influence — only town, merchant_house_1 and merchant_house_2 have values; others are null.
    const influence = factionInfluence(state, faction.id);
    return { id: faction.id, name, kind: FACTION_KIND_NAMES[faction.kind] ?? "", emblem: factionEmblem(faction, currentYear(state)), emblemLabel: COPY.crestLabel, leader,
      relation, relationX: relationX(relation), relationText, demands: faction.demands.length, promises: faction.promises.length, memory: faction.memory.length,
      label: COPY.factionRowLabel(name, leader === null ? COPY.noLeader : leaderName(leader), relationText, faction.demands.length), influence };
  });
}

function timelineLine(state: GameState, factionId: FactionId, entry: FactionTimelineEntry): string {
  if (entry.kind === "world") return WORLD_EVENT_LINES[entry.id] ?? "";
  if (entry.kind === "affair") return FACTION_AFFAIR_LINES[entry.id] ?? "";
  // UI-10: the Crown's head is the king of the calendar — not "died" when he was deposed (Richard II, 1399).
  const line = (factionId === "crown" && entry.id === "succeeded" ? FACTION_LEADER_LINES.crown_succeeded : FACTION_LEADER_LINES[entry.id]) ?? "";
  const person = entry.personId === undefined ? undefined : personById(state, entry.personId);
  return person === undefined ? line : COPY.timelineLeader(line, personDisplayName(person));
}

/** FX-6 `factionChronicle`: a faction's page. Its records and its timeline newest first, as the chronicle's list reads. */
export function factionPageView(state: GameState, id: FactionId): FactionPageView | null {
  const chronicle = factionChronicle(state, id);
  if (chronicle === null) return null;
  const { faction } = chronicle;
  const relation = clampRelation(faction.relation);
  const promises = new Map<string, { kind: string; id: string; count: number }>();
  for (const promise of faction.promises) {
    const key = `${promise.kind}:${promise.id}`;
    const held = promises.get(key);
    promises.set(key, { kind: promise.kind, id: promise.id, count: (held?.count ?? 0) + 1 });
  }
  const rights = state.politics?.rights ?? [];
  // UI-9: RG-8 revolt pressure shown on the commons faction page from chapter 4.
  const revoltPressure = faction.id === "commons" ? revoltPressureSection(state) : null;
  return {
    id: faction.id, name: nameOf(faction), kind: FACTION_KIND_NAMES[faction.kind] ?? "", emblem: factionEmblem(faction, currentYear(state)), emblemLabel: COPY.crestLabel,
    leader: leaderView(state, faction), relation, relationX: relationX(relation), relationText: COPY.relationText(relationBand(relation), relation),
    demands: faction.demands.map(demand => ({ key: demand.petitionId, date: chronicleDate(state, demand.arrivedTick),
      line: COPY.demand(DEMAND_NAMES[demand.defId] ?? COPY.demandsHeading, chronicleDate(state, demand.arrivedTick)) })),
    promises: [...promises.entries()].map(([key, promise]) => {
      const right = promise.kind === "right" ? rights.find(entry => entry.id === promise.id) : undefined;
      const date = right === undefined ? "" : chronicleDate(state, right.grantedTick);
      return { key, date, line: promise.kind === "right" ? COPY.promiseRight(date) : promise.kind === "loan" ? COPY.promiseLoan(promise.count) : COPY.promiseInstalment(promise.count) };
    }),
    memory: [...chronicle.records].reverse().map(record => ({ recordId: record.id, tick: record.tick, date: chronicleDate(state, record.tick), line: history.summary(record, state) })),
    timeline: [...chronicle.timeline].reverse().map((entry, index) => ({ key: `${entry.tick}:${entry.kind}:${entry.id}:${index}`, date: COPY.timelineYear(entry.year),
      line: timelineLine(state, faction.id, entry) })).filter(entry => entry.line !== ""),
    revoltPressure,
  };
}

/** FX-5 `worldTimeline`: the realm's events up to this year, oldest first (the strip under the list). */
export function worldLines(state: GameState): readonly WorldLine[] {
  return worldTimeline(state).map(event => ({ id: event.id, year: event.year, line: WORLD_EVENT_LINES[event.id] ?? "" })).filter(event => event.line !== "");
}
