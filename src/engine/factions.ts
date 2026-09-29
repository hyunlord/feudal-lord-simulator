/**
 * FACTION-0 factions (spec docs/design/factions.md FX-1…FX-8):
 *
 * - FX-1 nine factions from the seed: the overlord (an earl), the Crown, two neighbouring lords, the bishop, two merchant
 *   houses, the town community and the commons — names and heraldry from the seed, the Crown's kings from the calendar.
 * - FX-2 leaders are persons: the outside factions' own (they age, die at the year's roll and are succeeded by an heir),
 *   the town's from its household heads (a merchant, an artisan, the reeve), chosen again when the leader is gone.
 * - FX-3 every petition has a faction (its petitioner's); the Crown's writs name the king, the refugees the bishop.
 * - FX-4 answers and events move a faction's relation; each move is a history ledger record (`faction.relation`) that the
 *   faction's memory points to (`factionChanges`, applied by the history ledger with the record ids, `applyFactionRecords`).
 * - FX-5 the world's timeline (the kings, the wars, the plagues) and each outside faction's own affairs, from the seed.
 * - FX-6 API `factions.*`.
 * - CODE-1a (decision FX6-2): every faction's leader wears one of its own pool-3 faces (`FACTION_PORTRAIT_POOLS`): the
 *   outside factions' people from their making, a town head from the season they are chosen.
 * Factions change nothing in the simulation yet (FACTION-0 is the base the rights and chronicle work builds on).
 */
import {
  BISHOP_SURNAMES, EARLDOMS, FACTION_DEF_BY_ID, FACTION_DEFS, FACTION_EVENTS, FACTION_LINEAGE_SETS, FACTION_PORTRAIT_POOLS, FAMILY_FACTIONS, FACTION_EVENT_PERMILLE, FACTION_OF_PETITIONER, KINGS, NEIGHBOUR_HOUSES,
  RELATION_RULES, SEES, WORLD_EVENTS, type FactionDef, type FactionId,
} from "../content/factionConfig";
import { MALE_GIVEN_NAMES } from "../content/personNames";
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import type { FamineResponseChoice, Petitioner, PetitionResponse } from "../content/chapterConfig";
import type { GameState } from "./engine.types";
import type { FactionMemory, FactionRecord, FactionState, FactionTimelineEntry, FactionView } from "./faction.types";
import type { HistoryRecord } from "./history.types";
import { lordshipOf } from "./lordshipState";
import { ageBandOf, ageOf, currentYear, seasonDeathPermille, weightedName } from "./persons";
import type { Person, PersonBuild, PersonClassBand } from "./persons.types";
import { hairWords, inheritTraits, populationTraits } from "./heredity";
import { chooseFactionPortraitIdentity, choosePortraitIdentity, identityFaction, identityLineage, PORTRAIT_BAND, setPlaces } from "./portraits";
import { hashSeed } from "./prng";
import { WAR_BALANCE } from "../content/warConfig";
import { HEIR_BY_RESPONSE, HEIR_CHOICE_PETITION_ID, LEGACY_CHOICE_PETITION_ID, LEGACY_PETITION_IDS, LEGACY_RELATIONS, type LegacyPetitionId } from "../content/legacyConfig";
import { BOROUGH_CHARTER_PETITION_ID, REORGANISATION_EVENT_RELATIONS, REORGANISATION_PETITION_IDS, REORGANISATION_RELATIONS, type ReorganisationPetitionId } from "../content/reorganisationConfig";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const YEAR = 4 * SEASON;
const clamp = (value: number) => Math.max(-100, Math.min(100, value));

export function factionsOf(state: Pick<GameState, "factions">): FactionState | undefined {
  return state.factions;
}

/** FX-3: the faction a petitioner stands for. */
export function factionOfPetitioner(petitioner: Petitioner): FactionId {
  return FACTION_OF_PETITIONER[petitioner];
}

/** The portraits already worn (town and factions), so a new face is not a twin. */
function portraitUsage(state: Pick<GameState, "persons" | "factions">, extra: readonly Person[] = []): Map<string, number> {
  const usage = new Map<string, number>();
  for (const person of [...(state.persons?.people ?? []), ...(state.factions?.people ?? []).filter(person => person.alive), ...extra]) {
    usage.set(person.portraitIdentity, (usage.get(person.portraitIdentity) ?? 0) + 1);
  }
  return usage;
}

