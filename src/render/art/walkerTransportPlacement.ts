import type { ArtPoint, ArtRect, WalkerTransportEntry } from './artContract';

export type CartPayloadPlacement = { readonly x: number; readonly y: number; readonly width: number };
export type TransportPlacement = {
  readonly sourceRect: ArtRect; readonly targetRect: ArtRect; readonly payload: CartPayloadPlacement;
};

/** Gait is supplied by the existing walker, not an independent animation clock. */
export function walkerTransportPlacement(entry: WalkerTransportEntry, foot: ArtPoint,
  gaitFrame: 0 | 1, figureHeight: number): TransportPlacement {
  const frame = entry.frames.find(frame => frame.gaitFrame === gaitFrame);
  if (frame === undefined) throw new RangeError('Transport gait frame missing from validated entry');
  if (!(figureHeight > 0) || !Number.isFinite(figureHeight)) throw new RangeError('Positive finite actor height required');
  const relativeScale = figureHeight / entry.referenceFigureHeight;
  const factor = entry.scale * relativeScale;
  const x = foot.x + entry.mountOffset.x * relativeScale - frame.pivot.x * factor;
  const y = foot.y + entry.mountOffset.y * relativeScale - frame.pivot.y * factor;
  return { sourceRect: frame.sourceRect,
    targetRect: { x, y, width: frame.sourceRect.width * factor, height: frame.sourceRect.height * factor },
    payload: { x: x + entry.payloadAnchor.x * factor, y: y + entry.payloadAnchor.y * factor, width: entry.payloadWidth * factor },
  };
}
