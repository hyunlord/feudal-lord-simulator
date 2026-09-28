import { drawKitCornerTowers } from "./constructionKits";
import { isStoneWallConstructionSite } from "../economy/constructionSiteAccessors";
import {
  constructionStage,
  type WallConstructionSite,
} from "../economy/construction";
import type { PalisadeConstructionSchedule } from "../economy/palisadeConstruction";
import {
  drawPalisadeRun,
  type PalisadeRunStyle,
} from "./drawPalisadeSegments";

// INSTALL-3b ①: the segments' tags are drawn per works after the object pass (wallSiteLabels.ts), not here.
type DrawPalisadeConstructionSiteInput = {
  readonly site: WallConstructionSite;
  readonly schedule: PalisadeConstructionSchedule;
  readonly zoom: number;
};

export function drawPalisadeConstructionSite(
  context: CanvasRenderingContext2D,
  input: DrawPalisadeConstructionSiteInput,
): void {
  if (input.schedule.kind === "queued") {
    drawPalisadeRun(context, {
      path: input.site.path,
      style: "queued",
      zoom: input.zoom,
    });
    return;
  }
  drawPalisadeRun(context, {
    path: input.site.path,
    style: palisadeRunStyle(input.site),
    zoom: input.zoom,
  });
  // INSTALL-11 defense kit: a stone wall site raises its corner towers stage by stage.
  if (isStoneWallConstructionSite(input.site)) drawKitCornerTowers(context, input.site.path, ["marked_plot", "foundation", "frame", "roof"].indexOf(constructionStage(input.site)));
}

function palisadeRunStyle(site: WallConstructionSite): PalisadeRunStyle {
  const stage = constructionStage(site);
  switch (stage) {
    case "marked_plot":
      return "plot";
    case "foundation":
      return "foundation";
    case "frame":
      return "frame";
    case "roof":
      return "roof";
    default:
      return assertNever(stage);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled palisade construction stage: ${JSON.stringify(value)}`);
}
