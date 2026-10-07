import { PETITION_DEFS, type PetitionDef, type PetitionResponse } from "../../../content/chapterConfig";
import { LEGACY_AXIS_COPY } from "../../../content/legacyCopy.ko";
import { LEGACY_BALANCE, LEGACY_BY_RESPONSE } from "../../../content/legacyConfig";
import { LORDSHIP_BALANCE } from "../../../content/lordshipConfig";
import { PLAGUE_BALANCE } from "../../../content/plagueConfig";
import { MARKET_TOLLS_RIGHT_ID, REORGANISATION_BALANCE as RG } from "../../../content/reorganisationConfig";
import { WAR_BALANCE } from "../../../content/warConfig";
import type { GameState } from "../../../engine/engine.types";
import { SEASON_TICKS } from "../../../engine/eventSchedule";
import { factionChanges } from "../../../engine/factions";
import type { HistoryDecision } from "../../../engine/history.types";
import { answerLegacyPetition, legacyOf, legacyScores } from "../../../engine/legacy";
import { lordshipOf } from "../../../engine/lordshipState";
import { answerPlaguePetition } from "../../../engine/plague";
import { openPetitions } from "../../../engine/politics";
import type { PetitionRecord } from "../../../engine/politics.types";
import { woolInKindSplit } from "../../../engine/pastureWool";
import { answerReorganisationPetition, revoltPressure } from "../../../engine/reorganisation";
import { calendarLabel } from "../../../engine/scenarioState";
import { answerWarPetition, marketExpansionPermille, murageTollPermille, warTaxPermille, woolInKindPerSeason, woolLevyAmount } from "../../../engine/war";
import { treasuryBalance } from "../../../ledger/ledger";
import { factionDisplayName } from "../../../content/factionCopy.ko";
import { petitionDecisionView } from "../../decisionModels";
import type { HeirCandidateView } from "../../heirCandidateModel";
import { courtLine } from "../../lordCardsModel";
import { PETITION_COPY } from "../../petitionCopy.ko";
import { isPetitionDefId, type PetitionDefId, type PetitionFrom } from "../../petitionPresentation";
import { perState } from "../../perState";
import { DECISION_CARD_COPY } from "../decisionCardCopy.ko";
import type { DecisionCardView, DecisionChoiceView } from "../decisionCardTypes";
import { afterAnswer, remembersOf } from "../remembers";
import { PETITION_ANSWER_COPY as ANSWER, PETITION_CARD_COPY as COPY, PETITION_STAKE, type AnswerWords } from "./petitionCardCopy.ko";

// DEC-CARD, every political petition (chapter 1's charter and the right's buy-back, the war's five, the plague's four,
// chapter 4's four, chapter 5's four and the interlude's two). Each answer is run on the state (`afterAnswer`: the
// reducer is pure and records the decision, so the answer's faction records are who remembers it, P-D4) and the card
// says what the state after it shows: the treasury, the people, the merchants' gauge, the Crown's favour, the
// instalments and the men away, the legacy's scores, the revolt's pressure (chapter 3's answers carry into chapter 4's),
// the engine's two-season forecast and when its actual is written. Silence is run the same way: the family's own answer
// to `expired` (as the engine runs it at the deadline), compared with each answer the card offers.
// Once per state (`perState`): only the card that is up reads it; the chips read `petitionPresentation`.

export type PetitionCardView = Readonly<{
  card: DecisionCardView; defId: string; petitionId: string; from: PetitionFrom | null;
  /** UI-10 (LG-3): the heir each answer names, beside its answer's label (the heir's card only). */
  heirs: readonly Readonly<{ choice: PetitionResponse; label: string; heir: HeirCandidateView }>[];
}>;

const label = (state: GameState, tick: number) => calendarLabel({ ...state, tick });

