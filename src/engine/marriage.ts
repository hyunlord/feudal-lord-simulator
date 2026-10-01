/**
 * LM-E3 the marriage contract and the promise ledger (spec docs/design/negotiation.md NG-6…NG-9). The lord's house
 * offers a son of age for the third neighbour's elder daughter (the old lord with daughters only); the counterpart
 * accepts, counters or refuses (`negotiation.ts`). A contract pays its cash, writes every future term as a promise (kept
 * by its deadline, else broken), raises the relation and an expectation of the inheritance (an LM-E2 claim by marriage).
 * Then the middle events: the bride comes, a first child, perhaps a brother-in-law, the old lord's illness, perhaps a
 * new will, his death — and the inheritance: the estate becomes the lord's, or a brother's, or a rival's to be sued.
 */
import {
  BREACHED_NON_INFRINGEMENT_GAIN, BROTHER_IN_LAW_CLAIM_LOSS, BROTHER_IN_LAW_PERMILLE, CONTRACT_RELATION_GAIN, COUNTER_ANSWER_TICKS,
  GROOM_MIN_AGE, MARRIAGE_TIMES, MARRIAGE_WITNESSES, PROMISE_PAYMENT_TICKS, PROMISE_STAKE, PROMISE_SUPPORT_TICKS, WILL_CHANGE_PERMILLE,
  WILL_FAVOUR_PENNIES,
} from "../content/diplomacyConfig";
import { FEMALE_GIVEN_NAMES, MALE_GIVEN_NAMES } from "../content/personNames";
import { postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import type { DiplomacyState, MarriagePlan, Negotiation, PromiseRecord, Term } from "./diplomacy.types";
import type { GameState } from "./engine.types";
import { estatesOf, LORD, raiseClaim } from "./estates";
import { hairWords, populationTraits } from "./heredity";
import { lordshipOf } from "./lordshipState";
import { counterOffer, diplomacyOf, evaluateOffer, offerDraw } from "./negotiation";
import { ageBandOf, ageOf, currentYear, weightedName } from "./persons";
import { MANOR_HOUSEHOLD, type Person } from "./persons.types";
import { choosePortraitIdentity } from "./portraits";
import { hashSeed } from "./prng";

/** NG-7: the house the first marriage is offered to (LM-E2's third neighbour). */
export const MARRIAGE_ESTATE_ID = "estate-neighbour-3";
const COUNTERPART = `estate:${MARRIAGE_ESTATE_ID}`;

/** NG-7: why a marriage offer cannot be made now (the screens say it; the state is unchanged). */
export type MarriageRefusal = "no_groom" | "no_bride" | "under_way" | "treasury" | "no_terms";

function withDiplomacy(state: GameState, diplomacy: DiplomacyState): GameState {
  return { ...state, diplomacy };
}

// --- NG-7 the two candidates -------------------------------------------------------------------------------------------

/** NG-7 API: the groom — the lord's house's eldest son of age and unmarried; the bride — the old lord's elder unmarried daughter. */
export function marriageCandidates(state: GameState): { readonly groom: Person | null; readonly bride: Person | null } {
  const order = lordshipOf(state).house.order;
  const year = currentYear(state);
  const people = state.persons?.people ?? [];
  const married = new Set(people.flatMap(person => person.tags.filter(tag => tag.startsWith("spouse-of:")).map(tag => tag.slice("spouse-of:".length))));
  const groom = people.filter(person => person.householdId === MANOR_HOUSEHOLD && person.tags.includes(`lord-house:${order}`) && person.sex === "male"
    && person.role === "child" && ageOf(person, year) >= GROOM_MIN_AGE && !married.has(person.id))
    .sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id))[0] ?? null;
  const estate = estatesOf(state).estates.find(entry => entry.id === MARRIAGE_ESTATE_ID);
  const bride = estatesOf(state).people.filter(person => person.alive && person.sex === "female" && person.fatherId === estate?.house?.lordId
    && !person.tags.includes("married-out")).sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id))[0] ?? null;
  return { groom, bride };
}

