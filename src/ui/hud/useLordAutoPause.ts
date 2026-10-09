import { useEffect, useRef, useState } from "react";

import type { PauseEvent } from "../../engine/autoPause";
import type { GameStoreApi } from "../../state/gameStore.types";
import { eventWorldFirstMs } from "../eventStory";
import { autoPauseMemory, autoPauseStep } from "./autoPauseModel";

/** A chip of the same matter comes `eventWorldFirstMs` after the stop (after the world); this much more for the UI's sampling. */
const CHIP_AFTER_STOP_MS = 1_000;

/**
 * Harnesses that need time to keep running in lord mode (a capture waiting for a season to close, a perf run) open the
 * game with `?auto-pause=off`; the screen then never stops by itself (the reasons are not read).
 */
export function autoPauseEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return new URLSearchParams(window.location.search).get("auto-pause") !== "off";
}

/**
 * LM-R3 (lord slice LS-2): the lord-mode auto-pause. After every state the store commits (each frame's tick batch, and
 * every command) it reads the engine's `pauseReasons` against the last state seen; when there are any, time stops
 * (`setSpeed(0)`, as a story modal's pause does) and the reasons stay until time is started again. A load, a new game
 * or the tick going back is no turn (autoPauseStep). Sandbox and the campaign never stop (lord mode only).
 *
 * `modalUp`: a modal holds time and will give the speed before it back when it closes; a stop made under it holds once
 * more then (the stop is the reason's, not the modal's).
 *
 * `chipPause`: the story chips' "a new chip stops time" setting (eventPause). It keeps its meaning, but a chip that comes
 * within its delay after an auto-pause is that stop's own matter: it does not stop time a second time.
 */
export function useLordAutoPause(store: GameStoreApi, modalUp: boolean) {
  const [events, setEvents] = useState<readonly PauseEvent[]>([]);
  const [enabled] = useState(autoPauseEnabled);
  const memoryRef = useRef(autoPauseMemory(store.getState()));
  const heldRef = useRef(false);
  const underModalRef = useRef(false);
  const stoppedAtRef = useRef(Number.NEGATIVE_INFINITY);
  const modalRef = useRef(modalUp);
  modalRef.current = modalUp;
  useEffect(() => {
    if (!enabled) return undefined;
    const check = () => {
      const step = autoPauseStep(memoryRef.current, store.getState(), store.getPreviousRenderState());
      memoryRef.current = step.memory;
      if (step.fresh.length > 0) {
        heldRef.current = true; underModalRef.current = modalRef.current; stoppedAtRef.current = Date.now();
        setEvents(current => [...current, ...step.fresh]);
        store.setSpeed(0);
        return;
      }
      if (!heldRef.current || store.getSpeed() === 0) return;
      // Time started again: the stop is answered — unless it was the modal giving its speed back.
      if (underModalRef.current && !modalRef.current) { underModalRef.current = false; store.setSpeed(0); return; }
      heldRef.current = false; underModalRef.current = false;
      setEvents([]);
    };
    return store.subscribe(check);
  }, [store, enabled]);
  // After the modal's own effect gave its speed back (it runs first): a modal that held none leaves nothing to hold.
  useEffect(() => { if (!modalUp) underModalRef.current = false; }, [modalUp]);
  const chipPause = () => {
    if (Date.now() - stoppedAtRef.current < eventWorldFirstMs() + CHIP_AFTER_STOP_MS) return;
    store.setSpeed(0);
  };
  return { events, chipPause };
}
