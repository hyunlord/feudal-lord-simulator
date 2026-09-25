import type { HurdlePiece } from "../world/boundary/yardProps";

/** The zone asset each yard hurdle piece draws (Wave 4b straight and north corner; Wave 4c gate, half, E / S / W corners). */
export type HurdleAssetKey = "hurdle_straight" | "hurdle_gate" | "hurdle_half" | "hurdle_end_corner" | "hurdle_corner_e" | "hurdle_corner_s" | "hurdle_corner_w";

export function hurdleAssetKey(piece: Pick<HurdlePiece, "kind" | "vertex">): HurdleAssetKey {
  if (piece.kind === "corner") {
    return piece.vertex === "east" ? "hurdle_corner_e" : piece.vertex === "south" ? "hurdle_corner_s" : piece.vertex === "west" ? "hurdle_corner_w" : "hurdle_end_corner";
  }
  return piece.kind === "gate" ? "hurdle_gate" : piece.kind === "half" ? "hurdle_half" : "hurdle_straight";
}
