import type { HurdlePiece } from "../world/boundary/yardProps";

/**
 * The zone asset each yard hurdle piece draws (Wave 4b straight and north corner; Wave 4c gate, half, E / S / W corners;
 * Wave 4e quarter, three-quarter and the short gate).
 */
export type HurdleAssetKey = "hurdle_straight" | "hurdle_gate" | "hurdle_half" | "hurdle_end_corner" | "hurdle_corner_e" | "hurdle_corner_s" | "hurdle_corner_w"
  | "hurdle_quarter" | "hurdle_three_quarter" | "hurdle_gate_short";

export function hurdleAssetKey(piece: Pick<HurdlePiece, "kind" | "vertex">): HurdleAssetKey {
  if (piece.kind === "corner") {
    return piece.vertex === "east" ? "hurdle_corner_e" : piece.vertex === "south" ? "hurdle_corner_s" : piece.vertex === "west" ? "hurdle_corner_w" : "hurdle_end_corner";
  }
  switch (piece.kind) {
    case "gate": return "hurdle_gate";
    case "half": return "hurdle_half";
    case "quarter": return "hurdle_quarter";
    case "three_quarter": return "hurdle_three_quarter";
    case "short_gate": return "hurdle_gate_short";
    default: return "hurdle_straight";
  }
}
