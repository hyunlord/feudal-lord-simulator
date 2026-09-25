// F0-V: the game speed as the presentation sees it (set by the app shell on every speed change). At 5x the completion
// sequence and other repeated motions shrink to their dust and sound (visibility design 2절 완공, 5절 "5배속").
let speed = 1;
export function setPresentationSpeed(value: number): void { speed = value; }
export function presentationSpeed(): number { return speed; }
export const FAST_PRESENTATION_SPEED = 5;
