// The guardrail's openings (seeds 1..5): the product's seeded opening (src/state/growthOpening.ts, LM-E5 LG-1), its
// verification seeds only, with the provenance the guardrail's reports have always carried.
import { seededOpening } from "../src/state/growthOpening";

export { InvalidGrowthOpeningError, selectGrowthOpening } from "../src/state/growthOpening";

export function createGrowthOpening(seed: number, archetypeId?: string) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 5) throw new RangeError("verification seed must be 1..5");
  const opening = seededOpening(seed, archetypeId);
  return { ...opening, provenance: { mode: "translated-verification-fixture", offset: opening.provenance.offset,
    selection: opening.provenance.selection, productSeedFeature: false } as const };
}
