import { useEffect, useRef } from "react";

import type { GameCanvasRuntimeInput } from "./gameCanvasRuntimeInput";

export function useGameCanvasRuntimeRefs(input: {
  readonly state: GameCanvasRuntimeInput["state"];
  readonly previousRenderState: GameCanvasRuntimeInput["previousRenderState"];
  readonly selectedTool: GameCanvasRuntimeInput["selectedTool"];
  readonly overlayMode: GameCanvasRuntimeInput["overlayMode"];
  readonly selection: GameCanvasRuntimeInput["selection"];
  readonly highlightedHouseIds: GameCanvasRuntimeInput["highlightedHouseIds"];
  readonly palisadeDraft: NonNullable<GameCanvasRuntimeInput["palisadeDraft"]> | null;
  readonly houseMaterialWave: NonNullable<GameCanvasRuntimeInput["houseMaterialWave"]> | null;
  readonly palisadeCeremonyStartedAtMs: NonNullable<GameCanvasRuntimeInput["palisadeCeremonyStartedAtMs"]> | null;
}) {
  const stateRef = useRef(input.state);
  const previousRenderStateRef = useRef(input.previousRenderState);
  const selectedToolRef = useRef(input.selectedTool);
  const overlayModeRef = useRef(input.overlayMode);
  const selectionRef = useRef(input.selection);
  const highlightedHouseIdsRef = useRef(input.highlightedHouseIds);
  const palisadeDraftRef = useRef(input.palisadeDraft);
  const houseMaterialWaveRef = useRef(input.houseMaterialWave);
  const palisadeCeremonyStartedAtMsRef = useRef(input.palisadeCeremonyStartedAtMs);

  useEffect(() => {
    stateRef.current = input.state;
    previousRenderStateRef.current = input.previousRenderState;
    selectedToolRef.current = input.selectedTool;
    overlayModeRef.current = input.overlayMode;
    selectionRef.current = input.selection;
    highlightedHouseIdsRef.current = input.highlightedHouseIds;
    palisadeDraftRef.current = input.palisadeDraft;
    houseMaterialWaveRef.current = input.houseMaterialWave;
    palisadeCeremonyStartedAtMsRef.current = input.palisadeCeremonyStartedAtMs;
  }, [
    input.highlightedHouseIds,
    input.houseMaterialWave,
    input.overlayMode,
    input.palisadeCeremonyStartedAtMs,
    input.palisadeDraft,
    input.selectedTool,
    input.selection,
    input.state,
    input.previousRenderState,
  ]);

  return {
    stateRef,
    previousRenderStateRef,
    selectedToolRef,
    overlayModeRef,
    selectionRef,
    highlightedHouseIdsRef,
    palisadeDraftRef,
    houseMaterialWaveRef,
    palisadeCeremonyStartedAtMsRef,
  };
}