/** NG-7 API: why a marriage offer would be refused now, or null. */
export function marriageRefusal(state: GameState, terms: readonly Term[]): MarriageRefusal | null {
  const { groom, bride } = marriageCandidates(state);
  if (groom === null) return "no_groom";
  if (bride === null) return "no_bride";
  const diplomacy = diplomacyOf(state);
  if (diplomacy.marriage !== undefined || diplomacy.negotiations.some(entry => entry.status === "countered")) return "under_way";
  if (terms.length === 0) return "no_terms";
  return cashOf(terms) > Math.max(0, treasuryBalance(state)) ? "treasury" : null;
}

const cashOf = (terms: readonly Term[]) => terms.filter(term => term.kind === "cash" && term.giver === "proposer").reduce((sum, term) => sum + (term.amount ?? 0), 0);

/** NG-7: the terms with the counterpart's consent (a marriage offer always asks it). */
function withConsent(terms: readonly Term[]): readonly Term[] {
  return terms.some(term => term.kind === "consent") ? terms : [...terms, { kind: "consent", giver: "counterpart" }];
}

// --- NG-7 the offer and the counter -------------------------------------------------------------------------------------

/**
 * NG-7: the lord's marriage offer — weighed now and answered by the seed's draw: accepted (the contract is made),
 * countered (the counter waits a season for the lord), or refused. Refused offers (`marriageRefusal`) change nothing.
 */
export function proposeMarriage(state: GameState, offered: readonly Term[]): GameState {
  if (marriageRefusal(state, offered) !== null) return state;
  const { groom, bride } = marriageCandidates(state);
  const terms = withConsent(offered);
  const diplomacy = diplomacyOf(state);
  const ordinal = diplomacy.nextNegotiation;
  const acceptance = evaluateOffer(state, LORD, COUNTERPART, terms);
  const accepted = offerDraw(state, ordinal) < acceptance.permille;
  const counter = accepted ? null : counterOffer(state, LORD, COUNTERPART, terms, `negotiation-${ordinal}`);
  const negotiation: Negotiation = { id: `negotiation-${ordinal}`, proposer: LORD, counterpart: COUNTERPART, purpose: "marriage",
    groomId: groom!.id, brideId: bride!.id, terms, acceptance, status: accepted ? "accepted" : counter === null ? "rejected" : "countered",
    ...(counter === null ? {} : { counter }), tick: state.tick, deadline: state.tick + COUNTER_ANSWER_TICKS };
  const next = withDiplomacy(state, { ...diplomacy, negotiations: [...diplomacy.negotiations, negotiation], nextNegotiation: ordinal + 1 });
  return accepted ? contract(next, negotiation, terms) : next;
}

/** NG-5: the lord takes the counter (the counterpart's own terms: it holds to them) or lets it go. */
export function answerCounter(state: GameState, negotiationId: string, accept: boolean): GameState {
  const diplomacy = diplomacyOf(state);
  const negotiation = diplomacy.negotiations.find(entry => entry.id === negotiationId);
  if (negotiation === undefined || negotiation.status !== "countered" || negotiation.counter === undefined || state.tick > negotiation.deadline) return state;
  if (accept && cashOf(negotiation.counter.terms) > Math.max(0, treasuryBalance(state))) return state;
  const settled = { ...negotiation, status: accept ? "accepted" as const : "withdrawn" as const };
  const next = withDiplomacy(state, { ...diplomacy, negotiations: diplomacy.negotiations.map(entry => entry.id === negotiationId ? settled : entry) });
  return accept ? contract(next, settled, negotiation.counter.terms) : next;
}

/** NG-5: a counter not answered within its season lapses (withdrawn). */
function lapseCounters(state: GameState): GameState {
  const diplomacy = state.diplomacy;
  if (diplomacy === undefined || !diplomacy.negotiations.some(entry => entry.status === "countered" && state.tick > entry.deadline)) return state;
  return withDiplomacy(state, { ...diplomacy, negotiations: diplomacy.negotiations.map(entry =>
    entry.status === "countered" && state.tick > entry.deadline ? { ...entry, status: "withdrawn" as const } : entry) });
}

// --- NG-6 the promise ledger --------------------------------------------------------------------------------------------

