import type { CountryStripPiece } from './countrysideLand';
import type { SeasonIndex } from './seasonArt';
import { tileToScreen } from './iso';
import { SPRING_WORLD_ART } from './art/springWorldArt';
import { drawCroppedWorldSprite } from './worldSprite';

type HedgeSource = { readonly width: number; readonly height: number; readonly groundY: number; readonly scale: number };
type HedgeSlice = {
  readonly source: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly m: readonly [number, number, number, number, number, number];
};

export function springHedgeSlices(piece: Pick<CountryStripPiece, 'axis' | 'tx' | 'ty' | 'offset' | 'step'>, source: HedgeSource): readonly HedgeSlice[] {
  const perEdge = 32 / source.scale;
  const slope = piece.axis === 'x' ? 0.5 : -0.5;
  const left = tileToScreen(piece.axis === 'x' ? piece.tx - 0.5 : piece.tx + 0.5, piece.ty + 0.5);
  const start = (piece.offset * source.width + piece.step * perEdge) % source.width;
  const slices: HedgeSlice[] = [];
  for (let from = start, done = 0; done < perEdge - 1e-6;) {
    const width = Math.min(perEdge - done, source.width - from);
    const u = done * source.scale;
    slices.push({ source: { x: from, y: 0, width, height: source.height },
      m: [source.scale, slope * source.scale, 0, source.scale, left.sx + u, left.sy + slope * u - source.groundY * source.scale] });
    done += width; from = 0;
  }
  return slices;
}

export function drawSpringHedge(context: CanvasRenderingContext2D, piece: CountryStripPiece, season: SeasonIndex, zoom: number): boolean {
  if (season !== 0 || (piece.family !== 'hedgerow_a' && piece.family !== 'hedgerow_b')) return false;
  const entry = SPRING_WORLD_ART.select('hawthorn', 0);
  if (entry === null || zoom < entry.minZoom) return false;
  const image = SPRING_WORLD_ART.image(entry.id);
  if (image === null) return false;
  const slices = springHedgeSlices(piece, { ...entry.image, groundY: entry.geometry.pivot.y, scale: entry.geometry.scale });
  for (const slice of slices) {
    context.save();
    try {
      context.globalAlpha *= entry.opacity;
      context.transform(...slice.m);
      drawCroppedWorldSprite(context, image, slice.source, { x: 0, y: 0, width: slice.source.width, height: slice.source.height }, false, true);
    } finally { context.restore(); }
  }
  return true;
}
