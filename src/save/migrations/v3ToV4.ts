/** Old cities have no evidence of continuous timber shortage. Keep the optional
 * observation absent until the first actual shortage tick; do not backdate it. */
export function migrateV3ToV4(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v3 save must be an envelope object');
  return { ...input, schemaVersion: 4 };
}
