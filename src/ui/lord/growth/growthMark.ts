import type { GameState } from "../../../engine/engine.types";

/**
 * LS1-3 (lord-screen-v1.md): the status pill's growth mark — "정체 N년" after a stop of the town's growth that lasted past
 * two seasons. Its read is the engine's growthBlock (GB2A-7, with GROW-BLOCK-2a; its shape is the engine's report's): the
 * place is kept here — the pill's population cell and the hide order (the mode's tag hides first) — and nothing is shown
 * until that read is in and connected.
 */
export type GrowthMark = Readonly<{ years: number; text: string; label: string }>;

/** The mark for the state: none until the engine's growthBlock is connected. */
export function growthMarkOf(state: GameState): GrowthMark | null {
  void state;
  return null;
}
