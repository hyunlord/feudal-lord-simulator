// V1 gate 2: per pool, how the town's buildings split across variants, and how often two touching buildings of the
// same pool show the same variant. Usage: npx tsx scripts/variantDistribution.ts > docs/verification/v1-visual-variants/distribution.json
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { buildingVariantAssignments, touching } from "../src/render/buildingVariants";
import { seedGroundState } from "./boundaryFixtureStates";

export type PoolDistribution = { readonly pool: string; readonly count: number; readonly byVariant: Readonly<Record<string, number>>;
  readonly topShare: number; readonly adjacentPairs: number; readonly adjacentSame: number };

export function variantDistribution(state: GameState): { readonly pools: readonly PoolDistribution[]; readonly adjacentPairs: number;
  readonly adjacentSame: number; readonly adjacentSameShare: number } {
  const assignments = buildingVariantAssignments(state);
  const buildings = state.buildings.filter(building => assignments.has(building.id));
  const pools = new Map<string, { count: number; byVariant: Record<string, number>; pairs: number; same: number }>();
  for (const building of buildings) {
    const assignment = assignments.get(building.id);
    if (assignment === undefined) continue;
    const pool = pools.get(assignment.pool) ?? { count: 0, byVariant: {}, pairs: 0, same: 0 };
    pool.count += 1;
    pool.byVariant[assignment.variant.id] = (pool.byVariant[assignment.variant.id] ?? 0) + 1;
    pools.set(assignment.pool, pool);
  }
  buildings.forEach((a, index) => {
    for (const b of buildings.slice(index + 1)) {
      const pa = assignments.get(a.id); const pb = assignments.get(b.id);
      if (pa === undefined || pb === undefined || pa.pool !== pb.pool || !touching(a, b)) continue;
      const pool = pools.get(pa.pool);
      if (pool === undefined) continue;
      pool.pairs += 1;
      if (pa.variant.id === pb.variant.id) pool.same += 1;
    }
  });
  const rows = [...pools].sort(([a], [b]) => a.localeCompare(b)).map(([pool, value]) => ({
    pool, count: value.count, byVariant: value.byVariant,
    topShare: Math.max(...Object.values(value.byVariant)) / value.count, adjacentPairs: value.pairs, adjacentSame: value.same,
  }));
  const pairs = rows.reduce((sum, row) => sum + row.adjacentPairs, 0);
  const same = rows.reduce((sum, row) => sum + row.adjacentSame, 0);
  return { pools: rows, adjacentPairs: pairs, adjacentSame: same, adjacentSameShare: pairs === 0 ? 0 : same / pairs };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = Object.fromEntries(([1, 2, 3, 4, 5] as const).map(seed => [`seed${seed}`, variantDistribution(seedGroundState(seed))]));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
