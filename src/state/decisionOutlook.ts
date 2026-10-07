/**
 * DEC-TRACE §3 read model (`answerOutlook`; the render request docs/requests/engine-deccard-gp7.md §3, P-D4): what an
 * answer does now and later, and who remembers it — the command run on a copy of the state by the engine's own reducer
 * (no rule copied on the screen). It never changes the state.
 */
import type { GameState } from "../engine/engine.types";
import { decisionRemembers } from "../engine/decisionReads";
import { traceOf } from "../engine/decisionTrace";
import type { GameAction } from "./gameStore.types";
import { gameReducer } from "./gameStore";

export interface OutlookRow { readonly key: string; readonly amount?: number; readonly actor?: string }
export interface LaterRow { readonly key: string; readonly tick: number | null; readonly amount?: number; readonly actor?: string; readonly perSeason?: number }

/** What an answer does: now (the treasury, the minds it moves at once), later (what it sets going), who remembers it. */
export function answerOutlook(state: GameState, command: GameAction): { readonly now: readonly OutlookRow[]; readonly later: readonly LaterRow[]; readonly remembers: readonly { readonly actor: string; readonly delta: number }[] } | null {
  const after = gameReducer(state, command);
  if (after === state) return null;
  const now: OutlookRow[] = [];
  if (after.treasuryCoin !== state.treasuryCoin) now.push({ key: "treasury", amount: after.treasuryCoin - state.treasuryCoin });
  const decision = traceOf(after).decisions.find(entry => !traceOf(state).decisions.some(old => old.id === entry.id))
    ?? traceOf(after).decisions.find(entry => entry.lastTick === after.tick);
  const remembers = decision === undefined ? [] : decisionRemembers(after, decision.id).filter(entry => entry.tick === after.tick).map(({ actor, delta }) => ({ actor, delta }));
  for (const entry of remembers) now.push({ key: "relation", actor: entry.actor, amount: entry.delta });
  const later: LaterRow[] = [];
  for (const target of decision?.targets ?? []) {
    if (target.startsWith("promise:")) {
      const promise = after.diplomacy?.promises.find(entry => `promise:${entry.id}` === target);
      if (promise !== undefined && promise.status === "open") later.push({ key: "promise_due", tick: promise.deadline, ...(promise.amount === undefined ? {} : { amount: promise.amount }), actor: promise.promisee });
    } else if (target === "war_tax") {
      later.push({ key: "war_tax", tick: null, perSeason: after.war?.taxSeasonsLeft ?? 0 });
    } else if (target.startsWith("subsidy:")) {
      const kind = target.slice("subsidy:".length);
      const amount = after.agency?.subsidies.find(entry => entry.kind === kind)?.amount ?? 0;
      later.push({ key: amount > 0 ? "subsidy_paid_when_built" : "subsidy_withdrawn", tick: null, amount, actor: kind });
    } else if (target.startsWith("suit:")) {
      const suit = after.estates?.suits.find(entry => `suit:${entry.id}` === target);
      if (suit !== undefined) later.push({ key: "suit_stage", tick: null, actor: suit.stage });
    } else if (target === "timber") {
      later.push({ key: "timber_order", tick: null, amount: after.timberOrder ?? 0 });
    } else if (target === "dues") {
      later.push({ key: "stall_dues", tick: null, amount: after.agency?.duesPermille ?? 1000 });
    } else if (target.startsWith("faction:")) {
      later.push({ key: "faction_mind", tick: null, actor: target.slice("faction:".length) });
    }
  }
  return { now, later, remembers };
}
