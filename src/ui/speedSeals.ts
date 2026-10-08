import { KO_UI } from "../content/locale.ko";
import type { GameSpeed } from "../engine/engine.types";

// NAT-4 (user decision 2026-10-02): four seals — pause, 1x, 3x and ONE fast seal for 5x and 10x (a fifth seal put the
// always-on HUD 0.3 pt over its 1280 budget). The fast seal wears the 5x art (the time sheet's `fastest` cell, three
// chevrons) and a corner mark with the fast speed it stands for; a press from pause, 1x or 3x goes to 5x, and at 5x or
// 10x switches between the two. Digit5 / Digit0 pick 5x / 10x directly (mouseKeyboardTranslator.ts).
// PLAY-2 (Astra's second lord-mode play, 2026-10-08: "I could not find 10×"): the mark shows both of the seal's speeds,
// "×5·10", the current one inked — 10× is in sight at every speed, in the same corner and the same 44 px seal (the
// time cluster's box unchanged; N4-D6 kept: one fast seal, its mark showing the speed it runs at).

export type SpeedSeal = Readonly<{ id: "pause" | "normal" | "threefold" | "fast"; icon: "pause" | "play" | "fast" | "fastest" }>;

export const SPEED_SEALS: readonly SpeedSeal[] = [
  { id: "pause", icon: "pause" }, { id: "normal", icon: "play" }, { id: "threefold", icon: "fast" }, { id: "fast", icon: "fastest" },
];
const FIXED: Readonly<Record<Exclude<SpeedSeal["id"], "fast">, GameSpeed>> = { pause: 0, normal: 1, threefold: 3 };
const FAST_STEPS = [5, 10] as const;

/** The fast speed now (5x or 10x), or null when the game runs slower or stands. */
export function fastSpeedOf(speed: GameSpeed): 5 | 10 | null {
  return speed === 5 || speed === 10 ? speed : null;
}

/** The speed a press of the seal sets: the fast seal from pause, 1x or 3x goes to 5x, and switches 5x ↔ 10x. */
export function sealPress(seal: SpeedSeal, speed: GameSpeed): GameSpeed {
  if (seal.id !== "fast") return FIXED[seal.id];
  return speed === 5 ? 10 : 5;
}

/** One of the fast seal's two speeds in its mark: its words ("×5", then "10") and whether the game runs at it. */
export type SealStep = Readonly<{ speed: 5 | 10; text: string; on: boolean }>;

/** What the seal shows and says now: its name (the fast seal: the current fast speed and what a press does), pressed, and
 *  (the fast seal) its mark's two speeds. */
export function sealView(seal: SpeedSeal, speed: GameSpeed): Readonly<{ label: string; pressed: boolean; steps: readonly SealStep[] | null }> {
  if (seal.id !== "fast") return { label: KO_UI.speeds[seal.id === "pause" ? "paused" : seal.id], pressed: speed === FIXED[seal.id], steps: null };
  const fast = fastSpeedOf(speed);
  return { label: KO_UI.speeds.fastLabel(fast), pressed: fast !== null,
    steps: FAST_STEPS.map((step, index) => ({ speed: step, text: KO_UI.speeds.fastStep(step, index === 0), on: fast === step })) };
}
