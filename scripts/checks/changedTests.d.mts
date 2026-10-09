export const TRUNK: string;
export const MAC_LIMIT: number;
export const SOURCE_SCAN_WHY: string;
export function trunkMergeBase(root: string): string | null;
export function pickTests(options: { root: string; base: string; head?: string }): { changed: Set<string>; picked: Map<string, string>; causes: Map<string, Set<string>>; total: number };
export function testedTree(root: string): string;