function promise(diplomacy: DiplomacyState, fields: Omit<PromiseRecord, "id" | "status">): { readonly diplomacy: DiplomacyState; readonly record: PromiseRecord } {
  const record: PromiseRecord = { ...fields, id: `promise-${diplomacy.nextPromise}`, status: "open" };
  return { diplomacy: { ...diplomacy, promises: [...diplomacy.promises, record], nextPromise: diplomacy.nextPromise + 1 }, record };
}

/** NG-6: the contract's future terms as promises — the lord's payments and support, the counterpart's word on the will. */
function contractPromises(diplomacy: DiplomacyState, negotiation: Negotiation, terms: readonly Term[], tick: number): DiplomacyState {
  let next = diplomacy;
  const base = { negotiationId: negotiation.id, witnesses: MARRIAGE_WITNESSES, stake: PROMISE_STAKE };
  for (const term of terms) {
    if (term.giver === "proposer" && term.kind === "debt_assumption") {
      next = promise(next, { ...base, promisor: LORD, promisee: negotiation.counterpart, term: term.kind, amount: term.amount ?? 0, deadline: tick + PROMISE_PAYMENT_TICKS }).diplomacy;
    }
    if (term.giver === "proposer" && term.kind === "pension") {
      for (let year = 1; year <= (term.years ?? 1); year += 1) {
        next = promise(next, { ...base, promisor: LORD, promisee: negotiation.counterpart, term: term.kind, amount: term.amount ?? 0, deadline: tick + year * PROMISE_PAYMENT_TICKS }).diplomacy;
      }
    }
    if (term.giver === "proposer" && term.kind === "political_support") {
      next = promise(next, { ...base, promisor: LORD, promisee: negotiation.counterpart, term: term.kind, deadline: tick + PROMISE_SUPPORT_TICKS }).diplomacy;
    }
    if (term.giver === "counterpart" && term.kind === "inheritance_non_infringement") {
      next = promise(next, { ...base, promisor: negotiation.counterpart, promisee: LORD, term: term.kind, deadline: tick + MARRIAGE_TIMES.fatherDies }).diplomacy;
    }
  }
  return next;
}

