import { KO_UI } from "../content/locale.ko";
import type { GameSpeed } from "../engine/engine.types";

// NAT-4 (user decision 2026-10-02): four seals — pause, 1x, 3x and ONE fast seal for 5x and 10x (a fifth seal put the
// always-on HUD 0.3 pt over its 1280 budget). The fast seal wears the 5x art (the time sheet's `fastest` cell, three
// chevrons) and a corner mark with the fast speed it stands for; a press from pause, 1x or 3x goes to 5x, and at 5x or
// 10x switches between the two. Digit5 / Digit0 pick 5x / 10x directly (mouseKeyboardTranslator.ts).

export type SpeedSeal = Readonly<{ id: "pause" | "normal" | "threefold" | "fast"; icon: "pause" | "play" | "fast" | "fastest" }>;

export const SPEED_SEALS: readonly SpeedSeal[] = [
  { id: "pause", icon: "pause" }, { id: "normal", icon: "play" }, { id: "threefold", icon: "fast" }, { id: "fast", icon: "fastest" },
];
const FIXED: Readonly<Record<Exclude<SpeedSeal["id"], "fast">, GameSpeed>> = { pause: 0, normal: 1, threefold: 3 };

/** The fast speed now (5x or 10x), or null when the game runs slower or stands. */
export function fastSpeedOf(speed: GameSpeed): 5 | 10 | null {
  return speed === 5 || speed === 10 ? speed : null;
}

/** The speed a press of the seal sets: the fast seal from pause, 1x or 3x goes to 5x, and switches 5x ↔ 10x. */
export function sealPress(seal: SpeedSeal, speed: GameSpeed): GameSpeed {
  if (seal.id !== "fast") return FIXED[seal.id];
  return speed === 5 ? 10 : 5;
}

/** What the seal shows and says now: its name (the fast seal: the current fast speed and what a press does), pressed, its mark. */
export function sealView(seal: SpeedSeal, speed: GameSpeed): Readonly<{ label: string; pressed: boolean; mark: string | null }> {
  if (seal.id !== "fast") return { label: KO_UI.speeds[seal.id === "pause" ? "paused" : seal.id], pressed: speed === FIXED[seal.id], mark: null };
  const fast = fastSpeedOf(speed);
  return { label: KO_UI.speeds.fastLabel(fast), pressed: fast !== null, mark: KO_UI.speeds.fastMark(fast ?? 5) };
}
