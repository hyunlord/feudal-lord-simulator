import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import { isWallConstructionSite, type WallConstructionSite } from "../economy/construction";
import { palisadeConstructionSchedule } from "../economy/palisadeConstruction";
import type { GameState } from "../engine/engine.types";
import { resourceName } from "../content/resourceCatalog.ko";
import type { ResourceType } from "../content/resourceConfig";
import { currentConstructionSiteLabel } from "../ui/constructionAccessModel";
import { WALL_SITE_LABEL_COPY } from "../ui/wallCarryCopy.ko";
import type { CameraState } from "./camera";
import { tileToScreen } from "./iso";
import { applyInkOutline, snapToPixel } from "./style";
import { constructionLabelsVisible, noteConstructionTag } from "./constructionTagProbe";

// INSTALL-3b ①: a wall under construction is one works with one tag (minimal HUD). Every segment used to raise its own
// ("벽을 따라 운반 · 도로 연결 구간에서 N칸", "성벽 N번째 대기"), dozens over a chapter 2 town. Now each works (the
// segments of one wall and material) shows one tag at its segment nearest the gate among those on screen; the
// segments' own tags come back with the works selected or from zoom 1.35. Drawn after the object pass (a tag is HUD,
// not a thing in the depth order). UI-AUDIT-1: the works tag names the gate segment's material, not its cause sentence.

/** From this zoom every segment on screen shows its own tag. */
export const WALL_SEGMENT_LABEL_MIN_ZOOM = 1.35;

type Point = { readonly x: number; readonly y: number };
export type WallSiteLabel = { readonly siteId: string; readonly text: string; readonly anchor: Point };

/** The world point a segment's tag hangs from: the middle of its path. */
export function wallSiteLabelAnchor(site: Pick<WallConstructionSite, "path">): Point {
  const first = site.path[0];
  const last = site.path[site.path.length - 1];
  if (first === undefined || last === undefined) return { x: 0, y: 0 };
  const screen = tileToScreen((first.x + last.x) / 2, (first.y + last.y) / 2);
  return { x: screen.sx, y: screen.sy };
}

/** UI-AUDIT-1: the works tag's detail — a segment's first material, delivered of required ("목재 0/60"); null: none. */
export function wallWorksMaterial(site: Pick<WallConstructionSite, "required" | "delivered">): string | null {
  const entry = (Object.entries(site.required) as [ResourceType, number | undefined][]).find(([, amount]) => (amount ?? 0) > 0);
  if (entry === undefined) return null;
  const [resource, required] = entry;
  return WALL_SITE_LABEL_COPY.material(resourceName(resource), Math.floor(site.delivered[resource] ?? 0), required ?? 0);
}

/**
 * The tags to draw. `labelOf` is a segment's own tag ("" = none); `visible` says whether a world point is on screen.
 * A works shows nothing when no segment has a tag.
 */
export function wallSiteLabelPlan(input: {
  readonly sites: readonly WallConstructionSite[];
  readonly labelOf: (site: WallConstructionSite) => string;
  readonly zoom: number;
  readonly selectedSiteId: string | null;
  readonly visible: (point: Point) => boolean;
  readonly centre: Point;
}): readonly WallSiteLabel[] {
  const works = new Map<string, WallConstructionSite[]>();
  for (const site of input.sites) {
    const key = `${site.kind}:${site.wallId}`;
    works.set(key, [...(works.get(key) ?? []), site]);
  }
  const labels: WallSiteLabel[] = [];
  for (const segments of works.values()) {
    const tagged = segments.map(site => ({ site, text: input.labelOf(site), anchor: wallSiteLabelAnchor(site) }));
    const onScreen = tagged.filter(entry => input.visible(entry.anchor));
    if (input.zoom >= WALL_SEGMENT_LABEL_MIN_ZOOM || segments.some(site => site.id === input.selectedSiteId)) {
      labels.push(...onScreen.filter(entry => entry.text !== "").map(entry => ({ siteId: entry.site.id, text: entry.text, anchor: entry.anchor })));
      continue;
    }
    const byGate = (left: typeof tagged[number], right: typeof tagged[number]) => left.site.gateDistance - right.site.gateDistance
      || Math.hypot(left.anchor.x - input.centre.x, left.anchor.y - input.centre.y) - Math.hypot(right.anchor.x - input.centre.x, right.anchor.y - input.centre.y)
      || left.site.id.localeCompare(right.site.id);
    const cause = tagged.filter(entry => entry.text !== "").sort(byGate)[0];
    const leader = [...onScreen].sort(byGate)[0];
    if (cause === undefined || leader === undefined) continue;
    // The folded tag is one short line: the count and the gate segment's material (its cause when it needs none).
    labels.push({ siteId: leader.site.id, text: WALL_SITE_LABEL_COPY.works(segments.length, wallWorksMaterial(cause.site) ?? cause.text), anchor: leader.anchor });
  }
  return labels;
}

/** A segment's own tag: its queue place, or its live cause (constructionAccessModel). */
function segmentLabel(state: GameState, site: WallConstructionSite): string {
  const schedule = palisadeConstructionSchedule(site, state.constructionSites);
  return schedule.kind === "queued" ? WALL_SITE_LABEL_COPY.queued(schedule.position) : currentConstructionSiteLabel(state, site);
}

/** Draws the wall works' tags; the context carries the camera's pan and zoom (world coordinates). */
export function drawWallSiteLabels(context: CanvasRenderingContext2D, input: {
  readonly state: GameState;
  readonly camera: CameraState;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly selectedSiteId: string | null;
}): void {
  if (!constructionLabelsVisible()) return;
  const sites = input.state.constructionSites.filter(isWallConstructionSite);
  if (sites.length === 0) return;
  const { zoom, panX, panY } = input.camera;
  const plan = wallSiteLabelPlan({
    sites,
    labelOf: site => segmentLabel(input.state, site),
    zoom,
    selectedSiteId: input.selectedSiteId,
    visible: point => {
      const x = point.x * zoom + panX;
      const y = point.y * zoom + panY;
      return x >= 0 && x <= input.viewport.width && y >= 0 && y <= input.viewport.height;
    },
    centre: { x: (input.viewport.width / 2 - panX) / zoom, y: (input.viewport.height / 2 - panY) / zoom },
  });
  for (const label of plan) drawTag(context, label, zoom);
}

function drawTag(context: CanvasRenderingContext2D, label: WallSiteLabel, zoom: number): void {
  const x = snapToPixel(label.anchor.x - 22);
  const y = snapToPixel(label.anchor.y - 64);
  context.font = `${Math.round(12 / Math.max(zoom, 0.5))}px Georgia, serif`;
  const width = Math.ceil(context.measureText(label.text).width);
  context.fillStyle = SEMANTIC_PALETTE.vellum;
  context.fillRect(x - 4, y - 13, width + 8, 18);
  applyInkOutline(context, zoom);
  context.strokeRect(x - 4, y - 13, width + 8, 18);
  noteConstructionTag(context, x - 4, y - 13, width + 8, 18);
  context.fillStyle = PALETTE.ink;
  context.fillText(label.text, x, y);
}
