import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import {
  constructionOnSiteLabel,
  constructionStage,
  type PalisadeConstructionSite,
} from "../economy/construction";
import type { PalisadeConstructionSchedule } from "../economy/palisadeConstruction";
import {
  drawPalisadeRun,
  type PalisadeRunStyle,
} from "./drawPalisadeSegments";
import { tileToScreen } from "./iso";
import { applyInkOutline, snapToPixel } from "./style";

type Point = {
  readonly x: number;
  readonly y: number;
};

type DrawPalisadeConstructionSiteInput = {
  readonly site: PalisadeConstructionSite;
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
    drawLabel(context, {
      text: `성벽 ${input.schedule.position}번째 대기`,
      anchor: pathLabelAnchor(input.site.path),
      zoom: input.zoom,
    });
    return;
  }
  const label = constructionOnSiteLabel(input.site);
  if (label !== "") {
    drawLabel(context, {
      text: label,
      anchor: pathLabelAnchor(input.site.path),
      zoom: input.zoom,
    });
  }
  drawPalisadeRun(context, {
    path: input.site.path,
    style: palisadeRunStyle(input.site),
    zoom: input.zoom,
  });
}

function palisadeRunStyle(site: PalisadeConstructionSite): PalisadeRunStyle {
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

function drawLabel(
  context: CanvasRenderingContext2D,
  input: {
    readonly text: string;
    readonly anchor: Point;
    readonly zoom: number;
  },
): void {
  const x = snapToPixel(input.anchor.x - 22);
  const y = snapToPixel(input.anchor.y - 64);
  context.font = `${Math.round(12 / Math.max(input.zoom, 0.5))}px Georgia, serif`;
  const width = Math.ceil(context.measureText(input.text).width);
  context.fillStyle = SEMANTIC_PALETTE.vellum;
  context.fillRect(x - 4, y - 13, width + 8, 18);
  applyInkOutline(context, input.zoom);
  context.strokeRect(x - 4, y - 13, width + 8, 18);
  context.fillStyle = PALETTE.ink;
  context.fillText(input.text, x, y);
}

function pathLabelAnchor(path: readonly { readonly x: number; readonly y: number }[]): Point {
  const first = path[0];
  const last = path[path.length - 1];
  if (first === undefined || last === undefined) return { x: 0, y: 0 };
  const screen = tileToScreen((first.x + last.x) / 2, (first.y + last.y) / 2);
  return { x: screen.sx, y: screen.sy };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled palisade construction stage: ${JSON.stringify(value)}`);
}
