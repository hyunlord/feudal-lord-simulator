import type { AutoplayAction } from "../engine/autoplay";
import { AUTOPLAY_TICK_CADENCE } from "./autoplayPresentation";

export interface AutoplayDecision {
  readonly tick: number;
  readonly action: AutoplayAction;
}
export interface AutoplayDecisionCache<TState> {
  readonly observedState: TState;
  readonly enabled: boolean;
  readonly decision: AutoplayDecision | null;
}
export function sampleAutoplayDecision<TState extends { readonly tick: number }>(
  previous: AutoplayDecisionCache<TState> | null,
  input: { readonly state: TState; readonly enabled: boolean; readonly pending: boolean },
  decide: (state: TState) => AutoplayAction,
  retryAfterNone?: (previous: TState, current: TState) => boolean,
): AutoplayDecisionCache<TState> {
  const { state, enabled, pending } = input;
  const cached = enabled ? previous?.decision ?? null : null;
  const manualEdit = previous !== null && previous.observedState !== state && previous.observedState.tick === state.tick;
  const due = cached === null || previous?.enabled !== true || manualEdit
    || state.tick < cached.tick || state.tick - cached.tick >= AUTOPLAY_TICK_CADENCE
    || enabled && !pending && cached.action.kind === 'none' && previous !== null
      && retryAfterNone?.(previous.observedState, state) === true;
  const decision = enabled && !pending && due ? { tick: state.tick, action: decide(state) } : cached;
  return { observedState: state, enabled, decision };
}