/** The family's own sentences for an answer — what it does in words, with the engine's numbers for it. */
function answerWords(defId: PetitionDefId, state: GameState, after: GameState, petition: PetitionRecord, response: PetitionResponse,
  heir: HeirCandidateView | undefined): AnswerWords {
  switch (defId) {
    case "market_charter":
      return ANSWER.market_charter(response, after.politics?.rights.find(right => right.petitionId === petition.id)?.stallFeePermille ?? null);
    case "restore_right": {
      const decline = lordshipOf(after).decline;
      if (response === "refuse") return ANSWER.restore_right.refuse(label(state, decline?.petitionFrom ?? state.tick));
      // Astra B04: the engine restores only what the treasury can pay; short, the petition comes again later.
      if (decline !== null) return ANSWER.restore_right.short(response === "accept" ? LORDSHIP_BALANCE.restoreFee : LORDSHIP_BALANCE.restoreFeeHaggled,
        treasuryBalance(state), label(state, decline.petitionFrom ?? state.tick));
      const returns = lordshipOf(after).titleReturnsTick;
      return response === "accept" || returns === undefined ? ANSWER.restore_right.accept : ANSWER.restore_right.haggled(label(state, returns));
    }
    case "wool_payment": {
      if (response !== "accept") return response === "accept_with_price" ? ANSWER.wool_payment.cash : ANSWER.wool_payment.refuse;
      const split = woolInKindSplit(state, woolInKindPerSeason(woolLevyAmount(state)));
      return ANSWER.wool_payment.inKind(split.fleeces, split.inKind, split.cash);
    }
    case "levy_response":
      return response === "accept" ? ANSWER.levy_response.accept(after.war?.conscripts?.men ?? 0)
        : response === "accept_with_price" ? ANSWER.levy_response.exempt : ANSWER.levy_response.refuse;
    case "war_funding":
      return response === "accept" ? ANSWER.war_funding.loan : response === "accept_with_price" ? ANSWER.war_funding.treasury : ANSWER.war_funding.refuse;
    case "refugee_admission":
      return response === "accept" ? ANSWER.refugee_admission.all : response === "accept_with_price" ? ANSWER.refugee_admission.half : ANSWER.refugee_admission.refuse;
    case "wall_or_market":
      return response === "accept" ? ANSWER.wall_or_market.wall
        : response === "accept_with_price" ? after.war?.wall === "murage" ? ANSWER.wall_or_market.murage(murageTollPermille(after)) : ANSWER.wall_or_market.noFavour
        : ANSWER.wall_or_market.market(marketExpansionPermille(after));
    case "vacant_priest": {
      const comes = after.plague?.curacy?.filledTick;
      if (response !== "accept") return ANSWER.vacant_priest.clerk;
      return ANSWER.vacant_priest.monastery(comes !== undefined && comes > state.tick ? label(state, comes) : null);
    }
    case "wages":
      return response === "accept" ? ANSWER.wages.raise(PLAGUE_BALANCE.raisedWagePerWorker) : ANSWER.wages.bind;
    case "land_redistribution":
      return response === "accept_with_price" ? ANSWER.land_redistribution.settlers(PLAGUE_BALANCE.settlerHouseholds, PLAGUE_BALANCE.entryFine) : ANSWER.land_redistribution.neighbours;
    case "cash_rent":
      return response === "accept" ? ANSWER.cash_rent.commute(PLAGUE_BALANCE.cashRentPermille) : ANSWER.cash_rent.keep(PLAGUE_BALANCE.labourServiceUpkeepPermille);
    case "guild_charter":
      return response === "accept" ? ANSWER.guild_charter.grant(Math.round((1000 - RG.guildTicksPermille) / 10), RG.autonomyWithGuildYear)
        : ANSWER.guild_charter.refuse(Math.round((RG.refusedWeavingPermille - 1000) / 10), RG.refusedWeaverHouseholds);
    case "tax_collection":
      return response === "accept" ? ANSWER.tax_collection.town(RG.delegatedPerAdult) : ANSWER.tax_collection.lord(RG.directPerAdult);
    case "cloth_or_grain":
      return response === "accept" ? ANSWER.cloth_or_grain.cloth(RG.specialisedClothPrice, RG.specialisedHarvestPermille / 10) : ANSWER.cloth_or_grain.grain;
    case "borough_charter":
      return response === "accept" ? ANSWER.borough_charter.grant(RG.feeFarm) : ANSWER.borough_charter.refuse;
    case "royal_tax":
      return response === "accept" ? ANSWER.royal_tax.pay : ANSWER.royal_tax.plead(LEGACY_BALANCE.confirmationFine);
    case "heir_choice": {
      const seated = heir === undefined ? ANSWER.heir_choice.unnamed : ANSWER.heir_choice.seated(heir.name, heir.lineage);
      const more = [...(response === "accept_with_price" ? [ANSWER.heir_choice.daughterBack] : []), ...(response === "accept" ? [] : [ANSWER.heir_choice.othersLeave])];
      return { now: [...seated.now, ...more], later: seated.later };
    }
    case "borough_autonomy": {
      const was = new Set((state.politics?.rights ?? []).map(right => right.id));
      const tolls = (after.politics?.rights ?? []).some(right => right.id === MARKET_TOLLS_RIGHT_ID && !was.has(right.id));
      return response === "accept" ? ANSWER.borough_autonomy.seal(tolls, legacyOf(after)?.feeFarm ?? 0) : ANSWER.borough_autonomy.keep(legacyOf(after)?.backlash ?? 0);
    }
    case "legacy_choice":
      return ANSWER.legacy_choice(LEGACY_AXIS_COPY[LEGACY_BY_RESPONSE[response]]?.legacy ?? "");
    case "guild_dispute":
      return response === "accept" ? ANSWER.guild_dispute.guild : ANSWER.guild_dispute.merchants;
    case "church_rebuilding":
      return response === "accept" ? ANSWER.church_rebuilding.build : ANSWER.church_rebuilding.wait;
  }
}

