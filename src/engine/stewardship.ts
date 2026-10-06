/**
 * LM-E4 delegation, attention and the yearly audit (spec docs/design/stewardship.md SW-1…SW-9). An estate the lord holds
 * off the map (LM-E3's inheritance) gets its oversight at the next season: three steward candidates of its own (one of
 * each disposition) and the lord's direct oversight with the most loyal as its receiver. Each season the estate yields
 * its quarter, by its rates; a petition comes; the steward (or the lord) answers it; the receiver keeps the accounts —
 * and may keep some back. At Michaelmas the accounts are audited. Nothing of this exists before the lord holds such an
 * estate: the sandbox and the campaign never have it.
 */
import {
  ATTENTION_AGE_LOSS, ATTENTION_BASE, ATTENTION_HEIR, ATTENTION_OLD_AGE, ATTENTION_VISIT_LOSS, AUDIT_ANSWER_TICKS, AUDIT_FIND, AUDIT_FIND_PER_ABILITY,
  DEFAULT_RULES, DIRECT_KEEP_SHARE, DIRECT_RATES, DISPOSITION_RATES, ERROR_PER_ABILITY, ERROR_SHARE, GRANT_RELATION, GREEDY_KEEP_BASE, MICHAELMAS_IN_YEAR,
  NEGLECT_PERMILLE, OVERLOAD_ERROR_PERMILLE, OVERLOAD_PETITION_DELAY, OVERLOAD_WAIT_RELATION, PETITION_ANSWER_TICKS, PETITION_KINDS, PUNISH_RECOVERY,
  PUNISH_TENANTS, RATE_RELATION_PER_PERMILLE, REFUSE_RELATION, RENT_SHARE, SOUR_TENANTS, SOUR_YIELD_LOSS, SUMMARIES_KEPT, TOLERATE_LOYALTY,
  HOME_PETITION_KINDS,
} from "../content/stewardshipConfig";
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import { HOME_PETITION_ENTRIES, HOME_PETITION_ENTRY_PREFIX, homeCycleKinds } from "../content/registry/homePetitions";
import { HOME_ESTATE_ID } from "../content/estateConfig";
import { MALE_GIVEN_NAMES, TOPOGRAPHIC_SURNAMES } from "../content/personNames";
import { postLedgerEntries } from "../ledger/ledger";
import type { GameState } from "./engine.types";
import { estatesOf, LORD } from "./estates";
import type { Estate } from "./estates.types";
import { hairWords, populationTraits } from "./heredity";
import { lordshipOf } from "./lordshipState";
import { ADULT_AGE, ageBandOf, ageOf, currentYear, manorLord, weightedName } from "./persons";
import { MANOR_HOUSEHOLD, type Person } from "./persons.types";
import { choosePortraitIdentity } from "./portraits";
import { hashSeed } from "./prng";
import type {
  AuditRecord, EstateOversight, EstatePetition, EstatePetitionKind, ExceptionRules, OversightMode, OversightView, QuarterSummary, StewardDisposition,
  StewardRecord, StewardshipState,
} from "./stewardship.types";
import { SEASONS_PER_YEAR } from "../content/packSettings";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const YEAR = SEASONS_PER_YEAR * SEASON;
const DISPOSITIONS: readonly StewardDisposition[] = ["merchant", "peasant", "greedy"];
const PETITION_ORDER: readonly EstatePetitionKind[] = ["rent_relief", "market_dues", "repair", "common_dispute", "charter_request", "marriage_licence"];

export const EMPTY_STEWARDSHIP: StewardshipState = { oversight: [], stewards: [], petitions: [], summaries: [], audits: [], rules: DEFAULT_RULES, nextPetition: 1, nextAudit: 1 };

/** SW-8 API: the stewardship (empty before the lord holds an estate off the map). */
export function stewardshipOf(state: Pick<GameState, "stewardship">): StewardshipState {
  return state.stewardship ?? EMPTY_STEWARDSHIP;
}

function withStewardship(state: GameState, stewardship: StewardshipState): GameState {
  return { ...state, stewardship };
}

/** The estates off the map the lord holds now (title and possession). */
export function heldOffMapEstates(state: GameState): readonly Estate[] {
  return state.estates === undefined ? [] : estatesOf(state).estates.filter(estate => estate.offMap && estate.possessor === LORD && estate.titleHolder === LORD);
}

const estateNumber = (estateId: string) => Number(estateId.replace(/\D+/g, "")) || 0;

// --- SW-1 attention -----------------------------------------------------------------------------------------------------

/** SW-1 API: the estates the lord can oversee himself, and why (base, a grown heir at home, age or wardship, a visit). */
export function attention(state: GameState): { readonly capacity: number; readonly load: number; readonly overloaded: boolean;
  readonly reasons: readonly { readonly name: "base" | "heir" | "age" | "visit"; readonly value: number }[] } {
  const year = currentYear(state);
  const order = lordshipOf(state).house.order;
  const people = state.persons?.people ?? [];
  const lord = manorLord(people, order, year);
  const reasons: { name: "base" | "heir" | "age" | "visit"; value: number }[] = [{ name: "base", value: ATTENTION_BASE }];
  const heir = people.some(person => person.householdId === MANOR_HOUSEHOLD && person.tags.includes(`lord-house:${order}`) && person.role === "child"
    && ageOf(person, year) >= ADULT_AGE);
  if (heir) reasons.push({ name: "heir", value: ATTENTION_HEIR });
  if (lordshipOf(state).wardship !== undefined || (lord !== undefined && ageOf(lord, year) >= ATTENTION_OLD_AGE)) reasons.push({ name: "age", value: -ATTENTION_AGE_LOSS });
  const visit = stewardshipOf(state).visitTick;
  if (visit !== undefined && state.tick - visit < YEAR) reasons.push({ name: "visit", value: -ATTENTION_VISIT_LOSS });
  const capacity = Math.max(1, reasons.reduce((sum, reason) => sum + reason.value, 0));
  // The home estate is always the lord's own (the map); each off-map estate he oversees himself adds one.
  const load = 1 + stewardshipOf(state).oversight.filter(entry => entry.mode === "direct" && heldOffMapEstates(state).some(estate => estate.id === entry.estateId)).length;
  return { capacity, load, overloaded: load > capacity, reasons };
}