/**
 * FX-2: an outside faction's person (a leader or an heir). PERSON-1a: in a noble faction the heir is the predecessor's son
 * (his father, half his traits) and, where the faction has a lineage set, wears the set's next generation's face.
 */
function outsidePerson(state: Pick<GameState, "seed" | "persons" | "factions">, ordinal: number, fields: { readonly factionId: FactionId;
  readonly givenName?: string; readonly surname?: string; readonly birthYear: number; readonly classBand: PersonClassBand; readonly occupation: string;
  readonly year: number; readonly predecessor?: Person }, made: readonly Person[]): Person {
  const id = `f-${String(ordinal).padStart(6, "0")}`;
  const father = fields.predecessor !== undefined && FAMILY_FACTIONS.has(fields.factionId) ? fields.predecessor : undefined;
  const scope = `faction:${fields.factionId}`;
  const traits = father === undefined ? populationTraits(state.seed, scope, ordinal) : inheritTraits(state.seed, scope, ordinal, undefined, father.traits);
  const build: PersonBuild = traits.buildBias;
  const draft = { id, sex: "male" as const, classBand: fields.classBand, build, occupation: fields.occupation, tags: [`faction:${fields.factionId}`], role: "head" as const, traits };
  const band = ageBandOf(fields.year - fields.birthYear);
  const usage = portraitUsage(state, made);
  const set = FACTION_LINEAGE_SETS[fields.factionId];
  let portraitIdentity: string | null = null;
  if (set !== undefined && father !== undefined) {
    const generation = (setPlaces(set).find(place => place.identityId === father.portraitIdentity)?.generation ?? 1) + 1;
    const worn = new Set([...(state.factions?.people ?? []), ...made].map(person => person.portraitIdentity));
    const free = setPlaces(set).filter(place => place.sex === "male" && place.generation === generation && !place.inLaw && !worn.has(place.identityId));
    // Only a place with a picture of his age (a set's first son may have been drawn as a baby only).
    portraitIdentity = free.find(place => place.bands.has(PORTRAIT_BAND[band]))?.identityId ?? null;
  }
  portraitIdentity ??= chooseFactionPortraitIdentity(state.seed, draft, band, usage, FACTION_PORTRAIT_POOLS[fields.factionId],
    new Set(fields.predecessor === undefined ? [] : [fields.predecessor.portraitIdentity]))
    ?? choosePortraitIdentity(state.seed, draft, band, usage);
  return { ...draft, givenName: fields.givenName ?? weightedName(MALE_GIVEN_NAMES, hashSeed(state.seed, "faction-name", ordinal)),
    ...(fields.surname === undefined ? {} : { surname: fields.surname }), birthYear: fields.birthYear, householdId: `faction:${fields.factionId}`,
    hair: hairWords(traits), alive: true, portraitIdentity, lineageId: `faction:${fields.factionId}`, ...(father === undefined ? {} : { fatherId: father.id }) };
}

/** FX-5: the king reigning in `year`. */
export function kingOf(year: number): (typeof KINGS)[number] {
  return KINGS.find(king => year >= king.from && year < king.until) ?? KINGS[KINGS.length - 1]!;
}

/** FX-1: the seed's picks — the earldom, the two neighbours' houses (not the lord's own), the see. */
function seedPicks(state: Pick<GameState, "seed" | "lordship">) {
  const earldom = EARLDOMS[hashSeed(state.seed, "faction:earldom") % EARLDOMS.length]!;
  const lord = lordshipOf(state as GameState).house.name;
  const houses = NEIGHBOUR_HOUSES.filter(name => name !== lord);
  const first = hashSeed(state.seed, "faction:neighbour") % houses.length;
  const second = (first + 1 + hashSeed(state.seed, "faction:neighbour-2") % (houses.length - 1)) % houses.length;
  const see = SEES[hashSeed(state.seed, "faction:see") % SEES.length]!;
  return { earldom, neighbours: [houses[first]!, houses[second]!] as const, see };
}

