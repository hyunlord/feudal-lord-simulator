import type { CSSProperties } from "react";
import type { AcceptanceTier } from "../../../engine/diplomacy.types";
import type { UI_PART_ART } from "../uiPartArt";

// LM-R2 (negotiation area): Astra's Wave 35 negotiation parts (B_negotiation, docs/ops/install-plan-20261003/SPECS/
// wave35-negotiation.md) as the `lord-negotiation` bundle of renderer B's art contract (scripts/installLmr2Negotiation.py).
// Each part is chosen by the engine's state, never by a hover: the treaty and its rows by the phase and `counter.changes`,
// the scale by the acceptance tier, the seal by the contract's state. A part that has not loaded (or failed) is null and
// the screen keeps the kit's frame and its written words — every tier, mark and seal state is also text.

export const NEGOTIATION_ART = {
  treaty: "lord.negotiation.treaty_frame",
  divider: "lord.negotiation.treaty_divider",
  scale: "lord.negotiation.acceptance_scale",
  rows: { same: "lord.negotiation.clause_row", changed: "lord.negotiation.clause_row_changed", rejected: "lord.negotiation.clause_row_rejected" },
  chips: { plus: "lord.negotiation.reason_chip_plus", minus: "lord.negotiation.reason_chip_minus" },
  seals: { empty: "lord.negotiation.seal_empty", stamped: "lord.negotiation.seal_stamped", broken: "lord.negotiation.seal_broken" },
} as const;
export const NEGOTIATION_ART_IDS: readonly string[] = [NEGOTIATION_ART.treaty, NEGOTIATION_ART.divider, NEGOTIATION_ART.scale,
  ...Object.values(NEGOTIATION_ART.rows), ...Object.values(NEGOTIATION_ART.chips), ...Object.values(NEGOTIATION_ART.seals)];

/** The CSS widths each picture is declared at in the bundle (the divider's 16 px is the records' fixed width). */
export const DIVIDER_WIDTH = 16;
export const SEAL_WIDTH = 48;
/** The scale strip (640 × 128: five 128 px cells, records/README.md) at half size: one 64 px cell shown. */
export const SCALE_STRIP_WIDTH = 320;
const SCALE_CELLS = 5;

/**
 * The scale's cell for a tier (records/marks.json cell order: left_deep, left_slight, level, right_slight, right_deep).
 * The left pan is the lord's side of the treaty ("우리가 주는 것"): the more the offer weighs with the counterpart, the
 * lower it hangs. A picture of the engine's tier — no chance is read from it.
 */
export const SCALE_CELL: Readonly<Record<AcceptanceTier, number>> = { almost_certain: 0, likely: 1, close: 2, unlikely: 3, impossible: 4 };

type Parts = typeof UI_PART_ART;

/** The scale's one cell for this tier (null: not loaded — the tier's word stays). */
export function scaleStyle(parts: Parts, tier: AcceptanceTier): CSSProperties | null {
  const strip = parts.image(NEGOTIATION_ART.scale, SCALE_STRIP_WIDTH);
  if (strip === null) return null;
  const cell = SCALE_STRIP_WIDTH / SCALE_CELLS;
  return { ...strip, width: cell, height: cell, backgroundSize: `${SCALE_CELLS * 100}% 100%`, backgroundPosition: `${SCALE_CELL[tier] * 25}% 0` };
}
