import { HOME_ESTATE_ID } from "../content/estateConfig";
import { factionDisplayName } from "../content/factionCopy.ko";
import { LEGACY_BALANCE } from "../content/legacyConfig";
import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import { HOME_PETITION_KINDS } from "../content/stewardshipConfig";
import { autoplayActionToGameAction } from "../engine/autoplayActions";
import type { GameState } from "../engine/engine.types";
import { faction, kingAt } from "../engine/factions";
import { lordHouse, lordshipOf } from "../engine/lordshipState";
import type { EmblemSpec } from "./heraldry/EmblemImage";
import { lordHouseArms } from "./persons/personModels";
import { ageOf, manorLord, personById, personDisplayName } from "../engine/persons";
import { stateCalendar } from "../engine/scenarioState";
import { lordEstatePetitions, precedentReport, stewardshipOf } from "../engine/stewardship";
import type { EstatePetition, HomePetitionKind } from "../engine/stewardship.types";
import { lordMode, lordRequests } from "../engine/townAgency";
import type { LordRequest } from "../engine/townAgency.types";
import type { GameAction } from "../state/gameStore.types";
import { calendarDays } from "./gameTimeCopy.ko";
import { HOME_PETITION_COPY, LORD_CARDS_COPY, type PetitionParties } from "./lordCardsCopy.ko";
import { PETITION_COPY } from "./petitionCopy.ko";
import { HOME_PETITION_ART, PRECEDENT_ART, type Wave44ImageId } from "./wave44Art";

// LM-R1 (petitions) the lord's cards, lord mode only (`lordMode`): the home estate's petitions as the engine raises them
// (`lordEstatePetitions`, estate "estate-home", FIX-14 SW-11) — a different API from the political petitions'
// (`PetitionRecord.defId`): each card is answered through `answer_estate_petition`, and each answer shows what the
// engine's own table (`HOME_PETITION_KINDS`) does to the treasury now and to each faction (`history.ts` moves them by
// that table on the answer). The steward's answers by precedent (`precedentReport`, SW-12), the town's requests
// (`lordRequests`, TA-7) and the court line (the king `kingAt`, the lord's age, the guardian of a minor lord).

export type RelationMove = Readonly<{ factionId: string; name: string; delta: number }>;
export type HomePetitionOption = Readonly<{ grant: boolean; label: string; treasury: number; relations: readonly RelationMove[]; line: string }>;
export type HomePetitionView = Readonly<{
  petitionId: string; kind: HomePetitionKind; art: Wave44ImageId | null; title: string; demand: string; court: string; waits: string;
  /** ER-6: what the steward does with the kind next (a hint before a precedent; why a settled kind still came). */
  precedent: string | null;
  recurring: boolean;
  options: readonly [HomePetitionOption, HomePetitionOption];
  /** LR1-D5 (user 2026-10-05): the lord house's arms in the frame's roundel, as the lordship screen shows them. */
  arms: EmblemSpec; armsLabel: string;
}>;

const isHomeKind = (kind: EstatePetition["kind"]): kind is HomePetitionKind => Object.hasOwn(HOME_PETITION_KINDS, kind);

/** The home petitions waiting for the lord, oldest first (none outside lord mode). */
export function openHomePetitions(state: GameState): readonly (EstatePetition & { readonly kind: HomePetitionKind })[] {
  if (!lordMode(state)) return [];
  return lordEstatePetitions(state).filter((petition): petition is EstatePetition & { readonly kind: HomePetitionKind } =>
    petition.estateId === HOME_ESTATE_ID && isHomeKind(petition.kind));
}

const factionName = (state: GameState, id: string): string | null => {
  const view = faction(state, id as Parameters<typeof faction>[1]);
  return view === undefined ? null : factionDisplayName(view.id, view.name);
};

function parties(state: GameState, petition: Pick<EstatePetition, "party">): PetitionParties {
  return {
    party: (petition.party === undefined ? null : factionName(state, petition.party)) ?? PETITION_COPY.relationNames.neighbour_1!,
    firstHouse: factionName(state, "merchant_house_1") ?? "", secondHouse: factionName(state, "merchant_house_2") ?? "",
    bishop: factionName(state, "bishop") ?? "",
  };
}

/** An answer's moves by the engine's table: `party` is the petition's neighbour house; a faction the town lacks is skipped (as history.ts does). */
export function homeRelationMoves(state: GameState, petition: Pick<EstatePetition, "kind" | "party">, grant: boolean): readonly RelationMove[] {
  if (!isHomeKind(petition.kind)) return [];
  const table = HOME_PETITION_KINDS[petition.kind][grant ? "grant" : "refuse"].factions;
  const moves: RelationMove[] = [];
  for (const [key, delta] of Object.entries(table)) {
    const id = key === "party" ? petition.party : key;
    const name = id === undefined ? null : factionName(state, id);
    if (id !== undefined && name !== null && delta !== 0) moves.push({ factionId: id, name, delta });
  }
  return moves;
}

/** The pennies an answer moves now (the engine's `petitionEffect`: the table's sign × the petition's amount). */
export function homeTreasury(petition: Pick<EstatePetition, "kind" | "amount">, grant: boolean): number {
  return isHomeKind(petition.kind) ? HOME_PETITION_KINDS[petition.kind][grant ? "grant" : "refuse"].income * petition.amount : 0;
}

const relationsLine = (moves: readonly RelationMove[]) =>
  moves.length === 0 ? LORD_CARDS_COPY.noRelations : PETITION_COPY.relations(moves.map(move => [move.name, move.delta] as const));