/** FX-2: the town's heads a town faction may be led by, best first (merchant houses: merchants; the town: artisans; the commons: the reeve). */
function townCandidates(state: Pick<GameState, "persons" | "seed">, def: FactionDef): readonly Person[] {
  const heads = (state.persons?.people ?? []).filter(person => person.role === "head" && person.householdId !== "manor");
  const rank: Readonly<Record<string, readonly string[]>> = {
    merchant_house: ["merchant", "artisan", "labour", "poor_servant"], town: ["artisan", "merchant", "labour", "poor_servant"], commons: ["labour", "poor_servant", "artisan", "merchant"],
  };
  const order = rank[def.kind] ?? [];
  const key = (person: Person) => (def.kind === "commons" && person.tags.includes("reeve") ? -1 : order.indexOf(person.classBand) === -1 ? 9 : order.indexOf(person.classBand));
  return [...heads].sort((a, b) => key(a) - key(b) || hashSeed(state.seed, `leader:${def.id}`, Number(a.id.slice(2))) - hashSeed(state.seed, `leader:${def.id}`, Number(b.id.slice(2))));
}

/** FX-2: the town factions' leaders — kept while they live in the town, else the best head not leading another town faction. */
function townLeaders(state: Pick<GameState, "persons" | "seed">, factions: readonly FactionRecord[]): Map<FactionId, Person | null> {
  const living = new Map((state.persons?.people ?? []).map(person => [person.id, person]));
  const taken = new Set<string>();
  const result = new Map<FactionId, Person | null>();
  for (const def of FACTION_DEFS.filter(entry => entry.leaders === "town")) {
    const current = factions.find(faction => faction.id === def.id)?.leaderId;
    const kept = current == null ? undefined : living.get(current);
    // The second merchant house is another family (another surname) than the first.
    const firstSurname = def.id === "merchant_house_2" ? living.get(result.get("merchant_house_1")?.id ?? "")?.surname : undefined;
    const leader = kept !== undefined && kept.role === "head" && !taken.has(kept.id) ? kept
      : townCandidates(state, def).find(person => !taken.has(person.id) && (firstSurname === undefined || person.surname !== firstSurname)) ?? null;
    if (leader !== null) taken.add(leader.id);
    result.set(def.id, leader);
  }
  return result;
}

function townFactionName(def: FactionDef, leader: Person | null): string {
  if (def.kind === "merchant_house") return leader?.surname ?? leader?.givenName ?? def.id;
  return def.kind;
}

/** FX-1: the factions of a town (at its first tick, or a v20 save's first). */
export function initialFactions(state: GameState): FactionState {
  const year = currentYear(state);
  const picks = seedPicks(state);
  const people: Person[] = [];
  let ordinal = 1;
  const make = (fields: Parameters<typeof outsidePerson>[2]) => { const person = outsidePerson(state, ordinal, fields, people); ordinal += 1; people.push(person); return person; };
  const age = (salt: string, from: number, span: number) => year - from - hashSeed(state.seed, salt) % span;
  const king = kingOf(year);
  const outside: Readonly<Partial<Record<FactionId, { name: string; leader: Person }>>> = {
    overlord: { name: picks.earldom.title, leader: make({ factionId: "overlord", surname: picks.earldom.surname, birthYear: age("faction:overlord-age", 30, 26), classBand: "gentry", occupation: "earl", year }) },
    crown: { name: "crown", leader: make({ factionId: "crown", givenName: king.name, birthYear: king.born, classBand: "gentry", occupation: "king", year }) },
    neighbour_1: { name: picks.neighbours[0], leader: make({ factionId: "neighbour_1", surname: picks.neighbours[0], birthYear: age("faction:n1-age", 25, 31), classBand: "gentry", occupation: "lord", year }) },
    neighbour_2: { name: picks.neighbours[1], leader: make({ factionId: "neighbour_2", surname: picks.neighbours[1], birthYear: age("faction:n2-age", 25, 31), classBand: "gentry", occupation: "lord", year }) },
    bishop: { name: picks.see, leader: make({ factionId: "bishop", surname: BISHOP_SURNAMES[hashSeed(state.seed, "faction:bishop") % BISHOP_SURNAMES.length]!,
      birthYear: age("faction:bishop-age", 45, 21), classBand: "clerical", occupation: "bishop", year }) },
  };
  const town = townLeaders(state, []);
  const factions: FactionRecord[] = FACTION_DEFS.map(def => {
    const own = outside[def.id];
    const leader = own?.leader ?? town.get(def.id) ?? null;
    return { id: def.id, kind: def.kind, name: own?.name ?? townFactionName(def, leader), leaderId: leader?.id ?? null,
      heraldrySeed: hashSeed(state.seed, `heraldry:${def.id}`), relation: def.startRelation, memory: [], timeline: [] };
  });
  return { factions, people, nextOrdinal: ordinal };
}

