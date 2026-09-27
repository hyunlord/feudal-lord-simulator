/**
 * FAIL-3 failure ladder, rungs 3 and 4 (spec docs/design/failure-ladder-campaign.md FL-3…FL-7), checked at each season's
 * start:
 * - Stage 3, decline: a town with a third of its houses derelict (FP-3 stage 2) or unpaid upkeep over four periods loses
 *   a right — the overlord takes it in custody for the arrears (breach-based suspension), the merchant elite seizes it
 *   for the dereliction (unilateral seizure) — and the lord's title is demoted.
 * - Recovery: once the cause has cleared, the right's holder offers it back (a `restore_right` petition, FL-6).
 * - Stage 4: a decline two years unbroken ends the house; a new one carries on with the town (no game over).
 */
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import { RESTORE_RIGHT_PETITION_ID, type PetitionResponse } from "../content/chapterConfig";
import { LORDSHIP_BALANCE, SEIZURE_ORDER, SUSPENSION_ORDER } from "../content/lordshipConfig";
import { postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import type { GameState } from "./engine.types";
import type { DeclineState, LordshipState } from "./lordship.types";
import { lordHouseHeraldrySeed, lordHouseName, lordshipOf, rightHeld, rightPresent } from "./lordshipState";
import type { PetitionRecord } from "./politics.types";

const SEASON = PRESSURE_BALANCE.seasonTicks;

/** FL-3: the share of the houses (permille) standing derelict, or null for a town under `minHouses` houses. */
export function derelictPermille(state: Pick<GameState, "houses">): number | null {
  if (state.houses.length < LORDSHIP_BALANCE.minHouses) return null;
  return Math.floor(state.houses.filter(house => house.abandonedTick !== undefined).length * 1000 / state.houses.length);
}

/** FL-3: the distinct ledger periods over which unpaid upkeep is still owed. */
export function arrearsPeriods(state: Pick<GameState, "money">): number {
  return new Set((state.money?.arrears ?? []).map(arrear => arrear.tick)).size;
}

/** FL-3: why the town would decline now (arrears first), or null. */
export function declineCause(state: GameState): DeclineState["cause"] | null {
  if (arrearsPeriods(state) >= LORDSHIP_BALANCE.arrearsPeriods) return "arrears";
  const share = derelictPermille(state);
  return share !== null && share >= LORDSHIP_BALANCE.derelictPermille ? "derelict" : null;
}

/** FL-4: stage 3 begins — the first right held in the path's order is lost, and the title is demoted. */
function enterDecline(state: GameState, lordship: LordshipState, cause: DeclineState["cause"]): LordshipState {
  const by = cause === "arrears" ? "overlord" as const : "merchants" as const;
  const order = cause === "arrears" ? SUSPENSION_ORDER : SEIZURE_ORDER;
  const lost = order.find(id => rightPresent(state, id) && rightHeld(state, id)) ?? null;
  const { titleReturnsTick: _returns, ...rest } = lordship;
  return {
    ...rest,
    lostRights: lost === null ? lordship.lostRights
      : [...lordship.lostRights, { id: lost, status: cause === "arrears" ? "suspended" : "seized", by, since: state.tick }],
    titleDemoted: true,
    decline: { since: state.tick, cause, lost, by },
  };
}

function openRestoration(state: GameState): PetitionRecord | undefined {
  return state.politics?.petitions.find(petition => petition.defId === RESTORE_RIGHT_PETITION_ID && petition.response === undefined);
}

/** FL-7: the house withdraws; a new one takes the town, its treasury halved, the merchants' grudge half forgotten. */
function changeHouse(state: GameState, lordship: LordshipState): GameState {
  const order = lordship.house.order + 1;
  const house = { order, name: lordHouseName(state.seed, order), heraldrySeed: lordHouseHeraldrySeed(state.seed, order), since: state.tick };
  const loss = Math.floor(Math.max(0, treasuryBalance(state)) * LORDSHIP_BALANCE.houseChangeTreasuryLossPermille / 1000);
  let next: GameState = state;
  if (loss > 0) {
    const posted = postLedgerEntries(state, [{ account: "cash", category: "house_change", amount: -loss,
      sourceRefs: [{ type: "actor", id: `lord_house:${lordship.house.order}`, detail: lordship.house.name }] }]);
    next = { ...next, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger };
  }
  const politics = next.politics === undefined ? undefined : {
    ...next.politics,
    merchantGauge: Math.round((next.politics.merchantGauge + 50) / 2),
    petitions: next.politics.petitions.map(petition => petition.defId === RESTORE_RIGHT_PETITION_ID && petition.response === undefined
      ? { ...petition, response: "expired" as const, respondedTick: state.tick } : petition),
  };
  return {
    ...next,
    ...(politics === undefined ? {} : { politics }),
    lordship: { house, pastHouses: [...lordship.pastHouses, { ...lordship.house, until: state.tick }], lostRights: [], titleDemoted: false, decline: null },
  };
}

/** One tick of FAIL-3 (a no-op except at season starts, and while a haggled title has not yet come back). */
export function advanceLordship(state: GameState): GameState {
  if (state.tick <= 0) return state;
  let lordship = lordshipOf(state);
  let next = state;
  // FL-6: a haggled restoration gives the title back a year later.
  if (lordship.titleReturnsTick !== undefined && state.tick >= lordship.titleReturnsTick) {
    const { titleReturnsTick: _returns, ...rest } = lordship;
    lordship = { ...rest, titleDemoted: lordship.decline !== null };
    next = { ...next, lordship };
  }
  if (state.tick % SEASON !== 0) return next;
  const decline = lordship.decline;
  if (decline === null) {
    const cause = declineCause(next);
    return cause === null ? next : { ...next, lordship: enterDecline(next, lordship, cause) };
  }
  // FL-7: two years unbroken.
  if (state.tick - decline.since >= LORDSHIP_BALANCE.houseChangeTicks) return changeHouse(next, lordship);
  // FL-6: the cause cleared — the holder offers the right back (the merchants when nothing was lost).
  if (declineCause(next) === null && state.tick >= (decline.petitionFrom ?? 0) && next.politics !== undefined && openRestoration(next) === undefined) {
    const petition: PetitionRecord = { id: `${RESTORE_RIGHT_PETITION_ID}@${state.tick}`, defId: RESTORE_RIGHT_PETITION_ID,
      petitioner: decline.lost === null ? "merchants" : decline.by, arrivedTick: state.tick };
    next = { ...next, politics: { ...next.politics, petitions: [...next.politics.petitions, petition] } };
  }
  return next;
}

/**
 * FL-6: the lord's answer to a restoration petition (called by `respondToPetition`, which records the decision). A fee the
 * treasury cannot pay restores nothing; a refusal, or an unpaid fee, brings the petition back a year later.
 */
export function answerRestoration(state: GameState, petition: PetitionRecord, response: PetitionResponse): GameState {
  const lordship = lordshipOf(state);
  const decline = lordship.decline;
  if (decline === null) return state;
  const fee = response === "accept" ? LORDSHIP_BALANCE.restoreFee : response === "accept_with_price" ? LORDSHIP_BALANCE.restoreFeeHaggled : 0;
  if (response === "refuse" || treasuryBalance(state) < fee) {
    return { ...state, lordship: { ...lordship, decline: { ...decline, petitionFrom: state.tick + LORDSHIP_BALANCE.restoreRetryTicks } } };
  }
  const posted = postLedgerEntries(state, [{ account: "cash", category: "restoration_fee", amount: -fee,
    sourceRefs: [{ type: "right", id: decline.lost ?? "title", detail: `petition:${petition.id}` }, { type: "actor", id: petition.petitioner }] }]);
  const restored: LordshipState = {
    ...lordship,
    lostRights: lordship.lostRights.filter(right => right.id !== decline.lost),
    titleDemoted: response !== "accept",
    ...(response === "accept" ? {} : { titleReturnsTick: state.tick + LORDSHIP_BALANCE.titleReturnTicks }),
    decline: null,
  };
  return { ...state, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger, lordship: restored };
}
