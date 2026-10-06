export type RandomState = { rng: number };
export function random(state: RandomState): number {
 state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
 return state.rng / 4294967296;
}