// --- SW-3 the steward candidates ----------------------------------------------------------------------------------------

/** SW-3: an estate's three candidates (one of each disposition), as estate persons and steward records. */
function makeCandidates(state: GameState, estateId: string): { readonly people: readonly Person[]; readonly stewards: readonly StewardRecord[] } {
  const people = estatesOf(state).people;
  let ordinal = people.reduce((top, person) => Math.max(top, Number(person.id.slice(4)) || 0), 0) + 1;
  const made: Person[] = [];
  const stewards: StewardRecord[] = [];
  const number = estateNumber(estateId);
  // FIX-13 (ES-11): a later round of candidates (the first all dead) is drawn afresh; the first round's draws are kept.
  const round = Math.floor(stewardshipOf(state).stewards.filter(entry => entry.estateId === estateId).length / DISPOSITIONS.length);
  DISPOSITIONS.forEach((disposition, at) => {
    const index = at + round * DISPOSITIONS.length;
    const salt = (what: string) => hashSeed(state.seed, `steward:${what}`, number, index);
    const traits = populationTraits(state.seed, `steward:${estateId}`, index);
    const id = `est-${String(ordinal).padStart(6, "0")}`;
    ordinal += 1;
    const age = 28 + salt("age") % 25;
    const draft = { id, sex: "male" as const, classBand: "clerical" as const, build: traits.buildBias, occupation: "steward",
      tags: [`steward-candidate:${estateId}`], role: "head" as const, traits };
    made.push({ ...draft, givenName: weightedName(MALE_GIVEN_NAMES, salt("name")), surname: TOPOGRAPHIC_SURNAMES[salt("surname") % TOPOGRAPHIC_SURNAMES.length]!,
      birthYear: currentYear(state) - age, householdId: `steward:${estateId}`, hair: hairWords(traits), alive: true, lineageId: `steward:${id}`,
      portraitIdentity: choosePortraitIdentity(state.seed, draft, ageBandOf(age), new Map()) });
    const loyalty = disposition === "greedy" ? 20 + salt("loyalty") % 31 : 55 + salt("loyalty") % 36;
    const connection = disposition === "merchant" ? "merchant_house_1" : disposition === "peasant" ? "commons" : (["overlord", "bishop", null] as const)[salt("connection") % 3]!;
    stewards.push({ personId: id, estateId, ability: 30 + salt("ability") % 61, loyalty, disposition, connection, since: state.tick, kept: 0, errors: 0, status: "candidate" });
  });
  return { people: made, stewards };
}

/**
 * FIX-17 (A02): a steward record whose person lives — a candidate who died keeps the status "candidate" (only a serving
 * steward's death is turned into "dead" at the season's turn), so every choice of a steward asks the person.
 */
function living(state: GameState, record: StewardRecord): boolean {
  return record.status !== "dismissed" && record.status !== "dead" && estatesOf(state).people.find(person => person.id === record.personId)?.alive !== false;
}

/** SW-3 API: an estate's stewards — the serving one and the candidates, living (dismissed and dead ones are not offered). */
export function stewardCandidates(state: GameState, estateId: string): readonly { readonly record: StewardRecord; readonly person: Person | undefined }[] {
  const people = estatesOf(state).people;
  return stewardshipOf(state).stewards.filter(entry => entry.estateId === estateId && living(state, entry))
    .map(record => ({ record, person: people.find(person => person.id === record.personId) }));
}

/** SW-2: the estates the lord came to hold get their oversight (direct, the most loyal candidate keeping the accounts). */
function ensureOversight(state: GameState): GameState {
  const held = heldOffMapEstates(state);
  const current = stewardshipOf(state);
  const missing = held.filter(estate => !current.oversight.some(entry => entry.estateId === estate.id));
  if (missing.length === 0) return state;
  let next = state;
  let stewardship = current;
  for (const estate of missing) {
    const made = makeCandidates(next, estate.id);
    const receiver = [...made.stewards].sort((a, b) => b.loyalty - a.loyalty || a.personId.localeCompare(b.personId))[0]!;
    next = { ...next, estates: { ...estatesOf(next), people: [...estatesOf(next).people, ...made.people] } };
    stewardship = { ...stewardship, stewards: [...stewardship.stewards, ...made.stewards.map(record => record === receiver ? { ...record, status: "serving" as const } : record)],
      oversight: [...stewardship.oversight, { estateId: estate.id, mode: "direct", stewardId: receiver.personId, auditMode: "accounts", tenants: 0, merchants: 0,
      undetected: 0, since: state.tick }] };
  }
  return withStewardship(next, stewardship);
}

