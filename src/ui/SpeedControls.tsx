import type { GameSpeed } from "../engine/engine.types";

const SPEED_SEALS: readonly {
  readonly speed: GameSpeed;
  readonly label: string;
  readonly paths: readonly string[];
}[] = [
  { speed: 0, label: "Pause", paths: ["M8 6v12", "M16 6v12"] },
  { speed: 1, label: "Normal speed", paths: ["m9 6 8 6-8 6Z"] },
  { speed: 3, label: "Threefold speed", paths: ["m5 6 7 6-7 6Z", "m12 6 7 6-7 6Z"] },
  { speed: 5, label: "Fivefold speed", paths: ["m3 6 6 6-6 6Z", "m9 6 6 6-6 6Z", "m15 6 6 6-6 6Z"] },
];

export function speedToIntervalMs(speed: GameSpeed): number | null {
  return speed === 0 ? null : 1_000 / speed;
}

type SpeedSealsProps = {
  readonly speed: GameSpeed;
  readonly onChange: (speed: GameSpeed) => void;
};

export function SpeedSeals({ speed, onChange }: SpeedSealsProps) {
  return (
    <div className="speed-seals" role="group" aria-label="Time seals">
      {SPEED_SEALS.map((option) => (
        <button
          key={option.speed}
          className="speed-seal"
          type="button"
          aria-label={option.label}
          aria-pressed={speed === option.speed}
          onClick={() => onChange(option.speed)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            {option.paths.map((path) => <path key={path} d={path} />)}
          </svg>
        </button>
      ))}
    </div>
  );
}
