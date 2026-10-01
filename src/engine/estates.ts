/**
 * LM-E2 estates and rights (spec docs/design/estates.md ES-1…ES-10). The town is the player's first estate: its title
 * and possession are the ruling house's, and its pieces (rent, the manor court, the market, the tolls, the mill, the
 * fishery, the church's advowson) each have a title holder and a possessor apart. FAIL-3's lost rights are now a
 * possession lost with the title kept: the overlord's custody (suspended) or the merchants' seizure. Three neighbour
 * estates lie off the map. With nothing yet different from the opening the state keeps no `estates` (ES-9): the
 * portfolio is read from the seed, so a town that never lost a right, claimed or sued is the very state it was.
 */
import {
  CLAIM_BASIS_STRENGTH, HOME_ESTATE_ID, HOME_PIECES, MARK_PENNIES, NEIGHBOUR_ESTATES, OLD_LORD_AGE, OLD_LORD_DAUGHTER_AGES,
  GRANT_PIECE, OLD_POSSESSION_YEARS, OPENING_CLAIMS, PIECE_INCOME_CATEGORIES, SOUND_STRENGTH,
} from "../content/estateConfig";
import { NEIGHBOUR_HOUSES } from "../content/factionConfig";
import type { LordRightId } from "../content/lordshipConfig";
import { FEMALE_GIVEN_NAMES, MALE_GIVEN_NAMES } from "../content/personNames";
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import type { GameState } from "./engine.types";
import type { Claim, ClaimBasis, Estate, EstatesState, HolderId, PossessionLoss, RightPiece, RightPieceKind } from "./estates.types";
import { hairWords, populationTraits } from "./heredity";
import { ageBandOf, currentYear, weightedName } from "./persons";
import type { Person } from "./persons.types";
import { choosePortraitIdentity } from "./portraits";
import { hashSeed } from "./prng";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const YEAR = 4 * SEASON;

/** ES-1: the town's ruling house, as a holder. */
export const LORD: HolderId = "lord";

/** ES-3: the home estate's piece for each FAIL-3 right. */
export const PIECE_OF_RIGHT: Readonly<Record<LordRightId, string>> = { market: "home:market", tolls: "home:tolls", mill: "home:mill" };

// --- ES-1, ES-8 the opening portfolio ----------------------------------------------------------------------------------

function homeEstate(): Estate {
  return {
    id: HOME_ESTATE_ID, name: "home", kind: "market_town", manors: 1, annualValue: 0, burdens: { debt: 0, rentCharges: 0, repairs: 0 },
    pieces: HOME_PIECES.map(piece => ({ ...piece, titleHolder: LORD, possessor: LORD, possessedSince: 0 })),
    titleHolder: LORD, possessor: LORD, titleStrength: SOUND_STRENGTH, possessionStrength: SOUND_STRENGTH, offMap: false,
  };
}

/** The year the game opens (the neighbours' ages are counted from it, so the portfolio reads the same at any tick). */
function openingYear(state: Pick<GameState, "scenarioId">): number {
  return currentYear({ ...state, tick: 0 });
}

/** ES-8: the third neighbour's house — an old lord, his two daughters, no son (his wife dead). */
function oldLordHouse(state: Pick<GameState, "seed" | "scenarioId" | "factions">): { readonly name: string; readonly people: readonly Person[] } {
  const taken = new Set((state.factions?.factions ?? []).filter(faction => faction.kind === "neighbour").map(faction => faction.name));
  const free = NEIGHBOUR_HOUSES.filter(name => !taken.has(name));
  const surname = free[hashSeed(state.seed, "estate:old-lord-house") % free.length] ?? NEIGHBOUR_HOUSES[0]!;
  const year = openingYear(state);
  const scope = "estate:neighbour-3";
  const person = (ordinal: number, sex: "male" | "female", age: number, role: Person["role"]): Person => {
    const traits = populationTraits(state.seed, scope, ordinal);
    const id = `est-${String(ordinal).padStart(6, "0")}`;
    const draft = { id, sex, classBand: "gentry" as const, build: traits.buildBias, occupation: role === "head" ? "lord" : "", tags: [scope], role, traits };
    return { ...draft, givenName: weightedName(sex === "male" ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES, hashSeed(state.seed, scope, ordinal)), surname,
      birthYear: year - age, householdId: scope, hair: hairWords(traits), alive: true, lineageId: scope,
      portraitIdentity: choosePortraitIdentity(state.seed, draft, ageBandOf(age), new Map()) };
  };
  const lord = person(1, "male", OLD_LORD_AGE, "head");
  const daughters = OLD_LORD_DAUGHTER_AGES.map((age, index) => ({ ...person(2 + index, "female", age, "child"), fatherId: lord.id }));
  return { name: surname, people: [lord, ...daughters] };
}

