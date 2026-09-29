/**
 * F4-A chapter 4's reorganisation (spec docs/design/chapter-four-reorganisation.md RG-1…RG-12). From chapter 4's first
 * season (the sandbox's spring of 1364), at each season start:
 *
 * - RG-1 the steps: the wage competition, the textile street and the alehouses (when the town has them), the
 *   petitions' surge, the guild's demand, the cloth-or-grain question, the earl's warning (when the town is strong),
 *   the poll tax of 1377, the rumour of 1381, the town's demand for a charter, the chapter's end.
 * - RG-2 the neighbours lure households with wages (a year); RG-3 cloth becomes the lord's chief income (the market
 *   side is `marketSettlement.ts`, the looms' time `reorganisationDefinition`); RG-4 the town's and the merchants'
 *   influence, counted each season.
 * - RG-5…RG-9 the four decisions (petitions, `answerReorganisationPetition`): the guild, the tax, cloth or grain, the
 *   charter. RG-8 the rumour chases the collectors when the pressure is high — nobody dies.
 * - RG-10 chapter 4 ends the season after the charter's answer, by 1400 at the latest; chapter 5 starts from its outcome.
 */
import type { SourceRef } from "../contracts";
import { CHAPTER_FOUR, type PetitionResponse } from "../content/chapterConfig";
import { BUILDING_CONFIG_BY_KIND, type BuildingDefinition, type BuildingKind } from "../content/buildingConfig";
import { CASH_RENT_PETITION_ID, WAGES_PETITION_ID } from "../content/plagueConfig";
import {
  BOROUGH_CHARTER_PETITION_ID,
  BRIDGE_TOLLS_RIGHT_ID,
  CLOTH_OR_GRAIN_PETITION_ID,
  GUILD_CHARTER_PETITION_ID,
  MARKET_TOLLS_RIGHT_ID,
  REORGANISATION_BALANCE,
  REORGANISATION_PETITION_IDS,
  REORGANISATION_SEQUENCE_ID,
  TAX_COLLECTION_PETITION_ID,
} from "../content/reorganisationConfig";
import { LEDGER_PERIOD_TICKS, postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import type { LedgerCategory } from "../ledger/ledger.types";
import type { House } from "../population/population.types";
import { townAle } from "./ale";
import type { GameState } from "./engine.types";
import { ageOf, currentYear } from "./persons";
import type { Person } from "./persons.types";
import type { PetitionRecord } from "./politics.types";
import { hashSeed } from "./prng";
import { legacyClothPermille } from "./legacy";
import type { ChapterFiveStart, GuildRecord, ReorganisationState, ReorganisationStep, RevoltPressure } from "./reorganisation.types";
import { calendar, scenarioOf } from "./scenarioState";
import { abandonHouse } from "./seasonPressure";

const SEASON = 1000;
const YEAR = 4000;
const B = REORGANISATION_BALANCE;
const TOWN_ACTOR: SourceRef = { type: "actor", id: "town" };
/** RG-3 / RG-5: the cloth buildings the guild speeds (the spinning is the households'). */
const GUILD_KINDS: ReadonlySet<BuildingKind> = new Set(["weaver_house", "fulling_mill", "dyehouse", "tenter_yard"]);
const CLOTH_INCOME: ReadonlySet<LedgerCategory> = new Set(["ulnage", "cloth_toll", "fulling_toll"]);

export function reorganisationOf(state: Pick<GameState, "reorganisation">): ReorganisationState | undefined {
  return state.reorganisation;
}

export function reorganisationActive(state: Pick<GameState, "scenarioId">): boolean {
  return scenarioOf(state).activeEvents.includes(REORGANISATION_SEQUENCE_ID);
}

const yearOf = (state: Pick<GameState, "scenarioId">, tick: number) => calendar(tick, scenarioOf(state).startYear).year;
/** The tick of `year`'s season `season` (0 spring … 3 winter). */
const seasonOf = (state: Pick<GameState, "scenarioId">, year: number, season = 0) => (year - scenarioOf(state).startYear) * YEAR + season * SEASON;

// --- RG-3 / RG-5 / RG-7 / RG-8 / RG-9: what the rest of the rules read ---------------------------------------------

/** RG-3: the cloth trade of chapter 4 (null before): the price, the seal, the lord's toll share; the merchants come apart. */
export function reorganisationClothTrade(state: Pick<GameState, "reorganisation"> & Partial<Pick<GameState, "legacy" | "tick">>): { readonly price: number; readonly ulnage: number; readonly toll: number } | null {
  const reorganisation = state.reorganisation;
  if (reorganisation === undefined) return null;
  // FIX-9 (LG-13): the Staple's years (1391) sell cloth a tenth dearer.
  const price = Math.round((reorganisation.answers[CLOTH_OR_GRAIN_PETITION_ID] === "accept" ? B.specialisedClothPrice : B.clothPrice) * legacyClothPermille(state) / 1000);
  return { price, ulnage: B.ulnagePerCloth, toll: Math.round(price * B.clothTollPermille / 1000) };
}

const scaled = new Map<string, BuildingDefinition>();
/**
 * RG-5: a cloth building's definition under the guild (its working time × 0.75) or after the guild was refused (the
 * weaving × 1.25, to the chapter's end); every other building's own. Memo key: kind and permille (the only inputs).
 */
export function reorganisationDefinition(state: Pick<GameState, "reorganisation">, kind: BuildingKind): BuildingDefinition {
  const definition = BUILDING_CONFIG_BY_KIND[kind];
  if (!GUILD_KINDS.has(kind) || definition.production === null) return definition;
  const reorganisation = state.reorganisation;
  const answer = reorganisation?.answers[GUILD_CHARTER_PETITION_ID];
  const permille = answer === "accept" ? B.guildTicksPermille
    : (answer === "refuse" || answer === "expired") && kind === "weaver_house" && reorganisation!.endedTick === undefined ? B.refusedWeavingPermille : 1_000;
  if (permille === 1_000) return definition;
  const key = `${kind}:${permille}`;
  let entry = scaled.get(key);
  if (entry === undefined) {
    entry = { ...definition, production: { ...definition.production, ticksPerOutput: Math.max(1, Math.round(definition.production.ticksPerOutput * permille / 1000)) } };
    scaled.set(key, entry);
  }
  return entry;
}

/** RG-8: the tenants withhold their rent (the court rolls burnt) — the rent's share at a period close, permille. */
export function reorganisationRentPermille(state: Pick<GameState, "reorganisation" | "tick">): number {
  const until = state.reorganisation?.rentWithheldUntil;
  return until !== undefined && state.tick <= until ? 0 : 1_000;
}

/** RG-9: the tolls' share left to the lord once the town holds the bridge tolls, permille. */
export function reorganisationTollPermille(state: Pick<GameState, "politics">): number {
  return (state.politics?.rights ?? []).some(right => right.id === BRIDGE_TOLLS_RIGHT_ID) ? B.bridgeTollPermille : 1_000;
}

// --- RG-4 influence ------------------------------------------------------------------------------------------------

const TOWN_HOLDERS = new Set(["townsfolk", "craftsmen"]);

function computeInfluence(state: GameState, reorganisation: ReorganisationState): Readonly<Record<string, number>> {
  const c = B.influence;
  const clothYear = reorganisation.clothSeasons.reduce((sum, count) => sum + count, 0);
  const guild = reorganisation.guild !== undefined;
  const rights = state.politics?.rights ?? [];
  const townRights = rights.filter(right => TOWN_HOLDERS.has(right.holder)).length;
  const town = Math.min(100, Math.min(c.peopleCap, Math.floor(Math.max(0, state.population) / c.peoplePerPoint))
    + Math.min(c.clothCap, Math.floor(clothYear / c.clothPerPoint)) + (guild ? c.guild : 0) + Math.min(c.rightsCap, townRights * c.rightPoints));
  const charter = rights.some(right => right.holder === "merchants" && right.id === "market_charter");
  const first = Math.min(100, Math.min(c.merchantClothCap, clothYear) + (charter ? c.merchantCharter : 0) + (guild ? c.merchantGuild : 0)
    + Math.min(c.merchantGaugeCap, Math.floor((state.politics?.merchantGauge ?? 0) / c.merchantGaugePerPoint)));
  return { town, merchant_house_1: first, merchant_house_2: Math.floor(first * c.secondHousePermille / 1000) };
}

/** RG-4 API: a faction's influence now (0–100), or null for a faction without one or before chapter 4. */
export function factionInfluence(state: Pick<GameState, "reorganisation">, id: string): number | null {
  return state.reorganisation?.influence[id] ?? null;
}

/** RG-5 API: the guild, if the lord granted it. */
export function guildOf(state: Pick<GameState, "reorganisation">): GuildRecord | null {
  return state.reorganisation?.guild ?? null;
}

/** RG-9 API: the state chapter 5 begins from (null before chapter 4 has ended). */
export function chapterFiveStart(state: Pick<GameState, "reorganisation">): ChapterFiveStart | null {
  return state.reorganisation?.chapterFiveStart ?? null;
}

// --- RG-8 pressure -------------------------------------------------------------------------------------------------

const refused = (answer: PetitionResponse | "expired" | undefined) => answer === "refuse" || answer === "expired";

/** RG-8 API: the pressure behind the rumour of 1381 now, and its causes (the tax counts once answered or left). */
export function revoltPressure(state: Pick<GameState, "reorganisation" | "plague" | "factions">): RevoltPressure {
  const answers = state.reorganisation?.answers ?? {};
  const plague = state.plague?.answers ?? {};
  const commons = state.factions?.factions.find(faction => faction.id === "commons")?.relation ?? 0;
  const p = B.pressure;
  const causes = [
    { id: "direct_collection", pressure: p.direct_collection, on: refused(answers[TAX_COLLECTION_PETITION_ID]) },
    { id: "labour_services", pressure: p.labour_services, on: refused(plague[CASH_RENT_PETITION_ID]) },
    { id: "wages_bound", pressure: p.wages_bound, on: refused(plague[WAGES_PETITION_ID]) },
    { id: "guild_refused", pressure: p.guild_refused, on: refused(answers[GUILD_CHARTER_PETITION_ID]) },
    { id: "cloth_specialised", pressure: p.cloth_specialised, on: answers[CLOTH_OR_GRAIN_PETITION_ID] === "accept" },
    { id: "commons_estranged", pressure: p.commons_estranged, on: commons < 0 },
  ].filter(cause => cause.on).map(({ id, pressure }) => ({ id, pressure }));
  return { total: causes.reduce((sum, cause) => sum + cause.pressure, 0), causes };
}

// --- ledger --------------------------------------------------------------------------------------------------------

function earn(state: GameState, category: LedgerCategory, amount: number, sources: readonly [SourceRef, ...SourceRef[]]): GameState {
  if (amount <= 0) return state;
  const posted = postLedgerEntries(state, [{ account: "cash", category, amount, sourceRefs: sources }]);
  return { ...state, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger };
}

// --- the sequence --------------------------------------------------------------------------------------------------

function withReorganisation(state: GameState, reorganisation: ReorganisationState): GameState {
  return { ...state, reorganisation };
}

function addPetition(state: GameState, defId: string, petitioner: PetitionRecord["petitioner"]): GameState {
  if (state.politics === undefined) return state;
  const petition: PetitionRecord = { id: `${defId}@${state.tick}`, defId, petitioner, arrivedTick: state.tick };
  return { ...state, politics: { ...state.politics, petitions: [...state.politics.petitions, petition] } };
}

const petitionOf = (state: GameState, defId: string) => state.politics?.petitions.find(petition => petition.defId === defId);

const livedIn = (house: House) => house.residents > 0 && house.abandonedTick === undefined && house.burntTick === undefined;

/** RG-2 / RG-5: households leave (their houses stand empty for the ladder), in `order`. */
function leave(state: GameState, order: readonly House[], count: number): { readonly state: GameState; readonly left: number } {
  const lived = state.houses.filter(livedIn);
  const going = new Set(order.filter(livedIn).slice(0, Math.max(0, Math.min(count, lived.length - 1))).map(house => house.buildingId));
  if (going.size === 0) return { state, left: 0 };
  const people = state.houses.filter(house => going.has(house.buildingId)).reduce((sum, house) => sum + house.residents, 0);
  return { state: { ...state, population: state.population - people, houses: state.houses.map(house => going.has(house.buildingId) ? abandonHouse(house, state.tick) : house) }, left: going.size };
}

/** RG-2: the poorest household first (lowest level, least bread, id). */
function poorestFirst(state: GameState): readonly House[] {
  return [...state.houses].filter(livedIn).sort((a, b) => a.level - b.level || a.breadStock - b.breadStock || a.buildingId.localeCompare(b.buildingId));
}

/** RG-5: the households nearest the weaver's houses first (the looms' street empties). */
function weaversFirst(state: GameState): readonly House[] {
  const looms = state.buildings.filter(building => building.kind === "weaver_house");
  const lots = new Map(state.buildings.map(building => [building.id, building]));
  const distance = (house: House) => {
    const lot = lots.get(house.buildingId);
    return lot === undefined || looms.length === 0 ? Infinity : Math.min(...looms.map(loom => Math.abs(loom.tx - lot.tx) + Math.abs(loom.ty - lot.ty)));
  };
  return [...state.houses].filter(livedIn).sort((a, b) => distance(a) - distance(b) || a.buildingId.localeCompare(b.buildingId));
}

/** RG-5: the guild's head — the town's best craftsman household head not leading another town faction. */
function guildHead(state: GameState): string | null {
  const leaders = new Set((state.factions?.factions ?? []).map(faction => faction.leaderId).filter((id): id is string => id !== null));
  const rank = (person: Person) => ["artisan", "merchant", "labour", "poor_servant"].indexOf(person.classBand);
  const heads = (state.persons?.people ?? []).filter(person => person.role === "head" && person.householdId !== "manor" && !leaders.has(person.id));
  const key = (person: Person) => hashSeed(state.seed, "guild-head", Number(person.id.slice(2)));
  return [...heads].sort((a, b) => (rank(a) === -1 ? 9 : rank(a)) - (rank(b) === -1 ? 9 : rank(b)) || key(a) - key(b))[0]?.id ?? null;
}

/** RG-6: the town's adults (14 and over; the lord's household apart). */
function adults(state: GameState): number {
  const year = currentYear(state);
  const people = state.persons?.people;
  if (people === undefined) return Math.floor(Math.max(0, state.population) * 2 / 3);
  return people.filter(person => person.householdId !== "manor" && ageOf(person, year) >= B.adultAge).length;
}

/**
 * RG-5…RG-9: the lord's answer to a reorganisation petition (called by `respondToPetition`, which records the decision
 * and marks the petition answered). `expired` is a petition left a season unanswered.
 */
export function answerReorganisationPetition(state: GameState, petition: PetitionRecord, response: PetitionResponse | "expired"): GameState {
  const reorganisation = reorganisationOf(state);
  if (reorganisation === undefined) return state;
  let next = withReorganisation(state, { ...reorganisation, answers: { ...reorganisation.answers, [petition.defId]: response } });
  if (petition.defId === GUILD_CHARTER_PETITION_ID && response === "accept") {
    next = withReorganisation(next, { ...reorganisationOf(next)!, guild: { foundedTick: state.tick, headId: guildHead(state) } });
  }
  if (petition.defId === BOROUGH_CHARTER_PETITION_ID && response === "accept" && next.politics !== undefined) {
    // RG-9: the market's dues and half the tolls go to the town (two right lines); the town owes the fee farm.
    next = { ...next, politics: { ...next.politics, rights: [...next.politics.rights,
      { id: MARKET_TOLLS_RIGHT_ID, holder: "townsfolk", grantedTick: state.tick, petitionId: petition.id, stallFeePermille: 0 },
      { id: BRIDGE_TOLLS_RIGHT_ID, holder: "townsfolk", grantedTick: state.tick, petitionId: petition.id, stallFeePermille: 1000 }] } };
  }
  return next;
}

/** RG-12 prediction (HL-3): the treasury after the answer, two seasons on. */
export function reorganisationDecisionForecast(state: GameState, defId: string, response: PetitionResponse): number {
  const treasury = treasuryBalance(state);
  const within = (tick: number) => tick > state.tick && tick <= state.tick + 2 * SEASON;
  switch (defId) {
    case TAX_COLLECTION_PETITION_ID: {
      const perAdult = response === "accept" ? B.delegatedPerAdult : B.directPerAdult;
      const due = B.pollTaxCollections.filter(([year, season]) => within(seasonOf(state, year, season))).length;
      return treasury + due * perAdult * adults(state);
    }
    case BOROUGH_CHARTER_PETITION_ID: {
      if (response !== "accept") return treasury;
      const spring = Math.ceil((state.tick + 1) / YEAR) * YEAR;
      return treasury + (within(spring) ? B.feeFarm : 0);
    }
    default:
      return treasury;
  }
}

/** RG-1 API: the stage now — before the surge, from it to the town's demand, from the demand to the end, done (null before). */
export function reorganisationStage(state: Pick<GameState, "reorganisation">): "rumour" | "arrival" | "recovery" | "done" | null {
  const reorganisation = state.reorganisation;
  if (reorganisation === undefined) return null;
  if (reorganisation.endedTick !== undefined) return "done";
  if (reorganisation.autonomyTick !== undefined) return "recovery";
  return reorganisation.surgeTick === undefined ? "rumour" : "arrival";
}

/** RG-9: when the town's demand for a charter is due (null until the tax and the guild are settled enough to say). */
function autonomyDue(state: GameState, reorganisation: ReorganisationState): number {
  if (reorganisation.rebellion?.outcome === "chased") return reorganisation.rebellion.tick + SEASON;
  return seasonOf(state, reorganisation.answers[GUILD_CHARTER_PETITION_ID] === "accept" ? B.autonomyWithGuildYear : B.autonomyYear);
}

/** RG-1 API `reorganisationForecast`: the sequence's steps and their state. */
export function reorganisationForecast(state: GameState): readonly ReorganisationStep[] {
  const r = reorganisationOf(state);
  if (r === undefined) return [];
  const came = (defId: string) => petitionOf(state, defId)?.arrivedTick ?? null;
  const surge = r.surgeTick ?? null;
  const guild = came(GUILD_CHARTER_PETITION_ID) ?? (surge === null ? null : surge + B.guildAfterSurge * SEASON);
  const steps: [ReorganisationStep["id"], number | null, boolean][] = [
    ["wage_competition", r.wageCompetitionTick ?? r.startTick + B.wageCompetitionAfter * SEASON, r.wageCompetitionTick !== undefined],
    ["textile_street", r.textileStreetTick ?? null, r.textileStreetTick !== undefined],
    ["alehouse_boom", r.alehouseBoomTick ?? null, r.alehouseBoomTick !== undefined],
    ["petitions_surge", surge ?? seasonOf(state, B.surgeLatestYear), surge !== null],
    ["guild_demand", guild, came(GUILD_CHARTER_PETITION_ID) !== null],
    ["cloth_or_grain", came(CLOTH_OR_GRAIN_PETITION_ID) ?? (guild === null ? null : guild + B.clothAfterGuild * SEASON), came(CLOTH_OR_GRAIN_PETITION_ID) !== null],
    ["overlord_warning", r.warningTick ?? null, r.warningTick !== undefined],
    ["poll_tax", came(TAX_COLLECTION_PETITION_ID) ?? seasonOf(state, B.pollTaxYear), came(TAX_COLLECTION_PETITION_ID) !== null],
    ["rebellion_rumour", r.rebellion?.tick ?? seasonOf(state, B.rebellionYear, B.rebellionSeason), r.rebellion !== undefined],
    ["autonomy_request", r.autonomyTick ?? autonomyDue(state, r), r.autonomyTick !== undefined],
    ["end", r.endedTick ?? seasonOf(state, B.chapterEndYear), r.endedTick !== undefined],
  ];
  return steps.map(([id, tick, done]) => ({ id, tick, state: done ? "done" : tick !== null && state.tick >= tick ? "now" : "ahead" }));
}

/** RG-1: the sequence begins — with chapter 4 in the campaign, from the spring of 1364 once the pestilence is over in the sandbox. */
function startsNow(state: GameState): boolean {
  if (scenarioOf(state).mode === "campaign") return (state.politics?.chapter.number ?? 1) >= CHAPTER_FOUR.chapter;
  return yearOf(state, state.tick) >= B.sandboxStartYear && (state.plague === undefined || state.plague.endedTick !== undefined);
}

/** RG-4: the cloth sold and the treasury's cloth income this tick (the ledger's entries of this tick). */
function countCloth(state: GameState, reorganisation: ReorganisationState): ReorganisationState {
  const entries = state.ledger?.entries ?? [];
  let sold = 0, income = 0;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (entry.tick !== state.tick) break;
    if (entry.account !== "cash" || !CLOTH_INCOME.has(entry.category)) continue;
    income += entry.amount;
    if (entry.category === "ulnage") sold += 1;
  }
  if (sold === 0 && income === 0) return reorganisation;
  return { ...reorganisation, clothSeason: reorganisation.clothSeason + sold, clothSold: reorganisation.clothSold + sold, clothIncome: reorganisation.clothIncome + income };
}

