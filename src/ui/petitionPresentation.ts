import { MARKET_CHARTER_PETITION_ID, RESTORE_RIGHT_PETITION_ID, type PetitionResponse } from "../content/chapterConfig";
import { LEGACY_BALANCE, type LegacyPetitionId } from "../content/legacyConfig";
import type { PLAGUE_PETITION_IDS } from "../content/plagueConfig";
import type { ReorganisationPetitionId } from "../content/reorganisationConfig";
import { WAR_BALANCE, type WarPetitionId } from "../content/warConfig";
import { factionDisplayName } from "../content/factionCopy.ko";
import { PETITION_SUBJECTS, WAR_CHOICES } from "../content/historyCopy.ko";
import type { GameState } from "../engine/engine.types";
import { faction, factionOfPetitioner } from "../engine/factions";
import { heirCandidates } from "../engine/legacy";
import { lordHouse } from "../engine/lordshipState";
import { ageOf, currentYear, inTown, manorLord, personById, personDisplayName } from "../engine/persons";
import type { Person } from "../engine/persons.types";
import type { PetitionRecord } from "../engine/politics.types";
import { treasuryBalance } from "../ledger/ledger";
import { levyMen, refugeeRoom, subsidyAmount, woolLevyAmount } from "../engine/war";
import { DECISION_COPY } from "./decisionCopy.ko";
import type { EmblemSpec } from "./heraldry/EmblemImage";
import { factionEmblem } from "./chronicle/chronicleScreenModel";
import { PETITION_COPY } from "./petitionCopy.ko";
import { factionLeaderRow, type PersonRow } from "./persons/personModels";
import type { Wave16ImageId } from "./wave16Art";
import type { Wave17ImageId } from "./wave17Art";
import type { Wave21ImageId } from "./wave21Art";
import type { Wave33ImageId } from "./wave33Art";

/**
 * UI-6: one presentation per petition kind (`defId`): its scene, title, what it asks, and who brings it. DEC-CARD: what
 * each answer does now and later, and who remembers it, is the card's (`decisionCard/families/petitionCard.ts`): the
 * answer run on the state, no longer a line here with the relation tables copied (P-D4). The chapter 1 market charter keeps its UI-4 copy; the war's five demands (F2-A, the Wave 17 decision cards
 * 1:1) and the right's buy-back (FAIL-3) have their own.
 * UI-8: extended to accept "wave21" for the chapter 3 plague decision cards.
 * UI-10: chapter 5's four cards (Wave 21) and the interlude's two (Wave 33, 960×540). The table covers every petition
 * kind the engine raises (`PetitionDefId`): a new kind without a card is a compile error, no longer the market's picture.
 */
export type PetitionArt = Readonly<{ sheet: "wave16"; id: Wave16ImageId }> | Readonly<{ sheet: "wave17"; id: Wave17ImageId }>
  | Readonly<{ sheet: "wave21"; id: Wave21ImageId }> | Readonly<{ sheet: "wave33"; id: Wave33ImageId }>;
/** Every petition kind the engine can raise (the ids of `PETITION_DEFS`: chapter 1's two, the war's, the plague's, the reorganisation's, chapter 5's). */
export type PetitionDefId = typeof MARKET_CHARTER_PETITION_ID | typeof RESTORE_RIGHT_PETITION_ID | WarPetitionId | (typeof PLAGUE_PETITION_IDS)[number]
  | ReorganisationPetitionId | LegacyPetitionId;
type Presentation = Readonly<{
  art: PetitionArt;
  title: string;
  demand: (state: GameState) => string;
  /** UI-10: an answer's label other than the ledger's (the heir's card when the nephew's place is a distant kinsman's). */
  label?: (state: GameState, response: PetitionResponse) => string | undefined;
}>;