function neighbourEstates(state: Pick<GameState, "seed" | "scenarioId" | "factions">): { readonly estates: readonly Estate[]; readonly people: readonly Person[] } {
  const old = oldLordHouse(state);
  const estates = NEIGHBOUR_ESTATES.map((def, index): Estate => {
    const faction = def.faction === null ? undefined : state.factions?.factions.find(entry => entry.id === def.faction);
    const holder: HolderId = def.faction ?? `estate:${def.id}`;
    const house = def.faction === null
      ? { name: old.name, lordId: old.people[0]!.id, familyIds: old.people.map(person => person.id), rank: "gentry" as const }
      : { name: faction?.name ?? NEIGHBOUR_HOUSES[index]!, lordId: faction?.leaderId ?? "", familyIds: faction?.leaderId == null ? [] : [faction.leaderId], rank: "gentry" as const };
    const value = def.marks * MARK_PENNIES;
    return {
      id: def.id, name: house.name, kind: def.kind, manors: def.manors, annualValue: value, burdens: def.burdens,
      pieces: def.pieces.map(kind => ({ id: `${def.id}:${kind}`, kind, annualValue: Math.floor(value / def.pieces.length), titleHolder: holder, possessor: holder, possessedSince: 0 })),
      titleHolder: holder, possessor: holder, titleStrength: SOUND_STRENGTH, possessionStrength: SOUND_STRENGTH, offMap: true, house,
    };
  });
  return { estates, people: old.people };
}

/** ES-9: the opening portfolio — the home estate and the three neighbours, read from the seed. */
export function initialEstates(state: Pick<GameState, "seed" | "scenarioId" | "factions">): EstatesState {
  const neighbours = neighbourEstates(state);
  const claims: Claim[] = OPENING_CLAIMS.map((claim, index) => ({ id: `claim-${index + 1}`, claimant: LORD, estateId: claim.estateId,
    pieceId: `${claim.estateId}:${claim.pieceKind}`, basis: claim.basis, strength: CLAIM_BASIS_STRENGTH[claim.basis], evidence: [], since: 0, status: "open" }));
  return { estates: [homeEstate(), ...neighbours.estates], claims, suits: [], nextClaim: claims.length + 1, nextSuit: 1, people: neighbours.people };
}

/** ES-9 API: the estates — the stored ones once anything differs from the opening, else the opening portfolio. */
export function estatesOf(state: Pick<GameState, "estates" | "seed" | "scenarioId" | "factions">): EstatesState {
  return state.estates ?? initialEstates(state);
}

export function estateById(state: Pick<GameState, "estates" | "seed" | "scenarioId" | "factions">, id: string): Estate | undefined {
  return estatesOf(state).estates.find(estate => estate.id === id);
}

/** Replaces one estate (and keeps the portfolio in the state from now on). */
function withEstate(state: GameState, estates: EstatesState, estate: Estate): GameState {
  return { ...state, estates: { ...estates, estates: estates.estates.map(entry => entry.id === estate.id ? estate : entry) } };
}

function withPiece(estate: Estate, piece: RightPiece): Estate {
  return { ...estate, pieces: estate.pieces.map(entry => entry.id === piece.id ? piece : entry) };
}

// --- ES-3 the lord's three rights: title kept, possession lost -----------------------------------------------------------

