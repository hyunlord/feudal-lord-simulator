import { useEffect, useState } from "react";

import type { OverlayMode } from "../engine/engine.types";
import { KO_UI } from "../content/locale.ko";
import {
  getObjectRenderViewMode,
  subscribeObjectRenderViewMode,
  toggleObjectRenderViewMode,
} from "../render/objectRenderViewMode";
import { Button } from "./kit";

export type EconomyOverlayControlsProps = {
  readonly overlayMode: OverlayMode;
  readonly problemOnly?: boolean;
  readonly onProblemOnlyChange?: (enabled: boolean) => void;
  readonly onChange: (mode: OverlayMode) => void;
};

type EconomyOverlayOption = {
  readonly mode: Extract<OverlayMode, "water" | "labour" | "distribution" | "road_component">;
  readonly keyCode: "Digit1" | "Digit2" | "Digit3" | "Digit4";
  readonly label: string;
  readonly compactLabel: string;
  readonly legend: string;
  readonly shortcut: "1" | "2" | "3" | "4";
};

const ECONOMY_OVERLAYS = [
  {
    mode: "water",
    keyCode: "Digit1",
    label: KO_UI.overlays.water.label,
    compactLabel: KO_UI.overlays.water.compact,
    legend: KO_UI.overlays.water.legend,
    shortcut: "1",
  },
  {
    mode: "labour",
    keyCode: "Digit2",
    label: KO_UI.overlays.labour.label,
    compactLabel: KO_UI.overlays.labour.compact,
    legend: KO_UI.overlays.labour.legend,
    shortcut: "2",
  },
  {
    mode: "distribution",
    keyCode: "Digit3",
    label: KO_UI.overlays.distribution.label,
    compactLabel: KO_UI.overlays.distribution.compact,
    legend: KO_UI.overlays.distribution.legend,
    shortcut: "3",
  },
  {
    mode: "road_component",
    keyCode: "Digit4",
    label: KO_UI.overlays.roadComponent.label,
    compactLabel: KO_UI.overlays.roadComponent.compact,
    legend: KO_UI.overlays.roadComponent.legend,
    shortcut: "4",
  },
] as const satisfies readonly EconomyOverlayOption[];

export function toggleOverlayByKey(
  keyCode: string,
  current: OverlayMode,
): OverlayMode {
  const option = ECONOMY_OVERLAYS.find((candidate) => candidate.keyCode === keyCode);
  if (option === undefined) return current;
  return current === option.mode ? "none" : option.mode;
}

export function EconomyOverlayControls({
  overlayMode,
  onChange,
  problemOnly = false,
  onProblemOnlyChange,
}: EconomyOverlayControlsProps) {
  const [objectRenderViewMode, setObjectRenderViewModeState] = useState(getObjectRenderViewMode);
  useEffect(
    () => subscribeObjectRenderViewMode(setObjectRenderViewModeState),
    [],
  );
  const outlinesEnabled = objectRenderViewMode === "outlines";
  const toggleOutlines = () => {
    setObjectRenderViewModeState(toggleObjectRenderViewMode(true));
  };

  return (
    <section className="economy-overlays" aria-label={KO_UI.overlays.ariaLabel}>
      <span className="overlay-heading">{KO_UI.overlays.heading}</span>
      <div className="overlay-seals">
        <Button className="overlay-seal" type="button" aria-pressed={problemOnly}
          aria-label="문제만 보기, 단축키 O" onPress={() => onProblemOnlyChange?.(!problemOnly)} variant="toggle">
          <span className="overlay-label">문제만 보기</span><span className="overlay-key">O</span>
        </Button>
        {ECONOMY_OVERLAYS.map((option) => (
          <Button
            key={option.mode}
            className="overlay-seal"
            type="button"
            aria-pressed={overlayMode === option.mode}
            aria-label={`${option.label} 보기, ${KO_UI.overlays.shortcut} ${option.shortcut}`}
            onPress={() => onChange(overlayMode === option.mode ? "none" : option.mode)}
           variant="toggle">
            <span className="overlay-label overlay-label--full">{option.label}</span>
            <span className="overlay-label overlay-label--compact" aria-hidden="true">{option.compactLabel}</span>
            <span className="overlay-key">{option.shortcut}</span>
            <span className="overlay-legend">{option.legend}</span>
          </Button>
        ))}
        <Button
          className="overlay-seal"
          type="button"
          aria-pressed={outlinesEnabled}
          aria-label={`${KO_UI.overlays.outlines.label} 보기`}
          onPress={toggleOutlines}
         variant="toggle">
          <span className="overlay-label overlay-label--full">{KO_UI.overlays.outlines.label}</span>
          <span className="overlay-label overlay-label--compact" aria-hidden="true">{KO_UI.overlays.outlines.compact}</span>

          <span className="overlay-legend">{KO_UI.overlays.outlines.legend}</span>
        </Button>
      </div>
    </section>
  );
}
