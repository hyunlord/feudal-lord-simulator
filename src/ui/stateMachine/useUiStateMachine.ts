import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSpeed } from "../../engine/engine.types";
import type { GameStoreApi } from "../../state/gameStore.types";
import { INITIAL_UI_STATE, reduceUi, timeStopped, type UiEvent, type UiState } from "./uiStateMachine";

/**
 * S-32 / QA-025, one step of the modal pause (pure, for the tests): the first modal saves the speed and stops time;
 * the last one to close puts the saved speed back — a game paused before the modal stays paused. `setSpeed` is the
 * speed to set now, or null when it stands (no second pause, so no extra "pause" autosave).
 */
export function modalPauseStep(saved: GameSpeed | null, stopped: boolean, speed: GameSpeed): { readonly saved: GameSpeed | null; readonly setSpeed: GameSpeed | null } {
  if (stopped && saved === null) return { saved: speed, setSpeed: speed === 0 ? null : 0 };
  if (!stopped && saved !== null) return { saved: null, setSpeed: saved === speed ? null : saved };
  return { saved, setSpeed: null };
}

/**
 * UX-3 / CODE-1c: which UI is on screen is one state (uiStateMachine: one panel slot, Esc one step, modals push / pop).
 * S-32: a modal stops time; the speed before it comes back when the last modal closes.
 */
export function useUiStateMachine(store: Pick<GameStoreApi, "getSpeed" | "setSpeed">) {
  const [ui, setUi] = useState<UiState>(INITIAL_UI_STATE);
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const sendUi = useCallback((event: UiEvent) => setUi(current => reduceUi(current, event)), []);
  const modalPauseRef = useRef<GameSpeed | null>(null);
  useEffect(() => {
    const step = modalPauseStep(modalPauseRef.current, timeStopped(ui), store.getSpeed());
    modalPauseRef.current = step.saved;
    if (step.setSpeed !== null) store.setSpeed(step.setSpeed);
  }, [ui, store]);
  return { ui, uiRef, setUi, sendUi };
}