/** The decision record the answer writes (its forecast two seasons on and when the actual is due). */
function decisionOf(before: GameState, after: GameState): HistoryDecision | null {
  const known = new Set((before.history?.records ?? []).map(record => record.id));
  return (after.history?.records ?? []).find(record => !known.has(record.id) && record.kind === "decision")?.decision ?? null;
}

/** What every answer may add, read off the state after it: the treasury, the people, the gauge, the favour, the scores. */
function nowLines(state: GameState, after: GameState): string[] {
  const lines: string[] = [];
  const moved = treasuryBalance(after) - treasuryBalance(state);
  lines.push(moved > 0 ? COPY.treasuryIn(moved) : moved < 0 ? COPY.treasuryOut(-moved) : COPY.treasurySame);
  const people = after.population - state.population;
  if (people !== 0) lines.push(people > 0 ? COPY.peopleIn(people) : COPY.peopleOut(-people));
  const gauge = { from: state.politics?.merchantGauge ?? 50, to: after.politics?.merchantGauge ?? 50 };
  if (gauge.to !== gauge.from) lines.push(COPY.gauge(gauge.from, gauge.to));
  if (state.war !== undefined && state.war.favour && after.war?.favour === false) lines.push(COPY.favourLost);
  if (legacyOf(state) !== undefined) {
    const was = legacyScores(state), now = legacyScores(after);
    for (const axis of ["town", "family", "church"] as const) {
      if (now[axis] !== was[axis]) lines.push(COPY.legacyPoints(LEGACY_AXIS_COPY[axis]?.name ?? axis, now[axis] - was[axis]));
    }
  }
  return lines;
}

/** What follows: the instalments, the men away, the war tax, the revolt's pressure, the forecast and its actual's date. */
function laterLines(state: GameState, after: GameState): string[] {
  const lines: string[] = [];
  const war = state.war, next = after.war;
  if (next !== undefined) {
    for (const due of next.instalments.slice(war?.instalments.length ?? 0)) lines.push(COPY.instalment(due.category, due.perSeason, due.seasonsLeft));
    if (next.conscripts !== undefined && war?.conscripts === undefined) {
      lines.push(COPY.conscripts(next.conscripts.men, label(state, next.conscripts.returnTick), next.conscripts.lostHouseIds.length));
    }
    if ((next.taxSeasonsLeft ?? 0) > (war?.taxSeasonsLeft ?? 0)) lines.push(COPY.warTax(next.taxSeasonsLeft ?? 0, warTaxPermille(after)));
  }
  if (state.plague !== undefined || state.reorganisation !== undefined) {
    // RG-8: the pressure's causes before and after; a chapter-3 answer is carried into chapter 4's (no reorganisation yet).
    const was = new Map(revoltPressure(state).causes.map(cause => [cause.id, cause.pressure]));
    const now = new Map(revoltPressure(after).causes.map(cause => [cause.id, cause.pressure]));
    for (const id of new Set([...was.keys(), ...now.keys()])) {
      const delta = (now.get(id) ?? 0) - (was.get(id) ?? 0);
      if (delta !== 0) lines.push(COPY.pressure(COPY.pressureCause[id] ?? id, delta, state.reorganisation === undefined));
    }
  }
  const decision = decisionOf(state, after);
  const forecast = decision?.predicted.treasury;
  if (forecast !== undefined) lines.push(COPY.forecast(forecast, treasuryBalance(state)));
  if (decision?.actualDueTick !== undefined) lines.push(COPY.actualDue(label(state, decision.actualDueTick)));
  return lines;
}

/**
 * Silence as the engine runs it at the deadline: the family's own answer to `expired`, the petition marked so (the
 * calendar's petitions only take the gauge's expiry). A buy-back offer has no deadline (null).
 */
function expiredState(state: GameState, petition: PetitionRecord, def: PetitionDef): GameState | null {
  const trigger = def.trigger ?? "calendar";
  if (trigger === "decline_recovered") return null;
  const answered = trigger === "war" ? answerWarPetition(state, petition, "expired") : trigger === "plague" ? answerPlaguePetition(state, petition, "expired")
    : trigger === "reorganisation" ? answerReorganisationPetition(state, petition, "expired") : trigger === "legacy" ? answerLegacyPetition(state, petition, "expired") : state;
  const politics = answered.politics;
  if (politics === undefined) return null;
  const gauge = trigger === "calendar" ? Math.max(0, Math.min(100, politics.merchantGauge + def.expiredGauge)) : politics.merchantGauge;
  return { ...answered, politics: { ...politics, merchantGauge: gauge,
    petitions: politics.petitions.map(entry => entry.id === petition.id ? { ...entry, response: "expired" as const, respondedTick: state.tick } : entry) } };
}