/** FX-2 / FX-5: a year's turn for the outside factions — the king by the calendar, deaths and heirs, the world, their affairs. */
function yearTurn(state: GameState, factionState: FactionState): FactionState {
  const year = currentYear(state);
  let ordinal = factionState.nextOrdinal;
  const people = [...factionState.people];
  const index = new Map(people.map((person, at) => [person.id, at]));
  const factions = factionState.factions.map(faction => {
    const def = FACTION_DEFS.find(entry => entry.id === faction.id)!;
    const timeline: FactionTimelineEntry[] = [...faction.timeline];
    for (const event of WORLD_EVENTS) if (event.year === year && event.factionId === faction.id) timeline.push({ tick: state.tick, year, kind: "world", id: event.id });
    let leaderId = faction.leaderId;
    if (def.leaders === "outside" && leaderId !== null) {
      const leader = people[index.get(leaderId)!]!;
      const king = kingOf(year);
      const dies = faction.id === "crown" ? leader.givenName !== king.name
        : hashSeed(state.seed, "faction-death", Number(leader.id.slice(2)), year) % 1000 < Math.min(1000, 4 * seasonDeathPermille(ageOf(leader, year)));
      if (dies) {
        people[index.get(leaderId)!] = { ...leader, alive: false, deathYear: year, deathCause: "age" };
        const heir = faction.id === "crown"
          ? outsidePerson(state, ordinal, { factionId: "crown", givenName: king.name, birthYear: king.born, classBand: "gentry", occupation: "king", year,
            predecessor: leader }, people)
          : outsidePerson(state, ordinal, { factionId: faction.id, ...(leader.surname === undefined ? {} : { surname: leader.surname }),
            birthYear: year - 20 - hashSeed(state.seed, "faction-heir", ordinal) % 16, classBand: leader.classBand, occupation: leader.occupation, year,
            predecessor: leader }, people);
        ordinal += 1;
        people.push(heir);
        index.set(heir.id, people.length - 1);
        leaderId = heir.id;
        timeline.push({ tick: state.tick, year, kind: "leader", id: "succeeded", personId: heir.id });
      }
    }
    const affairs = def.kind === "overlord" || def.kind === "neighbour" || def.kind === "church" ? FACTION_EVENTS[def.kind] : null;
    if (affairs !== null && hashSeed(state.seed, `faction-affair:${faction.id}`, year) % 1000 < FACTION_EVENT_PERMILLE) {
      timeline.push({ tick: state.tick, year, kind: "affair", id: affairs[hashSeed(state.seed, `faction-affair-kind:${faction.id}`, year) % affairs.length]! });
    }
    return { ...faction, leaderId, timeline };
  });
  return { factions, people, nextOrdinal: ordinal };
}

/**
 * CODE-1a: each faction's living leader in one of its pool-3 faces — a town head takes the face the season they are
 * chosen (and a leader of a save made before pool 3 at its next season). A leader of a sex the faction's faces lack
 * keeps their own.
 */
