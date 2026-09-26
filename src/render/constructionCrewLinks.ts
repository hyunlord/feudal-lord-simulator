import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import type { Walker } from "../agents/walker.types";
import type { GameState } from "../engine/engine.types";
import { constructionSiteLabelAnchor } from "./constructionSiteLabelLayout";
import { applyPaletteStroke } from "./style";
import { walkerVisualAnchor } from "./walkerAnchor";

// F0-V (visibility design 2절 "공사장↔배정 워커"): with a building site selected, a ring at the feet of each builder
// assigned to it (solid line to the site) and of each carter bringing it material (dashed line), so the player sees
// who works on it and what is on the way.
export function drawConstructionCrewLinks(context: CanvasRenderingContext2D, state: GameState, siteId: string,
  walkers: readonly Walker[], zoom: number): void {
  const site = state.constructionSites.find(candidate => candidate.id === siteId);
  if (site === undefined) return;
  const anchor = constructionSiteLabelAnchor(site);
  const crew = walkers.flatMap((walker): { readonly walker: Walker; readonly dashed: boolean }[] => {
    if (walker.kind === "builder" && "siteId" in walker && walker.siteId === siteId && !("resident" in walker)) return [{ walker, dashed: false }];
    if (walker.kind === "carter" && walker.reservation?.destination.kind === "construction_site" && walker.reservation.destination.siteId === siteId) return [{ walker, dashed: true }];
    return [];
  });
  if (crew.length === 0) return;
  context.save();
  for (const { walker, dashed } of crew) {
    const foot = walkerVisualAnchor(walker.position);
    applyPaletteStroke(context, dashed ? SEMANTIC_PALETTE.earthDark : PALETTE.gold, 1.5 / Math.max(zoom, 0.5));
    context.setLineDash(dashed ? [5 / zoom, 4 / zoom] : []);
    context.beginPath();
    context.moveTo(anchor.x, anchor.groundY);
    context.lineTo(foot.sx, foot.sy);
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.ellipse(foot.sx, foot.sy, 7, 3.5, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}
