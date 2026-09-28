// INSTALL-3b: proof hooks for the HUD area measure's canvas share (scripts/measureHudCoverage.ts, chapter 2 wall works).
// The construction tags (wall works, building plaques) are drawn on the canvas, so the measure hides them for its
// hidden shot and counts only pixels inside their boxes. Nothing is recorded until the proof port first asks.

let constructionLabelsShown = true;
/** Proof hook (INSTALL-3b area budget): hide the construction tags (wall works and building plaques) for one shot. */
export function setConstructionLabelsForProof(shown: boolean): void { constructionLabelsShown = shown; }
export function constructionLabelsVisible(): boolean { return constructionLabelsShown; }
type TagBox = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
let tagBoxes: TagBox[] | null = null;
let lastTagBoxes: readonly TagBox[] = [];
/** Proof hook (INSTALL-3b area budget): from the first call, each frame's tag boxes in canvas pixels; the last frame's. */
export function constructionTagBoxesForProof(): readonly TagBox[] { if (tagBoxes === null) tagBoxes = []; return lastTagBoxes; }
/** A frame starts: the boxes of the frame before are the last frame's (only while the proof records). */
export function beginConstructionTagFrame(): void { if (tagBoxes !== null) { lastTagBoxes = tagBoxes; tagBoxes = []; } }
/** A tag's box (world or canvas coordinates under the context's transform), kept while the proof records. */
export function noteConstructionTag(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  if (tagBoxes === null) return;
  const m = context.getTransform();
  tagBoxes.push({ x: m.a * x + m.e, y: m.d * y + m.f, w: m.a * width, h: m.d * height });
}