const MARKET = { sheet: "wave16", id: "event_market_petition" } as const;
const PRESENTATIONS: Readonly<Record<PetitionDefId, Presentation>> = {
  market_charter: { art: MARKET, title: DECISION_COPY.petitionTitle, demand: () => `${DECISION_COPY.demand} ${DECISION_COPY.petitionIntro}` },
  restore_right: { art: MARKET, title: PETITION_COPY.restore_right.title, demand: () => PETITION_COPY.restore_right.demand },
  wool_payment: {
    art: { sheet: "wave17", id: "decision_wool_payment" }, title: PETITION_COPY.wool_payment.title,
    demand: state => PETITION_COPY.wool_payment.demand(livedIn(state), woolLevyAmount(state)),
  },
  levy_response: {
    art: { sheet: "wave17", id: "decision_levy_response" }, title: PETITION_COPY.levy_response.title,
    demand: state => PETITION_COPY.levy_response.demand(levyMen(state)),
  },
  war_funding: {
    art: { sheet: "wave17", id: "decision_war_funding" }, title: PETITION_COPY.war_funding.title,
    demand: state => PETITION_COPY.war_funding.demand(subsidyAmount(state)),
  },
  refugee_admission: {
    art: { sheet: "wave17", id: "decision_refugee_admission" }, title: PETITION_COPY.refugee_admission.title,
    demand: state => PETITION_COPY.refugee_admission.demand(WAR_BALANCE.refugeeHouseholds, WAR_BALANCE.refugeeHouseholds * WAR_BALANCE.refugeesPerHousehold,
      refugeeRoom(state)),
  },
  wall_or_market: { art: { sheet: "wave17", id: "decision_wall_or_market" }, title: PETITION_COPY.wall_or_market.title, demand: () => PETITION_COPY.wall_or_market.demand },
  // UI-8: the four plague petition cards (F3-A PL-5…PL-8), Wave 21 640×480 decision art, two answers each.
  vacant_priest: { art: { sheet: "wave21", id: "ch3_decision_vacant_priest" }, title: PETITION_COPY.vacant_priest.title, demand: () => PETITION_COPY.vacant_priest.demand },
  wages: { art: { sheet: "wave21", id: "ch3_decision_wages" }, title: PETITION_COPY.wages.title, demand: state => PETITION_COPY.wages.demand(workerCount(state)) },
  land_redistribution: {
    art: { sheet: "wave21", id: "ch3_decision_land_redistribution" }, title: PETITION_COPY.land_redistribution.title,
    demand: state => PETITION_COPY.land_redistribution.demand(vacantPlotCount(state)),
  },
  cash_rent: { art: { sheet: "wave21", id: "ch3_decision_cash_rent" }, title: PETITION_COPY.cash_rent.title, demand: () => PETITION_COPY.cash_rent.demand },
  // UI-9: the four reorganisation petition cards (F4-A RG-5…RG-9), Wave 21 640×480 decision art, two answers each.
  guild_charter: { art: { sheet: "wave21", id: "ch4_decision_guild_approval" }, title: PETITION_COPY.guild_charter.title, demand: () => PETITION_COPY.guild_charter.demand },
  tax_collection: { art: { sheet: "wave21", id: "ch4_decision_tax_collection" }, title: PETITION_COPY.tax_collection.title, demand: () => PETITION_COPY.tax_collection.demand },
  cloth_or_grain: { art: { sheet: "wave21", id: "ch4_decision_textile_or_grain" }, title: PETITION_COPY.cloth_or_grain.title, demand: () => PETITION_COPY.cloth_or_grain.demand },
  borough_charter: { art: { sheet: "wave21", id: "ch4_decision_charter_negotiation" }, title: PETITION_COPY.borough_charter.title, demand: () => PETITION_COPY.borough_charter.demand },
  // UI-10: chapter 5's four cards (F5-A LG-2…LG-6), Wave 21 640×480 decision art; the heir's card offers the answers its record allows.
  royal_tax: {
    art: { sheet: "wave21", id: "ch5_decision_royal_tax_response" }, title: PETITION_COPY.royal_tax.title,
    demand: state => PETITION_COPY.royal_tax.demand(LEGACY_BALANCE.subsidyPermille, royalSubsidy(state), LEGACY_BALANCE.subsidyMin, LEGACY_BALANCE.subsidyMax),
  },
  heir_choice: {
    art: { sheet: "wave21", id: "ch5_decision_heir_choice" }, title: PETITION_COPY.heir_choice.title,
    demand: state => { const lord = oldLord(state); return PETITION_COPY.heir_choice.demand(lord === undefined ? "" : personDisplayName(lord), lord === undefined ? 0 : ageOf(lord, currentYear(state))); },
    label: (state, response) => response === "refuse" && kinsmanHeir(state) ? PETITION_COPY.heir_choice.kinsmanLabel : undefined,
  },
  borough_autonomy: {
    art: { sheet: "wave21", id: "ch5_decision_autonomy" }, title: PETITION_COPY.borough_autonomy.title,
    demand: state => { const mayor = state.legacy?.mayorCandidateId; const person = mayor === null || mayor === undefined ? undefined : personById(state, mayor);
      return PETITION_COPY.borough_autonomy.demand(person === undefined ? "" : personDisplayName(person)); },
  },
  legacy_choice: { art: { sheet: "wave21", id: "ch5_decision_legacy" }, title: PETITION_COPY.legacy_choice.title, demand: () => PETITION_COPY.legacy_choice.demand(LEGACY_BALANCE.endowment) },
  // UI-10: the interlude's two petitions (FIX-9 LG-13), their Wave 33 illustrations (960×540).
  guild_dispute: { art: { sheet: "wave33", id: "interlude_guild_dispute" }, title: PETITION_COPY.guild_dispute.title, demand: () => PETITION_COPY.guild_dispute.demand },
  church_rebuilding: {
    art: { sheet: "wave33", id: "interlude_church_rebuilding" }, title: PETITION_COPY.church_rebuilding.title,
    demand: () => PETITION_COPY.church_rebuilding.demand(LEGACY_BALANCE.churchRebuildingCost),
  },
};

/**
 * UI-10 (LG-4): the Crown's tenth and fifteenth asked in the demand (the chip's line, which runs no answer). The card
 * shows what paying takes from the answer run on the state (DEC-CARD); the engine has no read model for the sum asked yet.
 */
