import { PETITION_DEFS, type PetitionResponse } from "../content/chapterConfig";
import { PLAGUE_BALANCE } from "../content/plagueConfig";
import { REORGANISATION_BALANCE, REORGANISATION_EVENT_RELATIONS, REORGANISATION_RELATIONS, type ReorganisationPetitionId } from "../content/reorganisationConfig";
import { WAR_BALANCE } from "../content/warConfig";
import { factionDisplayName } from "../content/factionCopy.ko";
import { PETITION_SUBJECTS, WAR_CHOICES } from "../content/historyCopy.ko";
import type { GameState } from "../engine/engine.types";
import { faction, factionOfPetitioner } from "../engine/factions";
import { currentYear, personById } from "../engine/persons";
import type { PetitionRecord } from "../engine/politics.types";
import { levyMen, refugeeRoom, subsidyAmount, warOf, woolInKindPerSeason, woolLevyAmount } from "../engine/war";
import { woolInKindSplit } from "../engine/pastureWool";
import { DECISION_COPY } from "./decisionCopy.ko";
import type { EmblemSpec } from "./heraldry/EmblemImage";
import { factionEmblem } from "./chronicle/chronicleScreenModel";
import { PETITION_COPY } from "./petitionCopy.ko";
import { factionLeaderRow, type PersonRow } from "./persons/personModels";
import type { Wave16ImageId } from "./wave16Art";
import type { Wave17ImageId } from "./wave17Art";
import type { Wave21ImageId } from "./wave21Art";

/**
 * UI-6: one presentation per petition kind (`defId`): its scene, title, what it asks, what each answer does, and who
 * brings it. The chapter 1 market charter keeps its UI-4 copy; the war's five demands (F2-A, the Wave 17 decision cards
 * 1:1) and the right's buy-back (FAIL-3) have their own. An unknown kind still shows its subject and the ledger's labels.
 * UI-8: extended to accept "wave21" for the chapter 3 plague decision cards.
 */
export type PetitionArt = Readonly<{ sheet: "wave16"; id: Wave16ImageId }> | Readonly<{ sheet: "wave17"; id: Wave17ImageId }>
  | Readonly<{ sheet: "wave21"; id: Wave21ImageId }>;
type Presentation = Readonly<{
  art: PetitionArt;
  title: string;
  demand: (state: GameState) => string;
  line: (state: GameState, response: PetitionResponse) => string;
}>;

