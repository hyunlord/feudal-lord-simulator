import { storyWalkerScale } from './storyWorldProps';

export type FuneralDirection = 'NE' | 'SE' | 'SW' | 'NW';
type Point = readonly [number, number];
const HANDS = {
  NE: [[[34, 36], [59, 35]], [[33, 35], [60, 34]]],
  SE: [[[25, 38], [48, 34]], [[25, 36], [50, 34]]],
  SW: [[[25, 35], [48, 37]], [[23, 35], [49, 36]]],
  NW: [[[15, 37], [41, 36]], [[14, 35], [41, 35]]],
} as const;
const TIPS = {
  prop_bier_shroud_ne: [[10, 25], [16, 28], [46, 3], [52, 7]],
  prop_bier_shroud_nw: [[11, 7], [16, 3], [45, 28], [51, 24]],
} as const;
export const FUNERAL_BIER_SCALE = .65;

// Four decorative positions, not engine people/death counts. Endpoints carry ±2 source px uncertainty.
export function funeralRegistration(direction: FuneralDirection, gait: number) {
  const bierKey: keyof typeof TIPS = direction === 'NE' || direction === 'SW' ? 'prop_bier_shroud_ne' : 'prop_bier_shroud_nw';
  const hands = HANDS[direction][Math.abs(Math.floor(gait)) % 2 === 0 ? 0 : 1];
  const scale = storyWalkerScale('wk_funeral_bearers');
  const positions = TIPS[bierKey].map((tip, index) => {
    const hand: Point = hands[index % 2 === 0 ? 1 : 0];
    const sibling = TIPS[bierKey][index % 2 === 0 ? index + 1 : index - 1];
    return { hand, tip, behind: sibling !== undefined && tip[1] < sibling[1],
      x: FUNERAL_BIER_SCALE * (tip[0] - 32) - scale * (hand[0] - 37),
      y: FUNERAL_BIER_SCALE * (tip[1] - 16) - scale * (hand[1] - 70) };
  });
  const mean = positions.reduce((sum, p) => ({ x: sum.x + p.x / 4, y: sum.y + p.y / 4 }), { x: 0, y: 0 });
  return { bierKey, bier: { x: -mean.x, y: -mean.y },
    bearers: positions.map(p => ({ ...p, x: p.x - mean.x, y: p.y - mean.y })).sort((a, b) => a.y - b.y) };
}