/** ES-3 (FL-1): the lord possesses the right's piece (collects its income). Fast: no stored estates, every piece held. */
export function lordPossesses(state: Pick<GameState, "estates">, id: LordRightId): boolean {
  const home = state.estates?.estates.find(estate => estate.id === HOME_ESTATE_ID);
  const piece = home?.pieces.find(entry => entry.id === PIECE_OF_RIGHT[id]);
  return piece === undefined || piece.possessor === LORD;
}

/** ES-3 (FL-1): the lord's rights whose possession another holds — the FAIL-3 lost rights, in the order lost. */
export function lordRightsLost(state: Pick<GameState, "estates">): readonly { readonly id: LordRightId; readonly status: "suspended" | "seized"; readonly by: string; readonly since: number }[] {
  const home = state.estates?.estates.find(estate => estate.id === HOME_ESTATE_ID);
  if (home === undefined) return [];
  const lost = (Object.keys(PIECE_OF_RIGHT) as LordRightId[]).flatMap(id => {
    const piece = home.pieces.find(entry => entry.id === PIECE_OF_RIGHT[id]);
    return piece === undefined || piece.possessor === LORD || (piece.loss !== "suspended" && piece.loss !== "seized") ? []
      : [{ id, status: piece.loss, by: piece.possessor, since: piece.possessedSince }];
  });
  return lost.sort((a, b) => a.since - b.since);
}

/** ES-3: another takes possession of a piece; the title stays where it was. */
export function takePossession(state: GameState, estateId: string, pieceId: string, possessor: HolderId, loss: PossessionLoss): GameState {
  const estates = estatesOf(state);
  const estate = estates.estates.find(entry => entry.id === estateId);
  const piece = estate?.pieces.find(entry => entry.id === pieceId);
  if (estate === undefined || piece === undefined) return state;
  return withEstate(state, estates, withPiece(estate, { ...piece, possessor, possessedSince: state.tick, loss }));
}

/** ES-3: the title holder takes its piece back (FL-6's restoration, an enforced judgment). */
export function restorePossession(state: GameState, estateId: string, pieceId: string): GameState {
  const estates = estatesOf(state);
  const estate = estates.estates.find(entry => entry.id === estateId);
  const piece = estate?.pieces.find(entry => entry.id === pieceId);
  if (estate === undefined || piece === undefined || piece.possessor === piece.titleHolder) return state;
  const { loss: _loss, ...rest } = piece;
  return withEstate(state, estates, withPiece(estate, { ...rest, possessor: piece.titleHolder, possessedSince: state.tick }));
}

/**
 * ES-6 (FL-7): a new house takes the town — every home piece's title and possession are the ruling house's again (the
 * old house's lost rights end with it, as before), and the old house's nearest living kin keeps a claim by inheritance.
 */
export function houseChanged(state: GameState, oldOrder: number): GameState {
  const stored = state.estates;
  const kin = (state.persons?.people ?? []).filter(person => person.alive && person.tags.includes(`lord-house:${oldOrder}`))
    .sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id))[0];
  if (stored === undefined && kin === undefined) return state;
  let estates = stored ?? estatesOf(state);
  const home = estates.estates.find(estate => estate.id === HOME_ESTATE_ID);
  if (home !== undefined) {
    // As FAIL-3 cleared the lost rights: the pieces the overlord or the merchants took (suspended, seized) come back.
    const pieces = home.pieces.map(piece => {
      if (piece.loss !== "suspended" && piece.loss !== "seized") return piece;
      const { loss: _loss, ...rest } = piece;
      return { ...rest, possessor: piece.titleHolder, possessedSince: state.tick };
    });
    estates = { ...estates, estates: estates.estates.map(estate => estate.id === HOME_ESTATE_ID ? { ...home, pieces } : estate) };
  }
  const next: GameState = { ...state, estates };
  return kin === undefined ? next : raiseClaim(next, { claimant: `person:${kin.id}`, estateId: HOME_ESTATE_ID, basis: "inheritance" });
}

// --- ES-5, ES-6 claims ---------------------------------------------------------------------------------------------------

