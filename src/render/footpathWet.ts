import { SEMANTIC_PALETTE } from '../content/palette';
import type { GameState } from '../engine/engine.types';
import { ART_REGISTRY, selectLandArt } from './art/wave42Registry';
import type { FootpathPiece } from './footpathModel';
import type { StageSeason } from './landStageModel';
import { modeledWetness } from './natureWetGround';
import { presentationPreference } from './presentationPreferences';
import { stageArt, stageArtReady } from './wave42StageArt';
import { createTintCanvas, drawCroppedWorldSprite } from './worldSprite';

const LEVELS = 6;
const STRIP_WIDTH = 512;
const STRIP_HEIGHT = 64;
const KEYS = ART_REGISTRY.entries('land-stage')
  .filter(entry => entry.kind === 'land-stage' && entry.family === 'wet-path').map(entry => entry.id);
let ready = false;
let scratch: OffscreenCanvas | HTMLCanvasElement | null = null;
type RunLine = { readonly axis: 'ne' | 'nw'; readonly line: number };

/** Quantized presentation only: shares Wave39's weather curve, never persistent wear or measured soil moisture. */
export function wetPathStage(amount: number, enabled: boolean, artReady: boolean, season: StageSeason): number {
  return enabled && artReady && season === 'summer' ? Math.floor(Math.max(0, Math.min(1, amount)) * LEVELS) : 0;
}

export function wetPathCondition(state: GameState): { readonly stage: number; readonly token: string } {
  const enabled = presentationPreference('weatherFx');
  if (enabled && !ready) ready = stageArtReady(KEYS);
  const stage = wetPathStage(modeledWetness(state), enabled, ready, 'summer');
  return { stage, token: `:wet${Number(enabled)}${Number(ready)}.${stage}` };
}

/** Includes strip-only corners/crossings as well as authored connectors; straight runs and ends retain their shape. */
export function wetPathJoinCentres(run: RunLine, pieces: readonly FootpathPiece[]): readonly number[] {
  return pieces.filter(piece => (run.axis === 'ne' ? piece.tx : piece.ty) === run.line
    && piece.rule.shape !== 'straight_ne' && piece.rule.shape !== 'straight_nw'
    && piece.rule.shape !== 'end' && piece.rule.shape !== 'dot')
    .map(piece => (run.axis === 'ne' ? -piece.ty : piece.tx) * 128 + 64);
}

/** Keep the full join cell clear (64 UV either side), then smoothstep to muddy across the adjacent half-cell. */
export function wetPathJoinFade(u: number, centres: readonly number[]): number {
  let amount = 1;
  for (const centre of centres) {
    const t = Math.max(0, Math.min(1, (Math.abs(u - centre) - 64) / 64));
    amount = Math.min(amount, t * t * (3 - 2 * t));
  }
  return amount;
}

/** Composite at native UV size and world phase before the existing strip transform and end fade. */
export function drawWetPathOverlay(paint: CanvasRenderingContext2D, run: RunLine, from: number, to: number,
  pieces: readonly FootpathPiece[], stage: number, season: StageSeason): void {
  if (stage === 0 || season !== 'summer') return;
  const image = stageArt(selectLandArt('wet-path-strip', { family: 'wet-path', stage: run.axis, season }).id);
  if (image === null) return;
  const length = to - from;
  if (scratch === null || scratch.width < length) scratch = createTintCanvas(Math.max(length, 2 * STRIP_WIDTH), STRIP_HEIGHT);
  const overlay = scratch?.getContext('2d');
  if (scratch === null || overlay === null || overlay === undefined) return;
  overlay.clearRect(0, 0, scratch.width, STRIP_HEIGHT);
  for (let start = Math.floor(from / STRIP_WIDTH) * STRIP_WIDTH; start < to; start += STRIP_WIDTH) {
    drawCroppedWorldSprite(overlay, image, { x: 0, y: 0, width: STRIP_WIDTH, height: STRIP_HEIGHT },
      { x: start - from, y: 0, width: STRIP_WIDTH, height: STRIP_HEIGHT }, false, false);
  }
  const centres = wetPathJoinCentres(run, pieces);
  overlay.save();
  overlay.globalCompositeOperation = 'destination-out';
  overlay.fillStyle = SEMANTIC_PALETTE.ink;
  for (let x = 0; x < length; x += 1) {
    const fade = wetPathJoinFade(from + x + 0.5, centres);
    if (fade === 1) continue;
    overlay.globalAlpha = 1 - fade;
    overlay.fillRect(x, 0, 1, STRIP_HEIGHT);
  }
  overlay.restore();
  paint.save();
  paint.globalAlpha = stage / LEVELS;
  drawCroppedWorldSprite(paint, scratch, { x: 0, y: 0, width: length, height: STRIP_HEIGHT },
    { x: 0, y: 0, width: length, height: STRIP_HEIGHT }, false, false);
  paint.restore();
}
