import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createArtRegistry } from '../src/render/art/artRegistry';

export type Wave23Record = { readonly key: string; readonly url: string; readonly sha256: string };
/** Always starts from canonical82, never from yesterday's already-filtered manifest. */
export function legacyWave23Records<T extends Wave23Record>(canonical: readonly T[], bundles: readonly unknown[]): readonly T[] {
  if (canonical.length !== 82 || new Set(canonical.map(row => row.key)).size !== 82) throw new Error('Expected unique canonical Wave23 records82');
  const registry = createArtRegistry(bundles);
  const owned = new Set<string>();
  for (const deck of ['lower', 'upper'] as const) {
    const entry = registry.select('weather-shadow', `cloud-base-${deck}`, { weather: 'normal' }, 0);
    if (entry?.kind !== 'weather-shadow') throw new Error('Wave23 generation requires both migrated base shadows');
    const matches = canonical.filter(row => row.url === entry.image.url && row.sha256 === entry.provenance.runtimeSha256
      && row.sha256 === entry.provenance.sourceSha256);
    const row = matches[0];
    if (matches.length !== 1 || row === undefined || owned.has(row.key)) throw new Error('Cloud ownership must match unique canonical source bytes');
    owned.add(row.key);
  }
  const remaining = canonical.filter(row => !owned.has(row.key));
  if (remaining.length !== 80) throw new Error('Wave23 legacy ownership must retain80');
  return remaining;
}
function isRecord(value: unknown): value is Wave23Record {
  return typeof value === 'object' && value !== null && 'key' in value && typeof value.key === 'string'
    && 'url' in value && typeof value.url === 'string' && 'sha256' in value && typeof value.sha256 === 'string';
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const filename = process.argv[2];
  if (filename === undefined) throw new Error('Usage: tsx scripts/wave23CloudOwnership.ts CATALOG < canonical-records.json');
  const records: unknown = JSON.parse(readFileSync(0, 'utf8'));
  const bundles: unknown = JSON.parse(readFileSync(filename, 'utf8'));
  if (!Array.isArray(records) || !records.every(isRecord) || !Array.isArray(bundles)) throw new Error('Expected canonical records and bundle arrays');
  console.log(JSON.stringify(legacyWave23Records(records, bundles).map(row => row.key)));
}