/** ES-5: a new claim (its strength by its basis); the same claimant, target and basis are never claimed twice. */
export function raiseClaim(state: GameState, fields: { readonly claimant: HolderId; readonly estateId: string; readonly pieceId?: string;
  readonly basis: ClaimBasis; readonly strength?: number }): GameState {
  const estates = estatesOf(state);
  if (estates.claims.some(claim => claim.claimant === fields.claimant && claim.estateId === fields.estateId && claim.pieceId === fields.pieceId
    && claim.basis === fields.basis && (claim.status === "open" || claim.status === "suing"))) return state;
  const claim: Claim = { id: `claim-${estates.nextClaim}`, claimant: fields.claimant, estateId: fields.estateId,
    ...(fields.pieceId === undefined ? {} : { pieceId: fields.pieceId }), basis: fields.basis,
    strength: fields.strength ?? CLAIM_BASIS_STRENGTH[fields.basis], evidence: [], since: state.tick, status: "open" };
  return { ...state, estates: { ...estates, claims: [...estates.claims, claim], nextClaim: estates.nextClaim + 1 } };
}

/** ES-5 API: the open claims on an estate (or one piece of it). */
export function claimsOn(state: GameState, estateId: string, pieceId?: string): readonly Claim[] {
  return estatesOf(state).claims.filter(claim => claim.estateId === estateId && (pieceId === undefined || claim.pieceId === pieceId)
    && (claim.status === "open" || claim.status === "suing"));
}

// --- ES-4 life estates and remainders ------------------------------------------------------------------------------------

/**
 * ES-4: a piece (or the whole estate when `pieceId` is absent) settled for a life: the life tenant takes possession and
 * holds for life; the remainder takes title and possession at the tenant's death. The title holder keeps the title
 * till then (a life estate is not a sale). Ermington 1432: the manor for life, the fishery kept back.
 */
export function settleForLife(state: GameState, estateId: string, lifeTenant: HolderId, remainder: HolderId, pieceIds?: readonly string[]): GameState {
  const estates = estatesOf(state);
  const estate = estates.estates.find(entry => entry.id === estateId);
  if (estate === undefined) return state;
  const settled = new Set(pieceIds ?? estate.pieces.map(piece => piece.id));
  const pieces = estate.pieces.map(piece => settled.has(piece.id)
    ? { ...piece, possessor: lifeTenant, possessedSince: state.tick, lifeTenant, remainder } : piece);
  const whole = pieceIds === undefined;
  return withEstate(state, estates, { ...estate, pieces, ...(whole ? { possessor: lifeTenant, lifeTenant, remainder } : {}) });
}

/** A holder who is a person is alive (the town's people, the factions', the neighbours'); any other holder is. */
function holderAlive(state: GameState, holder: HolderId): boolean {
  if (!holder.startsWith("person:")) return true;
  const id = holder.slice("person:".length);
  const person = [...(state.persons?.people ?? []), ...(state.persons?.past ?? []), ...(state.factions?.people ?? []), ...estatesOf(state).people]
    .find(entry => entry.id === id);
  return person?.alive !== false;
}

/**
 * ES-4, ES-6: the estates' year, at each year's first tick — a life tenant dead passes title and possession to the
 * remainder; a possessor without the title for `OLD_POSSESSION_YEARS` gains a claim by old possession. Nothing runs
 * with no stored estates (nothing differs from the opening).
 */
