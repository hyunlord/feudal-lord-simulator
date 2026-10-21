export const TRUNK_HASHES: string;
export function compareTrunkHashes(
  rows: readonly { readonly seed: number; readonly finalStateSha256: string | null; readonly tick: number | null }[],
  list: { readonly seeds: Readonly<Record<string, { readonly finalStateSha256: string; readonly tick: number; readonly since: string }>> },
): { readonly seed: number; readonly trunkHash: "same" | "different" | "not listed"; readonly line: string }[];
