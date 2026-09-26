import type { CanvasMutableRefs } from './canvasRuntimeRefs';

export function cancelRoadPreview(refs: Pick<CanvasMutableRefs, 'dragRef' | 'suppressClick' | 'roadCancelled'> & Partial<Pick<CanvasMutableRefs, 'roadChain'>>): boolean {
  // UX-3R2: a click-click chain is dropped first (the right click or Esc that ends it does nothing else).
  if (refs.roadChain !== undefined && refs.roadChain.current !== null && refs.dragRef.current.mode !== 'road') { refs.roadChain.current = null; return true; }
  if (refs.dragRef.current.mode !== 'road') return false;
  refs.dragRef.current = { mode: 'none', roadStart: null, startCamera: null,
    startCanvasPoint: null, lastCanvasPoint: null, moved: true };
  refs.roadCancelled.current = true;
  refs.suppressClick.current = true;
  return true;
}
