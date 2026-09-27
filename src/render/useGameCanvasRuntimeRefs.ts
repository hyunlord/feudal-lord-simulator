import { useEffect, useRef } from "react";

import type { GameStoreApi } from "../state/gameStore.types";
import type { GameCanvasRuntimeInput } from "./gameCanvasRuntimeInput";
import { presentedPreviousState, presentedState } from "./presentation/presentedState";

export function useGameCanvasRuntimeRefs(input: {
  readonly store: GameStoreApi;
  readonly selectedTool: GameCanvasRuntimeInput["selectedTool"];
  readonly overlayMode: GameCanvasRuntimeInput["overlayMode"];
  readonly problemOnly?: boolean;
  readonly selection: GameCanvasRuntimeInput["selection"];
  readonly highlightedHouseIds: GameCanvasRuntimeInput["highlightedHouseIds"];
  readonly palisadeDraft: NonNullable<GameCanvasRuntimeInput["palisadeDraft"]> | null;
  readonly houseMaterialWave: NonNullable<GameCanvasRuntimeInput["houseMaterialWave"]> | null;
  readonly palisadeCeremonyStartedAtMs: NonNullable<GameCanvasRuntimeInput["palisadeCeremonyStartedAtMs"]> | null;
  readonly zoneTool?: GameCanvasRuntimeInput["zoneTool"];
}) {
  // CODE-1c: the canvas follows every committed tick through the store, not through a React render.
  const stateRef = useRef(presentedState(input.store.getState()));
  const previousRenderStateRef = useRef(presentedPreviousState(input.store.getPreviousRenderState(), input.store.getState()));
  const selectedToolRef = useRef(input.selectedTool);
  const overlayModeRef = useRef(input.overlayMode);
  const problemOnlyRef = useRef(input.problemOnly ?? false);
  const selectionRef = useRef(input.selection);
  const highlightedHouseIdsRef = useRef(input.highlightedHouseIds);
  const palisadeDraftRef = useRef(input.palisadeDraft);
  const houseMaterialWaveRef = useRef(input.houseMaterialWave);
  const palisadeCeremonyStartedAtMsRef = useRef(input.palisadeCeremonyStartedAtMs);
  const zoneToolRef = useRef(input.zoneTool ?? null);

  const { store } = input;
  useEffect(() => {
    const follow = () => {
      const state = store.getState();
      stateRef.current = presentedState(state);
      previousRenderStateRef.current = presentedPreviousState(store.getPreviousRenderState(), state);
    };
    follow();
    return store.subscribe(follow);
  }, [store]);

  useEffect(() => {
    selectedToolRef.current = input.selectedTool;
    overlayModeRef.current = input.overlayMode;
    problemOnlyRef.current = input.problemOnly ?? false;
    selectionRef.current = input.selection;
    highlightedHouseIdsRef.current = input.highlightedHouseIds;
    palisadeDraftRef.current = input.palisadeDraft;
    houseMaterialWaveRef.current = input.houseMaterialWave;
    palisadeCeremonyStartedAtMsRef.current = input.palisadeCeremonyStartedAtMs;
    zoneToolRef.current = input.zoneTool ?? null;
  }, [
    input.zoneTool,
    input.highlightedHouseIds,
    input.houseMaterialWave,
    input.overlayMode,
    input.problemOnly,
    input.palisadeCeremonyStartedAtMs,
    input.palisadeDraft,
    input.selectedTool,
    input.selection,
  ]);

  return {
    stateRef,
    previousRenderStateRef,
    selectedToolRef,
    overlayModeRef,
    problemOnlyRef,
    selectionRef,
    highlightedHouseIdsRef,
    palisadeDraftRef,
    houseMaterialWaveRef,
    palisadeCeremonyStartedAtMsRef,
    zoneToolRef,
  };
}