/**
 * FIX-13 (ES-11): a steward (or a direct estate's receiver) who died by the table is replaced at the season's turn — the
 * most loyal living candidate serves; with none left a fresh round of three is drawn. The mode stays.
 */
function replaceDeadStewards(state: GameState): GameState {
  let next = state;
  for (const oversight of stewardshipOf(state).oversight) {
    const people = estatesOf(next).people;
    if (people.find(person => person.id === oversight.stewardId)?.alive !== false) continue;
    let stewardship = stewardshipOf(next);
    stewardship = withSteward(stewardship, { ...steward(stewardship, oversight.stewardId)!, status: "dead" });
    const living = (records: readonly StewardRecord[]) => records.filter(entry => entry.estateId === oversight.estateId && entry.status === "candidate"
      && estatesOf(next).people.find(person => person.id === entry.personId)?.alive !== false);
    if (living(stewardship.stewards).length === 0) {
      const made = makeCandidates(withStewardship(next, stewardship), oversight.estateId);
      next = { ...next, estates: { ...estatesOf(next), people: [...estatesOf(next).people, ...made.people] } };
      stewardship = { ...stewardship, stewards: [...stewardship.stewards, ...made.stewards] };
    }
    const successor = [...living(stewardship.stewards)].sort((a, b) => b.loyalty - a.loyalty || a.personId.localeCompare(b.personId))[0]!;
    stewardship = withOversight(withSteward(stewardship, { ...successor, status: "serving", since: state.tick }), { ...oversight, stewardId: successor.personId, since: state.tick });
    next = withStewardship(next, stewardship);
  }
  return next;
}

// --- SW-4 petitions -----------------------------------------------------------------------------------------------------

/** SW-4: what a petition answered does — income (pennies, this season), the groups' goodwill, a repair's neglect, a bribe kept. */
function petitionEffect(petition: Pick<EstatePetition, "kind" | "amount">, grant: boolean, greedy: boolean):
  { readonly income: number; readonly tenants: number; readonly merchants: number; readonly neglect: boolean; readonly kept: number } {
  const none = { income: 0, tenants: 0, merchants: 0, neglect: false, kept: 0 };
  switch (petition.kind) {
    case "rent_relief": return grant ? { ...none, income: -petition.amount, tenants: GRANT_RELATION } : { ...none, tenants: REFUSE_RELATION };
    case "market_dues": return grant ? { ...none, income: -petition.amount, merchants: GRANT_RELATION } : { ...none, merchants: REFUSE_RELATION };
    case "repair": return grant ? { ...none, income: -petition.amount, tenants: GRANT_RELATION / 2 } : { ...none, tenants: REFUSE_RELATION, neglect: true };
    case "common_dispute": return grant ? { ...none, tenants: GRANT_RELATION / 2 + 1, merchants: -(GRANT_RELATION / 2 + 1) } : { ...none, tenants: -(GRANT_RELATION / 2 + 1), merchants: GRANT_RELATION / 2 + 1 };
    case "charter_request": return grant ? { ...none, income: -petition.amount, merchants: GRANT_RELATION + 4, kept: greedy ? 2 * petition.amount : 0 } : { ...none, merchants: REFUSE_RELATION - 2 };
    case "marriage_licence": return grant ? { ...none, income: greedy ? 0 : petition.amount, tenants: 2, kept: greedy ? petition.amount : 0 } : { ...none, tenants: -4 };
    // FIX-14 (SW-11): a home petition moves the treasury by its table (its factions through the ledger, `history.ts`).
    default: return { ...none, income: HOME_PETITION_KINDS[petition.kind][grant ? "grant" : "refuse"].income * petition.amount };
  }
}

/**
 * FIX-14 (SW-11): the home estate's season in lord mode — its petitions past their deadline lapse (refused, the wait
 * remembered), and one comes to the lord himself with the season's chance, in winter always when none came that year.
 * The kinds come in cycles of twelve, each cycle in its own order from the seed.
 * LM-E9 (ER-5): the kinds, their base order and the chance are the registry's home entries (`homePetitions.ts`); the
 * draws keep their names, so the petitions are the same.
 * LM-E9 (ER-6, NE10): a kind the lord has answered before the steward answers as he did ("선례대로"), unless the
 * lord's exceptions bring it up (recurring, or the amount, rights or marriage rule).
 */
