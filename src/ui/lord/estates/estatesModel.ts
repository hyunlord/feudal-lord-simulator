import { HOME_ESTATE_ID, MARK_PENNIES } from "../../../content/estateConfig";
import { GENTRY_NAMES_KO } from "../../../content/gentryNames";
import type { GameState } from "../../../engine/engine.types";
import { estatePortfolio, estatePerson, LORD, type EstateView } from "../../../engine/estates";
import type { EstateBurdens, EstateKind, HolderId, PossessionLoss, RightPieceKind } from "../../../engine/estates.types";
import { lordHouse } from "../../../engine/lordshipState";
import { currentYear, displayName } from "../../../engine/persons";
import { oversightViews } from "../../../engine/stewardship";
import type { OversightMode } from "../../../engine/stewardship.types";
import { moneyFull } from "../../money.ko";
import { ESTATES_COPY as COPY } from "./estatesCopy.ko";
import { perState } from "../../perState";

// LM-R2 (estates area, ES-10/SW-8): the portfolio card of one estate, read from the engine's `estatePortfolio` and
// `oversightViews` only. The region map (src/ui/lord/region) reads these types; the signature of `estateCardView`
// stays as it is.
//
// The card's picture (wave35-estates, 480×270) is picked from the Estate's own fields — its kind, its value, its
// burdens, its pieces' possession — never from a portrait. In order:
//   1. kind `mill_estate`                                   → riverside_mill
//   2. debt at least a year's worth (`burdens.debt ≥ annualValue`, the engine's own urgency ratio ≥ 1) → poor
//   3. a piece whose title the estate's holder keeps while another possesses it (ES-3)            → declining
//   4. 40 marks a year or more and no debt (estateConfig's richest anchor)                         → wealthy
//   5. a hunting piece                                                                             → hunting
//   6. otherwise                                                                                    → ordinary
// The integrated overlay sits on an off-map estate the lord has taken into possession (title and possession his).
// Ecclesiastical and moated have no engine field (no church holder, no moat) and are not pictures here.

export type EstatePicture = "ordinary" | "poor" | "wealthy" | "declining" | "hunting" | "riverside_mill";
/** How the lord stands to the estate: overseen himself, given to a steward, or another's (the region map's flags). */
export type EstateStanding = "direct" | "delegated" | "neighbour";

/** A picture is wealthy from this many marks a year (the richest neighbour's 40, Paston's 1444 anchor). */
export const WEALTHY_MARKS = 40;

export type EstatePieceRow = Readonly<{
  id: string; kind: RightPieceKind; name: string;
  titleHolderId: HolderId; titleHolder: string; possessorId: HolderId; possessor: string;
  lifeTenant: string | null; remainder: string | null;
  /** Pennies a year now (ES-10 `yearValue`), and as the card prints it. */
  yearValue: number; yearValueLine: string;
  claims: number; loss: PossessionLoss | null; note: string | null;
}>;

export type EstateGrantRow = Readonly<{ id: string; line: string }>;

export type EstateCardView = Readonly<{
  estateId: string;
  /** The card's name: "<house in Korean> 영지" (the home estate: the ruling house's 본영). */
  name: string;
  home: boolean;
  offMap: boolean;
  kind: EstateKind; kindName: string;
  standing: EstateStanding; standingLine: string;
  /** The oversight's mode when the lord holds it off the map (null at home and for another's estate). */
  oversight: OversightMode | null;
  titleHolderId: HolderId; titleHolder: string;
  possessorId: HolderId; possessor: string;
  lifeTenant: string | null; remainder: string | null;
  /** The house's lord (a neighbour estate's), for his portrait; null for the lord's own. */
  houseLordId: string | null;
  manors: number; manorsLine: string;
  annualValue: number; annualValueLine: string;
  burdens: EstateBurdens; burdensLine: string;
  pieces: readonly EstatePieceRow[];
  grants: readonly EstateGrantRow[];
  /** Open or suing claims on the estate and on its pieces. */
  claims: number; claimsLine: string;
  picture: EstatePicture;
  /** The integrated overlay (an off-map estate the lord took into possession). */
  overlay: boolean;
}>;

const yearOf = (state: GameState, tick: number): number => currentYear({ ...state, tick });
/** A house's name as the screens say it (the registry card's and the lead's decision cards' rule): Korean where the
 *  name table has it, the engine's name otherwise. */
export const houseNameKo = (name: string): string => GENTRY_NAMES_KO[name] ?? name;

/** A holder as the card names it: the lord's house, a faction or a house by its name, a person by theirs. */
export function holderLabel(state: GameState, holder: HolderId): string {
  if (holder === LORD) return COPY.lordHolder(houseNameKo(lordHouse(state).name));
  if (holder.startsWith("person:")) {
    const id = holder.slice("person:".length);
    const person = estatePerson(state, id) ?? state.persons?.people.find(entry => entry.id === id) ?? state.persons?.past?.find(entry => entry.id === id);
    return person === undefined ? COPY.personHolder : displayName(person);
  }
  if (holder.startsWith("estate:")) {
    const name = estatePortfolio(state).find(estate => estate.id === holder.slice("estate:".length))?.house?.name;
    return name === undefined ? COPY.estateHolder : COPY.houseHolder(houseNameKo(name));
  }
  const faction = state.factions?.factions.find(entry => entry.id === holder);
  return COPY.holders[holder] ?? (faction === undefined ? holder : houseNameKo(faction.name));
}

