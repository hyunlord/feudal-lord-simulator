import type { OverlayMode } from "../engine/engine.types";

export type EconomyOverlayControlsProps = {
  readonly overlayMode: OverlayMode;
  readonly onChange: (mode: OverlayMode) => void;
};

type EconomyOverlayOption = {
  readonly mode: Extract<OverlayMode, "water" | "labour">;
  readonly keyCode: "Digit1" | "Digit2";
  readonly label: string;
  readonly legend: string;
};

const ECONOMY_OVERLAYS = [
  {
    mode: "water",
    keyCode: "Digit1",
    label: "Water",
    legend: "well radius, dry houses",
  },
  {
    mode: "labour",
    keyCode: "Digit2",
    label: "Labour",
    legend: "understaffed worksites",
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
}: EconomyOverlayControlsProps) {
  return (
    <section className="economy-overlays" aria-label="Economy overlays">
      <span className="overlay-heading">Overlays</span>
      <div className="overlay-seals">
        {ECONOMY_OVERLAYS.map((option) => (
          <button
            key={option.mode}
            className="overlay-seal"
            type="button"
            aria-pressed={overlayMode === option.mode}
            aria-label={`${option.label} overlay ${option.keyCode}`}
            onClick={() => onChange(overlayMode === option.mode ? "none" : option.mode)}
          >
            <span className="overlay-label">{option.label}</span>
            <span className="overlay-key">{option.keyCode}</span>
            <span className="overlay-legend">{option.legend}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
