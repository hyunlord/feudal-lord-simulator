/** Provisional EB-INERT pressures: older decisions do not prove active losses. Keep optional fields absent. */
export function migrateV56ToV57(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v56 save must be an envelope object');
  if (!('state' in input) || typeof input.state !== 'object' || input.state === null) throw new TypeError('Schema v56 save has no state');
  return { ...input, schemaVersion: 57 };
}