function royalSubsidy(state: GameState): number {
  const B = LEGACY_BALANCE;
  return Math.max(B.subsidyMin, Math.min(B.subsidyMax, Math.floor(treasuryBalance(state) * B.subsidyPermille / 1000)));
}

/** UI-10 (LG-3): the old lord who names the heir (the house's head, else its eldest adult — the engine's `manorLord`). */
function oldLord(state: GameState) {
  return manorLord(state.persons?.people ?? [], lordHouse(state).order, currentYear(state));
}

/** UI-10 (LG-3): the nephew's place is a distant kinsman's (the lord has no brother or sister). */
function kinsmanHeir(state: GameState): boolean {
  return heirCandidates(state).some(candidate => candidate.kind === "nephew" && candidate.relation === "kinsman");
}

function livedIn(state: GameState): number {
  return state.houses.filter(house => house.residents > 0).length;
}

/** UI-8 PL-5: workers in lord's buildings (the wage cost's base). Mirrors plagueDecisionForecast's count. */
function workerCount(state: GameState): number {
  return state.buildings.reduce((sum, building) => sum + (building.kind === "house" ? 0 : Math.max(0, building.workers)), 0);
}

/** UI-8 PL-7: how many plots the plague emptied (shown in the land demand). */
function vacantPlotCount(state: GameState): number {
  return state.plague?.vacantHouseIds?.length ?? 0;
}

export type PetitionFrom = Readonly<{ factionId: string; name: string; arms: EmblemSpec; leader: PersonRow | null; writ: boolean }>;
/** `art` null: a kind the table does not know (only a hand-edited or foreign save; the development build throws). */
export type PetitionPresentation = Readonly<{ defId: string; art: PetitionArt | null; title: string; demand: string; from: PetitionFrom | null;
  label: (response: PetitionResponse) => string }>;

/**
 * NAT-4 (QA-036): the faction's leader as a petition shows him — never a dead (or departed) one. A leader no longer
 * living is followed through FIX-12's `faction.leader_succeeded` lines to his living successor; until the engine names
 * one (on the next death day) there is no leader chip, and the town's living representatives (FIX-12's
 * `petition.representative_replaced`, `petitionerRows`) stand first.
 */
function livingLeader(state: GameState, factionId: string, leaderId: string | null): Person | undefined {
  const records = state.history?.records ?? [];
  const seen = new Set<string>();
  for (let id = leaderId; id !== null && !seen.has(id);) {
    seen.add(id);
    const person = personById(state, id);
    if (person !== undefined && inTown(person)) return person;
    let next: string | null = null;
    for (let index = records.length - 1; index >= 0 && next === null; index -= 1) {
      const params = records[index]!.params;
      if (records[index]!.template === "faction.leader_succeeded" && params?.faction === factionId && params.predecessorId === id
        && typeof params.leaderId === "string") next = params.leaderId;
    }
    id = next;
  }
  return undefined;
}

/** Who brings it: the petitioner's faction (FX-3), its name (`factionDisplayName` only, FIX-5), its arms and leader. */
function petitionFrom(state: GameState, petition: PetitionRecord): PetitionFrom | null {
  const id = factionOfPetitioner(petition.petitioner);
  const view = faction(state, id);
  if (view === undefined) return null;
  const leader = livingLeader(state, id, view.leaderId);
  const name = factionDisplayName(view.id, view.name);
  return { factionId: id, name, arms: factionEmblem(view, currentYear(state)),
    leader: leader === undefined ? null : factionLeaderRow(state, leader, name), writ: petition.petitioner === "crown" };
}

/** UI-10: the kinds the table presents (a petition record's `defId` is a string: a save may carry any). */
export function isPetitionDefId(defId: string): defId is PetitionDefId {
  return Object.hasOwn(PRESENTATIONS, defId);
}

export function petitionPresentation(state: GameState, petition: PetitionRecord): PetitionPresentation {
  const labels = WAR_CHOICES[petition.defId];
  const ledgerLabel = (response: PetitionResponse) => labels?.[response] ?? DECISION_COPY.petition[response].label;
  if (!isPetitionDefId(petition.defId)) {
    // UI-10: no market picture for a kind without a card — the development build stops on it, a release shows no picture.
    if (import.meta.env?.DEV === true) throw new Error(`petition kind without a presentation: ${petition.defId}`);
    const title = PETITION_SUBJECTS[petition.defId] ?? petition.defId;
    return { defId: petition.defId, art: null, title, demand: title, from: petitionFrom(state, petition), label: ledgerLabel };
  }
  const known = PRESENTATIONS[petition.defId];
  return { defId: petition.defId, art: known.art, title: known.title, demand: known.demand(state), from: petitionFrom(state, petition),
    label: response => known.label?.(state, response) ?? ledgerLabel(response) };
}

/** UI-10 (tests): each kind's art, the table read without a state. */
export function petitionArtOf(defId: PetitionDefId): PetitionArt {
  return PRESENTATIONS[defId].art;
}
