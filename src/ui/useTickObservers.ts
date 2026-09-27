import { useEffect, useRef, useState } from "react";
import type { GameState } from "../engine/engine.types";
import { presentedState } from "../render/presentation/presentedState";
import type { GameStoreApi } from "../state/gameStore.types";
import { completedSiteNames, COMPLETION_GROUP_MS } from "./completionToast";
import { createDistributorRouteHistory, observeDistributorRouteHistory, type DistributorRouteHistory } from "./distributorRouteHistory";
import { appendPopulationEvents, diffPopulationEvents, type PopulationEvent } from "./populationEventModel";
import { createStoreStockHistory, observeStoreStockHistory } from "./storeStockHistory";

export function nextDistributorRouteHistoryCommit(input: {
  readonly previousState: GameState;
  readonly nextState: GameState;
  readonly history: DistributorRouteHistory;
}): DistributorRouteHistory | null {
  const nextHistory = observeDistributorRouteHistory(input);
  return nextHistory === input.history ? null : nextHistory;
}

export type CompletionToast = { readonly names: readonly string[]; readonly firstAtMs: number };

/**
 * CODE-1c: what the screen remembers of each committed tick — the stores' stock samples and cart uses (UX-3R2), the
 * distributors' routes, the population log (the drawer), completed sites (one grouped toast, F0-V). They follow every
 * change through the store (App no longer renders on a tick); only the log and the toast are React state, set when
 * they change.
 */
export function useTickObservers(store: GameStoreApi) {
  const storeHistoryRef = useRef(createStoreStockHistory());
  const distributorRouteHistoryRef = useRef(createDistributorRouteHistory());
  const [populationEvents, setPopulationEvents] = useState<readonly PopulationEvent[]>([]);
  const [completionToast, setCompletionToast] = useState<CompletionToast | null>(null);
  useEffect(() => {
    let previous = presentedState(store.getState());
    storeHistoryRef.current = observeStoreStockHistory(storeHistoryRef.current, previous);
    const observe = () => {
      const state = presentedState(store.getState());
      if (state === previous) return;
      storeHistoryRef.current = observeStoreStockHistory(storeHistoryRef.current, state);
      const history = nextDistributorRouteHistoryCommit({ previousState: previous, nextState: state, history: distributorRouteHistoryRef.current });
      if (history !== null) distributorRouteHistoryRef.current = history;
      const incoming = diffPopulationEvents(previous, state);
      if (incoming.length > 0) setPopulationEvents(existing => appendPopulationEvents(existing, incoming));
      const names = completedSiteNames(previous, state);
      if (names.length > 0) {
        const now = Date.now();
        setCompletionToast(current => current !== null && now - current.firstAtMs < COMPLETION_GROUP_MS
          ? { names: [...current.names, ...names], firstAtMs: current.firstAtMs } : { names, firstAtMs: now });
      }
      previous = state;
    };
    return store.subscribe(observe);
  }, [store]);
  return { storeHistoryRef, distributorRouteHistoryRef, populationEvents, completionToast };
}
