import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DistributionInputError, summarizeRegistryDistribution, type DistributionOptions } from './registryDistributionSummary';

function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new DistributionInputError(field);
  return Object.fromEntries(Object.entries(value));
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new DistributionInputError(field);
  return value;
}
function year(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new DistributionInputError(field);
  return value;
}
function list(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new DistributionInputError(field);
  return value;
}

function contextFrom(input: unknown): DistributionOptions & { readonly sourceRevision: string } {
  const context = object(input, 'context');
  const sourceRevision = text(context.sourceRevision, 'context.sourceRevision');
  const catalog = list(context.catalog, 'context.catalog').map(value => {
    const entry = object(value, 'context.catalog.entry');
    return { id: text(entry.id, 'catalog.id'), category: text(entry.category, 'catalog.category') };
  });
  const enabledEntryIds = context.enabledEntryIds === undefined ? undefined
    : list(context.enabledEntryIds, 'context.enabledEntryIds').map(value => text(value, 'enabledEntryIds.item'));
  const range = context.legacyRange === undefined ? undefined : object(context.legacyRange, 'context.legacyRange');
  const legacyRange = range === undefined ? undefined : { startYear: year(range.startYear, 'legacyRange.startYear'),
    endYearExclusive: year(range.endYearExclusive, 'legacyRange.endYearExclusive') };
  if (legacyRange !== undefined && legacyRange.endYearExclusive <= legacyRange.startYear) throw new DistributionInputError('legacyRange');
  return { sourceRevision, catalog, ...(enabledEntryIds === undefined ? {} : { enabledEntryIds }), ...(legacyRange === undefined ? {} : { legacyRange }) };
}

/** Caller supplies the historical catalog/support snapshot; this CLI never imports current engine support. */
export function writeRegistryDistributionReport(inputPath: string, contextPath: string, outputPath: string): void {
  if (resolve(outputPath) === resolve(inputPath) || resolve(outputPath) === resolve(contextPath)) throw new DistributionInputError('output must not replace an input');
  const inputBytes = readFileSync(inputPath);
  const contextBytes = readFileSync(contextPath);
  const input: unknown = JSON.parse(inputBytes.toString('utf8'));
  const contextInput: unknown = JSON.parse(contextBytes.toString('utf8'));
  const context = contextFrom(contextInput);
  const summary = summarizeRegistryDistribution(input, context);
  const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const report = { provenance: { sourceRevision: context.sourceRevision, inputSha256: hash(inputBytes), contextSha256: hash(contextBytes) }, summary };
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [inputPath, contextPath, outputPath, extra] = process.argv.slice(2);
  if (inputPath === undefined || contextPath === undefined || outputPath === undefined || extra !== undefined) {
    throw new DistributionInputError('usage: registryDistributionReport.ts input-run.json context.json output.json');
  }
  writeRegistryDistributionReport(inputPath, contextPath, outputPath);
}
