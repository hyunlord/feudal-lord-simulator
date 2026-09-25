import type { TileCoordinate } from "../../world/grid";

// UX-1: the current tutorial step's map target, handed from the App shell to the renderer's guidance pass (a halo on
// the suggested spot). Display only; one value, replaced when the step or its suggestion changes.

export type TutorialMapTarget = { readonly tiles: readonly TileCoordinate[]; readonly focus: TileCoordinate; readonly label: string };

let current: TutorialMapTarget | null = null;
let tutorialActive = false;

export function setTutorialMapTarget(target: TutorialMapTarget | null): void { current = target; }
export function tutorialMapTarget(): TutorialMapTarget | null { return current; }
/** Whether a tutorial runs (the old per-task map guidance then stays off). */
export function setTutorialGuidanceActive(active: boolean): void { tutorialActive = active; }
export function tutorialGuidanceActive(): boolean { return tutorialActive; }

/** Canvas CSS point of the target's focus tile in the last frame (the App makes the goal rail see-through over it). */
let canvasPoint: { readonly x: number; readonly y: number } | null = null;
export function setTutorialTargetCanvasPoint(point: { readonly x: number; readonly y: number } | null): void { canvasPoint = point; }
export function tutorialTargetCanvasPoint(): { readonly x: number; readonly y: number } | null { return canvasPoint; }