/** The card's picture from the Estate's fields (the order in the header). */
export function estatePicture(estate: Pick<EstateView, "kind" | "annualValue" | "burdens" | "titleHolder" | "pieces">): EstatePicture {
  if (estate.kind === "mill_estate") return "riverside_mill";
  if (estate.annualValue > 0 && estate.burdens.debt >= estate.annualValue) return "poor";
  if (estate.pieces.some(piece => piece.titleHolder === estate.titleHolder && piece.possessor !== estate.titleHolder)) return "declining";
  if (estate.annualValue >= WEALTHY_MARKS * MARK_PENNIES && estate.burdens.debt === 0) return "wealthy";
  if (estate.pieces.some(piece => piece.kind === "hunting")) return "hunting";
  return "ordinary";
}

/** The integrated overlay: an estate off the map whose title and possession are the lord's (taken into possession). */
export const estateIntegrated = (estate: Pick<EstateView, "offMap" | "titleHolder" | "possessor">): boolean =>
  estate.offMap && estate.titleHolder === LORD && estate.possessor === LORD;

function pieceRow(state: GameState, piece: EstateView["pieces"][number]): EstatePieceRow {
  const notes = [piece.loss === undefined || piece.possessor === piece.titleHolder ? null : COPY.losses[piece.loss],
    piece.scope === undefined ? null : COPY.scope(piece.scope.sharePermille)].filter((note): note is string => note !== null);
  return {
    id: piece.id, kind: piece.kind, name: COPY.pieceKinds[piece.kind],
    titleHolderId: piece.titleHolder, titleHolder: holderLabel(state, piece.titleHolder),
    possessorId: piece.possessor, possessor: holderLabel(state, piece.possessor),
    lifeTenant: piece.lifeTenant === undefined ? null : holderLabel(state, piece.lifeTenant),
    remainder: piece.remainder === undefined ? null : holderLabel(state, piece.remainder),
    yearValue: piece.yearValue, yearValueLine: moneyFull(piece.yearValue),
    claims: piece.claims.length, loss: piece.loss ?? null, note: notes.length === 0 ? null : notes.join(" · "),
  };
}

function cardOf(state: GameState, estate: EstateView, modes: ReadonlyMap<string, OversightMode>): EstateCardView {
  const home = estate.id === HOME_ESTATE_ID;
  const held = estate.titleHolder === LORD && estate.possessor === LORD;
  const oversight = estate.offMap && held ? modes.get(estate.id) ?? "direct" : null;
  const standing: EstateStanding = home || oversight === "direct" ? "direct" : oversight === "steward" ? "delegated" : held ? "direct" : "neighbour";
  const claims = estate.claims.length + estate.pieces.reduce((sum, piece) => sum + piece.claims.length, 0);
  const { debt, rentCharges, repairs } = estate.burdens;
  return {
    estateId: estate.id, name: home ? COPY.homeName(houseNameKo(lordHouse(state).name)) : COPY.estateName(houseNameKo(estate.name)), home, offMap: estate.offMap,
    kind: estate.kind, kindName: COPY.kinds[estate.kind],
    standing, standingLine: home ? COPY.homeStanding : COPY.standing[standing], oversight,
    titleHolderId: estate.titleHolder, titleHolder: holderLabel(state, estate.titleHolder),
    possessorId: estate.possessor, possessor: holderLabel(state, estate.possessor),
    lifeTenant: estate.lifeTenant === undefined ? null : holderLabel(state, estate.lifeTenant),
    remainder: estate.remainder === undefined ? null : holderLabel(state, estate.remainder),
    houseLordId: held || estate.house === undefined || estate.house.lordId === "" ? null : estate.house.lordId,
    manors: estate.manors, manorsLine: COPY.manors(estate.manors),
    annualValue: estate.annualValue, annualValueLine: moneyFull(estate.annualValue),
    burdens: estate.burdens,
    burdensLine: debt + rentCharges + repairs === 0 ? COPY.noBurdens : COPY.burdensLine(moneyFull(debt), moneyFull(rentCharges), moneyFull(repairs)),
    pieces: estate.pieces.map(piece => pieceRow(state, piece)),
    grants: estate.grants.map(grant => ({ id: grant.id,
      line: COPY.grantLine(grant.kind === null ? COPY.grantNoPiece : COPY.pieceKinds[grant.kind], holderLabel(state, grant.possessor), yearOf(state, grant.since)) })),
    claims, claimsLine: COPY.claimsCount(claims),
    picture: estatePicture(estate), overlay: estateIntegrated(estate),
  };
}

const oversightModes = (state: GameState): ReadonlyMap<string, OversightMode> =>
  new Map(oversightViews(state).map(view => [view.estateId, view.oversight.mode]));

/** Every estate's card, in the portfolio's order (home first, then the neighbours). Once per state (`perState`): the
 * lord screens re-render on clock and UI events within a tick, and the portfolio walks the ledger's year. */
export const estateCards = perState((state: GameState): readonly EstateCardView[] => {
  const modes = oversightModes(state);
  return estatePortfolio(state).map(estate => cardOf(state, estate, modes));
});

/** One estate's card (the region map's selected site opens the same estateId), or null for an unknown id. */
export function estateCardView(state: GameState, estateId: string): EstateCardView | null {
  return estateCards(state).find(card => card.estateId === estateId) ?? null;
}
