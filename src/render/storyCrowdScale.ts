import { WALKER_FIGURE_PX } from './walkerComposer';

/** Head/hood to visible foot or skirt hem in the unchanged crowd sprite; occluded soles carry ±2px uncertainty. */
export const PETITION_CROWD_FIGURES = [
  { id: 'back-centre', crown: { x: 70, y: 2 }, sole: { x: 68, y: 43 } },
  { id: 'back-left', crown: { x: 22, y: 9 }, sole: { x: 18, y: 52 } },
  { id: 'back-woman', crown: { x: 45, y: 13 }, sole: { x: 44, y: 54 } },
  { id: 'left-middle', crown: { x: 14, y: 39 }, sole: { x: 8, y: 83 } },
  { id: 'centre-middle', crown: { x: 80, y: 38 }, sole: { x: 80, y: 79 } },
  { id: 'left-centre', crown: { x: 53, y: 51 }, sole: { x: 54, y: 93 } },
  { id: 'middle-right', crown: { x: 111, y: 48 }, sole: { x: 111, y: 90 } },
  { id: 'right-centre', crown: { x: 146, y: 52 }, sole: { x: 147, y: 93 } },
  { id: 'far-right', crown: { x: 179, y: 51 }, sole: { x: 180, y: 96 } },
  { id: 'front-left', crown: { x: 27, y: 64 }, sole: { x: 26, y: 106 } },
  { id: 'front-left-centre', crown: { x: 72, y: 78 }, sole: { x: 70, y: 122 } },
  { id: 'front-centre', crown: { x: 97, y: 80 }, sole: { x: 95, y: 123 } },
  { id: 'front-right', crown: { x: 132, y: 79 }, sole: { x: 132, y: 125 } },
] as const;

const heights = PETITION_CROWD_FIGURES.map(({ crown, sole }) => sole.y - crown.y + 1).sort((a, b) => a - b);
const medianHeight = heights[Math.floor(heights.length / 2)]!;
export const petitionCrowdScale = (): number => WALKER_FIGURE_PX / medianHeight;