/** The last tick an answer is taken: the end of the def's last year (the calendar's), else a season after it came. */
function lastAnswerTick(petition: PetitionRecord, def: PetitionDef): number | null {
  const trigger = def.trigger ?? "calendar";
  if (trigger === "decline_recovered" || trigger === "calendar") return null;
  const seasons = trigger === "war" ? WAR_BALANCE.answerSeasons : 1;
  return Math.ceil((petition.arrivedTick + seasons * SEASON_TICKS) / SEASON_TICKS) * SEASON_TICKS - 1;
}

const movesKey = (moves: ReadonlyMap<string, number>) => [...moves].filter(([, delta]) => delta !== 0).sort(([a], [b]) => a.localeCompare(b)).map(([id, delta]) => `${id}:${delta}`).join(",");

function deadlineLine(state: GameState, petition: PetitionRecord, def: PetitionDef,
  answers: readonly Readonly<{ label: string; after: GameState | null }>[]): string {
  const expired = expiredState(state, petition, def);
  if (expired === null) return COPY.noDeadline;
  const last = lastAnswerTick(petition, def);
  const until = last === null ? COPY.untilYearEnd(def.toYear) : COPY.until(label(state, last));
  const silent = new Map<string, number>();
  for (const change of factionChanges(state, expired)) silent.set(change.factionId, (silent.get(change.factionId) ?? 0) + change.delta);
  const money = treasuryBalance(expired) - treasuryBalance(state);
  const same = answers.find(answer => {
    if (answer.after === null || treasuryBalance(answer.after) - treasuryBalance(state) !== money) return false;
    const moves = new Map<string, number>();
    for (const change of factionChanges(state, answer.after)) moves.set(change.factionId, (moves.get(change.factionId) ?? 0) + change.delta);
    return movesKey(moves) === movesKey(silent);
  });
  if (same !== undefined && silent.size > 0) return `${until} ${COPY.silenceSame(same.label)}`;
  const who = [...silent].filter(([, delta]) => delta !== 0).map(([id, delta]) => {
    const view = expired.factions?.factions.find(entry => entry.id === id);
    return COPY.silenceWho(factionDisplayName(id, view?.name ?? id), DECISION_CARD_COPY.feels(delta));
  });
  const gauge = { from: state.politics?.merchantGauge ?? 50, to: expired.politics?.merchantGauge ?? 50 };
  const lines = [who.length === 0 ? COPY.silenceNothing : COPY.silenceMoves(who.join(", ")), ...(gauge.to === gauge.from ? [] : [COPY.gauge(gauge.from, gauge.to)])];
  return `${until} ${lines.join(" ")}`;
}

export const petitionCard = perState((state: GameState): PetitionCardView | null => {
  const petition = openPetitions(state)[0];
  const view = petitionDecisionView(state);
  if (petition === undefined || view === null) return null;
  const def = PETITION_DEFS.find(entry => entry.id === petition.defId);
  const { presentation } = view;
  const defId = isPetitionDefId(petition.defId) ? petition.defId : null;
  const answers = view.options.map(option => ({ option, after: afterAnswer(state, { type: "petition_response", petitionId: petition.id, response: option.choice }) }));
  const choices = answers.map(({ option, after }): DecisionChoiceView => {
    if (after === null) return { id: option.choice, label: option.label, now: [], later: [], remembers: [], refusal: COPY.refused };
    const words = defId === null ? { now: [], later: [] } : answerWords(defId, state, after, petition, option.choice, option.heir);
    return { id: option.choice, label: option.label, now: [...words.now, ...nowLines(state, after)], later: [...words.later, ...laterLines(state, after)],
      remembers: remembersOf(state, after), refusal: null };
  });
  const from = presentation.from;
  const behalf = PETITION_COPY.onBehalf[presentation.defId];
  const art = presentation.art;
  const card: DecisionCardView = {
    family: "petition", subjectId: petition.id, title: presentation.title, court: courtLine(state),
    from: from === null ? null : behalf === undefined ? PETITION_COPY.from(from.name) : PETITION_COPY.fromOnBehalf(from.name, behalf),
    situation: presentation.demand, stake: defId === null ? presentation.demand : PETITION_STAKE[defId],
    deadline: def === undefined ? null : deadlineLine(state, petition, def, answers.map(({ option, after }) => ({ label: option.label, after }))),
    illustration: art === null ? null : art.id, choices,
  };
  return { card, defId: petition.defId, petitionId: petition.id, from,
    heirs: view.options.flatMap(option => option.heir === undefined ? [] : [{ choice: option.choice, label: option.label, heir: option.heir }]) };
});