/** The court line: the season, the king reigning then (`kingAt`), the lord with his age ("늙은" from the engine's old age) and his guardian. */
export function courtLine(state: GameState): string {
  const date = stateCalendar(state);
  const season = SCENARIO_COPY.seasons[date.season] ?? "";
  const king = kingAt(date.year, date.season).name;
  const lord = state.persons === undefined ? undefined : manorLord(state.persons.people, lordHouse(state).order, date.year);
  if (lord === undefined) return LORD_CARDS_COPY.court(date.year, season, king, null);
  const age = ageOf(lord, date.year);
  const wardship = lordshipOf(state).wardship;
  const guardian = wardship === undefined ? null : wardship.guardianId === null ? LORD_CARDS_COPY.guardianOverlord
    : (() => { const person = personById(state, wardship.guardianId); return person === undefined ? LORD_CARDS_COPY.guardianOverlord : LORD_CARDS_COPY.guardian(personDisplayName(person)); })();
  const who = LORD_CARDS_COPY.lord(personDisplayName(lord), age, age >= LEGACY_BALANCE.lordOldAge);
  return LORD_CARDS_COPY.court(date.year, season, king, guardian === null ? who : `${who} · ${guardian}`);
}

/** The answer a settled kind's precedent repeats (the lord's last two answers alike), or null. */
function settledAnswer(state: GameState, kind: HomePetitionKind): boolean | null {
  const answers = stewardshipOf(state).petitions.filter(entry => entry.estateId === HOME_ESTATE_ID && entry.kind === kind && entry.decidedBy === "lord"
    && (entry.status === "granted" || entry.status === "refused"));
  const [last, before] = [answers.at(-1), answers.at(-2)];
  return last !== undefined && before !== undefined && last.status === before.status ? last.status === "granted" : null;
}

/** The first home petition waiting for the lord as its card shows it, or null (none, or not lord mode). */
export function homePetitionView(state: GameState): HomePetitionView | null {
  const petition = openHomePetitions(state)[0];
  if (petition === undefined) return null;
  const copy = HOME_PETITION_COPY[petition.kind];
  const named = parties(state, petition);
  const option = (grant: boolean): HomePetitionOption => {
    const treasury = homeTreasury(petition, grant);
    const relations = homeRelationMoves(state, petition, grant);
    return { grant, label: grant ? copy.grant(named) : copy.refuse(named), treasury, relations,
      line: `${LORD_CARDS_COPY.treasury(treasury)} · ${relationsLine(relations)}` };
  };
  const recurring = stewardshipOf(state).rules.recurring === true;
  const settled = settledAnswer(state, petition.kind);
  return {
    petitionId: petition.id, kind: petition.kind, art: HOME_PETITION_ART[petition.kind], title: copy.title,
    demand: copy.demand(petition.amount, named), court: courtLine(state),
    waits: LORD_CARDS_COPY.waits(calendarDays(petition.deadline - state.tick)),
    precedent: settled === null ? LORD_CARDS_COPY.precedentHint : LORD_CARDS_COPY.precedentSettled(settled ? copy.grant(named) : copy.refuse(named)),
    recurring, options: [option(true), option(false)],
    arms: lordHouseArms(state), armsLabel: PETITION_COPY.arms(lordHouse(state).name),
  };
}

export type PrecedentView = Readonly<{ key: string; art: Wave44ImageId; court: string; recurring: boolean; items: readonly string[] }>;

/** ER-6: the home petitions the steward answered by precedent in the season just closed (the season report's list), or null. */
export function precedentView(state: GameState): PrecedentView | null {
  if (!lordMode(state)) return null;
  const answered = precedentReport(state).filter((petition): petition is EstatePetition & { readonly kind: HomePetitionKind } =>
    petition.estateId === HOME_ESTATE_ID && petition.decidedBy === "steward" && petition.precedent === true && isHomeKind(petition.kind));
  if (answered.length === 0) return null;
  return {
    key: answered.map(petition => petition.id).join("+"), art: PRECEDENT_ART, court: courtLine(state), recurring: stewardshipOf(state).rules.recurring === true,
    items: answered.map(petition => {
      const copy = HOME_PETITION_COPY[petition.kind];
      const named = parties(state, petition);
      return LORD_CARDS_COPY.precedentItem(copy.title, petition.status === "granted" ? copy.grant(named) : copy.refuse(named));
    }),
  };
}

export type LordRequestView = Readonly<{ key: string; kind: LordRequest["kind"]; title: string; demand: string; grant: string; court: string;
  more: string; command: GameAction | null }>;

/** TA-7: the town's first request of the week as its card shows it (a proclamation waiting for the lord), or null. */
export function lordRequestView(state: GameState): LordRequestView | null {
  if (!lordMode(state)) return null;
  const requests = lordRequests(state).filter((action): action is LordRequest => Object.hasOwn(LORD_CARDS_COPY.request, action.kind));
  const request = requests[0];
  if (request === undefined) return null;
  const copy = LORD_CARDS_COPY.request[request.kind];
  return {
    key: request.kind, kind: request.kind, title: copy.title,
    demand: request.kind === "order_timber" ? LORD_CARDS_COPY.request.order_timber.demand(request.amount) : LORD_CARDS_COPY.request[request.kind].demand,
    grant: copy.grant, court: courtLine(state), more: LORD_CARDS_COPY.requestWaits(requests.length),
    // The bot's own conversion (lordBot `townMoves`): the request granted is the game command it names.
    command: autoplayActionToGameAction(request, state),
  };
}
