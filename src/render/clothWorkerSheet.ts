import type { Walker } from "../agents/walker.types";
import type { GameState } from "../engine/engine.types";

// UI-9: the cloth chain's workers (Wave 3 reskins, band "cloth"): which sheet a walker wears.
// Mirrors aleWorldArt.ts `aleWorkerSheet` for the ale chain.
// The shepherd, fuller and wool merchant sheets are registered in walkerSheetManifest.generated.ts
// (scripts/buildWalkerSheetManifest.py INSTALL-3 cloth band).
//
// Building-kind rule (carters only, no resident occupations yet — the engine's cloth buildings assign
// worker counts, not named trades; backyardConfig.ts INSTALL-27 note):
//   pastoral_farm  → wk_shepherd  (the farm's carter takes fleece to the stores)
//   fulling_mill   → wk_fuller    (the mill's carter moves cloth in / out)
//   dyehouse       → wk_wool_merchant (dyed cloth outward to market)
//   tenter_yard    → wk_wool_merchant (finished cloth outward to market)

/**
 * UI-9: the cloth chain's workers (Wave 3 reskins, band "cloth"): a carter from a pastoral_farm wears
 * wk_shepherd, one from a fulling_mill wears wk_fuller, one from a dyehouse or tenter_yard wears
 * wk_wool_merchant. Returns null for any other walker.
 */
export function clothWorkerSheet(
  state: Pick<GameState, "buildings">,
  walker: Walker,
): "wk_shepherd" | "wk_fuller" | "wk_wool_merchant" | null {
  if (walker.kind !== "carter") return null;
  const kind = state.buildings.find(b => b.id === walker.homeBuildingId)?.kind;
  if (kind === "pastoral_farm") return "wk_shepherd";
  if (kind === "fulling_mill") return "wk_fuller";
  if (kind === "dyehouse" || kind === "tenter_yard") return "wk_wool_merchant";
  return null;
}
