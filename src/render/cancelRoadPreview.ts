import type { CanvasMutableRefs } from './canvasRuntimeRefs';

export function cancelRoadPreview(refs: Pick<CanvasMutableRefs, 'dragRef' | 'suppressClick' | 'roadCancelled'>): boolean {
  if (refs.dragRef.current.mode !== 'road') return false;
  refs.dragRef.current = { mode: 'none', roadStart: null, startCamera: null,
    startCanvasPoint: null, lastCanvasPoint: null, moved: true };
  refs.roadCancelled.current = true;
  refs.suppressClick.current = true;
  return true;
}
