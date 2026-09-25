import { constructionSiteFootprint, type ConstructionSite } from "../economy/construction";
import { tileToScreen } from "./iso";

/**
 * Construction stall labels (UX1): each label sits above its own site, centred on the footprint, with a leader
 * line down to the footprint centre (the site's art, drawn after the label, covers its lower end), so a label never
 * reads as belonging to a neighbouring building. Labels that would overlap step up one row each (greedy, in site
 * order), up to MAX_STAGGER_ROWS; past that the top row is shared.
 */
export type ConstructionLabelBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly textX: number;
  readonly textY: number;
  /** Leader line from the box's bottom centre down to the footprint centre on the ground. */
  readonly leaderX: number;
  readonly leaderTopY: number;
  readonly leaderBottomY: number;
};

export type ConstructionLabelEntry = {
  readonly site: ConstructionSite;
  readonly label: string;
};

const MAX_STAGGER_ROWS = 3;
/** Roof-stage art top above the footprint centre per tile of (width + height) (constructionArtLayers registration). */
const ART_RISE_PER_TILE = 13;

/**
 * Screen-constant sizes: the label is drawn in world space, so every length is divided by the zoom, clamped at 0.5
 * like the 12 px label font in drawConstructionSites.
 */
function labelScale(zoom: number): number {
  return 1 / Math.max(zoom, 0.5);
}

/** Footprint centre on the ground, and the top of the site's tallest (roof-stage) art straight above it. */
export function constructionSiteLabelAnchor(site: ConstructionSite): { readonly x: number; readonly topY: number; readonly groundY: number } {
  const footprint = constructionSiteFootprint(site);
  const center = tileToScreen(footprint.tx + (footprint.width - 1) / 2, footprint.ty + (footprint.height - 1) / 2);
  return { x: center.sx, topY: center.sy - (footprint.width + footprint.height) * ART_RISE_PER_TILE, groundY: center.sy };
}

/** Boxes for every labelled site, keyed by site id; `measure` returns the text width at the label font. */
export function constructionSiteLabelBoxes(
  entries: readonly ConstructionLabelEntry[],
  zoom: number,
  measure: (label: string) => number,
): ReadonlyMap<string, ConstructionLabelBox> {
  const scale = labelScale(zoom);
  const height = 18 * scale;
  const padding = 4 * scale;
  const gap = 12 * scale;
  const rowStep = height + 2 * scale;
  const placed: ConstructionLabelBox[] = [];
  const boxes = new Map<string, ConstructionLabelBox>();
  for (const entry of entries) {
    if (entry.label === "") continue;
    const anchor = constructionSiteLabelAnchor(entry.site);
    const width = Math.ceil(measure(entry.label)) + padding * 2;
    const boxAt = (row: number): ConstructionLabelBox => {
      const y = anchor.topY - gap - height - row * rowStep;
      return {
        x: anchor.x - width / 2, y, width, height,
        textX: anchor.x - width / 2 + padding, textY: y + 13 * scale,
        leaderX: anchor.x, leaderTopY: y + height, leaderBottomY: anchor.groundY,
      };
    };
    let row = 0;
    while (row < MAX_STAGGER_ROWS && placed.some(other => overlaps(boxAt(row), other))) row += 1;
    const box = boxAt(row);
    placed.push(box);
    boxes.set(entry.site.id, box);
  }
  return boxes;
}

function overlaps(a: ConstructionLabelBox, b: ConstructionLabelBox): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
