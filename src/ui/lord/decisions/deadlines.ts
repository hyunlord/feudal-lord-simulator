import type { GameState } from "../../../engine/engine.types";
import { SEASON_TICKS } from "../../../engine/eventSchedule";
import { famineStatus, openPetitions, politicalPetitionExpiryTick } from "../../../engine/politics";
import { estatesOf } from "../../../engine/estates";
import { suitAwaitsLord, suitVerdictTick } from "../../../engine/estateSuits";
import { registryEntry } from "../../../engine/registry";
import { openHomePetitions } from "../../lordCardsModel";
import { openRegistryCards } from "../../registryCardModel";
import { DEADLINE_COPY } from "./deadlinesCopy.ko";
import { lordMatterChips } from "./lordMattersDue";

// LS1-11 (lord-screen-v1.md; the user's rulings 2026-10-16, v1.1 §7 item 4): the held chips' deadlines — each the
// engine's own value (`lordMattersDue`'s dueTick, a home petition's and a registry offer's deadline, the famine's answer
// window to its `endTick`), never one of the screen's. The time left is that deadline less the tick now; the last season
// (the one the deadline falls in) marks the chip as near. A political petition has no tick of its own (the engine
// expires it once the year passes its definition's `toYear`, politics.ts), so it shows none. LS1-14: the engine now
// gives it (politicalPetitionExpiryTick), and it shows its time left as the others do.

export type DeadlineKind = "will_change" | "audit" | "estate_petition" | "suit_defence" | "entry_threat" | "home_petition" | "registry" | "famine" | "petition";

export interface HeldDeadline {
  readonly chipId: string;
  readonly kind: DeadlineKind;
  /** The engine's id of the matter (its lapse record's `subjectId`: the negotiation, audit, petition, occurrence). */
  readonly subjectId: string;
  /** The engine's deadline: the last tick an answer is still taken. */
  readonly dueTick: number;
  /** Whether its lapse does something (the 8-kind table's "기한이 지나면"): the auto-pause tells only these. */
  readonly effect: boolean;
  /** LS1-17: a suit against the lord counts to its verdict (engine B's suitVerdictTick, then `dueTick`), and is near
   * only while its stage waits for his answer (suitAwaitsLord) — never by the season alone. */
  readonly verdict?: Readonly<{ awaits: boolean }>;
}

/**
 * What the engine does when each lapses (LS1-7's table): the will is left as it is (`willLapsed`), an audit tolerated, an
 * off-map petition refused with the wait held against the lord; a home petition only lapses; the famine passes without
 * an answer; a registry offer applies its entry's lapse answer when it has one (engine B: v4 entries have none).
 */
const EFFECT: Readonly<Record<Exclude<DeadlineKind, "registry">, boolean>> = {
  will_change: true, audit: true, estate_petition: true, suit_defence: false, entry_threat: false, home_petition: false, famine: false,
  // LS1-14: a political petition left past its expiry is refused (the factions read "expired" as "refuse").
  petition: true,
};

/** Every held chip with a deadline, each by the engine's own value. */
export function heldDeadlines(state: GameState): readonly HeldDeadline[] {
  const out: HeldDeadline[] = [];
  for (const { matter, chipId } of lordMatterChips(state)) {
    if (matter.kind === "suit_defence") {
      // LS1-17 (engine B's suit reads, trunk e9a227e7): the verdict's planned tick (it moves if a fee goes unpaid; so does
      // the chip), none once no judgment remains.
      const suit = estatesOf(state).suits.find(entry => entry.id === matter.id);
      const verdict = suit === undefined ? null : suitVerdictTick(state, suit);
      if (suit !== undefined && verdict !== null)
        out.push({ chipId, kind: "suit_defence", subjectId: matter.id, dueTick: verdict, effect: EFFECT.suit_defence, verdict: { awaits: suitAwaitsLord(state, suit) } });
      continue;
    }
    if (matter.dueTick === null || matter.kind === "contested") continue;
    out.push({ chipId, kind: matter.kind, subjectId: matter.id, dueTick: matter.dueTick, effect: EFFECT[matter.kind] });
  }
  for (const petition of openHomePetitions(state)) out.push({ chipId: `home-petition:${petition.id}`, kind: "home_petition", subjectId: petition.id, dueTick: petition.deadline, effect: false });
  for (const { occurrence } of openRegistryCards(state))
    out.push({ chipId: `registry:${occurrence.id}`, kind: "registry", subjectId: occurrence.id, dueTick: occurrence.deadline, effect: registryEntry(occurrence.entryId)?.lapseChoice !== undefined });
  // LS1-14 (engine B's politicalPetitionExpiryTick, trunk 0ee84b1d): its first expired tick, so the last answerable one
  // is the tick before — the engine's value, no year counted here.
  for (const petition of openPetitions(state)) {
    const expiry = politicalPetitionExpiryTick(state, petition);
    if (expiry !== null) out.push({ chipId: `petition:${petition.id}`, kind: "petition", subjectId: petition.id, dueTick: expiry - 1, effect: EFFECT.petition });
  }
  const famine = famineStatus(state);
  if (famine !== null && famine.choices.length > 0) out.push({ chipId: `famine:${famine.eventId}`, kind: "famine", subjectId: famine.eventId, dueTick: famine.endTick, effect: false });
  return out;
}

/** The season a deadline closes (a deadline on a season's turn closes the season before it): its last season. */
const lastSeasonOf = (dueTick: number): number => Math.floor((dueTick - 1) / SEASON_TICKS);
/** That last season has begun. */
export const inLastSeason = (tick: number, dueTick: number): boolean => Math.floor(tick / SEASON_TICKS) >= lastSeasonOf(dueTick);

/** A held chip's time left as it says it, and whether it is near (its last season). */
export interface ChipDue {
  readonly left: string; readonly near: boolean;
  /** LS1-14: the chip's short mark ("이번 철", "2철", "기한 지남"); `left` stays for the card. */
  readonly short: string;
  /** The engine's deadline (LS1-12: a fold shows its earliest). */ readonly dueTick?: number;
}

/**
 * Each held chip's time left: the seasons to the one its deadline closes, counting this one. Past its deadline and not
 * yet settled (the engine lapses it at its own step), it says so.
 */
export function chipDues(state: GameState): ReadonlyMap<string, ChipDue> {
  return new Map(heldDeadlines(state).map(due => {
    if (due.verdict !== undefined) {
      // The seasons to the verdict's (it falls on a season's first tick), at least one.
      const seasons = Math.max(1, Math.floor(due.dueTick / SEASON_TICKS) - Math.floor(state.tick / SEASON_TICKS));
      return [due.chipId, { left: DEADLINE_COPY.toVerdict(seasons), short: DEADLINE_COPY.toVerdict(seasons), near: due.verdict.awaits, dueTick: due.dueTick }] as const;
    }
    if (due.dueTick < state.tick) return [due.chipId, { left: DEADLINE_COPY.past, short: DEADLINE_COPY.short.past, near: true, dueTick: due.dueTick }] as const;
    const seasons = lastSeasonOf(due.dueTick) - Math.floor(state.tick / SEASON_TICKS) + 1;
    const near = inLastSeason(state.tick, due.dueTick);
    return [due.chipId, { left: near ? DEADLINE_COPY.thisSeason : DEADLINE_COPY.seasonsLeft(seasons), short: near ? DEADLINE_COPY.short.thisSeason : DEADLINE_COPY.short.seasons(seasons),
      near, dueTick: due.dueTick }] as const;
  }));
}