export function advanceEstates(state: GameState): GameState {
  if (state.estates === undefined || state.tick <= 0 || state.tick % YEAR !== 0) return state;
  let estates = state.estates;
  let next: GameState = state;
  for (const estate of estates.estates) {
    let changed = estate;
    for (const piece of estate.pieces) {
      if (piece.lifeTenant === undefined || piece.remainder === undefined || holderAlive(state, piece.lifeTenant)) continue;
      const { lifeTenant: _tenant, remainder, loss: _loss, ...rest } = piece;
      changed = withPiece(changed, { ...rest, titleHolder: remainder, possessor: remainder, possessedSince: state.tick });
    }
    if (changed.lifeTenant !== undefined && changed.remainder !== undefined && !holderAlive(state, changed.lifeTenant)) {
      const { lifeTenant: _tenant, remainder, ...rest } = changed;
      changed = { ...rest, titleHolder: remainder, possessor: remainder };
    }
    if (changed !== estate) estates = { ...estates, estates: estates.estates.map(entry => entry.id === estate.id ? changed : entry) };
  }
  next = { ...next, estates };
  for (const estate of estates.estates) for (const piece of estate.pieces) {
    if (piece.possessor === piece.titleHolder || piece.lifeTenant === piece.possessor) continue;
    if (state.tick - piece.possessedSince < OLD_POSSESSION_YEARS * YEAR) continue;
    next = raiseClaim(next, { claimant: piece.possessor, estateId: estate.id, pieceId: piece.id, basis: "old_possession" });
  }
  return next.estates === state.estates ? state : next;
}

// --- ES-10 the portfolio (for the screens, LM-R2) ------------------------------------------------------------------------

export interface PieceView extends RightPiece {
  /** A year's worth now: the paying pieces' last four ledger periods, the others' set value (pennies). */
  readonly yearValue: number;
  readonly claims: readonly Claim[];
}

/** ES-10: a franchise granted from a piece (4장 특허 이양, 5장 자치): its holder has its title and possession. */
export interface GrantView {
  readonly id: string;
  readonly kind: RightPieceKind | null;
  readonly titleHolder: HolderId;
  readonly possessor: HolderId;
  readonly since: number;
  /** The stall fee under it, permille of the usual. */
  readonly stallFeePermille: number;
}

export interface EstateView extends Omit<Estate, "pieces"> {
  readonly pieces: readonly PieceView[];
  readonly claims: readonly Claim[];
  /** ES-10: the franchises granted from the home estate — read from the grants' record (`politics.rights`). */
  readonly grants: readonly GrantView[];
}

/** ES-10 API: the portfolio — every estate, its pieces' title holders and possessors, their worth, the claims on them. */
export function estatePortfolio(state: GameState): readonly EstateView[] {
  const estates = estatesOf(state);
  const year = (kind: RightPieceKind): number | null => {
    const categories = PIECE_INCOME_CATEGORIES[kind];
    if (categories === undefined) return null;
    const from = state.tick - YEAR;
    return (state.ledger?.entries ?? []).filter(entry => entry.tick > from && categories.includes(entry.category) && entry.amount > 0)
      .reduce((sum, entry) => sum + entry.amount, 0);
  };
  return estates.estates.map(estate => {
    const pieces = estate.pieces.map(piece => ({ ...piece, yearValue: estate.offMap ? piece.annualValue : year(piece.kind) ?? piece.annualValue,
      claims: estates.claims.filter(claim => claim.pieceId === piece.id && (claim.status === "open" || claim.status === "suing")) }));
    // A faction's estate is led by the faction's leader now (the stored id is the one it had when stored).
    const leader = estate.house === undefined ? undefined : state.factions?.factions.find(faction => faction.id === estate.titleHolder)?.leaderId;
    const house = estate.house === undefined || leader == null ? estate.house : { ...estate.house, lordId: leader, familyIds: [leader] };
    const grants = estate.id !== HOME_ESTATE_ID ? [] : (state.politics?.rights ?? []).map(right => ({ id: `grant:${right.id}`,
      kind: GRANT_PIECE[right.id] ?? null, titleHolder: right.holder, possessor: right.holder, since: right.grantedTick, stallFeePermille: right.stallFeePermille }));
    return { ...estate, ...(house === undefined ? {} : { house }), pieces, grants, annualValue: estate.offMap ? estate.annualValue : pieces.reduce((sum, piece) => sum + piece.yearValue, 0),
      claims: estates.claims.filter(claim => claim.estateId === estate.id && claim.pieceId === undefined && (claim.status === "open" || claim.status === "suing")) };
  });
}

/** ES-8 API: the neighbour estates' people (the factions' lords and the old lord's house). */
export function estatePerson(state: GameState, id: string): Person | undefined {
  return estatesOf(state).people.find(person => person.id === id) ?? state.factions?.people.find(person => person.id === id);
}
