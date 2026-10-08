import type { PetitionDef } from "../../../content/chapterConfig";
import { factionDisplayName } from "../../../content/factionCopy.ko";
import { WAR_BALANCE } from "../../../content/warConfig";
import type { GameState } from "../../../engine/engine.types";
import { SEASON_TICKS } from "../../../engine/eventSchedule";
import { factionChanges } from "../../../engine/factions";
import { answerLegacyPetition } from "../../../engine/legacy";
import { answerPlaguePetition } from "../../../engine/plague";
import type { PetitionRecord } from "../../../engine/politics.types";
import { answerReorganisationPetition } from "../../../engine/reorganisation";
import { calendarLabel } from "../../../engine/scenarioState";
import { answerWarPetition } from "../../../engine/war";
import { treasuryBalance } from "../../../ledger/ledger";
import { DECISION_CARD_COPY } from "../decisionCardCopy.ko";
import { PETITION_CARD_COPY as COPY } from "./petitionCardCopy.ko";

// DEC-CARD, a political petition's deadline and what silence means (DC-D2): silence is run as the engine runs it at the
// deadline (the family's own answer to `expired`) and compared with each answer's dry run. The outlook does not model
// silence (no command is sent), so this stays the dry run (petitionCard.ts).

const label = (state: GameState, tick: number) => calendarLabel({ ...state, tick });

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

export function deadlineLine(state: GameState, petition: PetitionRecord, def: PetitionDef,
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

