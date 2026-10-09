import { useCallback, useEffect, useRef, useState } from "react";

import { presentationPreference } from "../../render/presentationPreferences";
import type { GameStoreApi } from "../../state/gameStore.types";
import { eventWorldFirstMs } from "../eventStory";
import { autoPauseMemory, autoPauseStep, seasonKey, seasonPutAway, seasonTurn, type SeasonHold } from "./autoPauseModel";

/** A chip of the same matter comes `eventWorldFirstMs` after the stop (after the world); this much more for the UI's sampling. */
const CHIP_AFTER_STOP_MS = 1_000;

/**
 * Harnesses that need time to keep running in lord mode (a capture waiting for a season to close, a perf run) open the
 * game with `?auto-pause=off`; the screen then never stops by itself (the reasons are not read). The player's own switch
 * is the presentation preference `lordAutoPause` (the settings, on by default).
 */
export function autoPauseEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return new URLSearchParams(window.location.search).get("auto-pause") !== "off";
}

/**
 * LM-R3 (lord slice LS-2; the user's ruling 2026-10-09): the lord-mode auto-pause. After every state the store commits
 * (each frame's tick batch, and every command) it reads the engine's reasons against the last state seen
 * (autoPauseStep). A season's first reasons stop time (`setSpeed(0)`, as a story modal's pause does) and stay until time
 * is started again; the season's later reasons join its list without a second stop (seasonTurn) — shown as its added
 * lines, put away by their [확인]. A load, a new game or the tick going back is no turn. Sandbox and the campaign never
 * stop (lord mode only). The player's switch off: nothing stops and nothing shows (the chips still come).
 *
 * `modalUp`: a modal holds time and will give the speed before it back when it closes; a stop made under it holds once
 * more then (the stop is the reason's, not the modal's).
 *
 * `chipPause`: the story chips' "a new chip stops time" setting (eventPause). It keeps its meaning, but a chip that comes
 * within its delay after an auto-pause is that stop's own matter: it does not stop time a second time.
 */
export function useLordAutoPause(store: GameStoreApi, modalUp: boolean) {
  const [hold, setHold] = useState<SeasonHold | null>(null);
  const [enabled] = useState(autoPauseEnabled);
  const memoryRef = useRef(autoPauseMemory(store.getState()));
  const holdRef = useRef<SeasonHold | null>(null);
  const underModalRef = useRef(false);
  const stoppedAtRef = useRef(Number.NEGATIVE_INFINITY);
  const modalRef = useRef(modalUp);
  modalRef.current = modalUp;
  const keep = useCallback((next: SeasonHold | null) => { holdRef.current = next; setHold(next); }, []);
  useEffect(() => {
    if (!enabled) return undefined;
    const check = () => {
      const state = store.getState();
      const step = autoPauseStep(memoryRef.current, state, store.getPreviousRenderState());
      memoryRef.current = step.memory;
      if (step.reset === true) { underModalRef.current = false; if (holdRef.current !== null) keep(null); return; }
      if (step.fresh.length > 0 && presentationPreference("lordAutoPause")) {
        const turn = seasonTurn(holdRef.current, seasonKey(state), step.fresh);
        keep(turn.hold);
        if (turn.stop) { underModalRef.current = modalRef.current; stoppedAtRef.current = Date.now(); store.setSpeed(0); return; }
      }
      if (holdRef.current?.mode !== "stopped" || store.getSpeed() === 0) return;
      // Time started again: the stop is answered — unless it was the modal giving its speed back.
      if (underModalRef.current && !modalRef.current) { underModalRef.current = false; store.setSpeed(0); return; }
      underModalRef.current = false;
      keep(seasonPutAway(holdRef.current));
    };
    return store.subscribe(check);
  }, [store, enabled, keep]);
  // After the modal's own effect gave its speed back (it runs first): a modal that held none leaves nothing to hold.
  useEffect(() => { if (!modalUp) underModalRef.current = false; }, [modalUp]);
  const chipPause = () => {
    if (Date.now() - stoppedAtRef.current < eventWorldFirstMs() + CHIP_AFTER_STOP_MS) return;
    store.setSpeed(0);
  };
  const dismiss = useCallback(() => keep(seasonPutAway(holdRef.current)), [keep]);
  return { hold, chipPause, dismiss };
}