function withLeaderFaces(state: GameState): GameState {
  const current = state.factions;
  if (current === undefined) return state;
  const year = currentYear(state);
  const usage = portraitUsage(state);
  let town = state.persons?.people;
  let outside = current.people;
  for (const faction of current.factions) {
    if (faction.leaderId === null) continue;
    const pools = FACTION_PORTRAIT_POOLS[faction.id];
    const isOutside = FACTION_DEF_BY_ID.get(faction.id)?.leaders === "outside";
    const list = isOutside ? outside : town ?? [];
    const at = list.findIndex(person => person.id === faction.leaderId);
    const leader = list[at];
    if (leader === undefined || !leader.alive || pools.includes(identityFaction(leader.portraitIdentity) ?? "")) continue;
    // PERSON-1a: an heir in the faction's lineage set wears the family's face.
    if (FACTION_LINEAGE_SETS[faction.id] !== undefined && identityLineage(leader.portraitIdentity) === FACTION_LINEAGE_SETS[faction.id]) continue;
    const face = chooseFactionPortraitIdentity(state.seed, leader, ageBandOf(ageOf(leader, year)), usage, pools);
    if (face === null) continue;
    usage.set(leader.portraitIdentity, Math.max(0, (usage.get(leader.portraitIdentity) ?? 1) - 1));
    usage.set(face, (usage.get(face) ?? 0) + 1);
    const next = list.map((person, index) => index === at ? { ...person, portraitIdentity: face } : person);
    if (isOutside) outside = next; else town = next;
  }
  if (outside === current.people && town === state.persons?.people) return state;
  return { ...state, factions: { ...current, people: outside }, ...(state.persons === undefined || town === undefined ? {} : { persons: { ...state.persons, people: town } }) };
}

/** One tick of FACTION-0: the factions at the first tick; then at each season start the town's leaders, and each year's turn. */
export function advanceFactions(state: GameState): GameState {
  if (state.tick <= 0) return state;
  let current = state.factions;
  if (current === undefined) current = initialFactions(state);
  else if (state.tick % SEASON !== 0) return state;
  else {
    if (state.tick % YEAR === 0) current = yearTurn(state, current);
    const leaders = townLeaders(state, current.factions);
    const changed = current.factions.some(faction => leaders.has(faction.id) && (leaders.get(faction.id)?.id ?? null) !== faction.leaderId);
    if (changed) {
      const year = currentYear(state);
      current = { ...current, factions: current.factions.map(faction => {
        if (!leaders.has(faction.id)) return faction;
        const leader = leaders.get(faction.id) ?? null;
        if ((leader?.id ?? null) === faction.leaderId) return faction;
        const def = FACTION_DEFS.find(entry => entry.id === faction.id)!;
        return { ...faction, leaderId: leader?.id ?? null, name: townFactionName(def, leader),
          timeline: leader === null ? faction.timeline : [...faction.timeline, { tick: state.tick, year, kind: "leader" as const, id: "chosen", personId: leader.id }] };
      }) };
    }
  }
  return withLeaderFaces(current === state.factions ? state : { ...state, factions: current });
}

/** FX-4: a change of a faction's relation, before the ledger gives it a record. */
export interface FactionChange {
  readonly factionId: FactionId;
  readonly delta: number;
  readonly reason: string;
}

/**
 * FX-4: what moved the factions between two states — petitions answered (or left unanswered), the famine's answer, a
 * decline begun or ended, a new lord's house, the raid.
 */
