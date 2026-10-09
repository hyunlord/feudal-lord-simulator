export const SOURCE_SCAN_WHY: string;
export const gitIn: (root: string) => (...args: string[]) => string;
export function pickTests(options: { root: string; base: string; head?: string }): { changed: Set<string>; picked: Map<string, string>; causes: Map<string, Set<string>>; total: number };
