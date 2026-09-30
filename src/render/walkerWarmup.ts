import type { GameState } from "../engine/engine.types";
import { composedLookForProof, currentWalkerLooks, lookFitsBudget } from "./walkerComposer";

// SMOOTH-2R item 5: the looks on the map are composed ahead, in idle time, when a game is loaded and when a chapter
// begins (new trades, new sheets), so the first frames that show them only draw. Without it the first seconds after a
// load composed a look per walker that came into view (81–113 looks in the biggest town, 8 cells each). Carts need
// nothing here: the runtime actor loader rasters the handcart's frames when it loads (runtimeActorAssets.ts).
// A look whose images are still loading is tried again on a later idle slice (at most WARM_ROUNDS times); warm-up
// stops while the canvas budget has no room (canvasBudget.ts).
const WARM_ROUNDS = 20;
const MIN_IDLE_MS = 3;
let warmedFor: string | null = null;

/** Starts the warm-up when the game or chapter changed since the last call (once per frame is fine). */
export function warmWalkerLooksFor(state: GameState, chapter: number): void {
  const key = `${state.scenarioId}:${state.seed}:${chapter}`;
  if (key === warmedFor || typeof requestIdleCallback !== "function") return;
  warmedFor = key;
  let queue = [...currentWalkerLooks(state)];
  let rounds = 0;
  const run = (deadline: IdleDeadline): void => {
    const waiting: typeof queue = [];
    while (queue.length > 0 && deadline.timeRemaining() > MIN_IDLE_MS && lookFitsBudget()) {
      const look = queue.shift()!;
      if (composedLookForProof(...look) === null) waiting.push(look);
    }
    queue = [...queue, ...waiting];
    rounds += waiting.length > 0 ? 1 : 0;
    if (queue.length > 0 && rounds < WARM_ROUNDS && lookFitsBudget()) requestIdleCallback(run, { timeout: 500 });
  };
  requestIdleCallback(run, { timeout: 500 });
}

/** Tests: forget what was warmed. */
export function resetWalkerWarmupForTest(): void { warmedFor = null; }
