/** EB-TLINK isolated provisional v55, colliding with GROW: engine integration must renumber/combine this migration.
 * Old trace roots and aliases cannot identify every own answer. Leave answers absent (unknown), never backfill them.
 */
export function migrateV54ToV55(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v54 save must be an envelope object');
  if (!('state' in input) || typeof input.state !== 'object' || input.state === null) throw new TypeError('Schema v54 save has no state');
  return { ...input, schemaVersion: 55 };
}