export function factionChanges(before: GameState, after: GameState): readonly FactionChange[] {
  const factions = after.factions;
  if (factions === undefined) return [];
  const changes: FactionChange[] = [];
  const was = new Map((before.politics?.petitions ?? []).map(petition => [petition.id, petition.response]));
  for (const petition of after.politics?.petitions ?? []) {
    if (petition.response === undefined || was.get(petition.id) !== undefined) continue;
    // F4-A (RG-5…RG-9): a reorganisation answer moves the town's side and the lords' side apart (its own table).
    if ((REORGANISATION_PETITION_IDS as readonly string[]).includes(petition.defId)) {
      const answer = petition.response === "expired" ? "refuse" : petition.response;
      const reason = `petition:${petition.defId}:${petition.response}`;
      for (const [factionId, delta] of Object.entries(REORGANISATION_RELATIONS[petition.defId as ReorganisationPetitionId][answer] ?? {})) {
        const warned = petition.defId === BOROUGH_CHARTER_PETITION_ID && answer === "accept" && factionId === "overlord" && after.reorganisation?.warningTick !== undefined;
        changes.push({ factionId: factionId as FactionId, delta: delta! + (warned ? REORGANISATION_EVENT_RELATIONS.warnedOverlord : 0), reason });
      }
      continue;
    }
    // F5-A (LG-6): a chapter-5 answer, by its own table (the silence as its default: the heir named, the rest refused).
    if ((LEGACY_PETITION_IDS as readonly string[]).includes(petition.defId)) {
      const heir = after.legacy?.heir?.kind;
      const answer = petition.response !== "expired" ? petition.response
        : petition.defId === HEIR_CHOICE_PETITION_ID ? (Object.entries(HEIR_BY_RESPONSE).find(([, kind]) => kind === heir)?.[0] as PetitionResponse | undefined)
        : petition.defId === LEGACY_CHOICE_PETITION_ID ? undefined : "refuse";
      const reason = `petition:${petition.defId}:${petition.response}`;
      for (const [factionId, delta] of Object.entries(answer === undefined ? {} : LEGACY_RELATIONS[petition.defId as LegacyPetitionId][answer] ?? {})) {
        changes.push({ factionId: factionId as FactionId, delta: delta!, reason });
      }
      continue;
    }
    const factionId = factionOfPetitioner(petition.petitioner);
    const rules = factionId === "crown" ? RELATION_RULES.crown : RELATION_RULES.petition;
    changes.push({ factionId, delta: rules[petition.response], reason: `petition:${petition.defId}:${petition.response}` });
  }
  const famine = (record: GameState) => record.events?.records.find(entry => entry.defId === "great_famine")?.response?.choice;
  const choice = famine(after);
  if (choice !== undefined && famine(before) === undefined) {
    const rule = RELATION_RULES.famine[choice as FamineResponseChoice];
    changes.push({ factionId: "commons", delta: rule.commons, reason: `famine:${choice}` }, { factionId: "bishop", delta: rule.bishop, reason: `famine:${choice}` });
  }
  const lordBefore = lordshipOf(before), lordAfter = lordshipOf(after);
  if (lordAfter.house.order > lordBefore.house.order) {
    for (const def of FACTION_DEFS.filter(entry => entry.leaders === "outside")) {
      const relation = factions.factions.find(faction => faction.id === def.id)!.relation;
      const delta = Math.round((def.startRelation - relation) * RELATION_RULES.houseChangePermille / 1000);
      if (delta !== 0) changes.push({ factionId: def.id, delta, reason: "house_change" });
    }
  } else if (lordAfter.decline !== null && lordBefore.decline === null) {
    // FIX-5: a town emptied of its people fails the overlord as one in arrears does.
    changes.push(lordAfter.decline.cause === "derelict" ? { factionId: "town", delta: RELATION_RULES.declineDerelict, reason: "decline:derelict" }
      : { factionId: "overlord", delta: RELATION_RULES.declineArrears, reason: `decline:${lordAfter.decline.cause}` });
  } else if (lordAfter.decline === null && lordBefore.decline !== null && lordBefore.decline.lost !== null) {
    changes.push({ factionId: lordBefore.decline.by === "overlord" ? "overlord" : "merchant_house_1", delta: RELATION_RULES.restored, reason: "restored" });
  }
  if (after.war?.raid !== undefined && before.war?.raid === undefined) {
    const held = after.war.raid.defencePermille >= WAR_BALANCE.timberDefencePermille;
    changes.push({ factionId: "town", delta: held ? RELATION_RULES.raidHeld : RELATION_RULES.raidBreached, reason: held ? "raid:held" : "raid:breached" });
  }
  // F4-A (RG-2, RG-4, RG-8): the neighbours' wages, the earl's warning, the rumour of 1381.
  const reorgBefore = before.reorganisation, reorgAfter = after.reorganisation;
  if (reorgAfter !== undefined) {
    const lured = reorgAfter.wageLeavers - (reorgBefore?.wageLeavers ?? 0);
    if (lured > 0) changes.push({ factionId: "neighbour_1", delta: lured * RELATION_RULES.wageCompetition, reason: "reorg:wage_competition" });
    if (reorgAfter.warningTick !== undefined && reorgBefore?.warningTick === undefined) {
      changes.push({ factionId: "overlord", delta: REORGANISATION_EVENT_RELATIONS.overlordWarning, reason: "reorg:overlord_warning" });
    }
    if (reorgAfter.rebellion !== undefined && reorgBefore?.rebellion === undefined) {
      for (const [factionId, delta] of Object.entries(REORGANISATION_EVENT_RELATIONS[reorgAfter.rebellion.outcome])) {
        changes.push({ factionId: factionId as FactionId, delta, reason: `reorg:rebellion:${reorgAfter.rebellion.outcome}` });
      }
    }
  }
  return changes.filter(change => change.delta !== 0);
}