/** RG-10: the town's outcome for chapter 5. */
function outcomeOf(reorganisation: ReorganisationState, calendarEnd: boolean): ChapterFiveStart {
  const charter = reorganisation.answers[BOROUGH_CHARTER_PETITION_ID];
  const partial = charter === "accept";
  const town = reorganisation.influence.town ?? 0;
  return {
    charter: partial ? "partial" : calendarEnd && charter === undefined ? "calendar" : "refused",
    rights: partial ? [MARKET_TOLLS_RIGHT_ID, BRIDGE_TOLLS_RIGHT_ID] : [],
    feeFarm: partial ? B.feeFarm : 0,
    backlash: partial ? 0 : Math.min(100, Math.max(B.backlashFloor, town)),
    guild: reorganisation.guild ?? null,
    influence: reorganisation.influence,
  };
}

/**
 * One tick of F4-A (a no-op except at season starts and for a scenario without the reorganisation; the cloth count at
 * the market's ticks). `endChapter` writes chapter 4's end (the politics).
 */
export function advanceReorganisation(state: GameState, endChapter: (state: GameState) => GameState): GameState {
  if (state.tick <= 0 || !reorganisationActive(state)) return state;
  let r = reorganisationOf(state);
  const seasonStart = state.tick % SEASON === 0;
  if (r === undefined) {
    if (!seasonStart || !startsNow(state)) return state;
    const created: ReorganisationState = { startTick: state.tick, answers: {}, influence: {}, clothSeasons: [], clothSeason: 0, clothIncome: 0, clothSold: 0,
      pollTax: 0, collections: 0, wageLeavers: 0, weaverLeavers: 0 };
    return withReorganisation(state, { ...created, influence: computeInfluence(state, created) });
  }
  let next = state;
  if (r.endedTick === undefined) {
    const counted = countCloth(state, r);
    if (counted !== r) next = withReorganisation(next, r = counted);
  }
  if (!seasonStart) return next;
  // RG-9: the fee farm, each spring once the charter is granted (after the chapter too).
  if (state.tick % YEAR === 0 && r.chapterFiveStart?.charter === "partial") {
    next = earn(next, "fee_farm", B.feeFarm, [TOWN_ACTOR, { type: "right", id: MARKET_TOLLS_RIGHT_ID, detail: "fee_farm" }]);
  }
  if (r.endedTick !== undefined) return next;

  // A petition left a season unanswered: the lord's silence answers it.
  for (const petition of next.politics?.petitions ?? []) {
    if (petition.response !== undefined || !(REORGANISATION_PETITION_IDS as readonly string[]).includes(petition.defId)) continue;
    if (state.tick - petition.arrivedTick < SEASON) continue;
    next = answerReorganisationPetition(next, petition, "expired");
    next = { ...next, politics: { ...next.politics!, petitions: next.politics!.petitions.map(entry => entry.id === petition.id
      ? { ...entry, response: "expired" as const, respondedTick: state.tick } : entry) } };
  }
  r = reorganisationOf(next)!;
  // RG-4: the season's cloth rolls into the year; the influence counted.
  r = { ...r, clothSeasons: [...r.clothSeasons, r.clothSeason].slice(-4), clothSeason: 0 };
  r = { ...r, influence: computeInfluence(next, r) };
  // RG-5: the guild keeps a living head.
  if (r.guild !== undefined && (r.guild.headId === null || !(next.persons?.people ?? []).some(person => person.id === r!.guild!.headId))) {
    r = { ...r, guild: { ...r.guild, headId: guildHead(next) } };
  }
  next = withReorganisation(next, r);
  const tick = state.tick;
  const offset = Math.round((tick - r.startTick) / SEASON);
  const year = yearOf(state, tick);

  // RG-2: the neighbours' wages (a year from the season after the start).
  if (offset === B.wageCompetitionAfter && r.wageCompetitionTick === undefined) next = withReorganisation(next, r = { ...r, wageCompetitionTick: tick });
  if (r.wageCompetitionTick !== undefined && tick < r.wageCompetitionTick + B.wageCompetitionSeasons * SEASON
    && hashSeed(state.seed, "reorg:wage-competition", tick) % 1000 < B.wageCompetitionPermille) {
    const gone = leave(next, poorestFirst(next), 1);
    next = gone.state;
    r = { ...reorganisationOf(next)!, wageLeavers: r.wageLeavers + gone.left };
    next = withReorganisation(next, r);
  }
  // RG-1: the textile street and the alehouses, when the town has them.
  if (r.textileStreetTick === undefined && offset >= B.textileStreetAfter
    && next.buildings.filter(building => building.kind === "weaver_house").length >= B.textileStreetWeavers) next = withReorganisation(next, r = { ...r, textileStreetTick: tick });
  if (r.alehouseBoomTick === undefined && offset >= B.alehouseBoomAfter) {
    const ale = townAle(next);
    if (ale.alehouses >= B.alehouseBoomAlehouses && (ale.lastSeason?.drunk ?? 0) >= B.alehouseBoomDrunk) next = withReorganisation(next, r = { ...r, alehouseBoomTick: tick });
  }
  // RG-1: the petitions surge the season after both, from 1368 — by 1372 at the latest.
  if (r.surgeTick === undefined) {
    const both = r.textileStreetTick !== undefined && r.alehouseBoomTick !== undefined && tick >= Math.max(r.textileStreetTick, r.alehouseBoomTick) + SEASON;
    if ((both && year >= B.surgeFromYear) || tick >= seasonOf(state, B.surgeLatestYear)) next = withReorganisation(next, r = { ...r, surgeTick: tick });
  }
  // RG-5 the guild's demand; RG-7 cloth or grain.
  if (r.surgeTick !== undefined && tick >= r.surgeTick + B.guildAfterSurge * SEASON && petitionOf(next, GUILD_CHARTER_PETITION_ID) === undefined) {
    next = addPetition(next, GUILD_CHARTER_PETITION_ID, "craftsmen");
  }
  const guildPetition = petitionOf(next, GUILD_CHARTER_PETITION_ID);
  if (guildPetition !== undefined && tick >= guildPetition.arrivedTick + B.clothAfterGuild * SEASON && petitionOf(next, CLOTH_OR_GRAIN_PETITION_ID) === undefined) {
    next = addPetition(next, CLOTH_OR_GRAIN_PETITION_ID, "merchants");
  }
  // RG-4: the earl warns a strong town (from the guild's demand).
  if (guildPetition !== undefined && r.warningTick === undefined && (r.influence.town ?? 0) >= B.warningInfluence) next = withReorganisation(next, r = { ...r, warningTick: tick });
  // RG-6: the poll tax — the town asks to collect it (spring 1377); the collections.
  if (tick >= seasonOf(state, B.pollTaxYear) && petitionOf(next, TAX_COLLECTION_PETITION_ID) === undefined) next = addPetition(next, TAX_COLLECTION_PETITION_ID, "townsfolk");
  r = reorganisationOf(next)!;
  // RG-8: the rumour of 1381, before that summer's collection.
  if (r.rebellion === undefined && tick === seasonOf(state, B.rebellionYear, B.rebellionSeason)) {
    const pressure = revoltPressure(next).total;
    const chased = pressure >= B.revoltThreshold;
    r = { ...r, rebellion: { tick, pressure, outcome: chased ? "chased" : "quiet" }, ...(chased ? { rentWithheldUntil: tick + LEDGER_PERIOD_TICKS } : {}) };
    next = withReorganisation(next, r);
  }
  for (const [collectYear, collectSeason] of B.pollTaxCollections) {
    if (tick !== seasonOf(state, collectYear, collectSeason)) continue;
    if (r.rebellion?.tick === tick && r.rebellion.outcome === "chased") continue;
    const answer: PetitionResponse | "expired" | undefined = r.answers[TAX_COLLECTION_PETITION_ID];
    if (answer === undefined) continue;
    const perAdult: number = answer === "accept" ? B.delegatedPerAdult : B.directPerAdult;
    const amount: number = perAdult * adults(next);
    next = earn(next, "poll_tax", amount, [{ type: "actor", id: answer === "accept" ? "town" : "crown" }, { type: "claim", id: "poll_tax", detail: `${collectYear}:${answer === "accept" ? "delegated" : "direct"}` }]);
    r = { ...reorganisationOf(next)!, pollTax: r.pollTax + amount, collections: r.collections + 1 };
    next = withReorganisation(next, r);
  }
  // RG-5: the refused guild's weavers go (the season after the answer).
  const guildAnswer = r.answers[GUILD_CHARTER_PETITION_ID];
  const answeredGuild = next.politics?.petitions.find(petition => petition.defId === GUILD_CHARTER_PETITION_ID)?.respondedTick;
  if (refused(guildAnswer) && r.weaversLeftTick === undefined && answeredGuild !== undefined && tick > answeredGuild) {
    const gone = leave(next, weaversFirst(next), B.refusedWeaverHouseholds);
    next = gone.state;
    r = { ...reorganisationOf(next)!, weaverLeavers: r.weaverLeavers + gone.left, weaversLeftTick: tick };
    next = withReorganisation(next, r);
  }
  // RG-9: the town's demand for a charter.
  if (r.autonomyTick === undefined && tick >= autonomyDue(next, r) && (r.rebellion !== undefined || year > B.rebellionYear)) {
    next = addPetition(withReorganisation(next, r = { ...r, autonomyTick: tick }), BOROUGH_CHARTER_PETITION_ID, "townsfolk");
    r = reorganisationOf(next)!;
  }
  // RG-10: the end — the season after the charter's answer, by 1400 at the latest.
  const charterAnswered = next.politics?.petitions.find(petition => petition.defId === BOROUGH_CHARTER_PETITION_ID)?.respondedTick;
  const calendarEnd = tick >= seasonOf(state, B.chapterEndYear);
  if ((charterAnswered !== undefined && tick > charterAnswered) || calendarEnd) {
    r = { ...r, endedTick: tick, chapterFiveStart: outcomeOf(r, calendarEnd && charterAnswered === undefined) };
    next = withReorganisation(next, r);
    if (scenarioOf(next).mode === "campaign" && next.politics?.chapter.number === CHAPTER_FOUR.chapter) next = endChapter(next);
  }
  return next;
}