const ceilPermille = (amount: number, permille: number) => Math.ceil(amount * permille / 1000);
const MARKET = { sheet: "wave16", id: "event_market_petition" } as const;
const PRESENTATIONS: Readonly<Record<string, Presentation>> = {
  market_charter: {
    art: MARKET, title: DECISION_COPY.petitionTitle, demand: () => `${DECISION_COPY.demand} ${DECISION_COPY.petitionIntro}`,
    line: (_state, response) => {
      const outcome = PETITION_DEFS.find(def => def.id === "market_charter")!.outcomes[response];
      return DECISION_COPY.petition[response].line(outcome.stallFeePermille, outcome.charterFee);
    },
  },
  restore_right: {
    art: MARKET, title: PETITION_COPY.restore_right.title, demand: () => PETITION_COPY.restore_right.demand,
    line: (_state, response) => {
      const paid = -(PETITION_DEFS.find(def => def.id === "restore_right")!.outcomes[response].charterFee);
      return response === "refuse" ? PETITION_COPY.restore_right.refuse() : PETITION_COPY.restore_right[response](paid);
    },
  },
  wool_payment: {
    art: { sheet: "wave17", id: "decision_wool_payment" }, title: PETITION_COPY.wool_payment.title,
    demand: state => PETITION_COPY.wool_payment.demand(livedIn(state), woolLevyAmount(state)),
    line: (state, response) => {
      const levy = woolLevyAmount(state);
      if (response === "accept") {
        // ECON-UI (FIX-7 WR-2a, C5 CL-9): a season's share in the engine's words (woolInKindPerSeason), then what pays
        // it as the town stands now — the fleece in its stores first, the rest in coin (woolInKindSplit).
        const total = ceilPermille(levy, WAR_BALANCE.woolInKindPermille);
        const perSeason = woolInKindPerSeason(levy);
        const split = woolInKindSplit(state, perSeason);
        return PETITION_COPY.wool_payment.acceptInKind(PETITION_COPY.wool_payment.accept(total, perSeason, WAR_BALANCE.woolInKindSeasons),
          PETITION_COPY.wool_payment.inKindSplit(split.fleeces, split.inKind, split.cash));
      }
      return response === "accept_with_price" ? PETITION_COPY.wool_payment.accept_with_price(levy)
        : PETITION_COPY.wool_payment.refuse(ceilPermille(levy, WAR_BALANCE.woolSeizedPermille));
    },
  },
  levy_response: {
    art: { sheet: "wave17", id: "decision_levy_response" }, title: PETITION_COPY.levy_response.title,
    demand: state => PETITION_COPY.levy_response.demand(levyMen(state)),
    line: (state, response) => response === "accept" ? PETITION_COPY.levy_response.accept(levyMen(state), WAR_BALANCE.awaySeasons)
      : response === "accept_with_price" ? PETITION_COPY.levy_response.accept_with_price(levyMen(state) * WAR_BALANCE.exemptionPerMan)
      : PETITION_COPY.levy_response.refuse(),
  },
  war_funding: {
    art: { sheet: "wave17", id: "decision_war_funding" }, title: PETITION_COPY.war_funding.title,
    demand: state => PETITION_COPY.war_funding.demand(subsidyAmount(state)),
    line: (state, response) => response === "accept"
      ? PETITION_COPY.war_funding.accept(ceilPermille(subsidyAmount(state), 1000 + WAR_BALANCE.loanInterestPermille), WAR_BALANCE.loanSeasons)
      : response === "accept_with_price" ? PETITION_COPY.war_funding.accept_with_price(subsidyAmount(state), WAR_BALANCE.taxSurchargePermille, WAR_BALANCE.taxSeasons)
      : PETITION_COPY.war_funding.refuse(),
  },
  refugee_admission: {
    art: { sheet: "wave17", id: "decision_refugee_admission" }, title: PETITION_COPY.refugee_admission.title,
    demand: state => PETITION_COPY.refugee_admission.demand(WAR_BALANCE.refugeeHouseholds, WAR_BALANCE.refugeeHouseholds * WAR_BALANCE.refugeesPerHousehold,
      refugeeRoom(state)),
    line: (_state, response) => response === "accept" ? PETITION_COPY.refugee_admission.accept()
      : response === "accept_with_price" ? PETITION_COPY.refugee_admission.accept_with_price(Math.floor(WAR_BALANCE.refugeeHouseholds / 2), WAR_BALANCE.refugeeFeePerHousehold)
      : PETITION_COPY.refugee_admission.refuse(),
  },
  wall_or_market: {
    art: { sheet: "wave17", id: "decision_wall_or_market" }, title: PETITION_COPY.wall_or_market.title,
    demand: () => PETITION_COPY.wall_or_market.demand,
    line: (state, response) => response === "accept" ? PETITION_COPY.wall_or_market.accept()
      : response === "accept_with_price" ? PETITION_COPY.wall_or_market.accept_with_price(warOf(state)?.favour !== false)
      : PETITION_COPY.wall_or_market.refuse(),
  },
  // UI-8: the four plague petition cards (F3-A PL-5…PL-8), Wave 21 640×480 decision art, two answers each.
  vacant_priest: {
    art: { sheet: "wave21", id: "ch3_decision_vacant_priest" }, title: PETITION_COPY.vacant_priest.title,
    demand: () => PETITION_COPY.vacant_priest.demand,
    line: (_state, response) => response === "accept"
      ? PETITION_COPY.vacant_priest.accept(PLAGUE_BALANCE.monasteryStipend)
      : PETITION_COPY.vacant_priest.refuse(),
  },
  wages: {
    art: { sheet: "wave21", id: "ch3_decision_wages" }, title: PETITION_COPY.wages.title,
    demand: state => PETITION_COPY.wages.demand(workerCount(state)),
    line: (_state, response) => response === "accept"
      ? PETITION_COPY.wages.accept
      : PETITION_COPY.wages.refuse(),
  },
  land_redistribution: {
    art: { sheet: "wave21", id: "ch3_decision_land_redistribution" }, title: PETITION_COPY.land_redistribution.title,
    demand: state => PETITION_COPY.land_redistribution.demand(vacantPlotCount(state)),
    line: (_state, response) => response === "accept_with_price"
      ? PETITION_COPY.land_redistribution.accept_with_price(PLAGUE_BALANCE.settlerHouseholds, PLAGUE_BALANCE.entryFine)
      : PETITION_COPY.land_redistribution.accept,
  },
  cash_rent: {
    art: { sheet: "wave21", id: "ch3_decision_cash_rent" }, title: PETITION_COPY.cash_rent.title,
    demand: () => PETITION_COPY.cash_rent.demand,
    line: (_state, response) => response === "accept"
      ? PETITION_COPY.cash_rent.accept()
      : PETITION_COPY.cash_rent.refuse(),
  },
  // UI-9: the four reorganisation petition cards (F4-A RG-5…RG-9), Wave 21 640×480 decision art, two answers each.
  guild_charter: {
    art: { sheet: "wave21", id: "ch4_decision_guild_approval" }, title: PETITION_COPY.guild_charter.title,
    demand: () => PETITION_COPY.guild_charter.demand,
    line: (state, response) => response === "accept"
      ? PETITION_COPY.guild_charter.accept(reorgRelations(state, "guild_charter", response))
      : PETITION_COPY.guild_charter.refuse(REORGANISATION_BALANCE.refusedWeaverHouseholds, reorgRelations(state, "guild_charter", response)),
  },
  tax_collection: {
    art: { sheet: "wave21", id: "ch4_decision_tax_collection" }, title: PETITION_COPY.tax_collection.title,
    demand: () => PETITION_COPY.tax_collection.demand,
    line: (state, response) => response === "accept"
      ? PETITION_COPY.tax_collection.accept(REORGANISATION_BALANCE.delegatedPerAdult, reorgRelations(state, "tax_collection", response))
      : PETITION_COPY.tax_collection.refuse(REORGANISATION_BALANCE.directPerAdult, reorgRelations(state, "tax_collection", response)),
  },
  cloth_or_grain: {
    art: { sheet: "wave21", id: "ch4_decision_textile_or_grain" }, title: PETITION_COPY.cloth_or_grain.title,
    demand: () => PETITION_COPY.cloth_or_grain.demand,
    line: (state, response) => response === "accept"
      ? PETITION_COPY.cloth_or_grain.accept(REORGANISATION_BALANCE.specialisedClothPrice, REORGANISATION_BALANCE.specialisedHarvestPermille / 10,
        reorgRelations(state, "cloth_or_grain", response))
      : PETITION_COPY.cloth_or_grain.refuse(reorgRelations(state, "cloth_or_grain", response)),
  },
  borough_charter: {
    art: { sheet: "wave21", id: "ch4_decision_charter_negotiation" }, title: PETITION_COPY.borough_charter.title,
    demand: () => PETITION_COPY.borough_charter.demand,
    line: (state, response) => response === "accept"
      ? PETITION_COPY.borough_charter.accept(REORGANISATION_BALANCE.feeFarm, reorgRelations(state, "borough_charter", response))
      : PETITION_COPY.borough_charter.refuse(reorgRelations(state, "borough_charter", response)),
  },
};