/** FX-4: applies the ledger's `faction.relation` records to the factions (their relation and their memory). */
export function applyFactionRecords(factions: FactionState, records: readonly HistoryRecord[]): FactionState {
  const moves = records.filter(record => record.template === "faction.relation" && record.subject.type === "faction");
  if (moves.length === 0) return factions;
  return { ...factions, factions: factions.factions.map(faction => {
    const own = moves.filter(record => record.subject.id === faction.id);
    if (own.length === 0) return faction;
    let relation = faction.relation;
    const memory: FactionMemory[] = [...faction.memory];
    for (const record of own) {
      const delta = Number(record.params?.delta ?? 0);
      relation = clamp(relation + delta);
      memory.push({ recordId: record.id, tick: record.tick, delta, reason: String(record.params?.reason ?? "") });
    }
    return { ...faction, relation, memory };
  }) };
}

/** FX-6 API `factions.list`: the factions with their open demands and their promises. */
export function factionsList(state: GameState): readonly FactionView[] {
  const factions = state.factions?.factions ?? [];
  const open = (state.politics?.petitions ?? []).filter(petition => petition.response === undefined);
  return factions.map(faction => ({
    ...faction,
    // F4-A (RG-4): the town's and the merchant houses' influence from chapter 4.
    ...(state.reorganisation?.influence[faction.id] === undefined ? {} : { influence: state.reorganisation.influence[faction.id] }),
    demands: open.filter(petition => factionOfPetitioner(petition.petitioner) === faction.id).map(petition => ({ petitionId: petition.id, defId: petition.defId, arrivedTick: petition.arrivedTick })),
    promises: [
      ...(state.politics?.rights ?? []).filter(right => factionOfPetitioner(right.holder) === faction.id).map(right => ({ kind: "right" as const, id: right.id })),
      ...(faction.id === "merchant_house_1" ? (state.war?.instalments ?? []).filter(entry => entry.category === "war_loan").map(() => ({ kind: "loan" as const, id: "war_loan" })) : []),
      ...(faction.id === "crown" ? (state.war?.instalments ?? []).filter(entry => entry.category === "wool_levy").map(() => ({ kind: "instalment" as const, id: "wool_levy" })) : []),
    ],
  }));
}

/** FX-6 API `factions.get`. */
export function faction(state: GameState, id: FactionId): FactionView | undefined {
  return factionsList(state).find(entry => entry.id === id);
}

/** FX-6 API `factions.chronicle`: the faction's page — its memory's ledger records (oldest first) and its own timeline. */
export function factionChronicle(state: GameState, id: FactionId): { readonly faction: FactionView; readonly records: readonly HistoryRecord[];
  readonly timeline: readonly FactionTimelineEntry[] } | null {
  const view = faction(state, id);
  if (view === undefined) return null;
  const records = (state.history?.records ?? []).filter(record => record.subject.type === "faction" && record.subject.id === id
    || (record.actors ?? []).some(actor => actor.type === "faction" && actor.id === id));
  return { faction: view, records, timeline: view.timeline };
}

/** FX-5 API `factions.world`: the world's fixed events up to the town's year. */
export function worldTimeline(state: Pick<GameState, "tick" | "scenarioId">): readonly (typeof WORLD_EVENTS)[number][] {
  const year = currentYear(state);
  return WORLD_EVENTS.filter(event => event.year <= year);
}

/** FX-2: an outside faction's person by id (`personById` looks here too). */
export function factionPerson(state: Pick<GameState, "factions">, id: string): Person | undefined {
  return state.factions?.people.find(person => person.id === id);
}

/** FX-3: the persons who bring a petition of an outside faction (its leader), or null for the town's own. */
export function petitionFactionLeaders(state: Pick<GameState, "factions">, petitioner: Petitioner): readonly string[] | null {
  const id = factionOfPetitioner(petitioner);
  const def = FACTION_DEFS.find(entry => entry.id === id)!;
  if (def.leaders === "town") return null;
  const leader = state.factions?.factions.find(entry => entry.id === id)?.leaderId;
  return leader == null ? [] : [leader];
}