function homePetitionSeason(state: GameState): GameState {
  if (state.agency === undefined) return state;
  let stewardship = stewardshipOf(state);
  const lapsed = stewardship.petitions.filter(petition => petition.estateId === HOME_ESTATE_ID && petition.status === "open" && state.tick > petition.deadline);
  if (lapsed.length > 0) stewardship = { ...stewardship, petitions: stewardship.petitions.map(petition => lapsed.includes(petition) ? { ...petition, status: "lapsed" as const } : petition) };
  const homes = stewardship.petitions.filter(petition => petition.estateId === HOME_ESTATE_ID);
  const year = Math.floor(state.tick / YEAR);
  const winter = Math.floor((state.tick % YEAR) / SEASON) === 3;
  const kinds = homeCycleKinds();
  const chance = HOME_PETITION_ENTRIES[0]?.frequency.chancePermille ?? 0;
  const comes = hashSeed(state.seed, "home-petition", state.tick) % 1000 < chance
    || (winter && !homes.some(petition => Math.floor(petition.tick / YEAR) === year));
  if (!comes) return lapsed.length === 0 ? state : withStewardship(state, stewardship);
  const cycle = Math.floor(homes.length / kinds.length);
  const order = [...kinds].sort((a, b) => hashSeed(state.seed, `home-petition-order:${a}`, cycle) - hashSeed(state.seed, `home-petition-order:${b}`, cycle) || a.localeCompare(b));
  const kind = order[homes.length % order.length]!;
  const def = HOME_PETITION_KINDS[kind];
  const amount = def.amount[0] + hashSeed(state.seed, "home-petition-amount", state.tick) % (def.amount[1] - def.amount[0] + 1);
  const petition: EstatePetition = { id: `estate-petition-${stewardship.nextPetition}`, estateId: HOME_ESTATE_ID, kind, group: def.group, amount,
    rights: def.rights === true, marriage: def.marriage === true, tick: state.tick, deadline: state.tick + PETITION_ANSWER_TICKS, status: "open", escalated: "direct",
    ...(def.party === true ? { party: hashSeed(state.seed, "home-petition-party", state.tick) % 2 === 0 ? "neighbour_1" : "neighbour_2" } : {}) };
  const entry = HOME_PETITION_ENTRIES.find(candidate => candidate.id === `${HOME_PETITION_ENTRY_PREFIX}${kind}`);
  const rules = stewardship.rules;
  // ER-6 (the user's decision 2026-10-03): a precedent is the lord's same answer to the kind twice running; and the year's
  // first home petition always comes to the lord (a year is never without his decision).
  const lordAnswers = homes.filter(earlier => earlier.kind === kind && earlier.decidedBy === "lord" && (earlier.status === "granted" || earlier.status === "refused"));
  const [last, before] = [lordAnswers.at(-1), lordAnswers.at(-2)];
  const settled = last !== undefined && before !== undefined && last.status === before.status ? last : undefined;
  const firstOfYear = !homes.some(earlier => Math.floor(earlier.tick / YEAR) === year && earlier.precedent !== true);
  const precedent = entry?.precedent !== true || rules.recurring === true || exceptionMatch(rules, petition) !== null || firstOfYear ? undefined : settled;
  if (precedent === undefined) {
    return withStewardship(state, { ...stewardship, petitions: [...stewardship.petitions, petition], nextPetition: stewardship.nextPetition + 1 });
  }
  // ER-6: answered by precedent — the same treasury line as the lord's answer (the factions move through the ledger).
  const grant = precedent.status === "granted";
  const { escalated: _escalated, ...rest } = petition;
  const answered: EstatePetition = { ...rest, status: grant ? "granted" : "refused", decidedBy: "steward", precedent: true };
  let next: GameState = state;
  const income = petitionEffect(answered, grant, false).income;
  if (income !== 0) {
    const posted = postLedgerEntries(next, [{ account: "cash", category: "estate_income", amount: income,
      sourceRefs: [{ type: "actor", id: `estate:${HOME_ESTATE_ID}` }, { type: "claim", id: answered.id, detail: answered.kind }] }]);
    next = { ...next, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
  }
  return withStewardship(next, { ...stewardship, petitions: [...stewardship.petitions, answered], nextPetition: stewardship.nextPetition + 1 });
}

/** SW-3: how a steward answers each kind, by his disposition (a dispute: grant = the tenants' side). */
const STEWARD_ANSWERS: Readonly<Record<StewardDisposition, Readonly<Record<EstatePetitionKind, boolean>>>> = {
  merchant: { rent_relief: false, market_dues: true, repair: true, common_dispute: false, charter_request: true, marriage_licence: true },
  peasant: { rent_relief: true, market_dues: false, repair: true, common_dispute: true, charter_request: false, marriage_licence: true },
  greedy: { rent_relief: false, market_dues: false, repair: false, common_dispute: false, charter_request: true, marriage_licence: true },
};

/** SW-5: the exceptions' rule a petition matches (the steward brings it to the lord), or null. */
export function exceptionMatch(rules: ExceptionRules, petition: Pick<EstatePetition, "amount" | "rights" | "marriage">): "amount" | "rights" | "marriage" | null {
  if (rules.rights && petition.rights) return "rights";
  if (rules.marriage && petition.marriage) return "marriage";
  if (rules.amountAtLeast !== null && petition.amount >= rules.amountAtLeast) return "amount";
  return null;
}

// --- SW-7 the season ----------------------------------------------------------------------------------------------------

const clamp = (value: number) => Math.max(-100, Math.min(100, Math.round(value)));

function steward(stewardship: StewardshipState, personId: string): StewardRecord | undefined {
  return stewardship.stewards.find(entry => entry.personId === personId);
}

function withSteward(stewardship: StewardshipState, record: StewardRecord): StewardshipState {
  return { ...stewardship, stewards: stewardship.stewards.map(entry => entry.personId === record.personId ? record : entry) };
}

function withOversight(stewardship: StewardshipState, oversight: EstateOversight): StewardshipState {
  return { ...stewardship, oversight: stewardship.oversight.map(entry => entry.estateId === oversight.estateId ? oversight : entry) };
}

/** The estate's card year worn by a refused repair (permille). */
function neglectEstate(state: GameState, estateId: string): GameState {
  const estates = estatesOf(state);
  return { ...state, estates: { ...estates, estates: estates.estates.map(estate => estate.id !== estateId ? estate
    : { ...estate, annualValue: Math.round(estate.annualValue * (1000 - NEGLECT_PERMILLE) / 1000) }) } };
}

/** SW-7: one estate's season — lapses, its petition, its yield by its rates, what is kept back and lost, the summary. */
function estateSeason(state: GameState, estate: Estate): GameState {
  let stewardship = stewardshipOf(state);
  let oversight = stewardship.oversight.find(entry => entry.estateId === estate.id)!;
  const record = steward(stewardship, oversight.stewardId)!;
  const overloaded = attention(state).overloaded && oversight.mode === "direct";
  let next = state;
  let tenants = oversight.tenants, merchants = oversight.merchants;
  let incomeDelta = 0, keptExtra = 0;
  const number = estateNumber(estate.id);
  // Petitions brought to the lord and not answered by their deadline lapse (refused, and the wait remembered).
  const lapsed = stewardship.petitions.filter(petition => petition.estateId === estate.id && petition.status === "open" && state.tick > petition.deadline);
  for (const petition of lapsed) {
    const effect = petitionEffect(petition, false, false);
    tenants += effect.tenants - (petition.group === "tenants" ? OVERLOAD_WAIT_RELATION : 0);
    merchants += effect.merchants - (petition.group === "merchants" ? OVERLOAD_WAIT_RELATION : 0);
    if (effect.neglect) next = neglectEstate(next, estate.id);
  }
  stewardship = { ...stewardship, petitions: stewardship.petitions.map(petition => lapsed.includes(petition) ? { ...petition, status: "lapsed" as const } : petition) };
  // The season's petition.
  const kind = PETITION_ORDER[hashSeed(state.seed, "estate-petition", number, state.tick) % PETITION_ORDER.length]!;
  const def = PETITION_KINDS[kind];
  const base = Math.round(estatesOf(next).estates.find(entry => entry.id === estate.id)!.annualValue / 4);
  const size = def.size[0] + hashSeed(state.seed, "estate-petition-size", number, state.tick) % (def.size[1] - def.size[0] + 1);
  const matched = oversight.mode === "direct" ? "direct" as const : exceptionMatch(stewardship.rules, { amount: Math.round(base * size / 1000), rights: def.rights === true, marriage: def.marriage === true });
  // FIX-14 (SW-12): a delegated estate's petition of a kind the lord has answered there before — the steward answers it
  // as he did (the precedent), unless the lord's exceptions bring recurring ones up again.
  const precedent = matched === null || matched === "direct" || stewardship.rules.recurring === true ? undefined
    : [...stewardship.petitions].reverse().find(entry => entry.estateId === estate.id && entry.kind === kind && entry.decidedBy === "lord" && (entry.status === "granted" || entry.status === "refused"));
  const rule = precedent === undefined ? matched : null;
  const petition: EstatePetition = { id: `estate-petition-${stewardship.nextPetition}`, estateId: estate.id, kind, group: def.group, amount: Math.round(base * size / 1000),
    rights: def.rights === true, marriage: def.marriage === true, tick: state.tick, deadline: state.tick + PETITION_ANSWER_TICKS + (overloaded ? OVERLOAD_PETITION_DELAY : 0),
    status: "open", ...(rule === null ? {} : { escalated: rule, ...(overloaded ? { reachesLord: state.tick + OVERLOAD_PETITION_DELAY } : {}) }) };
  let answered = petition;
  if (rule === null) {
    const grant = precedent !== undefined ? precedent.status === "granted" : STEWARD_ANSWERS[record.disposition][kind];
    const effect = petitionEffect(petition, grant, record.disposition === "greedy");
    incomeDelta += effect.income; tenants += effect.tenants; merchants += effect.merchants; keptExtra += effect.kept;
    if (effect.neglect) next = neglectEstate(next, estate.id);
    answered = { ...petition, status: grant ? "granted" : "refused", decidedBy: "steward", ...(precedent === undefined ? {} : { precedent: true as const }) };
  } else if (overloaded) {
    // An overloaded lord's estate: the petition waits a season before it reaches him.
    if (petition.group === "tenants") tenants -= OVERLOAD_WAIT_RELATION; else merchants -= OVERLOAD_WAIT_RELATION;
  }
  stewardship = { ...stewardship, petitions: [...stewardship.petitions, answered], nextPetition: stewardship.nextPetition + 1 };
  // The yield by the rates (the steward's disposition, or the old rates when direct).
  const rates = oversight.mode === "steward" ? DISPOSITION_RATES[record.disposition] : DIRECT_RATES;
  let income = Math.round(base * (RENT_SHARE * rates.rent + (1000 - RENT_SHARE) * rates.dues) / 1_000_000);
  if (tenants <= SOUR_TENANTS) income = Math.round(income * (1000 - SOUR_YIELD_LOSS) / 1000);
  income = Math.max(0, income + incomeDelta);
  tenants += (1000 - rates.rent) * RATE_RELATION_PER_PERMILLE;
  merchants += (1000 - rates.dues) * RATE_RELATION_PER_PERMILLE;
  // What the receiver keeps back (a third when the lord oversees himself), and what the books lose by error.
  const keepPermille = Math.round((record.disposition === "greedy" ? GREEDY_KEEP_BASE + (100 - record.loyalty) : (100 - record.loyalty) / 2)
    * (oversight.mode === "direct" ? DIRECT_KEEP_SHARE / 1000 : 1));
  const kept = Math.min(income, Math.round(income * keepPermille / 1000) + keptExtra);
  const errs = hashSeed(state.seed, "estate-error", number, state.tick) % 1000 < (100 - record.ability) * ERROR_PER_ABILITY + (overloaded ? OVERLOAD_ERROR_PERMILLE : 0);
  const error = errs ? Math.round((income - Math.min(income, kept)) * ERROR_SHARE / 1000) : 0;
  const reported = Math.max(0, income - kept - error);
  if (reported > 0) {
    const posted = postLedgerEntries(next, [{ account: "cash", category: "estate_income", amount: reported,
      sourceRefs: [{ type: "actor", id: `estate:${estate.id}` }, { type: "actor", id: `person:${record.personId}` }] }]);
    next = { ...next, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
  }
  oversight = { ...oversight, tenants: clamp(tenants), merchants: clamp(merchants) };
  stewardship = withSteward(withOversight(stewardship, oversight), { ...record, kept: record.kept + Math.min(income, kept), errors: record.errors + error });
  const summary: QuarterSummary = { estateId: estate.id, tick: state.tick, mode: oversight.mode, income, reported, kept: Math.min(income, kept), error,
    rentPermille: rates.rent, duesPermille: rates.dues, petitions: [...lapsed.map(entry => ({ id: entry.id, kind: entry.kind, status: "lapsed" as const })),
      { id: answered.id, kind: answered.kind, status: answered.status, ...(answered.decidedBy === undefined ? {} : { decidedBy: answered.decidedBy }) }],
    tenants: oversight.tenants, merchants: oversight.merchants, overloaded };
  const own = stewardship.summaries.filter(entry => entry.estateId === estate.id).slice(-(SUMMARIES_KEPT - 1));
  stewardship = { ...stewardship, summaries: [...stewardship.summaries.filter(entry => entry.estateId !== estate.id), ...own, summary] };
  return withStewardship(next, stewardship);
}

// --- SW-6 Michaelmas ----------------------------------------------------------------------------------------------------

/** SW-6: the audit of each estate's accounts — the errors always show; what was kept back, by the find's chance. */
function michaelmas(state: GameState): GameState {
  let stewardship = stewardshipOf(state);
  for (const oversight of stewardship.oversight) {
    if (!heldOffMapEstates(state).some(estate => estate.id === oversight.estateId)) continue;
    const record = steward(stewardship, oversight.stewardId)!;
    const find = AUDIT_FIND[oversight.auditMode] + (100 - record.ability) * AUDIT_FIND_PER_ABILITY;
    const found = hashSeed(state.seed, "audit-find", estateNumber(oversight.estateId), state.tick) % 1000 < find;
    const revealedKept = found ? record.kept : 0;
    const hidden = found ? 0 : record.kept;
    const audit: AuditRecord = { id: `audit-${stewardship.nextAudit}`, estateId: oversight.estateId, tick: state.tick, stewardId: record.personId,
      mode: oversight.auditMode, revealedKept, revealedErrors: record.errors, hidden, status: revealedKept + record.errors > 0 ? "pending" : "clean",
      deadline: state.tick + AUDIT_ANSWER_TICKS };
    stewardship = withOversight(withSteward(stewardship, { ...record, kept: 0, errors: 0 }), { ...oversight, undetected: oversight.undetected + hidden });
    stewardship = { ...stewardship, audits: [...stewardship.audits, audit], nextAudit: stewardship.nextAudit + 1,
      ...(oversight.auditMode === "visit" ? { visitTick: state.tick } : {}) };
  }
  return withStewardship(state, stewardship);
}

/** SW-6: an audit not answered within its season is tolerated. */
function lapseAudits(state: GameState): GameState {
  const stewardship = stewardshipOf(state);
  const due = stewardship.audits.filter(audit => audit.status === "pending" && state.tick > audit.deadline);
  if (due.length === 0) return state;
  let next = state;
  for (const audit of due) next = answerAudit(next, audit.id, "tolerate", true);
  return next;
}

/** SW-1…SW-7: one tick — the oversight of a newly held estate, each season's turn, Michaelmas, the lapses. */
export function advanceStewardship(state: GameState): GameState {
  if (state.tick <= 0 || state.estates === undefined) return state;
  const seasonStart = state.tick % SEASON === 0;
  const michaelmasDay = state.tick % YEAR === MICHAELMAS_IN_YEAR;
  if (!seasonStart && !michaelmasDay && state.stewardship === undefined) return state;
  let next = state;
  if (seasonStart) {
    next = homePetitionSeason(next);
    next = ensureOversight(next);
    if (next.stewardship !== undefined) next = replaceDeadStewards(next);
    for (const estate of heldOffMapEstates(next)) next = estateSeason(next, estate);
  }
  if (michaelmasDay && next.stewardship !== undefined) next = michaelmas(next);
  if (next.stewardship !== undefined) next = lapseAudits(next);
  return next;
}

// --- SW-2, SW-5, SW-6 the lord's commands --------------------------------------------------------------------------------

/** SW-2 API: oversee an estate directly or give it to a steward (one of its candidates; the receiver changes too). */
export function setEstateOversight(state: GameState, estateId: string, mode: OversightMode, stewardId?: string): GameState {
  const stewardship = stewardshipOf(state);
  const oversight = stewardship.oversight.find(entry => entry.estateId === estateId);
  if (oversight === undefined) return state;
  const chosen = stewardId ?? oversight.stewardId;
  const record = steward(stewardship, chosen);
  if (record === undefined || record.estateId !== estateId || !living(state, record)) return state;
  if (mode === oversight.mode && chosen === oversight.stewardId) return state;
  const swapped = chosen === oversight.stewardId ? stewardship
    : withSteward(withSteward(stewardship, { ...steward(stewardship, oversight.stewardId)!, status: "candidate" }), { ...record, status: "serving", since: state.tick });
  return withStewardship(state, withOversight(swapped, { ...oversight, mode, stewardId: chosen, since: state.tick }));
}

/** SW-5 API: the lord's exceptions (what every steward brings to him). */
export function setExceptionRules(state: GameState, rules: ExceptionRules): GameState {
  if (state.stewardship === undefined) return state;
  const current = stewardshipOf(state).rules;
  if (current.amountAtLeast === rules.amountAtLeast && current.rights === rules.rights && current.marriage === rules.marriage
    && (current.recurring === true) === (rules.recurring === true)) return state;
  return withStewardship(state, { ...stewardshipOf(state), rules });
}

/** SW-4 API: the petitions waiting for the lord (escalated, or a direct estate's) that have reached him. */
export function lordEstatePetitions(state: GameState): readonly EstatePetition[] {
  return stewardshipOf(state).petitions.filter(petition => petition.status === "open" && (petition.reachesLord ?? petition.tick) <= state.tick);
}

/**
 * LM-E9 (ER-6) API: the season report's list "청지기가 선례대로 처리한 것" — the petitions (home and off-map estates)
 * the steward answered by precedent in a season (by default the season just closed, as the season report shows it).
 */
export function precedentReport(state: GameState, startTick = Math.max(0, (Math.floor(state.tick / SEASON) - 1) * SEASON), endTick = startTick + SEASON): readonly EstatePetition[] {
  return stewardshipOf(state).petitions.filter(petition => petition.precedent === true && petition.tick >= startTick && petition.tick < endTick);
}

/** SW-4 API: the lord answers an estate's petition (its effect falls on the estate's goodwill and the treasury now). */
/**
 * LM-R2-E ② API: what the lord's answer to an open petition does — income, the tenants' and merchants' change, neglect
 * (the same table the answer uses, `petitionEffect`, as the lord answers it); null when it is not his open petition.
 */
export function estatePetitionEffect(state: GameState, petitionId: string, grant: boolean):
  { readonly income: number; readonly tenants: number; readonly merchants: number; readonly neglect: boolean } | null {
  const petition = lordEstatePetitions(state).find(entry => entry.id === petitionId);
  if (petition === undefined || state.tick > petition.deadline) return null;
  const { income, tenants, merchants, neglect } = petitionEffect(petition, grant, false);
  return { income, tenants, merchants, neglect };
}

export function answerEstatePetition(state: GameState, petitionId: string, grant: boolean): GameState {
  const stewardship = stewardshipOf(state);
  const petition = lordEstatePetitions(state).find(entry => entry.id === petitionId);
  if (petition === undefined || state.tick > petition.deadline) return state;
  const settled = (entry: EstatePetition) => entry.id === petitionId ? { ...entry, status: grant ? "granted" as const : "refused" as const, decidedBy: "lord" as const } : entry;
  // FIX-14 (SW-11): a home petition — the treasury by its table; its factions move through the ledger (`history.ts`).
  if (petition.estateId === HOME_ESTATE_ID) {
    const income = petitionEffect(petition, grant, false).income;
    let next: GameState = state;
    if (income !== 0) {
      const posted = postLedgerEntries(next, [{ account: "cash", category: "estate_income", amount: income,
        sourceRefs: [{ type: "actor", id: `estate:${HOME_ESTATE_ID}` }, { type: "claim", id: petition.id, detail: petition.kind }] }]);
      next = { ...next, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
    }
    return withStewardship(next, { ...stewardship, petitions: stewardship.petitions.map(settled) });
  }
  const oversight = stewardship.oversight.find(entry => entry.estateId === petition.estateId)!;
  const effect = petitionEffect(petition, grant, false);
  let next: GameState = state;
  if (effect.income !== 0) {
    const posted = postLedgerEntries(next, [{ account: "cash", category: "estate_income", amount: effect.income,
      sourceRefs: [{ type: "actor", id: `estate:${petition.estateId}` }, { type: "claim", id: petition.id, detail: petition.kind }] }]);
    next = { ...next, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
  }
  if (effect.neglect) next = neglectEstate(next, petition.estateId);
  const updated = withOversight({ ...stewardship, petitions: stewardship.petitions.map(entry => entry.id === petitionId
    ? { ...entry, status: grant ? "granted" as const : "refused" as const, decidedBy: "lord" as const } : entry) },
  { ...oversight, tenants: clamp(oversight.tenants + effect.tenants), merchants: clamp(oversight.merchants + effect.merchants) });
  return withStewardship(next, updated);
}

/** SW-6 API: how an estate is audited at Michaelmas — by its accounts, or the lord's visit (his attention is less for a year). */
export function setAuditMode(state: GameState, estateId: string, mode: "accounts" | "visit"): GameState {
  const stewardship = stewardshipOf(state);
  const oversight = stewardship.oversight.find(entry => entry.estateId === estateId);
  if (oversight === undefined || oversight.auditMode === mode) return state;
  return withStewardship(state, withOversight(stewardship, { ...oversight, auditMode: mode }));
}

/**
 * SW-6 API: the lord's answer to an audit that found something — punish (the steward dismissed, half of what he kept
 * recovered, the tenants approve, his faction does not), replace (dismissed, nothing recovered), or tolerate (kept,
 * more loyal). A dismissed steward's estate goes to `replacementId`, else the most able candidate left.
 */
/**
 * SW-6 (FIX-17 A02): the successor an audit's punish or replace answer puts in — the named living candidate, else the
 * ablest living one; undefined when none (the answer is refused).
 */
function auditSuccessor(state: GameState, stewardship: StewardshipState, audit: { readonly estateId: string; readonly stewardId: string }, replacementId?: string): StewardRecord | undefined {
  const others = stewardship.stewards.filter(entry => entry.estateId === audit.estateId && living(state, entry) && entry.personId !== audit.stewardId);
  // FIX-17 (A02): a named successor must be a living candidate (a dead or unknown one is refused, not replaced by another).
  if (replacementId !== undefined) return others.find(entry => entry.personId === replacementId);
  return [...others].sort((a, b) => b.ability - a.ability || a.personId.localeCompare(b.personId))[0];
}

/**
 * LM-R2-E ② API: what an answer to a pending audit does — the coin recovered, the tenants' change, the steward's loyalty
 * change, the successor — or null when the answer would be refused (not pending, past its deadline, no living successor).
 */
export function auditAnswerEffect(state: GameState, auditId: string, choice: "punish" | "replace" | "tolerate", replacementId?: string):
  { readonly recovered: number; readonly tenants: number; readonly loyalty: number; readonly successorId: string | null } | null {
  const stewardship = stewardshipOf(state);
  const audit = stewardship.audits.find(entry => entry.id === auditId);
  if (audit === undefined || audit.status !== "pending" || state.tick > audit.deadline) return null;
  const record = steward(stewardship, audit.stewardId)!;
  if (choice === "tolerate") return { recovered: 0, tenants: 0, loyalty: Math.min(100, record.loyalty + TOLERATE_LOYALTY) - record.loyalty, successorId: null };
  const successor = auditSuccessor(state, stewardship, audit, replacementId);
  if (successor === undefined) return null;
  return { recovered: choice === "punish" ? Math.round(audit.revealedKept * PUNISH_RECOVERY / 1000) : 0, tenants: choice === "punish" ? PUNISH_TENANTS : 0,
    loyalty: 0, successorId: successor.personId };
}

export function answerAudit(state: GameState, auditId: string, choice: "punish" | "replace" | "tolerate", lapsed = false, replacementId?: string): GameState {
  const stewardship = stewardshipOf(state);
  const audit = stewardship.audits.find(entry => entry.id === auditId);
  if (audit === undefined || audit.status !== "pending" || (!lapsed && state.tick > audit.deadline)) return state;
  const record = steward(stewardship, audit.stewardId)!;
  const oversight = stewardship.oversight.find(entry => entry.estateId === audit.estateId)!;
  const settled = { ...stewardship, audits: stewardship.audits.map(entry => entry.id === auditId
    ? { ...entry, status: choice === "punish" ? "punished" as const : choice === "replace" ? "replaced" as const : "tolerated" as const } : entry) };
  if (choice === "tolerate") return withStewardship(state, withSteward(settled, { ...record, loyalty: Math.min(100, record.loyalty + TOLERATE_LOYALTY) }));
  const successor = auditSuccessor(state, settled, audit, replacementId);
  if (successor === undefined) return state;
  let next = state;
  const recovered = choice === "punish" ? Math.round(audit.revealedKept * PUNISH_RECOVERY / 1000) : 0;
  if (recovered > 0) {
    const posted = postLedgerEntries(next, [{ account: "cash", category: "audit_recovery", amount: recovered,
      sourceRefs: [{ type: "claim", id: audit.id, detail: "audit" }, { type: "actor", id: `person:${record.personId}` }] }]);
    next = { ...next, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
  }
  const updated = withOversight(withSteward(withSteward(settled, { ...record, status: "dismissed" }), { ...successor, status: "serving", since: state.tick }),
    { ...oversight, stewardId: successor.personId, tenants: clamp(oversight.tenants + (choice === "punish" ? PUNISH_TENANTS : 0)), since: state.tick });
  return withStewardship(next, updated);
}

/** SW-6 API: the audits that wait for the lord's answer. */
export function pendingAudits(state: GameState): readonly AuditRecord[] {
  return stewardshipOf(state).audits.filter(audit => audit.status === "pending" && state.tick <= audit.deadline);
}

/** SW-8 API: each held off-map estate's oversight as the portfolio shows it. */
export function oversightViews(state: GameState): readonly OversightView[] {
  const stewardship = stewardshipOf(state);
  return stewardship.oversight.map(oversight => ({ estateId: oversight.estateId, holder: estatesOf(state).estates.find(estate => estate.id === oversight.estateId)?.possessor ?? LORD,
    oversight, steward: steward(stewardship, oversight.stewardId),
    lastSummary: [...stewardship.summaries].reverse().find(entry => entry.estateId === oversight.estateId),
    lastAudit: [...stewardship.audits].reverse().find(entry => entry.estateId === oversight.estateId) }));
}

/** SW-6: the next Michaelmas's tick from a tick. */
export function nextMichaelmas(tick: number): number {
  const inYear = tick % YEAR;
  return tick - inYear + MICHAELMAS_IN_YEAR + (inYear > MICHAELMAS_IN_YEAR ? YEAR : 0);
}