/** UI-9: an answer's relation moves (the engine's table), the earl's larger turn after his warning (RG-9). */
function reorgRelations(state: GameState, defId: ReorganisationPetitionId, response: string): string {
  const moves = Object.entries(REORGANISATION_RELATIONS[defId][response === "refuse" ? "refuse" : "accept"] ?? {}).map(([id, delta]) => [id, delta ?? 0] as const)
    .map(([id, delta]) => [id, defId === "borough_charter" && response === "accept" && id === "overlord" && state.reorganisation?.warningTick !== undefined
      ? delta + REORGANISATION_EVENT_RELATIONS.warnedOverlord : delta] as const);
  return PETITION_COPY.relations(moves.map(([id, delta]) => [PETITION_COPY.relationNames[id] ?? id, delta] as const));
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
export type PetitionPresentation = Readonly<{ defId: string; art: PetitionArt; title: string; demand: string; from: PetitionFrom | null;
  label: (response: PetitionResponse) => string; line: (response: PetitionResponse) => string }>;

/** Who brings it: the petitioner's faction (FX-3), its name (`factionDisplayName` only, FIX-5), its arms and leader. */
function petitionFrom(state: GameState, petition: PetitionRecord): PetitionFrom | null {
  const id = factionOfPetitioner(petition.petitioner);
  const view = faction(state, id);
  if (view === undefined) return null;
  const leader = view.leaderId === null ? undefined : personById(state, view.leaderId);
  const name = factionDisplayName(view.id, view.name);
  return { factionId: id, name, arms: factionEmblem(view, currentYear(state)),
    leader: leader === undefined ? null : factionLeaderRow(state, leader, name), writ: petition.petitioner === "crown" };
}

export function petitionPresentation(state: GameState, petition: PetitionRecord): PetitionPresentation {
  const known = PRESENTATIONS[petition.defId];
  const labels = WAR_CHOICES[petition.defId];
  const label = (response: PetitionResponse) => labels?.[response] ?? DECISION_COPY.petition[response].label;
  if (known === undefined) {
    const title = PETITION_SUBJECTS[petition.defId] ?? petition.defId;
    return { defId: petition.defId, art: MARKET, title, demand: title, from: petitionFrom(state, petition), label, line: label };
  }
  return { defId: petition.defId, art: known.art, title: known.title, demand: known.demand(state), from: petitionFrom(state, petition), label,
    line: response => known.line(state, response) };
}
