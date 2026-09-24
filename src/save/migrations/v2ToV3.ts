/** Missing operationPaused means running; preserve all legacy inventories, workers and references. */
export function migrateV2ToV3(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v2 save must be an envelope object');
  return { ...input, schemaVersion: 3 };
}
