import { PETITION_DEFS, type PetitionResponse } from "../content/chapterConfig";
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
};

function livedIn(state: GameState): number {
  return state.houses.filter(house => house.residents > 0).length;
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
