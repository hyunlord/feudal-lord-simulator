export const TRUNK: string;
export const MAC_LIMIT: number;
export function trunkMergeBase(root: string): string | null;
export function pickTests(options: { root: string; base: string; head?: string }): { changed: Set<string>; picked: Map<string, string>; total: number };
export function testedTree(root: string): string;
