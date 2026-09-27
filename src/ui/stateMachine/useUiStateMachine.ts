import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSpeed } from "../../engine/engine.types";
import type { GameStoreApi } from "../../state/gameStore.types";
import { INITIAL_UI_STATE, reduceUi, timeStopped, type UiEvent, type UiState } from "./uiStateMachine";

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
    if (timeStopped(ui) && modalPauseRef.current === null) { modalPauseRef.current = store.getSpeed(); store.setSpeed(0); }
    if (!timeStopped(ui) && modalPauseRef.current !== null) { store.setSpeed(modalPauseRef.current === 0 ? 0 : modalPauseRef.current); modalPauseRef.current = null; }
  }, [ui, store]);
  return { ui, uiRef, setUi, sendUi };
}
