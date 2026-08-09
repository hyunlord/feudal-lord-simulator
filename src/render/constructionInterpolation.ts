import type { ConstructionSite } from "../economy/construction";

type ConstructionInterpolationInput = {
  readonly previous: readonly ConstructionSite[];
  readonly current: readonly ConstructionSite[];
  readonly alpha: number;
};

export function interpolatedConstructionProgress(
  input: ConstructionInterpolationInput,
): ReadonlyMap<string, number> {
  const alpha = clampAlpha(input.alpha);
  const previousById = new Map(input.previous.map((site) => [site.id, site]));
  return new Map(input.current.map((site) => {
    const currentProgress = siteProgress(site);
    const previous = previousById.get(site.id);
    if (previous === undefined) return [site.id, currentProgress] as const;
    const previousProgress = siteProgress(previous);
    return [
      site.id,
      previousProgress + (currentProgress - previousProgress) * alpha,
    ] as const;
  }));
}

function siteProgress(site: ConstructionSite): number {
  if (site.requiredBuilderTicks <= 0) return 1;
  return Math.max(0, Math.min(1, site.builderTicks / site.requiredBuilderTicks));
}

function clampAlpha(alpha: number): number {
  if (!Number.isFinite(alpha)) return 1;
  return Math.max(0, Math.min(1, alpha));
}
