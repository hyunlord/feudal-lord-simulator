import type { RegistryOccurrence } from '../src/engine/registry.types';

/** Runner-owned observation archive; never installed in, or written back to, simulation state. */
export function createRegistryOccurrenceCollector(): {
  readonly observe: (occurrences: readonly RegistryOccurrence[]) => void;
  readonly snapshot: () => readonly RegistryOccurrence[];
} {
  const latest = new Map<string, RegistryOccurrence>();
  let previous: readonly RegistryOccurrence[] | undefined;
  return {
    observe(occurrences) {
      if (occurrences === previous) return;
      previous = occurrences;
      for (const occurrence of occurrences) latest.set(occurrence.id, occurrence);
    },
    snapshot: () => [...latest.values()],
  };
}