/** NG-6 API: the lord keeps a promise before its deadline — a payment is paid from the treasury; support is given. */
export function keepPromise(state: GameState, promiseId: string): GameState {
  const diplomacy = diplomacyOf(state);
  const record = diplomacy.promises.find(entry => entry.id === promiseId);
  if (record === undefined || record.status !== "open" || record.promisor !== LORD || state.tick > record.deadline) return state;
  let next = state;
  const amount = record.amount ?? 0;
  if (amount > 0) {
    if (treasuryBalance(state) < amount) return state;
    const posted = postLedgerEntries(state, [{ account: "cash", category: "promise_payment", amount: -amount,
      sourceRefs: [{ type: "claim", id: record.id, detail: record.term }, { type: "actor", id: record.promisee }] }]);
    next = { ...next, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
  }
  return settle(next, record.id, "kept");
}

function settle(state: GameState, promiseId: string, status: "kept" | "broken"): GameState {
  const diplomacy = diplomacyOf(state);
  return withDiplomacy(state, { ...diplomacy, promises: diplomacy.promises.map(entry => entry.id === promiseId ? { ...entry, status, settledTick: state.tick } : entry) });
}

/**
 * NG-6: the promises' deadlines — an open promise past its deadline is broken: the promisee's relation falls by its
 * stake (the trust is read from the broken promise in the next negotiation); the witnesses remember it (the ledger's
 * faction lines, `history.ts`). A counterpart's word on the will is kept when its deadline passes unbroken.
 */
function advancePromises(state: GameState): GameState {
  const diplomacy = state.diplomacy;
  if (diplomacy === undefined) return state;
  const due = diplomacy.promises.filter(entry => entry.status === "open" && state.tick > entry.deadline);
  if (due.length === 0) return state;
  let next = state;
  for (const record of due) {
    const keptByLapse = record.promisor !== LORD;
    next = settle(next, record.id, keptByLapse ? "kept" : "broken");
    if (!keptByLapse) {
      const now = diplomacyOf(next);
      next = withDiplomacy(next, { ...now, relations: { ...now.relations, [record.promisee]: (now.relations[record.promisee] ?? 0) - record.stake.relation } });
    }
  }
  return next;
}

// --- NG-7, NG-8 the contract and its middle events -----------------------------------------------------------------------

/** NG-7: the contract — its cash paid, its promises written, the relation raised, the expectation claimed (by marriage). */
function contract(state: GameState, negotiation: Negotiation, terms: readonly Term[]): GameState {
  let next = state;
  const cash = cashOf(terms);
  if (cash > 0) {
    const posted = postLedgerEntries(next, [{ account: "cash", category: "marriage_portion", amount: -cash,
      sourceRefs: [{ type: "claim", id: negotiation.id, detail: "marriage" }, { type: "actor", id: negotiation.counterpart }] }]);
    next = { ...next, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
  }
  const claimed = raiseClaim(next, { claimant: LORD, estateId: MARRIAGE_ESTATE_ID, basis: "marriage" });
  const claimId = estatesOf(claimed).claims.at(-1)!.id;
  let diplomacy = contractPromises(diplomacyOf(claimed), negotiation, terms, state.tick);
  diplomacy = { ...diplomacy, relations: { ...diplomacy.relations, [negotiation.counterpart]: (diplomacy.relations[negotiation.counterpart] ?? 0) + CONTRACT_RELATION_GAIN } };
  const plan: MarriagePlan = { negotiationId: negotiation.id, groomId: negotiation.groomId, brideId: negotiation.brideId, estateId: MARRIAGE_ESTATE_ID,
    contractedTick: state.tick, stage: "contracted", claimId, events: {} };
  return withDiplomacy(claimed, { ...diplomacy, marriage: plan });
}

function withPlan(state: GameState, plan: MarriagePlan): GameState {
  return withDiplomacy(state, { ...diplomacyOf(state), marriage: plan });
}

/** The estates' people with one changed or added. */
function withEstatePeople(state: GameState, people: readonly Person[]): GameState {
  return { ...state, estates: { ...estatesOf(state), people } };
}

function estatePerson(ordinal: number, state: GameState, fields: { readonly sex: "male" | "female"; readonly age: number; readonly fatherId?: string; readonly surname?: string; readonly tag: string }): Person {
  const traits = populationTraits(state.seed, fields.tag, ordinal);
  const id = `est-${String(ordinal).padStart(6, "0")}`;
  const draft = { id, sex: fields.sex, classBand: "gentry" as const, build: traits.buildBias, occupation: "", tags: [fields.tag], role: "child" as const, traits };
  return { ...draft, givenName: weightedName(fields.sex === "male" ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES, hashSeed(state.seed, fields.tag, ordinal)),
    ...(fields.surname === undefined ? {} : { surname: fields.surname }), birthYear: currentYear(state) - fields.age, householdId: fields.tag,
    hair: hairWords(traits), alive: true, lineageId: fields.tag, ...(fields.fatherId === undefined ? {} : { fatherId: fields.fatherId }),
    portraitIdentity: choosePortraitIdentity(state.seed, draft, ageBandOf(fields.age), new Map()) };
}

/** The whole estate (its pieces too) to a holder: title and possession. */
function estateTo(state: GameState, estateId: string, holder: string): GameState {
  const estates = estatesOf(state);
  return { ...state, estates: { ...estates, estates: estates.estates.map(estate => estate.id !== estateId ? estate : {
    ...estate, titleHolder: holder, possessor: holder, pieces: estate.pieces.map(piece => {
      const { loss: _loss, ...rest } = piece;
      return { ...rest, titleHolder: holder, possessor: holder, possessedSince: state.tick };
    }) }) } };
}

function claimStrength(state: GameState, claimId: string, delta: number): GameState {
  const estates = estatesOf(state);
  return { ...state, estates: { ...estates, claims: estates.claims.map(claim => claim.id === claimId ? { ...claim, strength: Math.max(0, claim.strength + delta) } : claim) } };
}

function claimStatus(state: GameState, claimId: string, status: "won" | "lapsed"): GameState {
  const estates = estatesOf(state);
  return { ...state, estates: { ...estates, claims: estates.claims.map(claim => claim.id === claimId ? { ...claim, status } : claim) } };
}

/** NG-8: the bride comes to the manor (her husband's house's), from her father's house. */
function brideArrives(state: GameState, plan: MarriagePlan): GameState {
  const people = estatesOf(state).people;
  const bride = people.find(person => person.id === plan.brideId);
  if (bride === undefined || state.persons === undefined) return state;
  const order = lordshipOf(state).house.order;
  const moved: Person = { ...bride, householdId: MANOR_HOUSEHOLD, role: "kin", tags: ["lord-family", `lord-house:${order}`, `spouse-of:${plan.groomId}`, `born:${MARRIAGE_ESTATE_ID}`] };
  const next = withEstatePeople(state, people.map(person => person.id === bride.id ? { ...person, tags: [...person.tags, "married-out"] } : person));
  return { ...next, persons: { ...state.persons, people: [...state.persons.people, moved].sort((a, b) => a.id.localeCompare(b.id)) } };
}

/** NG-8: the couple's first child, born in the manor (the lord's family's own ordinal). */
function firstChild(state: GameState, plan: MarriagePlan): GameState {
  const persons = state.persons;
  if (persons === undefined) return state;
  const groom = persons.people.find(person => person.id === plan.groomId);
  const ordinal = persons.lordOrdinal ?? 1;
  const id = `m-${String(ordinal).padStart(6, "0")}`;
  const sex = hashSeed(state.seed, "marriage-child", ordinal) % 2 === 0 ? "male" as const : "female" as const;
  const traits = populationTraits(state.seed, "lord-child", ordinal);
  const order = lordshipOf(state).house.order;
  const draft = { id, sex, classBand: "gentry" as const, build: traits.buildBias, occupation: "", tags: ["lord-family", `lord-house:${order}`], role: "child" as const, traits };
  const child: Person = { ...draft, givenName: weightedName(sex === "male" ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES, hashSeed(state.seed, "lord-child", ordinal)),
    ...(groom?.surname === undefined ? {} : { surname: groom.surname }), birthYear: currentYear(state), householdId: MANOR_HOUSEHOLD, hair: hairWords(traits),
    alive: true, lineageId: groom?.lineageId ?? `lin:${id}`, motherId: plan.brideId, fatherId: plan.groomId,
    portraitIdentity: choosePortraitIdentity(state.seed, draft, ageBandOf(0), new Map()) };
  return { ...state, persons: { ...persons, people: [...persons.people, child].sort((a, b) => a.id.localeCompare(b.id)), lordOrdinal: ordinal + 1 } };
}

function nextEstateOrdinal(state: GameState): number {
  return estatesOf(state).people.reduce((top, person) => Math.max(top, Number(person.id.slice(4)) || 0), 0) + 1;
}

function oldLord(state: GameState): Person | undefined {
  const estate = estatesOf(state).estates.find(entry => entry.id === MARRIAGE_ESTATE_ID);
  return estatesOf(state).people.find(person => person.id === estate?.house?.lordId);
}

/** NG-8 API: the will-change answer — a favour paid, support promised, or the new will let stand (it names a rival). */
export function answerWillChange(state: GameState, choice: "favour" | "support_promise" | "let_it_be"): GameState {
  const plan = diplomacyOf(state).marriage;
  if (plan === undefined || plan.stage !== "will_change" || plan.willAnswer !== undefined) return state;
  if (choice === "favour") {
    if (treasuryBalance(state) < WILL_FAVOUR_PENNIES) return state;
    const posted = postLedgerEntries(state, [{ account: "cash", category: "promise_payment", amount: -WILL_FAVOUR_PENNIES,
      sourceRefs: [{ type: "claim", id: plan.claimId, detail: "will_favour" }, { type: "actor", id: COUNTERPART }] }]);
    return withPlan({ ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin },
      { ...plan, stage: "father_ill", willAnswer: choice, events: { ...plan.events, will_dropped: state.tick } });
  }
  if (choice === "support_promise") {
    const made = promise(diplomacyOf(state), { promisor: LORD, promisee: COUNTERPART, term: "political_support", deadline: state.tick + PROMISE_SUPPORT_TICKS,
      witnesses: MARRIAGE_WITNESSES, stake: PROMISE_STAKE, negotiationId: plan.negotiationId });
    return withDiplomacy(state, { ...made.diplomacy, marriage: { ...plan, stage: "father_ill", willAnswer: choice, events: { ...plan.events, will_dropped: state.tick } } });
  }
  // The new will stands: it leaves the estate to a nephew; the counterpart's word on the inheritance, if given, is broken.
  const surname = oldLord(state)?.surname;
  const nephew = estatePerson(nextEstateOrdinal(state), state, { sex: "male", age: 24, tag: `estate:${MARRIAGE_ESTATE_ID}`, ...(surname === undefined ? {} : { surname }) });
  let next = withEstatePeople(state, [...estatesOf(state).people, nephew]);
  const rival = `person:${nephew.id}`;
  next = raiseClaim(next, { claimant: rival, estateId: MARRIAGE_ESTATE_ID, basis: "grant" });
  const word = diplomacyOf(next).promises.find(entry => entry.promisor === COUNTERPART && entry.term === "inheritance_non_infringement" && entry.status === "open");
  if (word !== undefined) next = claimStrength(settle(next, word.id, "broken"), plan.claimId, BREACHED_NON_INFRINGEMENT_GAIN);
  return withPlan(next, { ...plan, stage: "father_ill", willAnswer: choice, rival });
}

/** NG-8 API: what the marriage needs from the lord now (null: nothing; the screens show the stage). */
export function marriageDecisionDue(state: GameState): "will_change" | "contested" | null {
  const plan = diplomacyOf(state).marriage;
  if (plan?.stage === "will_change" && plan.willAnswer === undefined) return "will_change";
  return plan?.stage === "contested" ? "contested" : null;
}

/** NG-8: the old lord dies — the estate goes to his son, or the will's rival (the lord sues), or the lord by his wife. */
function inheritance(state: GameState, plan: MarriagePlan): GameState {
  const lord = oldLord(state);
  let next = lord === undefined ? state : withEstatePeople(state, estatesOf(state).people.map(person => person.id === lord.id ? { ...person, alive: false, deathYear: currentYear(state), deathCause: "age" as const } : person));
  const son = plan.brotherInLawId === undefined ? undefined : estatesOf(next).people.find(person => person.id === plan.brotherInLawId && person.alive);
  const events = { ...plan.events, father_died: state.tick };
  if (son !== undefined) {
    next = claimStatus(estateTo(next, MARRIAGE_ESTATE_ID, `person:${son.id}`), plan.claimId, "lapsed");
    return withPlan(next, { ...plan, stage: "lost", events });
  }
  if (plan.rival !== undefined) return withPlan(estateTo(next, MARRIAGE_ESTATE_ID, plan.rival), { ...plan, stage: "contested", events });
  next = claimStatus(estateTo(next, MARRIAGE_ESTATE_ID, LORD), plan.claimId, "won");
  return withPlan(next, { ...plan, stage: "inherited", events });
}

/**
 * NG-8: the marriage's middle events, each once at its time after the contract: the bride's coming, the first child,
 * perhaps a brother-in-law (the seed), the old lord's illness, perhaps a new will (the seed; answered by the lord within
 * a season, else let stand), his death and the inheritance; a contested estate becomes the lord's when a suit wins it.
 */
function advanceMarriage(state: GameState): GameState {
  const plan = state.diplomacy?.marriage;
  if (plan === undefined || plan.stage === "inherited" || plan.stage === "lost") return state;
  const since = state.tick - plan.contractedTick;
  const ev = plan.events;
  const t = MARRIAGE_TIMES;
  if (ev.bride_arrived === undefined && since >= t.brideArrives) {
    return withPlan(brideArrives(state, plan), { ...plan, stage: "bride_arrived", events: { ...ev, bride_arrived: state.tick } });
  }
  if (ev.child_born === undefined && since >= t.childBorn) {
    return withPlan(firstChild(state, plan), { ...plan, stage: "child_born", events: { ...ev, child_born: state.tick } });
  }
  if (ev.brother_in_law_born === undefined && since >= t.brotherInLaw && plan.brotherInLawId === undefined) {
    const born = hashSeed(state.seed, "marriage-brother-in-law", plan.contractedTick) % 1000 < BROTHER_IN_LAW_PERMILLE;
    if (!born) return withPlan(state, { ...plan, events: { ...ev, brother_in_law_born: -1 } });
    const lord = oldLord(state);
    const son = estatePerson(nextEstateOrdinal(state), state, { sex: "male", age: 0, tag: `estate:${MARRIAGE_ESTATE_ID}`,
      ...(lord?.id === undefined ? {} : { fatherId: lord.id }), ...(lord?.surname === undefined ? {} : { surname: lord.surname }) });
    const next = claimStrength(withEstatePeople(state, [...estatesOf(state).people, son]), plan.claimId, -BROTHER_IN_LAW_CLAIM_LOSS);
    return withPlan(next, { ...plan, brotherInLawId: son.id, events: { ...ev, brother_in_law_born: state.tick } });
  }
  if (ev.father_ill === undefined && since >= t.fatherIll) return withPlan(state, { ...plan, stage: "father_ill", events: { ...ev, father_ill: state.tick } });
  if (ev.will_change === undefined && since >= t.willChange) {
    const tried = plan.brotherInLawId === undefined && hashSeed(state.seed, "marriage-will", plan.contractedTick) % 1000 < WILL_CHANGE_PERMILLE;
    return withPlan(state, { ...plan, ...(tried ? { stage: "will_change" as const } : {}), events: { ...ev, will_change: tried ? state.tick : -1 } });
  }
  if (plan.stage === "will_change" && plan.willAnswer === undefined && since >= t.willChange + t.willAnswer) return answerWillChange(state, "let_it_be");
  if (ev.father_died === undefined && since >= t.fatherDies) return inheritance(state, plan);
  if (plan.stage === "contested") {
    const estate = estatesOf(state).estates.find(entry => entry.id === MARRIAGE_ESTATE_ID);
    if (estate !== undefined && estate.titleHolder === LORD && estate.possessor === LORD) {
      return withPlan(estateTo(state, MARRIAGE_ESTATE_ID, LORD), { ...plan, stage: "inherited" });
    }
  }
  return state;
}

/**
 * NG-9 API: the lord-mode bot's one marriage attempt — once a groom is of age and nothing was offered yet, it offers the
 * standard terms (a portion of a third of the treasury, the counterpart's word and the bride's residence) and takes a
 * counter it can pay at signing; it never offers twice. Returns the commands it would send (the caller dispatches them).
 */
export function lordBotMarriageCommands(state: GameState): readonly ({ readonly type: "propose_marriage"; readonly terms: readonly Term[] } | { readonly type: "answer_counter"; readonly negotiationId: string; readonly accept: boolean })[] {
  const diplomacy = diplomacyOf(state);
  const countered = diplomacy.negotiations.find(entry => entry.status === "countered");
  if (countered !== undefined) return [{ type: "answer_counter", negotiationId: countered.id, accept: cashOf(countered.counter?.terms ?? []) <= treasuryBalance(state) }];
  if (diplomacy.negotiations.length > 0) return [];
  const { groom, bride } = marriageCandidates(state);
  if (groom === null || bride === null) return [];
  const portion = Math.floor(Math.max(0, treasuryBalance(state)) / 3);
  return [{ type: "propose_marriage", terms: [{ kind: "cash", giver: "proposer", amount: portion }, { kind: "inheritance_non_infringement", giver: "counterpart" },
    { kind: "residence", giver: "counterpart" }] }];
}

/** NG-1: the diplomacy's tick — counters lapse, promises fall due, the marriage moves (nothing with no diplomacy). */
export function advanceDiplomacy(state: GameState): GameState {
  if (state.diplomacy === undefined) return state;
  return advanceMarriage(advancePromises(lapseCounters(state)));
}
