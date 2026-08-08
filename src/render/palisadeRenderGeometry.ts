import type { WallConstructionSite } from "../economy/construction";
import type { PalisadeSegment } from "../engine/engine.types";
import type { TileEdgePoint } from "../world/palisadeGeometry";
import { depthKey, tileToScreen } from "./iso";
import type { TileRange } from "./renderVisibility";

export type PalisadeRenderPath = readonly TileEdgePoint[];

export type PalisadeRenderBounds = {
  readonly minTx: number;
  readonly minTy: number;
  readonly maxTx: number;
  readonly maxTy: number;
};

export type PalisadeRenderAnchor = {
  readonly depth: number;
  readonly anchorTx: number;
};

export function palisadeSitePath(site: WallConstructionSite): PalisadeRenderPath {
  return site.path;
}

export function palisadeSegmentPath(segment: PalisadeSegment): PalisadeRenderPath {
  return segment.edgePath;
}

export function palisadeRenderBounds(path: PalisadeRenderPath): PalisadeRenderBounds {
  const xs = path.map((point) => point.x);
  const ys = path.map((point) => point.y);
  return {
    minTx: Math.min(...xs),
    minTy: Math.min(...ys),
    maxTx: Math.max(...xs),
    maxTy: Math.max(...ys),
  };
}

export function palisadePathVisible(path: PalisadeRenderPath, range: TileRange): boolean {
  const bounds = palisadeRenderBounds(path);
  return (
    bounds.maxTx >= range.minTx &&
    bounds.minTx <= range.maxTx + 1 &&
    bounds.maxTy >= range.minTy &&
    bounds.minTy <= range.maxTy + 1
  );
}

export function palisadeRenderAnchor(path: PalisadeRenderPath): PalisadeRenderAnchor {
  return path.reduce(
    (best, point) => {
      const depth = depthKey(point.x, point.y);
      if (depth > best.depth) return { depth, anchorTx: point.x };
      if (depth === best.depth && point.x > best.anchorTx) return { depth, anchorTx: point.x };
      return best;
    },
    { depth: Number.NEGATIVE_INFINITY, anchorTx: Number.NEGATIVE_INFINITY },
  );
}

export function palisadeScreenPath(path: PalisadeRenderPath): readonly { readonly x: number; readonly y: number }[] {
  return path.map((point) => {
    const screen = tileToScreen(point.x, point.y);
    return { x: screen.sx, y: screen.sy - 16 };
  });
}
